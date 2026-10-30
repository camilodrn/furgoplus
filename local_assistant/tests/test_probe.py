import io
import json
import subprocess
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from local_assistant import worker
from local_assistant.ollama import (
    ModelUnavailable, OllamaConfig, local_request,
)
from local_assistant.probe import probe


def raw(value):
    return json.dumps(value).encode()


class ProbeTests(unittest.TestCase):
    def test_installed_and_loaded_only_reports_selected_model(self):
        digest = "a" * 64
        replies = [raw({"version": "0.99.0-test"}), raw({"models": [
            {"name": "private-model", "digest": "private"},
            {"name": "qwen3:0.6b", "digest": digest},
        ]}), raw({"models": [{"name": "qwen3:0.6b", "size": 123456}]})]
        with patch("local_assistant.probe.local_request", side_effect=replies) as request:
            report = probe(OllamaConfig())
        self.assertEqual(report["status"], "available")
        self.assertEqual(report["digest"], digest)
        self.assertEqual(report["loaded_model_bytes_estimate"], 123456)
        self.assertIs(report["inference_tested"], False)
        self.assertNotIn("private", json.dumps(report))
        self.assertEqual([c.kwargs for c in request.call_args_list], [
            {"endpoint": "/api/version"}, {"endpoint": "/api/tags"}, {"endpoint": "/api/ps"},
        ])

    def test_installed_but_not_loaded_does_not_warm_up(self):
        with patch("local_assistant.probe.local_request", side_effect=[
            raw({"version": "0.99.0"}),
            raw({"models": [{"name": "qwen3:0.6b", "digest": "a" * 64}]}),
            raw({"models": []}),
        ]) as request:
            report = probe(OllamaConfig())
        self.assertEqual(report["status"], "available")
        self.assertFalse(report["model_loaded"])
        self.assertEqual(request.call_count, 3)

    def test_daemon_absent_is_not_reported_as_missing_weights(self):
        with patch("local_assistant.probe.local_request", side_effect=ModelUnavailable) as request:
            report = probe(OllamaConfig())
        self.assertEqual(report["status"], "unavailable")
        self.assertIsNone(report["model_installed"])
        self.assertFalse(report["api_available"])
        request.assert_called_once()

    def test_missing_model_is_not_downloaded(self):
        with patch("local_assistant.probe.local_request", side_effect=[
            raw({"version": "0.99.0"}), raw({"models": []}), raw({"models": []}),
        ]) as request:
            report = probe(OllamaConfig())
        self.assertEqual(report["status"], "model_missing")
        self.assertFalse(report["model_installed"])
        self.assertEqual(request.call_count, 3)

    def test_bad_metadata_or_failed_queries_fail_closed(self):
        for responses in (
            [b"not json"], [raw({"version": "secret\nvalue"})], [b"[]"],
            [raw({"version": "0.99.0"}), raw({"models": None})],
            [raw({"version": "0.99.0"}), raw({"models": [None]})],
            [raw({"version": "0.99.0"}), raw({"models": [{"name": "qwen3:0.6b", "digest": "secret"}]})],
            [raw({"version": "0.99.0"}), ModelUnavailable()],
            [raw({"version": "0.99.0"}), raw({"models": []}), ModelUnavailable()],
        ):
            with self.subTest(responses=responses), patch(
                "local_assistant.probe.local_request", side_effect=responses
            ):
                report = probe(OllamaConfig())
            self.assertNotEqual(report["status"], "available")
            self.assertNotIn("secret", json.dumps(report))


class ProbeTransportTests(unittest.TestCase):
    def test_readonly_transport_is_bounded_and_does_not_send_a_prompt(self):
        with patch("local_assistant.ollama.subprocess.run", return_value=
                   subprocess.CompletedProcess([], 0, stdout=b"{}")) as run:
            self.assertEqual(local_request(OllamaConfig(timeout=2), endpoint="/api/tags"), b"{}")
        args, kwargs = run.call_args
        self.assertEqual(args[0][-1], "/api/tags")
        self.assertEqual(kwargs["input"], b"")
        self.assertEqual(kwargs["timeout"], 2)
        self.assertIs(kwargs["check"], False)

    def test_other_methods_or_paths_cannot_open_a_socket(self):
        for endpoint, payload in (("/api/pull", {}), ("/api/tags", {}),
                                  ("/api/chat", None), ("https://example.org", None)):
            with patch("local_assistant.ollama.subprocess.run") as run:
                with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                    local_request(OllamaConfig(), endpoint=endpoint, payload=payload)
            run.assert_not_called()

    def test_worker_get_only_allowlisted_readonly_endpoints(self):
        for path in ("/api/version", "/api/tags", "/api/ps", "/api/pull", "http://external"):
            connection = Mock()
            response = connection.getresponse.return_value
            response.status = 200
            response.getheader.return_value = "application/json"
            response.read.return_value = b"{}"
            output = io.BytesIO()
            with patch.object(sys, "argv", ["worker", "11436", "2", path]), \
                 patch.object(sys, "stdin", SimpleNamespace(buffer=io.BytesIO())), \
                 patch.object(sys, "stdout", SimpleNamespace(buffer=output)), \
                 patch("local_assistant.worker.http.client.HTTPConnection", return_value=connection) as ctor:
                code = worker.main()
            if path in {"/api/version", "/api/tags", "/api/ps"}:
                self.assertEqual(code, 0)
                ctor.assert_called_once_with("127.0.0.1", 11436, timeout=2.0)
                self.assertEqual(connection.request.call_args.args, ("GET", path))
                self.assertIsNone(connection.request.call_args.kwargs["body"])
                connection.close.assert_called_once()
            else:
                self.assertEqual(code, 1)
                ctor.assert_not_called()


if __name__ == "__main__":
    unittest.main()
