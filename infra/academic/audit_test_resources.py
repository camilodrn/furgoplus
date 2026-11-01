"""Read-only audit of four accidental test resources; never execute deletions."""

import argparse
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

from control import PROJECT

VOLUMES = ("pg_data", "private_uploads")
NETWORKS = ("database", "frontend")
EMPTY_CHECK = """
import json, os, sys
from pathlib import Path
flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
for raw in json.loads(sys.argv[1]):
    path = Path(raw)
    if not path.is_absolute() or str(path) != raw or '..' in path.parts:
        raise SystemExit(1)
    fd = os.open('/', flags)
    try:
        for part in path.parts[1:]:
            child = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = child
        if os.listdir(fd):
            raise SystemExit(1)
    finally:
        os.close(fd)
"""


def docker(*args):
    result = subprocess.run(
        ["docker", *args], check=True, capture_output=True, text=True
    )
    return result.stdout


def snapshot():
    # Host filesystem inspection is only meaningful for a local Linux daemon.
    if os.environ.get("DOCKER_HOST"):
        raise ValueError("DOCKER_HOST definido: no se presupone un daemon local.")
    context = json.loads(docker("context", "inspect"))
    endpoint = context[0]["Endpoints"]["docker"]["Host"]
    if len(context) != 1 or not endpoint.startswith("unix:///"):
        raise ValueError("Se requiere el socket Unix de un daemon local.")
    daemon = json.loads(
        docker(
            "info",
            "--format",
            '{"root":{{json .DockerRootDir}},"id":{{json .ID}},"os":{{json .OSType}},'
            '"name":{{json .Name}},"kernel":{{json .KernelVersion}},'
            '"operating_system":{{json .OperatingSystem}}}',
        )
    )
    root = Path(daemon["root"])
    if (
        daemon["os"] != "linux"
        or not daemon["id"]
        or daemon["name"] != os.uname().nodename
        or daemon["kernel"] != os.uname().release
        or "docker desktop" in daemon["operating_system"].lower()
        or not root.is_absolute()
        or root == Path("/")
        or ".." in root.parts
    ):
        raise ValueError("Raíz o identidad del daemon inesperada.")
    result = {"daemon": {**daemon, "endpoint": endpoint}, "volumes": [], "networks": []}
    for kind, suffixes in (("volume", VOLUMES), ("network", NETWORKS)):
        expected = {f"{PROJECT}_{suffix}" for suffix in suffixes}
        names = docker(
            kind,
            "ls",
            "--filter",
            f"label=com.docker.compose.project={PROJECT}",
            "--format",
            "{{.Name}}",
        ).splitlines()
        if set(names) != expected or len(names) != len(expected):
            raise ValueError("Inventario académico distinto de los cuatro recursos.")
        for suffix in suffixes:
            name = f"{PROJECT}_{suffix}"
            values = json.loads(docker(kind, "inspect", name))
            if len(values) != 1:
                raise ValueError("Inspección de recurso ambigua.")
            value = values[0]
            labels = value.get("Labels") or {}
            if (
                value.get("Name") != name
                or labels.get("com.docker.compose.project") != PROJECT
                or labels.get(f"com.docker.compose.{kind}") != suffix
                or not labels.get("com.docker.compose.version")
                or value.get("Scope") != "local"
                or value.get("Options") not in (None, {})
            ):
                raise ValueError(
                    "Identidad, etiquetas u opciones de recurso inesperadas."
                )
            if kind == "volume":
                mountpoint = str(root / "volumes" / name / "_data")
                if (
                    value.get("Driver") != "local"
                    or value.get("Mountpoint") != mountpoint
                    or not value.get("CreatedAt")
                ):
                    raise ValueError("Volumen no local o ruta de datos inesperada.")
                fields = (
                    "Name",
                    "Driver",
                    "Scope",
                    "Options",
                    "Labels",
                    "Mountpoint",
                    "CreatedAt",
                )
            else:
                if (
                    value.get("Driver") != "bridge"
                    or value.get("Internal") is not (suffix == "database")
                    or value.get("Containers") != {}
                    or value.get("Ingress")
                    or value.get("ConfigOnly")
                    or not re.fullmatch(r"[a-f0-9]{64}", value.get("Id", ""))
                ):
                    raise ValueError("Red inesperada o con contenedores asociados.")
                fields = (
                    "Name",
                    "Id",
                    "Driver",
                    "Scope",
                    "Options",
                    "Labels",
                    "Internal",
                    "Created",
                    "IPAM",
                    "EnableIPv6",
                    "Attachable",
                )
            result[f"{kind}s"].append({field: value.get(field) for field in fields})
    return result


