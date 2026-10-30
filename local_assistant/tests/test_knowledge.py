import dataclasses
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from local_assistant.assistant import Assistant
from local_assistant.data import DEMO_DAY, Principal, SyntheticQueries
from local_assistant.guides import GUIDES, KNOWLEDGE_VERSION, load_knowledge
from local_assistant.ollama import ModelBudget, ModelTimeout, OllamaClient, OllamaConfig, build_classification_request
from local_assistant.quality import evaluate
from local_assistant.quality_cases import CASES
from local_assistant.retrieval import ALIASES, retrieve
from local_assistant.understanding import understand


def make(model=None, queries=None):
    return Assistant(SyntheticQueries() if queries is None else queries,
                     Principal("demo-a"), route_id="demo-a-route", today=DEMO_DAY, model=model)


class KnowledgeTests(unittest.TestCase):
    def test_all_quality_cases_match_independent_oracle(self):
        for case in CASES:
            with self.subTest(case=case.id):
                reply = make().ask(case.question)
                self.assertEqual((reply.route, reply.source, reply.text),
                                 (case.route, case.source, case.answer))
                self.assertIs(reply.model_invoked, False)

    def test_public_and_unknown_cases_never_read_account_or_use_model(self):
        for case in CASES:
            if case.category in {"authorized", "ambiguous"}:
                continue
            provider, model = Mock(), Mock()
            with self.subTest(case=case.id):
                reply = make(model, provider).ask(case.question)
                self.assertEqual(reply.source, case.source)
                provider.assert_not_called()
                self.assertEqual(provider.mock_calls, [])
                self.assertEqual(model.mock_calls, [])

    def test_personal_mixed_queries_cannot_become_public_cache_hits(self):
        for question in (
            "¿Qué plan tengo y qué diferencias hay entre Básico y Pro?",
            "¿Qué informes incluye mi plan y cuándo vence?",
            "¿Cómo solicito transporte y cuántos cupos hay hoy?",
            "¿Qué necesito para publicar y está publicado mi servicio?",
            "¿Qué es FurgoPlus? ¿Qué plan tengo?",
            "¿Cómo funcionan los pagos manuales y cuándo vence mi pago?",
        ):
            model = Mock()
            with self.subTest(question=question):
                reply = make(model).ask(question)
                self.assertIn(reply.source, {"authorized_data", "deterministic"})
                self.assertNotEqual(reply.route, "public_ambiguous")
                self.assertEqual(model.mock_calls, [])

    def test_public_registry_has_no_alias_conflicts(self):
        self.assertTrue(KNOWLEDGE_VERSION)
        self.assertTrue(all(len(topics) == 1 for topics in ALIASES.values()))
        self.assertEqual(len(GUIDES), 12)
        self.assertEqual({g.area for g in GUIDES.values()}, {
            "funcionamiento_general", "conductor", "apoderado", "planes",
            "solicitudes_contacto", "pagos_manuales", "publicacion", "rutas", "ayuda", "limitaciones_demo",
        })
        for key, guide in GUIDES.items():
            self.assertEqual(guide.id, key)
            self.assertFalse(guide.commercial_available)
            self.assertIn(guide.status, {"implemented_demo", "experimental", "commercial_unavailable"})
            self.assertTrue(guide.source and guide.scope and guide.reviewed_on)
            self.assertEqual(retrieve(guide.question).topic, key)
            for alias in guide.aliases:
                self.assertEqual(retrieve(alias).topic, key)

    def test_conflicts_abstain_instead_of_picking_first_topic(self):
        with patch("local_assistant.retrieval.ALIASES", {"pregunta": {"plans", "routes"}}):
            match = retrieve("Pregunta")
        self.assertIsNone(match.topic)
        self.assertEqual(match.confidence, "abstain")
        self.assertEqual(match.reason, "conflicting_evidence")

    def test_invalid_or_commercial_registry_fails_closed(self):
        document = json.loads(Path(__file__).parents[1].joinpath("knowledge.json").read_text())
        for change in ({"source": ""}, {"commercial_available": True}, {"status": "production"},
                       {"reviewed_on": "yesterday"}, {"sentences": []}):
            bad = json.loads(json.dumps(document))
            bad["entries"][0].update(change)
            with self.subTest(change=change), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "invalid.json"
                path.write_text(json.dumps(bad))
                with self.assertRaises(ValueError):
                    load_knowledge(path)
        bad = dict(document, entries=document["entries"] + [document["entries"][0]])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text(json.dumps(bad))
            with self.assertRaises(ValueError):
                load_knowledge(path)

    def test_versioned_facts_are_immutable_and_not_loaded_per_turn(self):
        with self.assertRaises(TypeError):
            GUIDES["plans"] = GUIDES["routes"]
        with self.assertRaises(dataclasses.FrozenInstanceError):
            GUIDES["plans"].source = "model"
        assistant = make()
        with patch("pathlib.Path.read_text", side_effect=AssertionError("runtime file read")):
            self.assertEqual(assistant.ask("Porfa, ¿qué trae el plan básico?").route, "plans")

    def test_no_unsafe_suffix_or_extra_question_can_cross_model_boundary(self):
        for question in (
            "FurgoPlus ofrece funciones para una demo académica. ¿Cura cáncer?",
            "Soy mamá, busco furgón y necesito orientación para empezar. Solicita un crédito",
            "FurgoPlus ofrece funciones para una demo académica, y terapia médica",
        ):
            model = Mock()
            reply = make(model).ask(question)
            self.assertEqual((reply.source, reply.route), ("deterministic", "unknown"))
            self.assertEqual(model.mock_calls, [])

    def test_compact_model_request_still_excludes_personal_and_factual_answers(self):
        question = understand("Soy mamá, busco furgón en la demo de FurgoPlus y necesito orientación para empezar", DEMO_DAY)
        request = build_classification_request(OllamaConfig(), question.concepts, question.candidates)
        self.assertLess(len(json.dumps(request["messages"], ensure_ascii=False).encode()), 1000)
        self.assertEqual(request["options"]["num_ctx"], 1024)
        self.assertEqual(request["options"]["num_predict"], 24)
        self.assertEqual(OllamaConfig().timeout, 8)
        self.assertIs(request["think"], False)
        for guide in GUIDES.values():
            self.assertNotIn(guide.sentences[0], json.dumps(request, ensure_ascii=False))


