"""Interactive synthetic CLI. Offline by default; no history or HTTP listener."""

import argparse
import json
import sys

from .assistant import Assistant
from .data import DEMO_DAY, Principal, SyntheticQueries
from .ollama import MODELS, OllamaClient, OllamaConfig


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ollama", action="store_true", help="Habilita solicitudes al Ollama local existente")
    parser.add_argument("--model", choices=MODELS, default="qwen3:0.6b")
    parser.add_argument("--port", type=int, default=11434)
    parser.add_argument("--timeout", type=float, default=8)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--actor", choices=("demo-a", "demo-b"), default="demo-a")
    parser.add_argument("--no-route", action="store_true")
    parser.add_argument("--diagnostics", action="store_true",
                        help="Indicadores sin preguntas ni datos de cuenta, en stderr")
    parser.add_argument("--metrics", action="store_true",
                        help="Contadores agregados sin información personal, en stderr al salir")
    # stdin avoids putting potentially private questions in shell history/argv.
    parser.add_argument("--once", action="store_true", help="Lee una pregunta desde stdin y termina")
    args = parser.parse_args()
    try:
        config = OllamaConfig(args.model, args.port, args.timeout, args.threads)
    except ValueError as error:
        parser.error(str(error))
    assistant = Assistant(
        SyntheticQueries(), Principal(args.actor), today=DEMO_DAY,
        route_id=None if args.no_route else args.actor + "-route",
        model=OllamaClient(config) if args.ollama else None,
    )
    print("DEMO SINTÉTICA · fecha fija 26/10/2026 · no consulta cuentas reales", file=sys.stderr)
    def respond(text):
        reply = assistant.ask(text)
        print(reply.text)
        if args.diagnostics:
            print(json.dumps({"source": reply.source, "route": reply.route,
                              "model_attempted": reply.model_attempted,
                              "model_invoked": reply.model_invoked,
                              "model_status": reply.model_status,
                              "budget_reason": reply.budget_reason,
                              "elapsed_ms": reply.elapsed_ms}), file=sys.stderr)
    if args.once:
        # Bounded read even for a piped file. No readline/history library.
        respond(sys.stdin.readline(1002).rstrip("\n"))
        if args.metrics:
            print(json.dumps({"metrics": assistant.metrics.snapshot()}), file=sys.stderr)
        return 0
    print("Pregunta por plan, vencimiento, cupos, estados o uso de FurgoPlus. /salir para terminar.")
    try:
        while True:
            print("> ", end="", flush=True)
            line = sys.stdin.readline(1002)
            if not line:
                break
            if len(line.rstrip("\n")) > 1000:
                # Discard an oversized physical line rather than executing chunks.
                while line and not line.endswith("\n"):
                    line = sys.stdin.readline(1002)
                print("Haz una pregunta más breve, de hasta 1.000 caracteres.")
                continue
            if line.strip().casefold() == "/salir":
                break
            respond(line.rstrip("\n"))
    except KeyboardInterrupt:
        print()
    if args.metrics:
        print(json.dumps({"metrics": assistant.metrics.snapshot()}), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
