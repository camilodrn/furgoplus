"""Manual DB/file recovery with metadata preflights and network-free file helpers.

No Compose one-off backend: its static IP may remain reserved by the canonical
container even while stopped. Never read secret files or inspect container env.
"""

import argparse
import hashlib
import ipaddress
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tarfile
from pathlib import Path, PurePosixPath

from check_config import validate_model

ROOT = Path(__file__).resolve().parents[2]
SOURCE_PROJECT = "furgoplus-demo"
FILES = {
    "database.dump",
    "private_uploads.tar",
    "source.tar",
    "deployment.env",
    "images.txt",
    "image-identities.txt",
    "manifest.json",
    "private-files.json",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def run(args, **kwargs):
    # Capture diagnostics; never print an entire inspect/config or command output.
    return subprocess.run(args, check=True, stderr=subprocess.PIPE, **kwargs)


def output(args):
    return run(args, stdout=subprocess.PIPE, text=True).stdout.strip()


def local_daemon():
    require(
        os.environ.get("DOCKER_HOST", "unix://").startswith("unix://"),
        "Use a local Unix-socket Docker daemon",
    )
    endpoint = output(
        [
            "docker",
            "context",
            "inspect",
            "--format",
            '{{(index .Endpoints "docker").Host}}',
        ]
    )
    require(endpoint.startswith("unix://"), "Remote Docker contexts are unsupported")


def compose(env_file, project):
    if not env_file.is_absolute():
        env_file = ROOT / env_file
    return [
        "docker",
        "compose",
        "--project-name",
        project,
        "--env-file",
        str(env_file),
        "-f",
        str(ROOT / "infra/demo/compose.yaml"),
    ]


def model_for(command, project):
    model = json.loads(output([*command, "config", "--format", "json"]))
    validate_model(model, project=project)
    return model


def digest(stream):
    checksum = hashlib.sha256()
    for chunk in iter(lambda: stream.read(256 * 1024), b""):
        checksum.update(chunk)
    return checksum.hexdigest()


def file_digest(path):
    with path.open("rb") as stream:
        return digest(stream)


def archive_inventory(path):
    files = {}
    names = set()
    with tarfile.open(path, "r:") as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            require(
                not name.is_absolute() and ".." not in name.parts,
                "Unsafe private archive path",
            )
            require("\\" not in member.name, "Ambiguous private archive path")
            require(
                member.isfile() or member.isdir(),
                "Private archive contains a link/device",
            )
            key = str(name)
            require(key not in names, "Duplicate private archive entry")
            names.add(key)
            if member.isfile():
                require(key != ".", "Invalid private archive file")
                with archive.extractfile(member) as stream:
                    files[key] = {"sha256": digest(stream), "size": member.size}
    return files


def verify_snapshot(snapshot, complete=True):
    if complete:
        marker = snapshot / "COMPLETE"
        require(
            not marker.is_symlink() and marker.is_file(),
            "Incomplete snapshot: no COMPLETE marker",
        )
        require(
            marker.read_text() == "FURGOPLUS_DEMO_SNAPSHOT_V1\n",
            "Invalid COMPLETE marker",
        )
    sums = snapshot / "SHA256SUMS"
    require(
        not sums.is_symlink() and sums.is_file(), "Missing/nonregular checksum manifest"
    )
    lines = (snapshot / "SHA256SUMS").read_text().splitlines()
    listed = set()
    for line in lines:
        match = re.fullmatch(r"([a-f0-9]{64})  ([a-zA-Z0-9_.-]+)", line)
        require(match is not None, "Unsafe checksum manifest")
        checksum, name = match.groups()
        require(
            name in FILES and name not in listed, "Unexpected/duplicate checksum file"
        )
        path = snapshot / name
        require(
            path.is_file() and not path.is_symlink(), "Missing/nonregular snapshot file"
        )
        require(file_digest(path) == checksum, f"Checksum mismatch: {name}")
        listed.add(name)
    require(listed == FILES, "Snapshot checksum manifest is incomplete")
    inventory = archive_inventory(snapshot / "private_uploads.tar")
    require(
        inventory == json.loads((snapshot / "private-files.json").read_text()),
        "Private file inventory mismatch",
    )
    manifest = json.loads((snapshot / "manifest.json").read_text())
    require(
        manifest["format"] == 1 and manifest["project"] == SOURCE_PROJECT,
        "Unsupported snapshot provenance",
    )
    require(
        set(manifest["images"]) == {"db", "backend", "caddy"},
        "Incomplete image identities",
    )
    require(
        manifest["volumes"]
        == {
            name: f"{SOURCE_PROJECT}_{name}" for name in ("pg_data", "private_uploads")
        },
        "Unexpected source volume identities",
    )
    require(
        ipaddress.ip_network(manifest["subnet"]).version == 4, "Invalid source subnet"
    )
    require(
        isinstance(manifest["port"], int) and 1 <= manifest["port"] <= 65535,
        "Invalid source port",
    )
    return manifest


def container_id(command, service):
    ids = output([*command, "ps", "-a", "--quiet", service]).splitlines()
    require(len(ids) == 1 and ids[0], f"Expected one existing {service} container")
    return ids[0]


def inspect_field(identifier, template):
    return output(["docker", "container", "inspect", "--format", template, identifier])


def helper_image(image):
    volumes = output(
        ["docker", "image", "inspect", "--format", "{{json .Config.Volumes}}", image]
    )
    require(
        volumes in {"null", "{}"}, "Helper image must not declare anonymous volumes"
    )


def container_metadata(command, project, service):
    identifier = container_id(command, service)
    require(
        inspect_field(
            identifier, '{{index .Config.Labels "com.docker.compose.project"}}'
        )
        == project,
        "Wrong container project",
    )
    require(
        inspect_field(
            identifier, '{{index .Config.Labels "com.docker.compose.service"}}'
        )
        == service,
        "Wrong container service",
    )
    return {"id": identifier, "image": inspect_field(identifier, "{{.Image}}")}


def volume_metadata(name, project):
    # Selected fields only; never inspect options values or container environment.
    template = (
        "{{.Name}}|{{.Driver}}|{{.Mountpoint}}|"
        '{{index .Labels "com.docker.compose.project"}}|'
        "{{if .Options}}custom{{else}}default{{end}}"
    )
    fields = output(["docker", "volume", "inspect", "--format", template, name]).split(
        "|"
    )
    require(len(fields) == 5, "Unexpected volume metadata")
    actual_name, driver, mountpoint, owner, options = fields
    require(actual_name == name and owner == project, "Wrong volume/project")
    require(
        driver == "local" and options == "default", "Only plain local volumes supported"
    )
    require(
        Path(mountpoint).is_absolute() and not any(c in mountpoint for c in ",\n\r"),
        "Unsafe volume mountpoint",
    )
    return mountpoint


def mounted_volume(identifier, destination, name):
    template = (
        '{{range .Mounts}}{{if eq .Destination "' + destination + '"}}'
        "{{.Type}}|{{.Name}}{{end}}{{end}}"
    )
    require(
        inspect_field(identifier, template) == f"volume|{name}",
        "Existing container does not mount the expected volume",
    )


def helper(image, mounts, entrypoint):
    command = [
        "docker",
        "run",
        "--rm",
        "--interactive",
        "--pull",
        "never",
        "--network",
        "none",
        "--read-only",
        "--user",
        "10001:10001",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--no-healthcheck",
        "--security-opt",
        "label=disable",
        "--memory",
        "128m",
        "--cpus",
        "0.5",
        "--pids-limit",
        "64",
        "--entrypoint",
        entrypoint,
    ]
    for source, target, readonly in mounts:
        require(not any(c in str(source) for c in ",\n\r"), "Unsafe bind path")
        mount = f"type=bind,source={source},target={target},bind-recursive=disabled"
        command.extend(["--mount", mount + (",readonly" if readonly else "")])
    return [*command, image]


def deployment_parameters(model):
    backend = model["services"]["backend"]
    return {
        "FURGOPLUS_RELEASE": backend["image"].rsplit(":", 1)[1],
        "DEMO_SYNTHETIC_ONLY": "true",
        "DEMO_HTTP_PORT": str(model["services"]["caddy"]["ports"][0]["published"]),
        "DEMO_PROXY_SUBNET": model["networks"]["proxy"]["ipam"]["config"][0]["subnet"],
        "DEMO_CADDY_IP": backend["environment"]["DEMO_CADDY_IP"],
        "DEMO_BACKEND_IP": backend["networks"]["proxy"]["ipv4_address"],
        "DJANGO_SECRET_KEY_PATH": model["secrets"]["django_secret_key"]["file"],
        "DB_PASSWORD_PATH": model["secrets"]["db_password"]["file"],
    }


def source_archive(destination):
    excluded = {
        "__pycache__",
        ".venv",
        "node_modules",
        "dist",
        "coverage",
        "secrets",
        "backups",
    }

    def accept(member):
        parts = PurePosixPath(member.name).parts
        name = parts[-1]
        if (
            set(parts) & excluded
            or name == "cloudflared.yaml"
            or (name.startswith(".env") and name != ".env.example")
            or name.endswith((".pyc", ".tsbuildinfo"))
            or member.issym()
        ):
            return None
        return member

    with tarfile.open(destination, "w:") as archive:
        for name in (
            "backend",
            "web",
            "infra",
            "docs",
            "README.md",
            ".dockerignore",
            ".gitignore",
        ):
            archive.add(ROOT / name, arcname=name, filter=accept)


def backup(snapshot, env_file, writers_paused):
    require(
        writers_paused, "Set DEMO_WRITERS_PAUSED=true after pausing external writers"
    )
    require(snapshot.is_absolute(), "Use an absolute snapshot path")
    snapshot = snapshot.resolve()
    require(
        not snapshot.is_relative_to(ROOT), "Snapshot must be outside the repository"
    )
    require(
        not snapshot.exists() and snapshot.parent.is_dir(),
        "Use a new snapshot directory",
    )
    local_daemon()
    command = compose(env_file, SOURCE_PROJECT)
    model = model_for(command, SOURCE_PROJECT)
    containers = {
        name: container_metadata(command, SOURCE_PROJECT, name)
        for name in ("db", "backend", "caddy")
    }
    helper_image(containers["backend"]["image"])
    volumes = {name: info["name"] for name, info in model["volumes"].items()}
    for name in volumes.values():
        volume_metadata(name, SOURCE_PROJECT)  # Both original volumes must exist.
    mounted_volume(
        containers["db"]["id"], "/var/lib/postgresql/data", volumes["pg_data"]
    )
    mounted_volume(
        containers["backend"]["id"],
        "/var/lib/furgoplus/private",
        volumes["private_uploads"],
    )
    require(
        inspect_field(containers["db"]["id"], "{{.State.Running}}") == "true",
        "Original PostgreSQL must be running",
    )
    snapshot.mkdir(mode=0o700)
    print(
        "Preflight OK; stopping application writers. No automatic restart.", flush=True
    )
    run([*command, "stop", "caddy", "backend"], stdout=subprocess.PIPE)
    for name in ("caddy", "backend"):
        require(
            inspect_field(containers[name]["id"], "{{.State.Running}}") == "false",
            "Application writer is still running",
        )
    with (snapshot / "database.dump").open("xb") as stream:
        print("Writers stopped; capturing database then private files.", flush=True)
        run(
            [
                *command,
                "exec",
                "-T",
                "db",
                "sh",
                "-eu",
                "-c",
                'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl',
            ],
            stdout=stream,
        )
    require((snapshot / "database.dump").stat().st_size > 0, "Empty database dump")
    mountpoint = volume_metadata(volumes["private_uploads"], SOURCE_PROJECT)
    with (snapshot / "private_uploads.tar").open("xb") as stream:
        run(
            [
                *helper(
                    containers["backend"]["image"],
                    [(mountpoint, "/private", True)],
                    "tar",
                ),
                "-C",
                "/private",
                "-cf",
                "-",
                ".",
            ],
            stdout=stream,
        )
    with (snapshot / "database.dump").open("rb") as stream:
        run(
            [*command, "exec", "-T", "db", "pg_restore", "--list"],
            stdin=stream,
            stdout=subprocess.PIPE,
        )
    inventory = archive_inventory(snapshot / "private_uploads.tar")
    (snapshot / "private-files.json").write_text(
        json.dumps(inventory, sort_keys=True, indent=2) + "\n"
    )
    parameters = deployment_parameters(model)
    # Export only nonsecret parameters, not arbitrary contents of the operator .env.
    (snapshot / "deployment.env").write_text(
        "".join(f"{key}={value}\n" for key, value in parameters.items())
    )
    (snapshot / "images.txt").write_text(
        "".join(
            model["services"][name]["image"] + "\n"
            for name in ("db", "backend", "caddy")
        )
    )
    identities = {name: info["image"] for name, info in containers.items()}
    (snapshot / "image-identities.txt").write_text(
        json.dumps(identities, indent=2) + "\n"
    )
    manifest = {
        "format": 1,
        "project": SOURCE_PROJECT,
        "images": identities,
        "volumes": volumes,
        "port": int(parameters["DEMO_HTTP_PORT"]),
        "subnet": parameters["DEMO_PROXY_SUBNET"],
    }
    (snapshot / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    source_archive(snapshot / "source.tar")
    (snapshot / "SHA256SUMS").write_text(
        "".join(f"{file_digest(snapshot / name)}  {name}\n" for name in sorted(FILES))
    )
    verify_snapshot(snapshot, complete=False)
    # Marker is the final write, only after all validations pass.
    (snapshot / "COMPLETE").write_text("FURGOPLUS_DEMO_SNAPSHOT_V1\n")
    print(
        "Snapshot verified. Source app remains stopped; copy/verify off-host, then start manually."
    )


def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", port))


def restore_preflight(command, model, manifest, project):
    require(
        not output(
            [
                "docker",
                "ps",
                "-a",
                "--filter",
                f"label=com.docker.compose.project={project}",
                "--format",
                "{{.ID}}",
            ]
        ),
        "Restore project already contains containers",
    )
    existing = set(
        output(["docker", "volume", "ls", "--format", "{{.Name}}"]).splitlines()
    )
    require(
        not any(name.startswith(f"{project}_") for name in existing),
        "Restore volume already exists",
    )
    network_ids = output(["docker", "network", "ls", "--quiet"]).splitlines()
    requested = ipaddress.ip_network(
        model["networks"]["proxy"]["ipam"]["config"][0]["subnet"]
    )
    require(
        not requested.overlaps(ipaddress.ip_network(manifest["subnet"])),
        "Restore subnet overlaps the source subnet",
    )
    for identifier in network_ids:
        name = output(
            ["docker", "network", "inspect", "--format", "{{.Name}}", identifier]
        )
        require(
            not name.startswith(f"{project}_"),
            "Restore network already exists",
        )
        ranges = output(
            [
                "docker",
                "network",
                "inspect",
                "--format",
                "{{range .IPAM.Config}}{{.Subnet}}\n{{end}}",
                identifier,
            ]
        ).splitlines()
        for value in ranges:
            network = ipaddress.ip_network(value)
            require(
                network.version != requested.version or not requested.overlaps(network),
                "Restore subnet overlaps an existing Docker network",
            )
    port = int(model["services"]["caddy"]["ports"][0]["published"])
    require(port != manifest["port"], "Restore must use a different loopback port")
    published = output(["docker", "ps", "--format", "{{.Ports}}"])
    require(
        f":{port}->" not in published, "Restore port is already published by Docker"
    )
    check_port(port)
    for service, image in manifest["images"].items():
        actual = output(
            [
                "docker",
                "image",
                "inspect",
                "--format",
                "{{.Id}}",
                model["services"][service]["image"],
            ]
        )
        require(
            actual == image,
            "Restore images differ from the snapshot; load exact images first",
        )
    helper_image(manifest["images"]["backend"])


RESTORE_FILES = """
import hashlib, json, os, pathlib, sys, tarfile
os.umask(0o077)
root = pathlib.Path('/private')
if any(root.iterdir()):
    raise SystemExit('Target private volume is not empty')
expected = json.loads(sys.stdin.buffer.readline())
with tarfile.open(fileobj=sys.stdin.buffer, mode='r|') as archive:
    archive.extractall(root, filter='data')
actual = {}
for path in root.rglob('*'):
    if path.is_file():
        checksum = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(262144), b''):
                checksum.update(chunk)
        actual[path.relative_to(root).as_posix()] = {'sha256': checksum.hexdigest(), 'size': path.stat().st_size}
if actual != expected:
    raise SystemExit('Restored private file checksums differ')
print('Private file checksums verified')
"""


def restore_private(command, snapshot):
    # Stream the manifest and archive instead of bind-mounting a 0700/0600 backup
    # owned by the host operator into a UID-10001 container.
    inventory = (snapshot / "private-files.json").read_bytes()
    header = json.dumps(json.loads(inventory)).encode() + b"\n"
    with subprocess.Popen(
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    ) as process:
        try:
            process.stdin.write(header)
            with (snapshot / "private_uploads.tar").open("rb") as stream:
                shutil.copyfileobj(stream, process.stdin, length=256 * 1024)
        except BrokenPipeError:
            pass
        finally:
            try:
                process.stdin.close()
            except BrokenPipeError:
                pass
            process.stdin = None
        process.communicate()
        require(process.returncode == 0, "Private file restore/verification failed")


def restore(snapshot, env_file, project):
    require(
        re.fullmatch(r"furgoplus-demo-restore-[a-z0-9-]+", project),
        "Use a fresh restore project name",
    )
    require(
        snapshot.is_absolute() and env_file.is_absolute(),
        "Use absolute snapshot/env paths",
    )
    snapshot = snapshot.resolve()
    manifest = verify_snapshot(snapshot)
    local_daemon()
    command = compose(env_file, project)
    model = model_for(command, project)
    restore_preflight(command, model, manifest, project)
    print(
        "Restore preflight OK; creating a fresh project. No source services are changed.",
        flush=True,
    )
    run(
        [*command, "up", "-d", "--wait", "--no-build", "--pull", "never", "db"],
        stdout=subprocess.PIPE,
    )
    # Create (do not start) the one canonical backend, initializing its new private
    # volume/ownership. --no-recreate also preserves the new, healthy database.
    run(
        [
            *command,
            "create",
            "--no-build",
            "--no-recreate",
            "--pull",
            "never",
            "backend",
        ],
        stdout=subprocess.PIPE,
    )
    backend = container_metadata(command, project, "backend")
    db = container_metadata(command, project, "db")
    mounted_volume(
        db["id"], "/var/lib/postgresql/data", model["volumes"]["pg_data"]["name"]
    )
    private_name = model["volumes"]["private_uploads"]["name"]
    volume_metadata(model["volumes"]["pg_data"]["name"], project)
    mounted_volume(backend["id"], "/var/lib/furgoplus/private", private_name)
    require(
        inspect_field(backend["id"], "{{.State.Running}}") == "false",
        "Restore backend must remain stopped",
    )
    mountpoint = volume_metadata(private_name, project)
    print(
        "Fresh volumes verified; restoring database transaction and private files.",
        flush=True,
    )
    # Do not run the PostgreSQL image as an auxiliary: its declared VOLUME would
    # create anonymous storage. The new canonical DB validates the catalog instead.
    with (snapshot / "database.dump").open("rb") as stream:
        run(
            [*command, "exec", "-T", "db", "pg_restore", "--list"],
            stdin=stream,
            stdout=subprocess.PIPE,
        )
    with (snapshot / "database.dump").open("rb") as stream:
        run(
            [
                *command,
                "exec",
                "-T",
                "db",
                "sh",
                "-eu",
                "-c",
                'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error --single-transaction',
            ],
            stdin=stream,
            stdout=subprocess.PIPE,
        )
    # Bind to the verified existing new volume, never create one through docker run.
    restore_private(
        [
            *helper(backend["image"], [(mountpoint, "/private", False)], "python"),
            "-c",
            RESTORE_FILES,
        ],
        snapshot,
    )
    print(
        "Restored DB/files into fresh volumes; backend is created/stopped, Caddy is not started."
    )
    print(
        "Before Caddy: start only the canonical backend; exec migrate --check and deploy checks. Never compose run backend."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("backup", "restore"))
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("project", nargs="?")
    args = parser.parse_args()
    os.umask(0o077)
    env_file = Path(os.environ.get("DEMO_ENV_FILE", "infra/demo/.env"))
    try:
        if args.operation == "backup":
            require(args.project is None, "Backup uses only the source demo project")
            backup(
                args.snapshot, env_file, os.environ.get("DEMO_WRITERS_PAUSED") == "true"
            )
        else:
            require(args.project is not None, "Set the fresh restore project name")
            restore(args.snapshot, env_file, args.project)
    except ValueError as error:
        print(
            f"Recovery rejected: {error}. Preserve partial data; no automatic restart/cleanup.",
            file=sys.stderr,
        )
        return 1
    except (
        OSError,
        KeyError,
        tarfile.TarError,
        subprocess.CalledProcessError,
    ):
        # No rollback, restarts, pruning, raw command output or secret diagnostics.
        print(
            "Recovery failed. Preserve partial snapshot/project; no automatic cleanup/restart. "
            "Review preconditions and the runbook before manual recovery.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
