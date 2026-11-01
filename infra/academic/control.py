"""Explicit Fedora operator entrypoint. Never invoked by application startup."""

import argparse
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

from provision import directory

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / "infra/academic/compose.json"
PROJECT = "furgoplus-task12-academic"
DATABASE = "furgoplus_task12_academic"


def run_sqlite_tests(environment):
    """Run the built backend without Compose resources or academic secrets."""
    result = subprocess.run(
        ["docker", "image", "inspect", f"{PROJECT}-backend"],
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    image = json.loads(result.stdout)[0]
    config = image["Config"]
    labels = config.get("Labels") or {}
    image_id = image["Id"]
    if (
        labels.get("com.docker.compose.project") != PROJECT
        or labels.get("com.docker.compose.service") != "backend"
        or not re.fullmatch(r"sha256:[a-f0-9]{64}", image_id)
        or config.get("Volumes") not in (None, {})
    ):
        raise ValueError("Imagen de pruebas ajena o con volúmenes implícitos.")
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--pull",
            "never",
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--user",
            "65534:65534",
            "--no-healthcheck",
            "--workdir",
            "/app",
            "--tmpfs",
            "/tmp:rw,nosuid,nodev,noexec,size=256m,mode=1777",
            "--env",
            "DJANGO_SETTINGS_MODULE=config.settings_task12_tests",
            "--env",
            "TASK12_TEST_POSTGRES=false",
            "--env",
            "PYTHONDONTWRITEBYTECODE=1",
            "--entrypoint",
            "python",
            image_id,
            "manage.py",
            "test",
            "drivers.test_academic_scenario",
            "--verbosity",
            "2",
        ],
        env=environment,
        check=True,
    )


def validate_model(model, secrets_dir):
    """Validate effective Compose JSON, including accidental multi-file merging."""
    source = json.loads(COMPOSE.read_text())
    if model.get("name") != PROJECT:
        raise ValueError("Proyecto Compose incorrecto.")
    if set(model["services"]) != {"db", "backend", "web"}:
        raise ValueError("Servicios inesperados.")
    for name, service in model["services"].items():
        original = source["services"][name]
        if service.get("environment") != original["environment"]:
            raise ValueError("Variables heredadas o destino incorrecto.")
        for field in (
            "network_mode",
            "container_name",
            "env_file",
            "volumes_from",
            "extends",
            "links",
            "external_links",
            "privileged",
        ):
            if service.get(field):
                raise ValueError("Configuración compartida o heredada.")
        wanted = {
            "db": [],
            "backend": [("127.0.0.1", "18082", 8000, "tcp")],
            "web": [("127.0.0.1", "15173", 5173, "tcp")],
        }[name]
        actual = [
            (
                p.get("host_ip"),
                str(p.get("published")),
                p.get("target"),
                p.get("protocol", "tcp"),
            )
            for p in service.get("ports", [])
        ]
        if actual != wanted:
            raise ValueError("Puertos adicionales, públicos o heredados (8000/5173).")
        if set(service.get("networks", {})) != set(original["networks"]):
            raise ValueError("Red compartida o inesperada.")
        mounts = {
            (v["type"], v["source"], v["target"], v.get("read_only", False))
            for v in service.get("volumes", [])
        }
        expected_mounts = {
            "db": {
                ("volume", "pg_data", "/var/lib/postgresql/data", False),
                (
                    "bind",
                    str(COMPOSE.parent / "10-academic-identity.sh"),
                    "/docker-entrypoint-initdb.d/10-academic-identity.sh",
                    True,
                ),
            },
            "backend": {
                ("volume", "private_uploads", "/var/lib/furgoplus/private", False)
            },
            "web": set(),
        }[name]
        if mounts != expected_mounts or len(mounts) != len(service.get("volumes", [])):
            raise ValueError("Volúmenes compartidos o inesperados.")
        service_secrets = service.get("secrets", [])
        expected_secrets = set(original.get("secrets", []))
        if (
            {s["source"] for s in service_secrets} != expected_secrets
            or len(service_secrets) != len(expected_secrets)
            or any(
                # Compose may expand the default target to its absolute mount path.
                s.get("target", s["source"])
                not in (s["source"], f"/run/secrets/{s['source']}")
                for s in service_secrets
            )
        ):
            raise ValueError("Secretos heredados o renombrados.")
        if name == "db":
            if service.get("image") != original["image"] or service.get("command"):
                raise ValueError("PostgreSQL inesperado.")
        else:
            build = service.get("build", {})
            if (
                build.get("context") != str(ROOT)
                or build.get("dockerfile") != original["build"]["dockerfile"]
                or service.get("image") not in {None, f"{PROJECT}-{name}"}
            ):
                raise ValueError("Build inesperado.")
        # Compose emits null for image defaults; empty strings/lists override them.
        if service.get("command") is not None or service.get("entrypoint") is not None:
            raise ValueError("Inicio reemplazado.")
    for field in ("volumes", "networks"):
        if set(model.get(field, {})) != set(source[field]):
            raise ValueError("Recursos compartidos o adicionales.")
        for name, value in model[field].items():
            if value.get("name") != f"{PROJECT}_{name}" or value.get("external"):
                raise ValueError("Recurso externo o de otro proyecto.")
            if value.get("driver_opts"):
                raise ValueError("Recurso con almacenamiento o red externa.")
            drivers = {None, "local"} if field == "volumes" else {None, "bridge"}
            if value.get("driver") not in drivers:
                raise ValueError("Driver de recurso no local o desconocido.")
    if not model["networks"]["database"].get("internal"):
        raise ValueError("Red de PostgreSQL debe ser interna.")
    if set(model.get("secrets", {})) != set(source["secrets"]):
        raise ValueError("Secretos adicionales.")
    for name, value in model["secrets"].items():
        if value.get("file") != str(secrets_dir / name) or value.get("external"):
            raise ValueError("Secretos ajenos al entorno académico.")


