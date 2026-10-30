import json
import unittest
from unittest.mock import Mock, patch

from local_assistant.benchmark import benchmark
from local_assistant.data import DEMO_DAY
from local_assistant.ollama import (
    ModelInvalidOutput, OllamaConfig, decode_classification,
)
from local_assistant.understanding import understand
from local_assistant import worker


class DiagnosticTests(unittest.TestCase):
    def test_deadline_cannot_be_extended_by_configuration_or_worker(self):
        for timeout in (8.001, 9, 15):
            with self.subTest(timeout=timeout), self.assertRaises(ValueError):
                OllamaConfig(timeout=timeout)
            with patch("sys.argv", ["worker", "11435", str(timeout)]), \
                 patch("local_assistant.worker.http.client.HTTPConnection") as connect:
                self.assertEqual(worker.main(), 1)
            connect.assert_not_called()

    def test_unexpected_thinking_is_not_accepted_as_non_thinking_classification(self):
        q = understand("Soy mamá, busco furgón y necesito orientación para empezar", DEMO_DAY)
        raw = json.dumps({"done": True, "done_reason": "stop", "message": {
            "role": "assistant", "thinking": "Unexpected reasoning",
            "content": '{"topic":"parent_request"}',
        }}).encode()
        with self.assertRaises(ModelInvalidOutput):
            decode_classification(raw, q.candidates)

    def test_benchmark_separates_server_components_from_client_residual(self):
        client = Mock(config=OllamaConfig())
        client.measure_classification.return_value = ("parent_request", {
            "total_duration": 5_000_000_000, "load_duration": 1_000_000_000,
            "prompt_eval_duration": 2_000_000_000, "eval_duration": 1_500_000_000,
            "prompt_eval_count": 100, "eval_count": 15,
        })
        with patch("local_assistant.benchmark.probe", return_value={"status": "available", "model_loaded": False}), \
             patch("local_assistant.benchmark.time.monotonic", side_effect=[10, 15.25]):
            report = benchmark(client, 1, "classify", "cold")
        self.assertEqual(report["status"], "ok")
        row = report["samples"][0]
        self.assertEqual(row["timing_seconds"], {
            "total": 5, "load": 1, "prompt_eval": 2, "eval": 1.5,
            "client_worker_transport": 0.25,
        })
        self.assertEqual(row["phase"], "cold")
        self.assertIs(report["request_profile"]["think"], False)

    def test_valid_topic_after_deadline_cannot_approve_benchmark(self):
        client = Mock(config=OllamaConfig())
        client.measure_classification.return_value = ("parent_request", {})
        with patch("local_assistant.benchmark.probe", return_value={"status": "available", "model_loaded": True}), \
             patch("local_assistant.benchmark.time.monotonic", side_effect=[10, 18.011]):
            report = benchmark(client, 1, "classify", "warm")
        self.assertEqual(report["status"], "failed")
        self.assertIsNone(report["warm_median_seconds"])
        self.assertFalse(report["samples"][0]["within_deadline"])


if __name__ == "__main__":
    unittest.main()
