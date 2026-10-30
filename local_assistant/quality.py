"""Reproducible offline quality/latency evaluation; no model or private data."""

import argparse
import hashlib
import json
import math
import platform
import statistics
import time
from pathlib import Path

from .assistant import Assistant
from .data import DEMO_DAY, Principal, SyntheticQueries
from .guides import KNOWLEDGE_VERSION
from .quality_cases import CASES
from .retrieval import retrieve


def latency(samples):
    values = sorted(samples)
    return {"median_ms": round(statistics.median(values), 4),
            "p95_ms": round(values[math.ceil(len(values) * .95) - 1], 4),
            "max_ms": round(values[-1], 4)}


def evaluate(repeats=100):
    if type(repeats) is not int or not 1 <= repeats <= 10000:
        raise ValueError("Repeticiones fuera de rango")
    assistant = Assistant(SyntheticQueries(), Principal("demo-a"), today=DEMO_DAY,
                          route_id="demo-a-route")
    rows, all_times, search_times = [], [], []
    categories = {}
    for case in CASES:
        times, correct = [], True
        for _ in range(repeats):
            start = time.perf_counter_ns()
            reply = assistant.ask(case.question)
            times.append((time.perf_counter_ns() - start) / 1e6)
            correct &= ((reply.route, reply.source, reply.text) == (case.route, case.source, case.answer)
                        and reply.model_invoked is False
                        and reply.model_status == ("disabled" if case.category == "ambiguous" else "not_needed"))
        all_times.extend(times)
        categories.setdefault(case.category, []).extend(times)
        if case.source == "faq":
            for _ in range(repeats):
                start = time.perf_counter_ns()
                retrieve(case.question)
                search_times.append((time.perf_counter_ns() - start) / 1e6)
        rows.append({"case": case.id, "category": case.category, "correct": bool(correct),
                     "source": reply.source, "route": reply.route, **latency(times)})
    correct = sum(r["correct"] for r in rows)
    direct = sum(c.source == "faq" for c in CASES)
    ambiguous = sum(c.category == "ambiguous" for c in CASES)
    unknown = [r for r in rows if r["category"] == "unknown"]
    public = [r for r in rows if r["category"] in {"faq", "paraphrase"}]
    return {
        "mode": "offline_no_model", "status": "ok" if correct == len(CASES) else "failed",
        "knowledge_version": KNOWLEDGE_VERSION,
        "knowledge_sha256": hashlib.sha256(Path(__file__).with_name("knowledge.json").read_bytes()).hexdigest(),
        "corpus_sha256": hashlib.sha256(Path(__file__).with_name("quality_cases.py").read_bytes()).hexdigest(),
        "oracle_sha256": hashlib.sha256(Path(__file__).with_name("acceptance_cases.py").read_bytes()).hexdigest(),
        "python": platform.python_version(), "system": platform.system(),
        "machine": platform.machine(), "repeats": repeats, "cases": len(rows),
        "accuracy_percent": round(100 * correct / len(rows), 2),
        "public_exact_answer_accuracy_percent": round(100 * sum(r["correct"] for r in public) / len(public), 2),
        "unknown_abstention_accuracy_percent": round(100 * sum(r["correct"] for r in unknown) / len(unknown), 2),
        "public_direct_cases": direct, "ambiguous_cases": ambiguous,
        "model_independent_route_percent": round(100 * (len(rows) - ambiguous) / len(rows), 2),
        "observed_no_model_attempt_percent": 100.0,
        "public_direct_percent_of_all_cases": round(100 * direct / len(rows), 2),
        "metrics": assistant.metrics.snapshot(),
        "latency": {"turn": latency(all_times), "public_retrieval": latency(search_times),
                    "by_category": {key: latency(value) for key, value in categories.items()}},
        "reference": {"direct_inference_ms_reported_by_operator": 8120,
                      "previous_faq_ms_reported_by_operator": [0.6, 2.5],
                      "comparable_run": False},
        "note": "Corpus fijo sintético, sin Ollama. Ambiguas se abstienen con modelo deshabilitado. Porcentajes por casos, no tráfico real; latencias repetidas con índice ya cargado, sin arranque CLI. Referencias históricas de otro host, no una aceleración medida ni latencia del clasificador real.",
        "results": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, choices=range(1, 10001), default=100)
    args = parser.parse_args()
    report = evaluate(args.repeats)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return int(report["status"] != "ok")


if __name__ == "__main__":
    raise SystemExit(main())
