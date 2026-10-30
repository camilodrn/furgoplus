import subprocess
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from local_assistant.assistant import Assistant
from local_assistant.acceptance_cases import PUBLIC_CASES
from local_assistant.data import DEMO_DAY, Principal, SyntheticQueries


class CliTests(unittest.TestCase):
    def run_cli(self, text, *options):
        return subprocess.run(
            [sys.executable, "-B", "-m", "local_assistant", *options],
            input=text, text=True, capture_output=True, timeout=3,
            cwd=Path(__file__).resolve().parents[2], check=False,
        )

    def test_once_reports_synthetic_context_and_exact_answer(self):
        result = self.run_cli("¿Cuántos cupos hay hoy?\n", "--once")
        self.assertEqual(result.returncode, 0)
        self.assertIn("DEMO SINTÉTICA", result.stderr)
        self.assertEqual(result.stdout.strip(), "Hay 3 cupos disponibles para el 26/10/2026 en el recorrido seleccionado.")

    def test_public_acceptance_answers_through_cli_with_ollama_enabled(self):
        # Integration regression: these exact questions must finish without a
        # socket, a model budget entry or the old eight-second timeout.
        for name, question, route, expected in PUBLIC_CASES:
            with self.subTest(name=name):
                result = self.run_cli(question, "--once", "--ollama", "--port", "11435", "--diagnostics")
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stdout.strip(), expected)
                diagnostic = json.loads(result.stderr.splitlines()[-1])
                self.assertEqual((diagnostic["source"], diagnostic["route"], diagnostic["model_status"]),
                                 ("faq", route, "not_needed"))
                self.assertFalse(diagnostic["model_attempted"])
                self.assertFalse(diagnostic["model_invoked"])

    def test_oversized_line_discarded_before_next_question(self):
        result = self.run_cli("x" * 4000 + "\n¿Qué plan tengo?\n/salir\n")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.count("Haz una pregunta más breve"), 1)
        self.assertIn("Tu plan es Pro y está activo.", result.stdout)
        self.assertNotIn("x" * 100, result.stdout + result.stderr)

    def test_final_line_without_newline_is_still_a_question(self):
        self.assertIn("Tu plan es Pro y está activo.", self.run_cli("plan").stdout)

    def test_diagnostics_are_opt_in_and_exclude_input_and_account_values(self):
        question = "¿Qué diferencia hay entre Básico y Pro? CANARY_NOMBRE"
        result = self.run_cli(question, "--once", "--diagnostics")
        self.assertEqual(result.returncode, 0)
        diagnostic = json.loads(result.stderr.splitlines()[-1])
        # An unreviewed suffix now abstains; privacy diagnostics still omit it.
        self.assertEqual(diagnostic["source"], "deterministic")
        self.assertEqual(diagnostic["route"], "unknown")
        self.assertFalse(diagnostic["model_invoked"])
        self.assertEqual(diagnostic["model_status"], "not_needed")
        self.assertEqual(set(diagnostic), {"source", "route", "model_attempted", "model_invoked", "model_status", "budget_reason", "elapsed_ms"})
        self.assertNotIn("CANARY", result.stdout + result.stderr)
        self.assertNotIn('"model_status"', self.run_cli(question, "--once").stderr)

    def test_aggregate_metrics_are_opt_in_and_contain_only_counters(self):
        question = "¿Qué plan tengo?"
        result = self.run_cli(question, "--once", "--metrics")
        self.assertEqual(result.returncode, 0)
        metrics = json.loads(result.stderr.splitlines()[-1])["metrics"]
        self.assertEqual(metrics["queries_total"], 1)
        self.assertEqual(metrics["authorized_answers"], 1)
        self.assertEqual(metrics["model_attempts"], 0)
        self.assertTrue(all(type(value) is int for value in metrics.values()))
        self.assertNotIn(question, result.stderr)
        self.assertNotIn('"metrics"', self.run_cli(question, "--once").stderr)

    def test_deterministic_flow_needs_no_files_processes_or_network(self):
        assistant = Assistant(SyntheticQueries(), Principal("demo-a"),
                              route_id="demo-a-route", today=DEMO_DAY)
        with patch("builtins.open", side_effect=AssertionError("file access")), \
             patch("subprocess.run", side_effect=AssertionError("process")), \
             patch("socket.create_connection", side_effect=AssertionError("network")):
            for question in ("plan", "cupos", "vencimiento", "validación", "publicación",
                             "horario", "¿Cómo publicar?", "¿Va a llover?"):
                self.assertTrue(assistant.ask(question).text)


if __name__ == "__main__":
    unittest.main()
