"""Read-only Ollama availability probe. Never loads or downloads a model."""

import argparse
import json
import re
import time

from .ollama import MODELS, ModelUnavailable, OllamaConfig, local_request


def model_rows(raw: bytes) -> list[dict]:
    value = json.loads(raw)
    rows = value["models"]
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError
    return rows


def probe(config: OllamaConfig) -> dict:
    """Three sequential GETs at most; each has config.timeout as wall deadline.

    'available' means API responds and selected weights are installed, not that
    inference will fit or be valid. Other installed model names are not reported.
    """
    start = time.monotonic()
    report = {"model": config.model, "api_available": False,
              "model_installed": None, "model_loaded": None,
              "status": "unavailable", "inference_tested": False}
    try:
        version = json.loads(local_request(config, endpoint="/api/version"))["version"]
        if not isinstance(version, str) or not re.fullmatch(r"[0-9][\w.+-]{0,79}", version):
            raise ValueError
        report.update(api_available=True, version=version, status="invalid_metadata")
        rows = model_rows(local_request(config, endpoint="/api/tags"))
        selected = next((row for row in rows if row.get("name") == config.model), None)
        report["model_installed"] = selected is not None
        if selected is None:
            report["status"] = "model_missing"
        else:
            digest = selected.get("digest")
            if not isinstance(digest, str) or not re.fullmatch(r"(?:sha256:)?[a-f0-9]{64}", digest):
                raise ValueError
            report["digest"] = digest
            report["status"] = "available"
        running = model_rows(local_request(config, endpoint="/api/ps"))
        loaded = next((row for row in running if row.get("name") == config.model), None)
        report["model_loaded"] = loaded is not None
        if loaded is not None:
            # Ollama's model-size estimate is not RSS, cgroup peak or host free RAM.
            size = loaded.get("size")
            if type(size) is not int or size < 0:
                raise ValueError
            report["loaded_model_bytes_estimate"] = size
    except (ModelUnavailable, ValueError, TypeError, KeyError, UnicodeError, RecursionError):
        if report["api_available"]:
            report["status"] = "metadata_unavailable"
    report["seconds"] = round(time.monotonic() - start, 3)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=MODELS, default="qwen3:0.6b")
    parser.add_argument("--port", type=int, default=11434)
    parser.add_argument("--timeout", type=float, default=2,
                        help="Plazo por GET; hasta tres consultas, sin inferencia")
    args = parser.parse_args()
    try:
        config = OllamaConfig(model=args.model, port=args.port, timeout=args.timeout)
    except ValueError as error:
        parser.error(str(error))
    report = probe(config)
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "available" else 1


if __name__ == "__main__":
    raise SystemExit(main())