def verify_no_containers(containers, state):
    volumes = {v["Name"] for v in state["volumes"]}
    paths = [Path(v["Mountpoint"]) for v in state["volumes"]]
    networks = {n["Name"] for n in state["networks"]}
    network_ids = {n["Id"] for n in state["networks"]}
    for container in containers:
        labels = container["Config"].get("Labels") or {}
        if labels.get("com.docker.compose.project") == PROJECT:
            raise ValueError(
                "Existe un contenedor académico, incluso si está detenido."
            )
        for mount in container["Mounts"]:
            source = Path(mount.get("Source", "/nonexistent"))
            if mount.get("Name") in volumes or any(
                source.is_relative_to(path) or path.is_relative_to(source)
                for path in paths
            ):
                raise ValueError("Un contenedor referencia los datos académicos.")
        attached = container["NetworkSettings"]["Networks"] or {}
        if (
            networks.intersection(attached)
            or any(n.get("NetworkID") in network_ids for n in attached.values())
            or container["HostConfig"].get("NetworkMode") in networks | network_ids
        ):
            raise ValueError("Un contenedor referencia una red académica.")


def check_containers(state):
    ids = docker("ps", "--all", "--quiet", "--no-trunc").splitlines()
    for container_id in ids:
        if not re.fullmatch(r"[a-f0-9]{64}", container_id):
            raise ValueError("Identificador de contenedor inesperado.")
        verify_no_containers(
            json.loads(docker("container", "inspect", container_id)), state
        )


def check_empty(state, sudo=False):
    paths = [v["Mountpoint"] for v in state["volumes"]]
    command = [sys.executable, "-I", "-B", "-c", EMPTY_CHECK, json.dumps(paths)]
    if sudo:
        command = ["sudo", "-n", "--", *command]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        # Never show directory entries, filenames, payloads or helper tracebacks.
        raise ValueError("Volumen no vacío, enlace simbólico o lectura no autorizada.")


def audit(*, sudo=False, expected=None):
    before = snapshot()
    check_containers(before)
    check_empty(before, sudo)
    after = snapshot()
    check_containers(after)
    if before != after:
        raise ValueError("Los recursos o el daemon cambiaron durante la auditoría.")
    check_empty(after, sudo)
    digest = hashlib.sha256(json.dumps(after, sort_keys=True).encode()).hexdigest()
    if expected is not None and expected != digest:
        raise ValueError("La identidad no coincide con la auditoría revisada.")
    return after, digest


def print_plan(state, digest, sudo):
    # Only print after the complete audit. This program NEVER executes rm.
    recheck = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--expect-fingerprint",
        digest,
    ]
    if sudo:
        recheck.append("--sudo-read-volumes")
    commands = [
        recheck,
        [
            "docker",
            "--host",
            state["daemon"]["endpoint"],
            "network",
            "rm",
            "--",
            *(n["Id"] for n in state["networks"]),
        ],
        [
            "docker",
            "--host",
            state["daemon"]["endpoint"],
            "volume",
            "rm",
            "--",
            *(f"{PROJECT}_{s}" for s in VOLUMES),
        ],
    ]
    print("Plan para revisión y ejecución MANUAL; este auditor no lo ejecuta:")
    print(" &&\n".join(shlex.join(command) for command in commands))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-read-volumes", action="store_true")
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--expect-fingerprint")
    args = parser.parse_args()
    state, digest = audit(sudo=args.sudo_read_volumes, expected=args.expect_fingerprint)
    print(
        "VERIFICADO: cuatro recursos exactos, sin contenedores y dos volúmenes vacíos."
    )
    print(f"Huella de identidad: {digest}")
    if args.print_plan:
        print_plan(state, digest, args.sudo_read_volumes)


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        sys.exit(f"Auditoría detenida: {error} Sin cambios ni plan de borrado.")
    except (KeyError, IndexError, TypeError, OSError, subprocess.SubprocessError):
        sys.exit(
            "Auditoría detenida: comprobación fallida; sin cambios ni plan de borrado."
        )
