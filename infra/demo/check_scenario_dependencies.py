"""Fail the isolated validation gate unless installed distributions match every pin."""

from importlib.metadata import version
from pathlib import Path

requirements = Path("/app/requirements.txt")
if not requirements.is_file():
    requirements = Path(__file__).resolve().parents[2] / "backend/requirements.txt"
for line in requirements.read_text().splitlines():
    if not line or line.startswith("#"):
        continue
    distribution, pinned = line.split("==")
    distribution = distribution.split("[")[0]
    actual = version(distribution)
    if actual != pinned:
        raise SystemExit(f"Pin incorrecto: {distribution} {actual}, requerido {pinned}")
print("Todos los pins backend coinciden")
