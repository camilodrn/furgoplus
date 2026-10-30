import json
import io
import os
import subprocess
import sys
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from unittest.mock import Mock
from types import SimpleNamespace

from local_assistant.guides import GUIDES
from local_assistant.understanding import understand
from local_assistant.ollama import (
    MAX_RESPONSE, ModelBudget, ModelBusy, ModelUnavailable, OllamaClient,
    OllamaConfig, build_classification_request, decode_classification,
)
from local_assistant import worker
from local_assistant.probe import probe
from local_assistant.assistant import Assistant
from local_assistant.data import DEMO_DAY, Principal, SyntheticQueries


QUESTION = "Soy mamá, busco furgón y necesito orientación para empezar"
Q = understand(QUESTION, DEMO_DAY)


def build_request(config):
    return build_classification_request(config, Q.concepts, Q.candidates)


def classify(client):
    return client.classify_guide(Q.concepts, Q.candidates)


def envelope(content=None, **overrides):
    result = {"done": True, "done_reason": "stop", "message": {
        "role": "assistant", "content": json.dumps({"topic": "parent_request"} if content is None else content),
    }}
    result.update(overrides)
    return json.dumps(result).encode()


class ContractTests(unittest.TestCase):
    def test_local_model_allowlist_and_resource_caps(self):
        for kwargs in ({"model": "qwen3:8b"}, {"model": "qwen3:1.7b-cloud"},
                       {"port": 0}, {"port": True}, {"timeout": 99},
                       {"timeout": float("nan")}, {"threads": 20}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                OllamaConfig(**kwargs)
        with self.assertRaises(TypeError):
            OllamaConfig(host="external.example")
        request = build_request(OllamaConfig())
        self.assertIs(request["think"], False)
        self.assertIs(request["stream"], False)
        self.assertEqual(request["options"]["num_ctx"], 1024)
        self.assertEqual(request["options"]["num_predict"], 24)
        self.assertEqual(request["keep_alive"], "60s")
        self.assertNotIn("tools", request)
        self.assertNotIn("demo-a", json.dumps(request))

    def test_generated_prose_and_tools_are_never_exposed(self):
        for content in ({"topic": "plan"}, {"topic": True}, {"topic": "unknown", "text": "Tu plan vence mañana"},
                        {"answer": "3 cupos"}, [], "SELECT * FROM users"):
            with self.subTest(content=content), self.assertRaises(ModelUnavailable):
                decode_classification(envelope(content), Q.candidates)
        for raw in (b"not json", b"[]", b"null", b"x" * (MAX_RESPONSE + 1),
                    envelope(done=False), envelope(done_reason="length"),
                    envelope(message={"role": "assistant", "content": "{}", "tool_calls": [{"name": "sql"}]}),
                    envelope(message=None)):
            with self.subTest(raw=raw[:70]), self.assertRaises(ModelUnavailable):
                decode_classification(raw, Q.candidates)

    def test_valid_model_output_is_only_a_topic(self):
        self.assertEqual(decode_classification(envelope(), Q.candidates), "parent_request")
        self.assertEqual(decode_classification(envelope({"topic": "unknown"}), Q.candidates), "unknown")

    def test_unrecognized_marker_abstains_without_model_transport(self):
        question = QUESTION + " CANARY_NINA"
        understood = understand(question, DEMO_DAY)
        self.assertEqual(understood.intents, ("unknown",))
        self.assertIsNone(understood.topic)
        self.assertEqual(understood.candidates, ())
        queries = Mock()
        assistant = Assistant(queries, Principal("demo-a"), today=DEMO_DAY,
                              model=OllamaClient(budget=ModelBudget()))
        with patch("local_assistant.ollama.local_request") as request:
            reply = assistant.ask(question)
        request.assert_not_called()  # No payload, including the marker, reaches Ollama.
        self.assertEqual(queries.mock_calls, [])
        self.assertEqual(reply.source, "deterministic")
        self.assertEqual(reply.route, "unknown")
        self.assertFalse(reply.model_attempted)
        self.assertIs(reply.model_invoked, False)
        self.assertEqual(reply.model_status, "not_needed")
        self.assertEqual(reply.text,
                         "No tengo información verificada para responder eso. "
                         "Prueba con «comparar Básico y Pro» o «cómo solicitar transporte»; "
                         "también puedo orientarte sobre el uso de la demo.")
        self.assertNotIn("CANARY_NINA", reply.text)

    def test_budget_rejects_parallel_rate_and_cools_down(self):
        budget = ModelBudget()
        with patch("local_assistant.ollama.time.monotonic", return_value=100):
            budget.enter()
            with self.assertRaises(ModelBusy) as caught:
                budget.enter()
            self.assertEqual(caught.exception.budget_reason, "concurrency")
            budget.leave(False)
            for _ in range(5):
                budget.enter()
                budget.leave(False)
            with self.assertRaises(ModelBusy) as caught:
                budget.enter()
            self.assertEqual(caught.exception.budget_reason, "rate_limit")
        with patch("local_assistant.ollama.time.monotonic", return_value=161):
            budget.enter()
            budget.leave(True)
            with self.assertRaises(ModelBusy) as caught:
                budget.enter()
            self.assertEqual(caught.exception.budget_reason, "circuit_open")
        with patch("local_assistant.ollama.time.monotonic", return_value=192):
            budget.enter()
            budget.leave(False)

    def test_default_clients_share_process_budget(self):
        self.assertIs(OllamaClient().budget, OllamaClient().budget)

    def test_subprocess_errors_release_slot_and_do_not_echo(self):
        for error in (OSError("private"), subprocess.TimeoutExpired("worker", 1)):
            budget = ModelBudget()
            client = OllamaClient(budget=budget)
            with patch("local_assistant.ollama.subprocess.run", side_effect=error):
                with self.assertRaises(ModelUnavailable) as caught:
                    classify(client)
            self.assertEqual(str(caught.exception), "")
            self.assertFalse(budget.active)
            self.assertGreater(budget.blocked_until, time.monotonic())

    def test_real_child_timeout_is_reaped_without_sockets(self):
        real_run = subprocess.run
        def stalled_child(*args, **kwargs):
            # Exercise subprocess.run's actual kill/wait path with a sleeping
            # child in place of the network worker. No background process survives.
            return real_run([sys.executable, "-B", "-c", "import time; time.sleep(10)"], **kwargs)
        client = OllamaClient(OllamaConfig(timeout=0.2), budget=ModelBudget())
        start = time.monotonic()
        with patch("local_assistant.ollama.subprocess.run", side_effect=stalled_child):
            with self.assertRaises(ModelUnavailable):
                classify(client)
        self.assertLess(time.monotonic() - start, 1)
        self.assertFalse(client.budget.active)

    def test_parallel_call_rejected_without_waiting_or_second_child(self):
        entered, release = threading.Event(), threading.Event()
        client = OllamaClient(budget=ModelBudget())
        answers = []
        def run(*args, **kwargs):
            entered.set()
            release.wait(timeout=2)
            return subprocess.CompletedProcess(args[0], 0, stdout=envelope())
        with patch("local_assistant.ollama.subprocess.run", side_effect=run) as runner:
            first = threading.Thread(target=lambda: answers.append(classify(client)))
            first.start()
            self.assertTrue(entered.wait(timeout=1))
            try:
                with self.assertRaises(ModelBusy):
                    classify(client)
                self.assertEqual(runner.call_count, 1)
            finally:
                release.set()
                first.join(timeout=2)
        self.assertEqual(answers, ["parent_request"])


class WorkerTests(unittest.TestCase):
    def run_worker(self, status=200, body=None, content_type="application/json"):
        body = envelope() if body is None else body
        connection = Mock()
        response = connection.getresponse.return_value
        response.status = status
        response.getheader.return_value = content_type
        response.read.return_value = body
        request = json.dumps(build_request(OllamaConfig())).encode()
        output = io.BytesIO()
        with patch.object(sys, "argv", ["worker", "11434", "1"]), \
             patch.object(sys, "stdin", SimpleNamespace(buffer=io.BytesIO(request))), \
             patch.object(sys, "stdout", SimpleNamespace(buffer=output)), \
             patch("local_assistant.worker.http.client.HTTPConnection", return_value=connection) as ctor:
            code = worker.main()
        return code, output.getvalue(), connection, ctor

    def test_worker_pins_loopback_and_sends_only_bounded_guide_request(self):
        code, output, connection, ctor = self.run_worker()
        self.assertEqual(code, 0)
        self.assertEqual(output, envelope())
        ctor.assert_called_once_with("127.0.0.1", 11434, timeout=1.0)
        args, kwargs = connection.request.call_args
        self.assertEqual(args, ("POST", "/api/chat"))
        self.assertEqual(json.loads(kwargs["body"]), build_request(OllamaConfig()))
        connection.getresponse.return_value.read.assert_called_once_with(MAX_RESPONSE + 1)
        connection.close.assert_called_once()

    def test_worker_rejects_redirects_errors_and_bad_bodies_without_echo(self):
        for status, body, content_type in (
            (302, b"private", "application/json"), (404, b"missing", "application/json"),
            (503, b"private", "application/json"), (200, b"private", "text/html"),
            (200, b"not-json", "application/json"), (200, b"x" * (MAX_RESPONSE + 1), "application/json"),
        ):
            with self.subTest(status=status, body_length=len(body)):
                code, output, connection, ctor = self.run_worker(status, body, content_type)
                self.assertEqual(code, 1)
                self.assertEqual(output, b"")
                ctor.assert_called_once()
                connection.request.assert_called_once()
                connection.close.assert_called_once()


class QuietServer(ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False

    def handle_error(self, request, client_address):
        pass


class WireTests(unittest.TestCase):
    """Real HTTP and real child process against an ephemeral loopback fixture."""

    def setUp(self):
        self.requests = []
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                owner.requests.append((self.path, None))
                raw = json.dumps({
                    "/api/version": {"version": "0.99.0"},
                    "/api/tags": {"models": [{"name": "qwen3:0.6b", "digest": "a" * 64}]},
                    "/api/ps": {"models": []},
                }[self.path]).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_POST(self):
                body = self.rfile.read(int(self.headers["Content-Length"]))
                owner.requests.append((self.path, json.loads(body)))
                if owner.mode == "slow_headers":
                    self.wfile.write(b"HTTP/1.1 200 OK\r\nX-Slow: ")
                    self.wfile.flush()
                    for _ in range(30):
                        time.sleep(0.05)
                        self.wfile.write(b"x")
                        self.wfile.flush()
                    return
                self.send_response(owner.status)
                self.send_header("Content-Type", owner.content_type)
                self.send_header("Content-Length", str(len(owner.body)))
                if owner.status == 302:
                    self.send_header("Location", "https://example.com/private")
                self.end_headers()
                if owner.mode == "slow_body":
                    for chunk in owner.body:
                        self.wfile.write(bytes([chunk]))
                        self.wfile.flush()
                        time.sleep(0.05)
                else:
                    self.wfile.write(owner.body)

            def log_message(self, *args):
                pass

        self.mode = "ok"
        self.status = 200
        self.content_type = "application/json"
        self.body = envelope()
        try:
            self.server = QuietServer(("127.0.0.1", 0), Handler)
        except PermissionError:
            if os.environ.get("FURGOPLUS_REQUIRE_WIRE_TESTS") == "1":
                raise
            self.skipTest("El sandbox prohíbe sockets; repetir con FURGOPLUS_REQUIRE_WIRE_TESTS=1 en host autorizado")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def client(self, timeout=2):
        return OllamaClient(OllamaConfig(port=self.server.server_port, timeout=timeout), budget=ModelBudget())

    def test_wire_contract_without_proxy_environment(self):
        with patch.dict(os.environ, {"HTTP_PROXY": "http://invalid:9", "ALL_PROXY": "http://invalid:9", "NO_PROXY": ""}):
            answer = classify(self.client())
        self.assertEqual(answer, "parent_request")
        self.assertEqual(len(self.requests), 1)
        path, body = self.requests[0]
        self.assertEqual(path, "/api/chat")
        self.assertEqual(body, build_request(OllamaConfig()))

    def test_probe_uses_real_get_without_inference(self):
        report = probe(OllamaConfig(port=self.server.server_port, timeout=2))
        self.assertEqual(report["status"], "available")
        self.assertFalse(report["model_loaded"])
        self.assertEqual(self.requests, [("/api/version", None), ("/api/tags", None), ("/api/ps", None)])

    def test_original_questions_and_intent_recognition_through_real_http(self):
        assistant = Assistant(SyntheticQueries(), Principal("demo-a"), today=DEMO_DAY,
                              model=self.client())
        for question, topic in (
            ("¿Qué diferencia hay entre Básico y Pro?", "plans"),
            ("¿Cómo puede un apoderado solicitar transporte?", "parent_request"),
        ):
            reply = assistant.ask(question)
            self.assertEqual(reply.text, GUIDES[topic].sentences[0])
            self.assertEqual(reply.source, "faq")
            self.assertFalse(reply.model_invoked)
        self.assertEqual(self.requests, [])
        self.body = envelope({"topic": "parent_request"})
        reply = assistant.ask(QUESTION)
        self.assertEqual(reply.source, "ollama_intent_faq")
        self.assertEqual(reply.route, "parent_request")
        self.assertEqual(reply.text, GUIDES["parent_request"].sentences[0])
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.requests[0][0], "/api/chat")

    def test_fallback_diagnostics_through_real_http(self):
        self.status = 503
        assistant = Assistant(SyntheticQueries(), Principal("demo-a"), today=DEMO_DAY,
                              model=self.client())
        reply = assistant.ask(QUESTION)
        self.assertEqual(reply.source, "faq_fallback")
        self.assertEqual(reply.model_status, "transport_error")
        self.assertTrue(reply.model_attempted)
        self.assertIsNone(reply.model_invoked)
        self.assertIn("No tengo información verificada", reply.text)
        # Circuit-open requests are not reported as another invocation.
        reply = assistant.ask(QUESTION)
        self.assertEqual(reply.model_status, "budget_rejected")
        self.assertEqual(reply.budget_reason, "circuit_open")
        self.assertFalse(reply.model_invoked)
        self.assertEqual(len(self.requests), 1)

    def test_http_errors_invalid_content_and_oversized_body(self):
        for status, content_type, body in (
            (302, "application/json", envelope()), (503, "application/json", envelope()),
            (404, "application/json", envelope()), (200, "text/html", b"private failure"),
            (200, "application/json", b"null"), (200, "application/json", b"x" * (MAX_RESPONSE + 1)),
        ):
            self.status, self.content_type, self.body = status, content_type, body
            with self.subTest(status=status, content_type=content_type), self.assertRaises(ModelUnavailable):
                classify(self.client())

    def test_hard_deadline_covers_trickled_headers_and_body(self):
        for mode in ("slow_headers", "slow_body"):
            self.mode = mode
            client = self.client(timeout=0.35)
            start = time.monotonic()
            with self.subTest(mode=mode), self.assertRaises(ModelUnavailable):
                classify(client)
            self.assertLess(time.monotonic() - start, 1.2)
            self.assertFalse(client.budget.active)

    def test_no_waiting_queue_under_concurrent_requests(self):
        self.mode = "slow_body"
        client = self.client(timeout=0.6)
        errors = []

        def first():
            try:
                classify(client)
            except ModelUnavailable:
                errors.append(True)

        thread = threading.Thread(target=first)
        thread.start()
        deadline = time.monotonic() + 1
        while not self.requests and time.monotonic() < deadline:
            time.sleep(0.01)
        start = time.monotonic()
        with self.assertRaises(ModelBusy):
            classify(client)
        self.assertLess(time.monotonic() - start, 0.1)
        thread.join(timeout=2)
        self.assertFalse(thread.is_alive())
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(errors, [True])


if __name__ == "__main__":
    unittest.main()
