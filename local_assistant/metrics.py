"""Process-local counters only: no text, identifiers, DTOs or timestamps."""

import threading


class Diagnostics:
    def __init__(self):
        self._lock = threading.Lock()
        self._counts = dict.fromkeys((
            "queries_total", "public_direct", "ambiguous", "model_attempts",
            "model_confirmed", "model_timeouts", "fallbacks", "abstentions",
            "authorized_answers", "data_unavailable",
        ), 0)

    def record(self, reply):
        ambiguous = reply.route == "public_ambiguous" or reply.source == "ollama_intent_faq"
        events = {
            "queries_total": True,
            "public_direct": reply.source == "faq",
            "ambiguous": ambiguous,
            "model_attempts": reply.model_attempted,
            "model_confirmed": reply.model_invoked is True,
            "model_timeouts": reply.model_status == "timeout",
            "fallbacks": ambiguous and reply.source != "ollama_intent_faq",
            "abstentions": reply.route == "unknown" or (ambiguous and reply.source != "ollama_intent_faq"),
            "authorized_answers": reply.source == "authorized_data",
            "data_unavailable": reply.source == "data_unavailable",
        }
        with self._lock:
            for name, occurred in events.items():
                self._counts[name] += int(occurred)

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return self._counts.copy()