def command():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=(
            "config",
            "build",
            "create",
            "migrate",
            "dry-run",
            "load",
            "audit",
            "start",
            "test",
        ),
    )
    args = parser.parse_args()
    secrets_dir = directory()
    for path in (
        secrets_dir,
        *(
            secrets_dir / n
            for n in ("db_password", "django_secret_key", "academic_identity")
        ),
    ):
        info = path.lstat()
        expected_mode = (
            0o700
            if path == secrets_dir
            else (0o644 if path.name == "academic_identity" else 0o600)
        )
        if (
            path.is_symlink()
            or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != expected_mode
        ):
            raise ValueError(
                "Secretos requieren propietario actual y permisos privados."
            )
    environment = os.environ.copy()
    environment["ACADEMIC_SECRETS_DIR"] = str(secrets_dir)
    compose = [
        "docker",
        "compose",
        "--project-directory",
        str(COMPOSE.parent),
        "--env-file",
        "/dev/null",
        "-p",
        PROJECT,
        "-f",
        str(COMPOSE),
    ]
    # Do not emit effective config: only the topology verdict and public identity.
    result = subprocess.run(
        compose + ["config", "--format", "json"],
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    validate_model(json.loads(result.stdout), secrets_dir)
    print(f"Destino: {PROJECT} / PostgreSQL {DATABASE} (db:5432)", flush=True)
    if args.action == "config":
        print("Compose validado: API 127.0.0.1:18082; React 127.0.0.1:15173.")
        return
    if args.action == "test":
        run_sqlite_tests(environment)
        return

    def inspect(kind, name):
        result = subprocess.run(
            ["docker", kind, "inspect", name],
            env=environment,
            capture_output=True,
            text=True,
        )
        if result.returncode:
            # Distinguish a missing object from an unavailable daemon.
            subprocess.run(
                ["docker", "info", "--format", "{{.ServerVersion}}"],
                env=environment,
                check=True,
                capture_output=True,
            )
            message = result.stderr.lower()
            if "no such" in message or "not found" in message:
                return None
            raise ValueError("No se pudo verificar el recurso; no se supone ausente.")
        return json.loads(result.stdout)[0]

    if args.action == "create":
        # Creation is exclusively for NEW resources; never adopt an existing volume.
        for kind, names in (
            ("volume", ("pg_data", "private_uploads")),
            ("network", ("database", "frontend")),
        ):
            for name in names:
                if inspect(kind, f"{PROJECT}_{name}") is not None:
                    raise ValueError(
                        "Recurso existente: creación detenida; conservar y revisar."
                    )
        result = subprocess.run(
            compose + ["ps", "--all", "--quiet"],
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )
        if result.stdout.strip():
            raise ValueError("Proyecto existente; no se recrean sus contenedores.")
    elif args.action not in {"build", "test"}:
        volume = inspect("volume", f"{PROJECT}_pg_data")
        if (
            not volume
            or volume.get("Labels", {}).get("com.docker.compose.project") != PROJECT
        ):
            raise ValueError("Volumen PostgreSQL sin identidad Compose académica.")
        private = inspect("volume", f"{PROJECT}_private_uploads")
        if (
            private
            and private.get("Labels", {}).get("com.docker.compose.project") != PROJECT
        ):
            raise ValueError("Volumen privado compartido o desconocido.")
        result = subprocess.run(
            compose + ["ps", "--quiet", "db"],
            env=environment,
            check=True,
            capture_output=True,
            text=True,
        )
        ids = result.stdout.split()
        if len(ids) != 1:
            raise ValueError("Se requiere exactamente un PostgreSQL académico activo.")
        db_container = inspect("container", ids[0])
        validate_db_container(db_container)
    expectations = ["--expect-project", PROJECT, "--expect-database", DATABASE]
    actions = {
        "build": ["build"],
        "create": ["up", "-d", "--wait", "--wait-timeout", "90", "--no-deps", "db"],
        "start": ["up", "-d", "--no-deps", "backend", "web"],
        "migrate": [
            "run",
            "--rm",
            "--no-deps",
            "backend",
            "python",
            "manage.py",
            "migrate_academic",
            *expectations,
        ],
        "dry-run": [
            "run",
            "--rm",
            "--no-deps",
            "backend",
            "python",
            "manage.py",
            "prepare_academic_scenario",
            "--dry-run",
            *expectations,
        ],
        "load": [
            "run",
            "--rm",
            "--no-deps",
            "backend",
            "python",
            "manage.py",
            "prepare_academic_scenario",
            "--apply",
            *expectations,
        ],
        "audit": [
            "run",
            "--rm",
            "--no-deps",
            "backend",
            "python",
            "manage.py",
            "audit_academic_scenario",
            *expectations,
        ],
    }
    subprocess.run(compose + actions[args.action], env=environment, check=True)


def validate_db_container(container):
    labels = container["Config"].get("Labels", {})
    if (
        labels.get("com.docker.compose.project") != PROJECT
        or labels.get("com.docker.compose.service") != "db"
        or not container["State"]["Running"]
    ):
        raise ValueError("Contenedor PostgreSQL ajeno o detenido.")
    data = [
        m for m in container["Mounts"] if m["Destination"] == "/var/lib/postgresql/data"
    ]
    if (
        len(data) != 1
        or data[0].get("Type") != "volume"
        or data[0].get("Name") != f"{PROJECT}_pg_data"
    ):
        raise ValueError("PostgreSQL utiliza otro volumen.")
    if container["HostConfig"].get("PortBindings"):
        raise ValueError("PostgreSQL tiene puertos publicados.")
    if set(container["NetworkSettings"]["Networks"]) != {f"{PROJECT}_database"}:
        raise ValueError("PostgreSQL comparte una red inesperada.")


if __name__ == "__main__":
    try:
        command()
    except ValueError as error:
        sys.exit(str(error))
    except (
        KeyError,
        OSError,
        subprocess.SubprocessError,
    ):
        sys.exit(
            "Operación detenida: revise identidad, permisos o Compose; sin reintento."
        )
