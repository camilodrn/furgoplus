"""Opt-in bounded measurements against an ALREADY installed local model."""

import argparse
import json
import statistics
import time

from .data import DEMO_DAY
from .ollama import (MODELS, ModelUnavailable, OllamaClient, OllamaConfig,
                     build_classification_request, local_request)
from .probe import model_rows, probe
from .understanding import understand


def loaded_state(config: OllamaConfig) -> bool | None:
    try:
        return any(row.get("name") == config.model for row in model_rows(
            local_request(config, endpoint="/api/ps")))
    except (ModelUnavailable, ValueError, TypeError, KeyError, UnicodeError, RecursionError):
        return None


def benchmark(client: OllamaClient, samples: int, mode: str, expect_first: str) -> dict:
    if mode != "classify":
        raise ValueError("Solo se mide clasificación de consultas ambiguas")
    question = understand("Soy mamá, busco furgón en la demo de FurgoPlus y necesito orientación para empezar", DEMO_DAY)
    request = build_classification_request(client.config, question.concepts, question.candidates)
    metadata = probe(client.config)
    report = {"model": client.config.model, "timeout": client.config.timeout,
              "threads": client.config.threads, "mode": mode,
              "probe": metadata, "samples": [], "status": "precondition_failed",
              "request_profile": {
                  "endpoint": "/api/chat",
                  "serialized_bytes": len(json.dumps(request, ensure_ascii=False).encode()),
                  "message_chars": [len(m["content"]) for m in request["messages"]],
                  "schema_bytes": len(json.dumps(request["format"]).encode()),
                  "candidate_count": len(question.candidates),
                  "enum_count": len(question.candidates) + 1,
                  "think": request["think"], "tools": False,
                  "options": request["options"], "keep_alive": request["keep_alive"],
              }}
    initial = metadata.get("model_loaded")
    if (metadata["status"] != "available"
            or expect_first == "cold" and initial is not False
            or expect_first == "warm" and initial is not True):
        return report  # no inference, retries, forced load or forced unload
    for index in range(samples):
        loaded = initial if index == 0 else loaded_state(client.config)
        row = {"sample": index + 1, "loaded_before": loaded,
               "phase": "cold" if loaded is False else "warm" if loaded is True else "unconfirmed"}
        start = time.monotonic()
        try:
            selection, metrics = client.measure_classification(question.concepts, question.candidates)
            valid = selection == "parent_request"
            row.update(valid_selection=valid, model_status="ok", model_attempted=True,
                       model_invoked=True, server_metrics=metrics,
                       budget_reason=None, timeout_censored=False)
        except ModelUnavailable as error:
            row.update(valid_selection=False, model_status=error.reason,
                       model_attempted=error.attempted, model_invoked=None if error.attempted else False,
                       budget_reason=getattr(error, "budget_reason", None),
                       timeout_censored=error.reason == "timeout")
        wall = time.monotonic() - start
        row["seconds"] = round(wall, 3)
        row["within_deadline"] = wall < client.config.timeout
        if "server_metrics" in row:
            metrics = row["server_metrics"]
            timings = {key.removesuffix("_duration"): round(metrics[key] / 1e9, 6)
                       for key in ("total_duration", "load_duration", "prompt_eval_duration", "eval_duration")
                       if key in metrics}
            if "total" in timings:
                timings["client_worker_transport"] = round(wall - metrics["total_duration"] / 1e9, 6)
            row["timing_seconds"] = timings
        report["samples"].append(row)
        if not row["valid_selection"] or not row["within_deadline"]:
            break
    warm = [r["seconds"] for r in report["samples"]
            if r["phase"] == "warm" and r["valid_selection"] and r["within_deadline"]]
    report.update(
        status="ok" if len(report["samples"]) == samples and all(
            r["valid_selection"] and r["within_deadline"] for r in report["samples"]
        ) else "failed",
        warm_median_seconds=statistics.median(warm) if warm else None,
        warm_max_seconds=max(warm) if warm else None,
        p95=None,
        note="Small sample; no p95. Wall time includes subprocess and tunnel. Server durations are nanoseconds. client_worker_transport is wall minus server total, an estimate that cannot isolate SSH from worker startup. Server time may also include queue/schema overhead. Timeout has no completed server counters. Cold/warm from /api/ps immediately before request, subject to concurrent external use. No warmup performed.",
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ollama", action="store_true", required=True)
    parser.add_argument("--model", choices=MODELS, default="qwen3:0.6b")
    parser.add_argument("--port", type=int, default=11434)
    parser.add_argument("--samples", type=int, choices=range(2, 6), default=3)
    parser.add_argument("--timeout", type=float, default=8)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--mode", choices=("classify",), default="classify")
    parser.add_argument("--expect-first", choices=("cold", "warm", "either"), default="either")
    args = parser.parse_args()
    try:
        client = OllamaClient(OllamaConfig(args.model, args.port, args.timeout, args.threads))
    except ValueError as error:
        parser.error(str(error))
    report = benchmark(client, args.samples, args.mode, args.expect_first)
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
