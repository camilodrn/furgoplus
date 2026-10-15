"""Synthetic recovery simulations. Docker, sockets and volume IO are mocked."""

import io
import json
import subprocess
import tarfile
import tempfile
import unittest
from contextlib import redirect_stdout
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

import recovery
from check_config import compose_model

CANARY = b"FURGOPLUS_TASK11_RESTORE_TEST"
PROJECT = "furgoplus-demo-restore-simulation"
REAL_RESTORE_PRIVATE = recovery.restore_private


def private_archive(name=".restore_canary_task11", kind=tarfile.REGTYPE):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:") as archive:
        root = tarfile.TarInfo(".")
        root.type = tarfile.DIRTYPE
        root.mode = 0o700
        archive.addfile(root)
        item = tarfile.TarInfo(name)
        item.type = kind
        item.size = len(CANARY) if kind == tarfile.REGTYPE else 0
        item.linkname = "../../outside" if kind == tarfile.SYMTYPE else ""
        archive.addfile(item, io.BytesIO(CANARY) if item.size else None)
    return buffer.getvalue()


class DockerSimulation:
    def __init__(self, model):
        self.source = deepcopy(model)
        self.target = deepcopy(model)
        self.target["name"] = PROJECT
        for category in ("volumes", "networks"):
            for name, info in self.target[category].items():
                info["name"] = f"{PROJECT}_{name}"
        self.target["networks"]["proxy"]["ipam"]["config"][0]["subnet"] = (
            "172.30.82.0/29"
        )
        self.target["services"]["caddy"]["ports"][0]["published"] = "18081"
        self.target["services"]["caddy"]["networks"]["proxy"]["ipv4_address"] = (
            "172.30.82.2"
        )
        self.target["services"]["backend"]["networks"]["proxy"]["ipv4_address"] = (
            "172.30.82.3"
        )
        self.target["services"]["backend"]["environment"]["DEMO_CADDY_IP"] = (
            "172.30.82.2"
        )
        self.images = {name: "sha256:" + name for name in ("db", "backend", "caddy")}
        self.running = {"source-db": True, "source-backend": True, "source-caddy": True}
        self.volumes = {v["name"] for v in self.source["volumes"].values()}
        self.events = []
        self.fail = None
        self.extra_containers = ""
        self.published_ports = "127.0.0.1:18080->8080/tcp"
        self.network_name = "furgoplus-demo_proxy"
        self.network_subnet = "172.30.81.0/29"
        self.archive = private_archive()
        self.mismatch_image = False
        self.anonymous_volumes = "null"
        self.disappear_after_stop = False
        self.still_running = False

    def project(self, args):
        return args[args.index("--project-name") + 1]

    def output(self, args):
        self.events.append(args)
        if args[:3] == ["docker", "context", "inspect"]:
            return "unix:///synthetic/docker.sock"
        if args[:2] == ["docker", "compose"]:
            project = self.project(args)
            if "config" in args:
                return json.dumps(
                    self.source if project == recovery.SOURCE_PROJECT else self.target
                )
            if "ps" in args:
                identifier = (
                    "source-" if project == recovery.SOURCE_PROJECT else "target-"
                ) + args[-1]
                return identifier if identifier in self.running else ""
        if args[:3] == ["docker", "container", "inspect"]:
            template, identifier = args[-2:]
            service = identifier.split("-", 1)[1]
            project = (
                recovery.SOURCE_PROJECT if identifier.startswith("source-") else PROJECT
            )
            if "Config.Labels" in template:
                return (
                    project if '"com.docker.compose.project"' in template else service
                )
            if template == "{{.Image}}":
                return self.images[service]
            if template == "{{.State.Running}}":
                return "true" if self.running[identifier] else "false"
            if ".Mounts" in template:
                volume = (
                    "pg_data"
                    if "/var/lib/postgresql/data" in template
                    else "private_uploads"
                )
                return f"volume|{project}_{volume}"
        if args[:3] == ["docker", "volume", "inspect"]:
            name = args[-1]
            if name not in self.volumes:
                raise subprocess.CalledProcessError(1, args)
            project = PROJECT if name.startswith(PROJECT) else recovery.SOURCE_PROJECT
            return (
                f"{name}|local|/synthetic/docker/volumes/{name}/_data|{project}|default"
            )
        if args[:3] == ["docker", "volume", "ls"]:
            return "\n".join(self.volumes)
        if args[:2] == ["docker", "ps"]:
            if args[-1] == "{{.Ports}}":
                return self.published_ports
            return self.extra_containers
        if args[:3] == ["docker", "network", "ls"]:
            return "source-network"
        if args[:3] == ["docker", "network", "inspect"]:
            return self.network_name if args[-2] == "{{.Name}}" else self.network_subnet
        if args[:3] == ["docker", "image", "inspect"]:
            if args[-2] == "{{json .Config.Volumes}}":
                return self.anonymous_volumes
            if self.mismatch_image:
                return "sha256:wrong"
            service = next(
                name
                for name in self.images
                if self.target["services"][name]["image"] == args[-1]
            )
            return self.images[service]
        raise AssertionError(f"Unexpected simulated query: {args}")

    def run(self, args, **kwargs):
        self.events.append(args)
        if args[:2] == ["docker", "compose"]:
            if "run" in args:
                raise AssertionError("Never compose run a backend with a static IP")
            project = self.project(args)
            if "stop" in args:
                assert project == recovery.SOURCE_PROJECT
                for service in ("caddy", "backend"):
                    self.running["source-" + service] = self.still_running
                if self.disappear_after_stop:
                    self.volumes.remove("furgoplus-demo_private_uploads")
            elif "up" in args:
                assert project == PROJECT and args[-1] == "db"
                self.running["target-db"] = True
                self.volumes.add(f"{PROJECT}_pg_data")
            elif "create" in args:
                assert project == PROJECT and args[-1] == "backend"
                assert "--no-recreate" in args and "never" in args
                self.running["target-backend"] = False
                self.volumes.add(f"{PROJECT}_private_uploads")
            elif "exec" in args:
                if "pg_dump" in args[-1]:
                    if self.fail == "dump":
                        raise subprocess.CalledProcessError(1, args)
                    kwargs["stdout"].write(b"SYNTHETIC_POSTGRES_DUMP")
                elif "--list" in args:
                    if self.fail == "list":
                        raise subprocess.CalledProcessError(1, args)
                elif "pg_restore" in args[-1]:
                    assert project == PROJECT and "--single-transaction" in args[-1]
                    if self.fail == "database-restore":
                        raise subprocess.CalledProcessError(1, args)
                else:
                    raise AssertionError(args)
            else:
                raise AssertionError(args)
        elif args[:2] == ["docker", "run"]:
            assert args[args.index("--network") + 1] == "none"
            assert "--no-healthcheck" in args and "--read-only" in args
            assert "10001:10001" in args and "--pull" in args and "never" in args
            assert (
                "--env" not in args
                and "--env-file" not in args
                and "--volumes-from" not in args
            )
            if args[args.index("--entrypoint") + 1] == "tar":
                assert (
                    not self.running["source-backend"]
                    and not self.running["source-caddy"]
                )
                mount = args[args.index("--mount") + 1]
                assert "type=bind" in mount and "readonly" in mount
                assert "furgoplus-demo_private_uploads" in mount
                if self.fail == "export":
                    raise subprocess.CalledProcessError(1, args)
                kwargs["stdout"].write(self.archive)
            else:
                assert "pg_restore" in args and "--mount" not in args
        else:
            raise AssertionError(args)
        return subprocess.CompletedProcess(args, 0)

    def restore_private(self, args, snapshot):
        self.events.append(args)
        mount = args[args.index("--mount") + 1]
        assert f"{PROJECT}_private_uploads" in mount and "readonly" not in mount
        assert "type=bind" in mount and "type=volume" not in mount
        assert args[args.index("--network") + 1] == "none"
        assert "--env" not in args and "--env-file" not in args
        if self.fail == "files-restore":
            raise ValueError("Synthetic verification failure")
        actual = recovery.archive_inventory(snapshot / "private_uploads.tar")
        assert actual[".restore_canary_task11"]["size"] == len(CANARY)


class RecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Compose config only, with the public example. No daemon, .env or secrets.
        cls.model = compose_model()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="furgoplus-recovery-sim-")
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        self.repo = self.base / "repo"
        self.repo.mkdir()
        for name in ("backend", "web", "infra", "docs"):
            (self.repo / name).mkdir()
        for name in ("README.md", ".dockerignore", ".gitignore"):
            (self.repo / name).write_text("synthetic fixture\n")
        (self.repo / "backend/.env").write_text("IGNORED_SYNTHETIC_FIXTURE\n")
        self.snapshot = self.base / "snapshot"
        self.sim = DockerSimulation(self.model)
        for target, replacement in (
            ("ROOT", self.repo),
            ("output", self.sim.output),
            ("run", self.sim.run),
            ("restore_private", self.sim.restore_private),
        ):
            patcher = patch.object(recovery, target, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.port_probe = patch.object(recovery, "check_port")
        self.check_port = self.port_probe.start()
        self.addCleanup(self.port_probe.stop)
        env = patch.dict("os.environ", {"DOCKER_HOST": "unix:///synthetic/docker.sock"})
        env.start()
        self.addCleanup(env.stop)
        self.log = redirect_stdout(io.StringIO())
        self.log.__enter__()
        self.addCleanup(self.log.__exit__, None, None, None)

    def make_snapshot(self):
        recovery.backup(self.snapshot, self.base / "source.env", True)
        self.assertTrue((self.snapshot / "COMPLETE").is_file())

    def attempt_restore(self):
        recovery.restore(self.snapshot, self.base / "restore.env", PROJECT)

    def writes(self):
        return [
            args
            for args in self.sim.events
            if args[:2] == ["docker", "run"]
            or (
                args[:2] == ["docker", "compose"]
                and any(op in args for op in ("stop", "up", "create", "exec"))
            )
        ]

    def test_backup_is_consistent_and_exports_existing_volume_read_only(self):
        self.make_snapshot()
        manifest = recovery.verify_snapshot(self.snapshot)
        self.assertEqual(manifest["images"]["backend"], "sha256:backend")
        self.assertFalse(self.sim.running["source-backend"])
        self.assertFalse(self.sim.running["source-caddy"])
        self.assertTrue(self.sim.running["source-db"])
        with tarfile.open(self.snapshot / "private_uploads.tar") as archive:
            self.assertEqual(
                archive.extractfile(".restore_canary_task11").read(), CANARY
            )
        with tarfile.open(self.snapshot / "source.tar") as archive:
            self.assertNotIn("backend/.env", archive.getnames())
        self.assertEqual(
            len((self.snapshot / "SHA256SUMS").read_text().splitlines()),
            len(recovery.FILES),
        )

    def test_missing_original_volumes_fail_before_stopping_or_creating(self):
        for name in ("pg_data", "private_uploads"):
            with self.subTest(volume=name):
                self.sim.volumes.discard(f"furgoplus-demo_{name}")
                with self.assertRaises(subprocess.CalledProcessError):
                    recovery.backup(self.snapshot, self.base / "source.env", True)
                self.assertFalse(self.writes())
                self.assertFalse(self.snapshot.exists())
                self.sim.volumes = {
                    v["name"] for v in self.sim.source["volumes"].values()
                }
                self.sim.events.clear()

    def test_disappearing_volume_never_creates_a_replacement(self):
        self.sim.disappear_after_stop = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.make_snapshot()
        self.assertFalse(any(args[:2] == ["docker", "run"] for args in self.sim.events))
        self.assertFalse((self.snapshot / "COMPLETE").exists())

    def test_backup_requires_external_writers_acknowledgement(self):
        with self.assertRaises(ValueError):
            recovery.backup(self.snapshot, self.base / "source.env", False)
        self.assertFalse(self.sim.events)

    def test_helper_image_cannot_create_implicit_anonymous_volumes(self):
        self.sim.anonymous_volumes = '{"/data": {}}'
        with self.assertRaises(ValueError):
            self.make_snapshot()
        self.assertFalse(self.writes())
        self.assertFalse(self.snapshot.exists())

    def test_existing_snapshot_and_repository_path_are_refused(self):
        for path in (self.base, self.repo / "snapshot"):
            with self.assertRaises(ValueError):
                recovery.backup(path, self.base / "source.env", True)
        self.assertFalse(self.sim.events)

    def test_running_writer_after_stop_aborts_before_dump(self):
        self.sim.still_running = True
        with self.assertRaises(ValueError):
            self.make_snapshot()
        self.assertFalse(any("pg_dump" in args[-1] for args in self.sim.events))

    def test_partial_backups_have_no_complete_marker_and_do_not_restart(self):
        for failure in ("dump", "export", "list"):
            with self.subTest(failure=failure):
                self.snapshot = self.base / failure
                self.sim.fail = failure
                with self.assertRaises(subprocess.CalledProcessError):
                    self.make_snapshot()
                self.assertFalse((self.snapshot / "COMPLETE").exists())
                self.assertFalse(self.sim.running["source-backend"])
                self.assertFalse(
                    any(
                        "start" in args or "rm" in args or "down" in args
                        for args in self.sim.events
                    )
                )

    def test_fresh_restore_uses_one_canonical_backend_and_no_static_ip_one_off(self):
        self.make_snapshot()
        self.sim.events.clear()
        self.attempt_restore()
        self.check_port.assert_called_once_with(18081)
        self.assertTrue(self.sim.running["target-db"])
        self.assertFalse(self.sim.running["target-backend"])
        self.assertNotIn("target-caddy", self.sim.running)
        for args in self.writes():
            if args[:2] == ["docker", "compose"]:
                self.assertEqual(self.sim.project(args), PROJECT)
                self.assertNotIn("run", args)
                self.assertNotIn("start", args)

    def test_existing_target_containers_volumes_and_networks_are_refused(self):
        self.make_snapshot()
        for resource in ("container", "pg_data", "private_uploads", "network"):
            with self.subTest(resource=resource):
                self.sim.events.clear()
                self.sim.extra_containers = (
                    "existing" if resource == "container" else ""
                )
                self.sim.volumes = {
                    v["name"] for v in self.sim.source["volumes"].values()
                }
                if resource in ("pg_data", "private_uploads"):
                    self.sim.volumes.add(f"{PROJECT}_{resource}")
                self.sim.network_name = (
                    f"{PROJECT}_proxy"
                    if resource == "network"
                    else "furgoplus-demo_proxy"
                )
                with self.assertRaises(ValueError):
                    self.attempt_restore()
                self.assertFalse(self.writes())

    def test_source_subnet_overlapping_other_network_and_source_port_are_refused(self):
        self.make_snapshot()
        for resource in ("source-subnet", "other-network", "source-port"):
            with self.subTest(resource=resource):
                self.sim.events.clear()
                self.sim.target["networks"]["proxy"]["ipam"]["config"][0]["subnet"] = (
                    "172.30.82.0/29"
                )
                self.sim.target["services"]["caddy"]["ports"][0]["published"] = "18081"
                self.sim.network_subnet = "172.30.81.0/29"
                if resource == "source-subnet":
                    self.sim.target["networks"]["proxy"]["ipam"]["config"][0][
                        "subnet"
                    ] = "172.30.81.0/24"
                elif resource == "other-network":
                    self.sim.network_subnet = "172.30.82.0/24"
                else:
                    self.sim.target["services"]["caddy"]["ports"][0]["published"] = (
                        "18080"
                    )
                with self.assertRaises(ValueError):
                    self.attempt_restore()
                self.assertFalse(self.writes())

    def test_busy_port_and_wrong_image_fail_before_target_creation(self):
        self.make_snapshot()
        self.sim.events.clear()
        self.check_port.side_effect = OSError("Synthetic busy port")
        with self.assertRaises(OSError):
            self.attempt_restore()
        self.assertFalse(self.writes())
        self.sim.mismatch_image = False
        self.sim.published_ports = "0.0.0.0:18081->80/tcp"
        with self.assertRaises(ValueError):
            self.attempt_restore()
        self.assertFalse(self.writes())
        self.check_port.side_effect = None
        self.sim.published_ports = "127.0.0.1:18080->8080/tcp"
        self.sim.mismatch_image = True
        with self.assertRaisesRegex(ValueError, "Restore images differ"):
            self.attempt_restore()
        self.assertFalse(self.writes())

    def test_incomplete_or_corrupt_snapshot_is_refused_before_docker_queries(self):
        self.make_snapshot()
        self.sim.events.clear()
        marker = self.snapshot / "COMPLETE"
        marker.unlink()
        with self.assertRaises(ValueError):
            self.attempt_restore()
        marker.write_text("FURGOPLUS_DEMO_SNAPSHOT_V1\n")
        (self.snapshot / "database.dump").write_bytes(b"corrupt synthetic dump")
        with self.assertRaises(ValueError):
            self.attempt_restore()
        self.assertFalse(self.sim.events)

    def test_checksum_path_injection_is_rejected(self):
        self.make_snapshot()
        (self.snapshot / "SHA256SUMS").write_text("0" * 64 + "  ../../outside\n")
        with self.assertRaises(ValueError):
            recovery.verify_snapshot(self.snapshot)

    def test_unsafe_private_archive_and_links_are_rejected(self):
        for name, kind in (
            ("../outside", tarfile.REGTYPE),
            ("/absolute", tarfile.REGTYPE),
            ("link", tarfile.SYMTYPE),
            ("device", tarfile.CHRTYPE),
        ):
            with self.subTest(name=name):
                path = self.base / "unsafe.tar"
                path.write_bytes(private_archive(name, kind))
                with self.assertRaises(ValueError):
                    recovery.archive_inventory(path)

    def test_failed_restore_preserves_partial_target_and_never_changes_source(self):
        self.make_snapshot()
        for failure in ("database-restore", "files-restore"):
            with self.subTest(failure=failure):
                self.sim.events.clear()
                self.sim.fail = failure
                self.sim.running = {
                    "source-db": True,
                    "source-backend": False,
                    "source-caddy": False,
                }
                self.sim.volumes = {
                    v["name"] for v in self.sim.source["volumes"].values()
                }
                with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                    self.attempt_restore()
                self.assertTrue(self.sim.running["target-db"])
                self.assertFalse(self.sim.running["target-backend"])
                self.assertFalse(
                    any(
                        "down" in args or "rm" in args or "stop" in args
                        for args in self.sim.events
                    )
                )

    def test_only_fresh_restore_names_and_local_daemon_are_allowed(self):
        for project in (
            "furgoplus-demo",
            "furgoplus",
            "fitfu",
            "furgoplus-demo-restore-",
        ):
            with self.assertRaises(ValueError):
                recovery.restore(self.snapshot, self.base / "restore.env", project)
        with patch.dict("os.environ", {"DOCKER_HOST": "tcp://synthetic:2375"}):
            with self.assertRaises(ValueError):
                recovery.backup(self.snapshot, self.base / "source.env", True)
        self.assertFalse(self.sim.events)

    def test_extraction_program_reproduces_canary_in_synthetic_directory(self):
        target = self.base / "synthetic-private"
        target.mkdir()
        self.make_snapshot()
        program = recovery.RESTORE_FILES.replace(
            "pathlib.Path('/private')", "pathlib.Path(" + repr(str(target)) + ")"
        )
        REAL_RESTORE_PRIVATE([recovery.sys.executable, "-c", program], self.snapshot)
        self.assertEqual((target / ".restore_canary_task11").read_bytes(), CANARY)
        # A second pass must refuse even identical existing files.
        with self.assertRaises(ValueError):
            REAL_RESTORE_PRIVATE(
                [recovery.sys.executable, "-c", program], self.snapshot
            )
        self.assertEqual((target / ".restore_canary_task11").read_bytes(), CANARY)


if __name__ == "__main__":
    unittest.main(verbosity=2)
