"""Answer-level acceptance; optional strict real-Ollama interpretation check."""

import argparse
import json

from .acceptance_cases import CONTROL_CASES, MODEL_CASES, PUBLIC_CASES
from .assistant import Assistant
from .data import DEMO_DAY, Principal, SyntheticQueries
from .ollama import MODELS, OllamaClient, OllamaConfig


def accept(assistant: Assistant, *, require_model: bool = True) -> dict:
    rows = []
    cases = [(*case, "faq") for case in PUBLIC_CASES] + list(CONTROL_CASES)
    if require_model:
        cases += [(*case, "ollama_intent_faq") for case in MODEL_CASES]
    for name, question, route, expected, source in cases:
        reply = assistant.ask(question)
        model_case = source == "ollama_intent_faq"
        answer_ok = reply.text == expected
        diagnostics_ok = (
            reply.source == source and reply.route == route
            and reply.model_status == ("ok" if model_case else "not_needed")
            and reply.model_attempted is model_case
            and reply.model_invoked is model_case
            and reply.budget_reason is None
        )
        rows.append({"case": name, "pass": answer_ok and diagnostics_ok,
                     "answer_correct": answer_ok, "diagnostics_correct": diagnostics_ok,
                     "answer": reply.text, "source": reply.source, "route": reply.route,
                     "model_attempted": reply.model_attempted,
                     "model_invoked": reply.model_invoked, "model_status": reply.model_status,
                     "budget_reason": reply.budget_reason, "elapsed_ms": reply.elapsed_ms})
        # Run all direct/control checks; stop on the first failed model attempt.
        if model_case and not rows[-1]["pass"]:
            break
    ok = len(rows) == len(cases) and all(r["pass"] for r in rows)
    return {"status": "ok" if ok else "failed", "cases": rows,
            "inference_verified": require_model and ok,
            "mode": "hybrid" if require_model else "offline",
            "metrics": assistant.metrics.snapshot()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ollama", action="store_true")
    parser.add_argument("--model", choices=MODELS, default="qwen3:0.6b")
    parser.add_argument("--port", type=int, default=11435)
    parser.add_argument("--timeout", type=float, default=8)
    parser.add_argument("--threads", type=int, default=1)
    args = parser.parse_args()
    try:
        config = OllamaConfig(args.model, args.port, args.timeout, args.threads)
    except ValueError as error:
        parser.error(str(error))
    assistant = Assistant(SyntheticQueries(), Principal("demo-a"), today=DEMO_DAY,
                          route_id="demo-a-route",
                          model=OllamaClient(config) if args.ollama else None)
    report = accept(assistant, require_model=args.ollama)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
