"""Bounded local classification: fixed public concepts, never original text."""

import json
import math
import subprocess
import sys
import threading
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from .guides import GUIDES
from .understanding import CONCEPT_PATTERNS, public_candidates

MODELS = ("qwen3:0.6b", "qwen3:1.7b", "qwen3:4b")
MAX_RESPONSE = 16_384


class ModelUnavailable(Exception):
    reason = "transport_error"
    attempted = True


class ModelBusy(ModelUnavailable):
    reason = "budget_rejected"
    attempted = False

    def __init__(self, budget_reason: str = "unspecified"):
        super().__init__()
        self.budget_reason = budget_reason


class ModelTimeout(ModelUnavailable):
    reason = "timeout"


class ModelInvalidOutput(ModelUnavailable):
    reason = "invalid_output"


@dataclass(frozen=True)
class OllamaConfig:
    model: str = "qwen3:0.6b"
    port: int = 11434  # loopback SSH forward may use a different local port
    timeout: float = 8.0
    threads: int = 1

    def __post_init__(self):
        if self.model not in MODELS:
            raise ValueError("Modelo fuera de la lista local permitida")
        if type(self.port) is not int or not 1 <= self.port <= 65535:
            raise ValueError("Puerto inválido")
        if not math.isfinite(self.timeout) or not 0.1 <= self.timeout <= 8:
            raise ValueError("Tiempo fuera de rango")
        if type(self.threads) is not int or not 1 <= self.threads <= 4:
            raise ValueError("Hilos fuera de rango")


class ModelBudget:
    """Shared by all clients in this process: one in flight, six starts/minute.

    No waiting queue, no user IDs retained. Failures open a 30-second circuit.
    A single-process CLI is the supported deployment boundary for this task.
    """

    def __init__(self):
        self.lock = threading.Lock()
        self.active = False
        self.starts: deque[float] = deque()
        self.blocked_until = 0.0

    def enter(self) -> None:
        with self.lock:
            now = time.monotonic()
            while self.starts and self.starts[0] <= now - 60:
                self.starts.popleft()
            if self.active:
                raise ModelBusy("concurrency")
            if now < self.blocked_until:
                raise ModelBusy("circuit_open")
            if len(self.starts) >= 6:
                raise ModelBusy("rate_limit")
            self.active = True
            self.starts.append(now)

    def leave(self, failed: bool) -> None:
        with self.lock:
            self.active = False
            if failed:
                self.blocked_until = time.monotonic() + 30


PROCESS_BUDGET = ModelBudget()


def local_request(config: OllamaConfig, *, payload: dict | None = None,
                  endpoint: str = "/api/chat") -> bytes:
    """Bounded child transport, shared by inference and read-only probes.

    No arbitrary URL, commands, retries, environment proxies or redirects.
    The worker also validates the method/path pair before opening a socket.
    """
    if (payload is None and endpoint not in {"/api/version", "/api/tags", "/api/ps"}
            or payload is not None and endpoint != "/api/chat"):
        raise ValueError("Endpoint fuera de la lista local permitida")
    try:
        result = subprocess.run(
            [sys.executable, "-B", "-m", "local_assistant.worker",
             str(config.port), str(config.timeout), endpoint],
            input=b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode(),
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=config.timeout,
            cwd=Path(__file__).resolve().parent.parent,
            check=False,
        )
        if result.returncode == 2:
            raise ModelTimeout
        if result.returncode or len(result.stdout) > MAX_RESPONSE:
            raise ModelUnavailable
        return result.stdout
    except subprocess.TimeoutExpired:
        raise ModelTimeout from None
    except (OSError, subprocess.SubprocessError):
        raise ModelUnavailable from None


def build_classification_request(config: OllamaConfig, concepts: tuple[str, ...],
                                 candidates: tuple[str, ...]) -> dict:
    if (not concepts or any(c not in CONCEPT_PATTERNS for c in concepts)
            or not candidates or candidates != public_candidates(concepts)):
        raise ValueError("Conceptos o temas fuera del catálogo público")
    return {
        "model": config.model, "stream": False, "think": False, "keep_alive": "60s",
        "format": {"type": "object", "properties": {
            "topic": {"type": "string", "enum": [*candidates, "unknown"]}},
            "required": ["topic"], "additionalProperties": False},
        "options": {"num_ctx": 1024, "num_predict": 24,
                    "temperature": 0, "seed": 14, "num_thread": config.threads},
        "messages": [
            {"role": "system", "content": (
                "Select a FurgoPlus topic matching the concepts; if unclear use unknown. "
                "Return only JSON with topic."
            )},
            {"role": "user", "content": json.dumps({
                "concepts": list(concepts),
                "topics": {key: GUIDES[key].question for key in candidates},
            }, ensure_ascii=False, separators=(",", ":"))},
        ],
    }


def decode_classification(raw: bytes, candidates: tuple[str, ...]) -> str:
    try:
        envelope = json.loads(raw)
        if (len(raw) > MAX_RESPONSE or not isinstance(envelope, dict)
                or envelope.get("done") is not True or envelope.get("done_reason") != "stop"
                or envelope["message"].get("role") != "assistant"
                or envelope["message"].get("thinking")
                or envelope["message"].get("tool_calls")):
            raise ValueError
        content = json.loads(envelope["message"]["content"])
        if (not isinstance(content, dict) or set(content) != {"topic"}
                or not isinstance(content["topic"], str)
                or content["topic"] not in (*candidates, "unknown")):
            raise ValueError
        return content["topic"]
    except (ValueError, TypeError, KeyError, AttributeError, UnicodeError, RecursionError):
        raise ModelInvalidOutput from None


class OllamaClient:
    def __init__(self, config: OllamaConfig = OllamaConfig(), *,
                 budget: ModelBudget = PROCESS_BUDGET):
        self.config = config
        self.budget = budget

    def classify_guide(self, concepts: tuple[str, ...], candidates: tuple[str, ...]) -> str:
        return self.measure_classification(concepts, candidates)[0]

    def measure_classification(self, concepts: tuple[str, ...], candidates: tuple[str, ...]) -> tuple[str, dict]:
        request = build_classification_request(self.config, concepts, candidates)
        return self._infer(request, lambda raw: decode_classification(raw, candidates))

    def _infer(self, request, decode) -> tuple[str, dict]:
        self.budget.enter()
        failed = True
        try:
            # The child has no model/user-controlled command, path or environment
            # interpolation. Killing and reaping it gives a WALL timeout even for
            # a server that trickles headers/bytes. No abandoned client threads.
            raw = local_request(self.config, payload=request)
            answer = decode(raw)
            envelope = json.loads(raw)
            # Optional server counters only. No response text, raw metadata or IDs.
            metrics = {key: envelope[key] for key in (
                "total_duration", "load_duration", "prompt_eval_count",
                "prompt_eval_duration", "eval_count", "eval_duration",
            ) if type(envelope.get(key)) is int and 0 <= envelope[key] < 2**63}
            failed = False
            return answer, metrics
        finally:
            self.budget.leave(failed)
