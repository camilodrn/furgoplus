"""Read-only Linux hardware inventory with opt-in local service metadata."""

import argparse
import json
import os
import platform
import shutil
import subprocess
from pathlib import Path


def read(path: str) -> str:
    try:
        return Path(path).read_text().strip()
    except OSError:
        return "unavailable"


def inventory(disk_path: Path | None = None) -> dict:
    cpu = read("/proc/cpuinfo")
    fields = {}
    for line in cpu.splitlines():
        key, _, value = line.partition(":")
        if key.strip() in {"model name", "flags", "Features"}:
            fields.setdefault(key.strip(), value.strip())
    memory = {}
    for line in read("/proc/meminfo").splitlines():
        key, _, value = line.partition(":")
        if key in {"MemTotal", "MemAvailable", "SwapTotal", "SwapFree"}:
            memory[key + "_KiB"] = int(value.strip().split()[0])
    disk = shutil.disk_usage(disk_path or Path.cwd())
    flags = set(fields.get("flags", fields.get("Features", "")).split())
    try:
        affinity = len(os.sched_getaffinity(0))
    except AttributeError:
        affinity = os.cpu_count()
    return {
        "scope": "this host only; not proof of homelab capacity",
        "os": platform.freedesktop_os_release().get("PRETTY_NAME", "unknown"),
        "python": platform.python_version(),
        "architecture": platform.machine(),
        "cpu_model": fields.get("model name", "unknown"),
        "logical_cpus": os.cpu_count(),
        "affinity_cpus": affinity,
        "instruction_flags": {
            key: key in flags if flags else None
            for key in ("avx", "avx2", "avx512f", "neon", "asimd")
        },
        "memory": memory,
        "cgroup_v2": {
            key: read("/sys/fs/cgroup/" + key)
            for key in ("cpu.max", "memory.max", "memory.current", "memory.swap.max")
        },
        "load_average": list(os.getloadavg()),
        "memory_pressure": read("/proc/pressure/memory"),
        "cpu_pressure": read("/proc/pressure/cpu"),
        "io_pressure": read("/proc/pressure/io"),
        "disk_scope": "requested path" if disk_path else "working directory",
        "disk_free_GiB": round(disk.free / 2**30, 2),
        "disk_total_GiB": round(disk.total / 2**30, 2),
        "ollama_executable_present": shutil.which("ollama") is not None,
    }


def service_inventory() -> dict:
    """Explicit opt-in: fixed metadata queries only; no sudo or service changes.

    Does not inspect container env, mounts, logs, command lines or app data.
    Review host/container names and listener addresses before sharing output.
    """
    commands = {
        "units": ["systemctl", "show", "--no-pager", "-p", "Id", "-p", "LoadState",
                  "-p", "ActiveState", "-p", "SubState", "-p", "MemoryCurrent",
                  "-p", "MemoryMax", "-p", "CPUUsageNSec", "ollama.service",
                  "docker.service", "containerd.service", "cloudflared.service",
                  "caddy.service", "tailscaled.service"],
        "listeners": ["ss", "-ltn"],
        "docker_engine_version": ["docker", "--host", "unix:///var/run/docker.sock",
                                  "version", "--format", "{{.Server.Version}}"],
        "compose_version": ["docker", "compose", "version", "--short"],
        "docker_storage": ["docker", "--host", "unix:///var/run/docker.sock",
                           "info", "--format", "{{.DockerRootDir}}"],
        "containers": ["docker", "--host", "unix:///var/run/docker.sock", "ps", "--format",
                       "{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"],
        "container_resources": ["docker", "--host", "unix:///var/run/docker.sock",
                                "stats", "--no-stream", "--format",
                                "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.BlockIO}}\t{{.PIDs}}"],
    }
    results = {}
    for name, command in commands.items():
        if shutil.which(command[0]) is None:
            results[name] = {"status": "command_missing"}
            continue
        try:
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                    timeout=5, check=False,
                                    env={**os.environ, "LC_ALL": "C"})
            results[name] = {"status": "ok" if result.returncode == 0 else "unavailable",
                             "output": result.stdout[:16_384].decode(errors="replace"),
                             "truncated": len(result.stdout) > 16_384}
        except (OSError, subprocess.SubprocessError):
            results[name] = {"status": "unavailable"}
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--disk-path", type=Path,
                        help="Ruta existente en el volumen previsto para los modelos; no se crea")
    parser.add_argument("--services", action="store_true",
                        help="Lee metadatos de unidades, listeners y contenedores; sin sudo ni cambios")
    args = parser.parse_args()
    try:
        report = inventory(args.disk_path)
    except OSError:
        parser.error("No se puede leer el volumen solicitado")
    if args.services:
        report["services"] = service_inventory()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