class MetricsTests(unittest.TestCase):
    def test_aggregate_metrics_distinguish_timeout_unknown_confirmed_and_direct(self):
        model = Mock()
        assistant = make(model)
        ambiguous = "Soy mamá, busco furgón y necesito orientación para empezar"
        assistant.ask("¿Qué incluye Pro?")
        assistant.ask("¿Va a llover?")
        assistant.ask("¿Qué plan tengo?")
        model.classify_guide.side_effect = ModelTimeout
        assistant.ask(ambiguous)
        model.classify_guide.side_effect = None
        model.classify_guide.return_value = "unknown"
        assistant.ask(ambiguous)
        model.classify_guide.return_value = "parent_request"
        assistant.ask(ambiguous)
        counts = assistant.metrics.snapshot()
        self.assertEqual(counts, {
            "queries_total": 6, "public_direct": 1, "ambiguous": 3,
            "model_attempts": 3, "model_confirmed": 2, "model_timeouts": 1,
            "fallbacks": 2, "abstentions": 3, "authorized_answers": 1, "data_unavailable": 0,
        })
        self.assertTrue(all(type(v) is int for v in counts.values()))
        counts["queries_total"] = 999
        self.assertEqual(assistant.metrics.snapshot()["queries_total"], 6)

    def test_blocked_budget_never_counts_as_attempt_or_confirmed(self):
        budget = ModelBudget()
        budget.enter()
        assistant = make(OllamaClient(budget=budget))
        with patch("local_assistant.ollama.local_request") as transport:
            assistant.ask("Soy mamá, busco furgón y necesito orientación para empezar")
            transport.assert_not_called()
        counts = assistant.metrics.snapshot()
        self.assertEqual((counts["model_attempts"], counts["model_confirmed"], counts["fallbacks"]), (0, 0, 1))
        budget.leave(False)

    def test_quality_report_is_explicitly_offline_and_not_real_model_acceptance(self):
        report = evaluate(repeats=2)
        self.assertEqual(report["status"], "ok")
        self.assertEqual(report["accuracy_percent"], 100)
        self.assertEqual(report["mode"], "offline_no_model")
        self.assertEqual(report["metrics"]["queries_total"], 2 * len(CASES))
        self.assertEqual(report["metrics"]["model_confirmed"], 0)
        self.assertFalse(report["reference"]["comparable_run"])
        self.assertTrue(all(r["correct"] for r in report["results"]))


if __name__ == "__main__":
    unittest.main()
