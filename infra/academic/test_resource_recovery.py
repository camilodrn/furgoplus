"""Recovery guard tests. Docker calls are simulated; temp directory checks are real."""

import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import audit_test_resources as recovery


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.volumes = {}
        self.networks = {}
        for kind, suffixes in (
            ("volume", recovery.VOLUMES),
            ("network", recovery.NETWORKS),
        ):
            for index, suffix in enumerate(suffixes):
                name = f"{recovery.PROJECT}_{suffix}"
                value = {
                    "Name": name,
                    "Driver": "local" if kind == "volume" else "bridge",
                    "Scope": "local",
                    "Options": {},
                    "Labels": {
                        "com.docker.compose.project": recovery.PROJECT,
                        f"com.docker.compose.{kind}": suffix,
                        "com.docker.compose.version": "5.5.1",
                    },
                }
                if kind == "volume":
                    value.update(
                        Mountpoint=f"/var/lib/docker/volumes/{name}/_data",
                        CreatedAt="2026-10-26T12:00:00Z",
                    )
                    self.volumes[name] = value
                else:
                    value.update(
                        Id=str(index + 1) * 64,
                        Internal=suffix == "database",
                        Containers={},
                        Created="2026-10-26T12:00:00Z",
                    )
                    self.networks[name] = value

    def docker(self, *args):
        if args == ("context", "inspect"):
            return json.dumps(
                [{"Endpoints": {"docker": {"Host": "unix:///var/run/docker.sock"}}}]
            )
        if args[0] == "info":
            return json.dumps(
                {
                    "root": "/var/lib/docker",
                    "id": "daemon-1",
                    "os": "linux",
                    "name": os.uname().nodename,
                    "kernel": os.uname().release,
                    "operating_system": "Fedora Linux",
                }
            )
        if args[0] == "ps":
            return ""
        resources = self.volumes if args[0] == "volume" else self.networks
        if args[1] == "ls":
            return "\n".join(resources)
        if args[1] == "inspect":
            return json.dumps([resources[args[2]]])
        raise AssertionError("Unexpected Docker command")

    def snapshot(self):
        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(recovery, "docker", side_effect=self.docker),
        ):
            return recovery.snapshot()

    def test_exact_empty_unattached_resources_can_be_audited(self):
        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(recovery, "docker", side_effect=self.docker),
            patch.object(recovery, "check_empty") as empty,
        ):
            state, digest = recovery.audit()
        self.assertEqual(len(state["volumes"]), 2)
        self.assertEqual(len(state["networks"]), 2)
        self.assertEqual(len(digest), 64)
        self.assertEqual(empty.call_count, 2)

    def test_foreign_names_labels_drivers_paths_and_endpoints_reject(self):
        for kind in ("volume", "network"):
            original = copy.deepcopy(
                self.volumes if kind == "volume" else self.networks
            )
            name = next(iter(original))
            for change in (
                "name",
                "project",
                "resource_label",
                "driver",
                "options",
                "scope",
            ):
                resources = copy.deepcopy(original)
                value = resources[name]
                if change == "name":
                    value["Name"] += "-other"
                elif change == "project":
                    value["Labels"]["com.docker.compose.project"] = "furgoplus-demo"
                elif change == "resource_label":
                    value["Labels"][f"com.docker.compose.{kind}"] = "foreign"
                else:
                    value[
                        {"driver": "Driver", "options": "Options", "scope": "Scope"}[
                            change
                        ]
                    ] = "foreign"
                setattr(self, kind + "s", resources)
                with (
                    self.subTest(kind=kind, change=change),
                    self.assertRaises(ValueError),
                ):
                    self.snapshot()
            setattr(self, kind + "s", original)
        name = next(iter(self.volumes))
        self.volumes[name]["Mountpoint"] = "/foreign/data"
        with self.assertRaises(ValueError):
            self.snapshot()
        with patch.dict(os.environ, {"DOCKER_HOST": "ssh://foreign"}, clear=True):
            with self.assertRaises(ValueError):
                recovery.snapshot()

    def test_remote_or_vm_daemon_cannot_validate_local_volume_directories(self):
        for change in (
            {"name": "docker-desktop"},
            {"kernel": "other-kernel"},
            {"operating_system": "Docker Desktop"},
            {"os": "windows"},
        ):

            def foreign(*args, change=change):
                raw = self.docker(*args)
                if args[0] == "info":
                    value = json.loads(raw)
                    value.update(change)
                    return json.dumps(value)
                return raw

            with (
                self.subTest(change=change),
                patch.dict(os.environ, {}, clear=True),
                patch.object(recovery, "docker", side_effect=foreign),
                self.assertRaises(ValueError),
            ):
                recovery.snapshot()

    def test_missing_or_additional_project_resources_reject(self):
        name = next(iter(self.volumes))
        value = self.volumes.pop(name)
        with self.assertRaises(ValueError):
            self.snapshot()
        self.volumes[name] = value
        self.volumes[name + "-other"] = value
        with self.assertRaises(ValueError):
            self.snapshot()

    def test_network_with_live_endpoint_or_wrong_internal_flag_rejects(self):
        name = next(iter(self.networks))
        self.networks[name]["Containers"] = {"container-id": {}}
        with self.assertRaises(ValueError):
            self.snapshot()
        self.networks[name]["Containers"] = {}
        self.networks[name]["Internal"] = False
        with self.assertRaises(ValueError):
            self.snapshot()

    def test_stopped_foreign_or_unlabelled_containers_with_references_reject(self):
        state = self.snapshot()
        empty = {
            "Config": {"Labels": {}},
            "Mounts": [],
            "NetworkSettings": {"Networks": {}},
            "HostConfig": {"NetworkMode": "none"},
            "State": {"Running": False},
        }
        cases = []
        project = copy.deepcopy(empty)
        project["Config"]["Labels"]["com.docker.compose.project"] = recovery.PROJECT
        cases.append(project)
        for volume in state["volumes"]:
            container = copy.deepcopy(empty)
            container["Mounts"] = [{"Type": "volume", "Name": volume["Name"]}]
            cases.append(container)
            container = copy.deepcopy(empty)
            container["Mounts"] = [{"Type": "bind", "Source": volume["Mountpoint"]}]
            cases.append(container)
        for network in state["networks"]:
            container = copy.deepcopy(empty)
            container["NetworkSettings"]["Networks"] = {
                network["Name"]: {"NetworkID": network["Id"]}
            }
            cases.append(container)
            container = copy.deepcopy(empty)
            container["HostConfig"]["NetworkMode"] = network["Id"]
            cases.append(container)
        for index, container in enumerate(cases):
            with self.subTest(case=index), self.assertRaises(ValueError):
                recovery.verify_no_containers([container], state)
        recovery.verify_no_containers([empty], state)

    def test_empty_check_accepts_only_completely_empty_real_directories(self):
        with tempfile.TemporaryDirectory(prefix="academic-recovery-test-") as directory:
            root = Path(directory)
            paths = [root / "pg", root / "private"]
            for path in paths:
                path.mkdir()
            state = {"volumes": [{"Mountpoint": str(path)} for path in paths]}
            recovery.check_empty(state)
            for name in (".hidden", "PG_VERSION", "payload"):
                file = paths[0] / name
                file.write_text("synthetic-test-only")
                with self.subTest(entry=name), self.assertRaises(ValueError):
                    recovery.check_empty(state)
                file.unlink()
            (paths[1] / "empty-subdirectory").mkdir()
            with self.assertRaises(ValueError):
                recovery.check_empty(state)

    def test_symlink_and_unreadable_or_missing_paths_never_count_as_empty(self):
        with tempfile.TemporaryDirectory(prefix="academic-recovery-test-") as directory:
            root = Path(directory)
            (root / "real").mkdir()
            (root / "link").symlink_to(root / "real", target_is_directory=True)
            for path in (root / "link", root / "missing"):
                with self.subTest(path=path), self.assertRaises(ValueError):
                    recovery.check_empty({"volumes": [{"Mountpoint": str(path)}]})

    def test_resource_race_or_changed_fingerprint_stops_without_plan(self):
        state = self.snapshot()
        changed = copy.deepcopy(state)
        changed["networks"][0]["Id"] = "f" * 64
        for states, expected in (([state, changed], None), ([state, state], "wrong")):
            with (
                patch.object(recovery, "snapshot", side_effect=states),
                patch.object(recovery, "check_containers"),
                patch.object(recovery, "check_empty"),
                self.assertRaises(ValueError),
            ):
                recovery.audit(expected=expected)

    def test_failed_audit_emits_no_deletion_plan(self):
        output = StringIO()
        with (
            patch.object(sys, "argv", ["audit", "--print-plan"]),
            patch.object(recovery, "audit", side_effect=ValueError("blocked")),
            patch.object(recovery, "print_plan") as plan,
            patch.object(sys, "stdout", output),
        ):
            with self.assertRaises(ValueError):
                recovery.main()
        plan.assert_not_called()
        self.assertEqual(output.getvalue(), "")

    def test_plan_only_prints_exact_ids_and_names_after_fingerprint_recheck(self):
        state = self.snapshot()
        output = StringIO()
        with (
            patch.object(sys, "stdout", output),
            patch.object(recovery.subprocess, "run") as run,
        ):
            recovery.print_plan(state, "a" * 64, True)
        run.assert_not_called()
        plan = output.getvalue()
        self.assertIn("--expect-fingerprint " + "a" * 64, plan)
        self.assertIn("--sudo-read-volumes", plan)
        self.assertIn("--host unix:///var/run/docker.sock", plan)
        self.assertIn("network rm -- " + "1" * 64 + " " + "2" * 64, plan)
        for suffix in recovery.VOLUMES:
            self.assertIn(f"{recovery.PROJECT}_{suffix}", plan)
        for forbidden in ("prune", "down", "--force", "furgoplus-demo"):
            self.assertNotIn(forbidden, plan)

    def test_docker_failure_is_not_treated_as_an_empty_inventory(self):
        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(
                recovery.subprocess,
                "run",
                side_effect=subprocess.CalledProcessError(1, "docker"),
            ),
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                recovery.snapshot()


if __name__ == "__main__":
    unittest.main(verbosity=2)
