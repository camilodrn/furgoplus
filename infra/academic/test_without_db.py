"""Run with stdlib only: never import Django, connect, migrate or invoke Docker."""

import ast
import copy
import json
import os
import secrets
import stat
import sys
import tempfile
import unittest
from contextlib import nullcontext
from datetime import date
from io import StringIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "backend"))

import academic_boundary as boundary  # noqa: E402
import control  # noqa: E402
import provision  # noqa: E402


def function(name, namespace):
    """Execute the actual function AST without importing ORM/framework dependencies."""
    source = ast.parse((ROOT / "backend/drivers/academic_scenario.py").read_text())
    node = next(
        n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == name
    )
    exec(
        compile(ast.Module(body=[node], type_ignores=[]), str(source), "exec"),
        namespace,
    )
    return namespace[name]


def model():
    """Normalize checked-in source exactly where Compose uses its long syntax."""
    value = json.loads(control.COMPOSE.read_text())
    for name, service in value["services"].items():
        service["networks"] = {n: {} for n in service["networks"]}
        service["secrets"] = [
            {"source": n, "target": f"/run/secrets/{n}"}
            for n in service.get("secrets", [])
        ]
        service["volumes"] = {
            "db": [
                {
                    "type": "volume",
                    "source": "pg_data",
                    "target": "/var/lib/postgresql/data",
                },
                {
                    "type": "bind",
                    "source": str(HERE / "10-academic-identity.sh"),
                    "target": "/docker-entrypoint-initdb.d/10-academic-identity.sh",
                    "read_only": True,
                },
            ],
            "backend": [
                {
                    "type": "volume",
                    "source": "private_uploads",
                    "target": "/var/lib/furgoplus/private",
                }
            ],
            "web": [],
        }[name]
        service["ports"] = [
            {"host_ip": host, "published": port, "target": int(target)}
            for host, port, target in (
                binding.split(":") for binding in service.get("ports", [])
            )
        ]
        if "build" in service:
            service["build"]["context"] = str(ROOT)
    for name in value["secrets"]:
        value["secrets"][name]["file"] = str(Path("/private/academic") / name)
    return value


def effective_model():
    """Real Compose 5.5.1 capture; relocate host paths only for portable tests."""
    value = json.loads((HERE / "fixtures/compose-5.5.1.config.json").read_text())
    for name in ("backend", "web"):
        value["services"][name]["build"]["context"] = str(ROOT)
    for volume in value["services"]["db"]["volumes"]:
        if volume["type"] == "bind":
            volume["source"] = str(HERE / "10-academic-identity.sh")
    for name, secret in value["secrets"].items():
        secret["file"] = str(Path("/private/academic") / name)
    return value


class EffectiveComposeTests(unittest.TestCase):
    def test_source_does_not_override_image_startup(self):
        for name, service in json.loads(control.COMPOSE.read_text())[
            "services"
        ].items():
            with self.subTest(service=name):
                self.assertNotIn("command", service)
                self.assertNotIn("entrypoint", service)

    def test_real_compose_capture_with_null_startup_passes(self):
        value = effective_model()
        for service in value["services"].values():
            self.assertIn("command", service)
            self.assertIsNone(service["command"])
            self.assertIn("entrypoint", service)
            self.assertIsNone(service["entrypoint"])
        control.validate_model(value, Path("/private/academic"))

    def test_absent_and_null_combinations_keep_image_defaults(self):
        for command_present in (False, True):
            for entrypoint_present in (False, True):
                value = effective_model()
                for service in value["services"].values():
                    if not command_present:
                        service.pop("command")
                    if not entrypoint_present:
                        service.pop("entrypoint")
                with self.subTest(
                    command=command_present, entrypoint=entrypoint_present
                ):
                    control.validate_model(value, Path("/private/academic"))

    def test_empty_custom_and_invalid_startup_fail_on_real_capture(self):
        for name in ("backend", "db", "web"):
            for field in ("command", "entrypoint"):
                for override in (
                    "",
                    [],
                    " ",
                    "sh -c true",
                    ["sh", "-c", "true"],
                    [""],
                    False,
                    0,
                    {},
                ):
                    value = effective_model()
                    value["services"][name][field] = override
                    with self.subTest(service=name, field=field, value=override):
                        with self.assertRaises(ValueError):
                            control.validate_model(value, Path("/private/academic"))

    def test_other_guards_still_reject_changes_to_real_capture(self):
        mutations = (
            lambda m: m.update(name="furgoplus-task12"),
            lambda m: m["services"]["backend"]["environment"].update(
                ACADEMIC_PROJECT="furgoplus-demo"
            ),
            lambda m: m["services"]["backend"]["ports"][0].update(published="18080"),
            lambda m: m["services"]["web"]["ports"][0].update(host_ip="0.0.0.0"),
            lambda m: m["networks"]["database"].update(internal=False),
            lambda m: m["volumes"]["pg_data"].update(name="furgoplus-task12_pg_data"),
            lambda m: m["secrets"]["db_password"].update(file="/r4/db_password"),
            lambda m: m["services"]["backend"]["secrets"][0].update(target="renamed"),
        )
        for index, mutate in enumerate(mutations):
            value = effective_model()
            mutate(value)
            with self.subTest(mutation=index), self.assertRaises(ValueError):
                control.validate_model(value, Path("/private/academic"))


class TopologyTests(unittest.TestCase):
    def valid(self, value):
        control.validate_model(value, Path("/private/academic"))

    def test_exclusive_topology(self):
        self.valid(model())

    def test_compose_secret_targets_accept_only_equivalent_forms(self):
        for form in ("omitted", "name", "absolute"):
            value = model()
            for service in value["services"].values():
                for secret in service.get("secrets", []):
                    if form == "omitted":
                        secret.pop("target")
                    elif form == "name":
                        secret["target"] = secret["source"]
            with self.subTest(form=form):
                self.valid(value)

    def test_foreign_renamed_or_redirected_service_secrets_fail(self):
        for name in ("db", "backend"):
            for target in (
                "renamed",
                "/run/secrets/renamed",
                "/tmp/db_password",
                "/run/secrets/../db_password",
                "/run/secrets//db_password",
                "./db_password",
                "../db_password",
                "",
                None,
            ):
                value = model()
                value["services"][name]["secrets"][0]["target"] = target
                with (
                    self.subTest(name=name, target=target),
                    self.assertRaisesRegex(
                        ValueError, "Secretos heredados o renombrados"
                    ),
                ):
                    self.valid(value)
            value = model()
            value["services"][name]["secrets"][0]["source"] = "demo_db_password"
            with (
                self.subTest(name=name, source="foreign"),
                self.assertRaises(ValueError),
            ):
                self.valid(value)

    def test_missing_extra_duplicate_or_swapped_service_secrets_fail(self):
        for name in ("db", "backend", "web"):
            for change in ("missing", "extra", "duplicate", "swapped"):
                value = model()
                service_secrets = value["services"][name]["secrets"]
                if change == "extra":
                    service_secrets.append({"source": "foreign", "target": "foreign"})
                elif not service_secrets:
                    continue
                elif change == "missing":
                    service_secrets.pop()
                elif change == "duplicate":
                    service_secrets.append(copy.deepcopy(service_secrets[0]))
                else:
                    service_secrets[0]["target"] = service_secrets[1]["target"]
                with (
                    self.subTest(name=name, change=change),
                    self.assertRaises(ValueError),
                ):
                    self.valid(value)

    def test_foreign_secret_files_and_external_resources_fail(self):
        for name in model()["secrets"]:
            for change in (
                {"file": f"/r4/{name}"},
                {"file": f"/private/academic-other/{name}"},
                {"file": f"/private/academic/../academic/{name}"},
                {"file": "/private/academic/renamed"},
                {"external": True},
            ):
                value = model()
                value["secrets"][name].update(change)
                with (
                    self.subTest(name=name, change=change),
                    self.assertRaises(ValueError),
                ):
                    self.valid(value)

    def test_source_ports_and_origins_are_exact(self):
        services = json.loads(control.COMPOSE.read_text())["services"]
        self.assertEqual(services["backend"]["ports"], ["127.0.0.1:18082:8000"])
        self.assertEqual(services["web"]["ports"], ["127.0.0.1:15173:5173"])
        self.assertFalse(services["db"].get("ports"))
        self.assertEqual(boundary.API_ORIGIN, "http://127.0.0.1:18082")
        self.assertEqual(boundary.WEB_ORIGIN, "http://127.0.0.1:15173")
        environment = services["backend"]["environment"]
        self.assertEqual(environment["API_PUBLIC_ORIGIN"], boundary.API_ORIGIN)
        self.assertEqual(environment["WEB_PUBLIC_ORIGIN"], boundary.WEB_ORIGIN)

    def test_legacy_and_unauthorized_published_ports_fail(self):
        for name, allowed in (("backend", "18082"), ("web", "15173")):
            for port in (
                "18080",
                "18081",
                "8000",
                "5173",
                "5432",
                "18083",
                "80",
                "443",
                "18080-18090",
                "18082",
                "15173",
            ):
                if port == allowed:
                    continue
                value = model()
                value["services"][name]["ports"][0]["published"] = port
                with self.subTest(name=name, port=port), self.assertRaises(ValueError):
                    self.valid(value)

    def test_missing_ports_wrong_targets_and_udp_fail(self):
        for name in ("backend", "web"):
            for change in ({"target": 5432}, {"protocol": "udp"}):
                value = model()
                value["services"][name]["ports"][0].update(change)
                with (
                    self.subTest(name=name, change=change),
                    self.assertRaises(ValueError),
                ):
                    self.valid(value)
            value = model()
            value["services"][name]["ports"] = []
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.valid(value)

    def test_merged_ports_fail(self):
        for service, port, target in (
            ("backend", 8000, 8000),
            ("backend", 18080, 8000),
            ("backend", 18081, 8000),
            ("web", 5173, 5173),
        ):
            with self.subTest(service=service, port=port):
                value = model()
                value["services"][service]["ports"].append(
                    {"host_ip": "127.0.0.1", "published": str(port), "target": target}
                )
                with self.assertRaises(ValueError):
                    self.valid(value)

    def test_lan_db_ports_and_wrong_destinations_fail(self):
        for name in ("backend", "web"):
            for host in ("0.0.0.0", "::", "::1", "192.0.2.10", None):
                value = model()
                value["services"][name]["ports"][0]["host_ip"] = host
                with self.subTest(name=name, host=host), self.assertRaises(ValueError):
                    self.valid(value)
        value = model()
        value["services"]["db"]["ports"] = [{"target": 5432, "published": "5432"}]
        with self.assertRaises(ValueError):
            self.valid(value)

    def test_foreign_volumes_networks_secrets_environment_fail(self):
        mutations = [
            lambda m: m.update(name="furgoplus-task12"),
            lambda m: m["volumes"]["pg_data"].update(name="furgoplus-task12_pg_data"),
            lambda m: m["volumes"]["pg_data"].update(external=True),
            lambda m: m["networks"]["database"].update(internal=False),
            lambda m: m["networks"]["frontend"].update(external=True),
            lambda m: m["secrets"]["db_password"].update(file="/r4/secret"),
            lambda m: m["services"]["backend"]["environment"].update(
                DB_NAME="furgoplus"
            ),
            lambda m: m["services"]["backend"]["environment"].update(
                DB_PASSWORD="forbidden"
            ),
            lambda m: m["services"]["backend"].update(network_mode="host"),
            lambda m: m["services"]["backend"]["volumes"].append(
                {"type": "bind", "source": "/r4", "target": "/app"}
            ),
        ]
        for mutate in mutations:
            value = model()
            mutate(value)
            with self.subTest(mutation=mutate), self.assertRaises(ValueError):
                self.valid(value)

    def test_runtime_db_container(self):
        value = {
            "Config": {
                "Labels": {
                    "com.docker.compose.project": boundary.PROJECT,
                    "com.docker.compose.service": "db",
                }
            },
            "State": {"Running": True},
            "Mounts": [
                {
                    "Destination": "/var/lib/postgresql/data",
                    "Type": "volume",
                    "Name": boundary.PROJECT + "_pg_data",
                }
            ],
            "HostConfig": {"PortBindings": {}},
            "NetworkSettings": {"Networks": {boundary.PROJECT + "_database": {}}},
        }
        control.validate_db_container(value)
        for mutate in (
            lambda m: m["Config"]["Labels"].update(
                {"com.docker.compose.project": "furgoplus-task12"}
            ),
            lambda m: m["Mounts"][0].update(Name="furgoplus-demo_pg_data"),
            lambda m: m["HostConfig"].update(PortBindings={"5432/tcp": []}),
            lambda m: m["State"].update(Running=False),
        ):
            candidate = copy.deepcopy(value)
            mutate(candidate)
            with self.assertRaises(ValueError):
                control.validate_db_container(candidate)


class ControlPreflightTests(unittest.TestCase):
    def check_config(
        self,
        *,
        changed_path=None,
        uid=None,
        permissions=None,
        symlink=False,
        timestamp=0,
        reject=False,
        action="config",
        existing_resource=None,
    ):
        root = Path("/private/academic")

        def metadata(path):
            mode = (
                0o700
                if path == root
                else (0o644 if path.name == "academic_identity" else 0o600)
            )
            if path == changed_path and permissions is not None:
                mode = permissions
            return SimpleNamespace(
                st_uid=uid if path == changed_path and uid is not None else os.getuid(),
                st_mode=(stat.S_IFDIR if path == root else stat.S_IFREG) | mode,
                st_ctime_ns=timestamp,
                st_mtime_ns=timestamp,
            )

        responses = [SimpleNamespace(stdout=json.dumps(effective_model()))]
        if existing_resource:
            for suffix in ("pg_data", "private_uploads", "database", "frontend"):
                if suffix == existing_resource:
                    responses.append(
                        SimpleNamespace(
                            returncode=0,
                            stdout=json.dumps(
                                [{"Name": f"{control.PROJECT}_{suffix}"}]
                            ),
                        )
                    )
                    break
                responses.extend(
                    [
                        SimpleNamespace(returncode=1, stderr="no such resource"),
                        SimpleNamespace(returncode=0),
                    ]
                )
        output = StringIO()
        with (
            patch.object(control, "directory", return_value=root),
            patch.object(Path, "lstat", autospec=True, side_effect=metadata),
            patch.object(
                Path,
                "is_symlink",
                autospec=True,
                side_effect=lambda path: path == changed_path and symlink,
            ),
            patch.object(
                control.subprocess,
                "run",
                side_effect=responses,
            ) as compose,
            patch.object(sys, "argv", ["control.py", action]),
            patch.object(sys, "stdout", output),
        ):
            if existing_resource:
                with self.assertRaisesRegex(ValueError, "Recurso existente"):
                    control.command()
                self.assertEqual(
                    compose.call_args.args[0][-1],
                    f"{control.PROJECT}_{existing_resource}",
                )
                self.assertFalse(any("up" in c.args[0] for c in compose.call_args_list))
            elif reject:
                with self.assertRaisesRegex(ValueError, "propietario actual"):
                    control.command()
                compose.assert_not_called()
            else:
                control.command()
                compose.assert_called_once()
                self.assertEqual(
                    compose.call_args.args[0][-3:], ["config", "--format", "json"]
                )
                self.assertEqual(
                    compose.call_args.kwargs["env"]["ACADEMIC_SECRETS_DIR"], str(root)
                )
                if action == "config":
                    self.assertIn(
                        "Compose validado: API 127.0.0.1:18082", output.getvalue()
                    )

    def test_test_action_validates_config_then_returns_without_compose_run(self):
        with patch.object(control, "run_sqlite_tests") as run_tests:
            self.check_config(action="test")
            run_tests.assert_called_once()

    def test_create_still_rejects_each_preexisting_academic_resource(self):
        for suffix in ("pg_data", "private_uploads", "database", "frontend"):
            with self.subTest(resource=suffix):
                self.check_config(action="create", existing_resource=suffix)

    def test_config_accepts_absolute_targets_independently_of_timestamps(self):
        # No secret files are read and subprocess.run is mocked; no Docker is run.
        for timestamp in (0, 1_700_000_000_000_000_000):
            with self.subTest(timestamp=timestamp):
                self.check_config(timestamp=timestamp)

    def test_owner_permissions_and_symlinks_still_reject_before_compose(self):
        root = Path("/private/academic")
        for path in (root, *(root / name for name in model()["secrets"])):
            for change in (
                {"uid": os.getuid() + 1},
                {"permissions": 0o777},
                {"symlink": True},
            ):
                with self.subTest(path=path, change=change):
                    self.check_config(changed_path=path, reject=True, **change)


class IsolatedSQLiteTests(unittest.TestCase):
    def image(self):
        return {
            "Id": "sha256:" + "a" * 64,
            "Config": {
                "Labels": {
                    "com.docker.compose.project": control.PROJECT,
                    "com.docker.compose.service": "backend",
                },
                "Volumes": None,
            },
        }

    def test_runs_real_django_suite_without_compose_mounts_or_published_ports(self):
        image = self.image()
        with patch.object(
            control.subprocess,
            "run",
            side_effect=[
                SimpleNamespace(stdout=json.dumps([image])),
                SimpleNamespace(returncode=0),
            ],
        ) as run:
            control.run_sqlite_tests({"TASK12_TEST_POSTGRES": "true"})
        inspect, execution = [c.args[0] for c in run.call_args_list]
        self.assertEqual(
            inspect, ["docker", "image", "inspect", f"{control.PROJECT}-backend"]
        )
        self.assertEqual(execution[:3], ["docker", "run", "--rm"])
        for flag, value in (
            ("--network", "none"),
            ("--pull", "never"),
            ("--entrypoint", "python"),
            ("--user", "65534:65534"),
        ):
            self.assertEqual(execution[execution.index(flag) + 1], value)
        self.assertIn("--read-only", execution)
        self.assertIn("--no-healthcheck", execution)
        self.assertIn("DJANGO_SETTINGS_MODULE=config.settings_task12_tests", execution)
        self.assertIn("TASK12_TEST_POSTGRES=false", execution)
        self.assertEqual(
            execution[-7:],
            [
                "python",
                image["Id"],
                "manage.py",
                "test",
                "drivers.test_academic_scenario",
                "--verbosity",
                "2",
            ],
        )
        for forbidden in (
            "compose",
            "--mount",
            "--volume",
            "-v",
            "-p",
            "--publish",
            "--env-file",
            "--volumes-from",
            "--keepdb",
        ):
            self.assertNotIn(forbidden, execution)
        self.assertFalse(any("/run/secrets" in arg for arg in execution))

    def test_foreign_images_or_declared_volumes_stop_before_container_creation(self):
        for change in ("project", "service", "id", "volumes"):
            image = self.image()
            if change == "id":
                image["Id"] = "mutable-tag"
            elif change == "volumes":
                image["Config"]["Volumes"] = {"/data": {}}
            else:
                image["Config"]["Labels"][f"com.docker.compose.{change}"] = "foreign"
            with (
                self.subTest(change=change),
                patch.object(
                    control.subprocess,
                    "run",
                    return_value=SimpleNamespace(stdout=json.dumps([image])),
                ) as run,
            ):
                with self.assertRaises(ValueError):
                    control.run_sqlite_tests({})
                run.assert_called_once()

    def test_inspection_failure_never_runs_a_container(self):
        with patch.object(control.subprocess, "run", side_effect=OSError) as run:
            with self.assertRaises(OSError):
                control.run_sqlite_tests({})
            run.assert_called_once()


class BoundaryTests(unittest.TestCase):
    def config(self):
        return dict(
            module=boundary.SETTINGS,
            environment="academic",
            project=boundary.PROJECT,
            debug=True,
            demo=True,
            engine="django.db.backends.postgresql",
            database=boundary.DATABASE,
            user=boundary.ROLE,
            host="db",
            port="5432",
            api_origin=boundary.API_ORIGIN,
            web_origin=boundary.WEB_ORIGIN,
        )

    def test_exact_config(self):
        boundary.verify_configuration(
            self.config(), boundary.PROJECT, boundary.DATABASE
        )

    def test_legacy_and_unauthorized_origins_fail(self):
        for key in ("api_origin", "web_origin"):
            for origin in (
                "http://127.0.0.1:18080",
                "http://127.0.0.1:18081",
                "http://127.0.0.1:8000",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:18083",
                "http://0.0.0.0:18082",
                "http://localhost:18082",
            ):
                value = self.config()
                value[key] = origin
                with (
                    self.subTest(key=key, origin=origin),
                    self.assertRaises(ValueError),
                ):
                    boundary.verify_configuration(
                        value, boundary.PROJECT, boundary.DATABASE
                    )
                candidate = model()
                env_key = key.upper().replace("_ORIGIN", "_PUBLIC_ORIGIN")
                candidate["services"]["backend"]["environment"][env_key] = origin
                with (
                    self.subTest(compose=key, origin=origin),
                    self.assertRaises(ValueError),
                ):
                    control.validate_model(candidate, Path("/private/academic"))

    def test_academic_settings_origin_guard_without_secrets_or_django(self):
        source = ast.parse((ROOT / "backend/config/settings_academic.py").read_text())
        required = next(
            n
            for n in source.body
            if isinstance(n, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "_required" for t in n.targets)
        )
        guard = next(n for n in source.body if isinstance(n, ast.If))
        code = compile(
            ast.Module(body=[required, guard], type_ignores=[]),
            "settings_academic origin guard",
            "exec",
        )
        environment = model()["services"]["backend"]["environment"]
        namespace = {
            "os": SimpleNamespace(environ=environment),
            "ImproperlyConfigured": ValueError,
            **{
                key: getattr(boundary, key)
                for key in ("PROJECT", "DATABASE", "ROLE", "API_ORIGIN", "WEB_ORIGIN")
            },
        }
        exec(code, namespace)
        for key, value in (
            ("API_PUBLIC_ORIGIN", "http://127.0.0.1:18080"),
            ("API_PUBLIC_ORIGIN", "http://127.0.0.1:18081"),
            ("API_PUBLIC_ORIGIN", "http://127.0.0.1:8000"),
            ("API_PUBLIC_ORIGIN", "http://0.0.0.0:18082"),
            ("WEB_PUBLIC_ORIGIN", "http://127.0.0.1:5173"),
        ):
            namespace["os"] = SimpleNamespace(environ={**environment, key: value})
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                exec(code, namespace)

    def test_each_identity_component_is_mandatory(self):
        for key in self.config():
            value = self.config()
            value[key] = "unknown"
            with self.subTest(key=key), self.assertRaises(ValueError):
                boundary.verify_configuration(
                    value, boundary.PROJECT, boundary.DATABASE
                )

    def test_r4_task12_production_unknown_rejected(self):
        for database in (
            "r4",
            "furgoplus",
            "furgoplus-task12",
            "production",
            "postgres",
            "unknown",
        ):
            with self.subTest(database=database), self.assertRaises(ValueError):
                boundary.verify_configuration(self.config(), boundary.PROJECT, database)

    def test_server_marker_roles_owner_port_and_database(self):
        identity = secrets.token_hex(32)
        row = (
            boundary.DATABASE,
            boundary.ROLE,
            boundary.ROLE,
            boundary.ROLE,
            5432,
            boundary.VERSION + ":" + identity,
        )
        boundary.verify_server(row, identity)
        for index in range(len(row)):
            candidate = list(row)
            candidate[index] = "other"
            with self.subTest(index=index), self.assertRaises(ValueError):
                boundary.verify_server(candidate, identity)
        with self.assertRaises(ValueError):
            boundary.verify_server(row, secrets.token_hex(32))


class SchemaTests(unittest.TestCase):
    def namespace(self, *, tables=None, occupied=False, plans=None):
        cursor = Mock()
        cursor.fetchone.return_value = [occupied]
        context = Mock()
        context.__enter__ = Mock(return_value=cursor)
        context.__exit__ = Mock(return_value=False)
        connection = SimpleNamespace(
            vendor="sqlite",
            introspection=SimpleNamespace(
                table_names=lambda **kwargs: tables or ["accounts_user", "drivers_plan"]
            ),
            cursor=lambda: context,
            ops=SimpleNamespace(quote_name=lambda name: '"' + name + '"'),
        )
        return {
            "connection": connection,
            "CommandError": ValueError,
            "table_models": lambda: {
                "accounts_user": object(),
                "drivers_plan": object(),
            },
            "AdminActionLog": SimpleNamespace(
                _meta=SimpleNamespace(db_table="drivers_adminactionlog")
            ),
            "BASELINE_TABLES": {
                "django_migrations",
                "django_content_type",
                "auth_permission",
                "drivers_plan",
            },
            "Plan": SimpleNamespace(
                objects=SimpleNamespace(
                    values_list=lambda *args: plans
                    if plans is not None
                    else [("basic", "Basic"), ("pro", "Pro"), ("elite", "Elite")]
                )
            ),
        }

    def test_migration_only_database_is_allowed(self):
        self.assertIsNone(function("check_schema", self.namespace())(migrated=False))

    def test_unknown_table_denied(self):
        with self.assertRaises(ValueError):
            function("check_schema", self.namespace(tables=["foreign"]))(migrated=False)

    def test_any_business_row_denied_without_manifest(self):
        with self.assertRaises(ValueError):
            function("check_schema", self.namespace(occupied=True))(migrated=False)

    def test_modified_or_missing_catalogue_denied(self):
        for plans in ([], [("basic", "Changed")]):
            with self.subTest(plans=plans), self.assertRaises(ValueError):
                function("check_schema", self.namespace(plans=plans))(migrated=False)

    def test_foreign_postgres_schema_denied(self):
        namespace = self.namespace()
        namespace["connection"].vendor = "postgresql"
        namespace["connection"].cursor().__enter__().fetchall.return_value = [
            ("public",),
            ("foreign_schema",),
        ]
        with self.assertRaises(ValueError):
            function("check_schema", namespace)(migrated=False)


class ProvisionTests(unittest.TestCase):
    def test_fresh_private_unique_files_without_secret_output(self):
        with tempfile.TemporaryDirectory(prefix="academic-secret-test-") as temporary:
            root = Path(temporary) / "private"
            output = StringIO()
            with (
                patch.object(provision, "directory", return_value=root),
                patch("builtins.input", return_value=boundary.PROJECT),
                patch.object(provision.getpass, "getpass", return_value=""),
                patch.object(provision.sys.stdin, "isatty", return_value=True),
                patch.object(provision.sys.stderr, "isatty", return_value=True),
                patch.object(provision.sys, "stdout", output),
            ):
                provision.main()
                files = list(root.iterdir())
                values = [p.read_text().strip() for p in files]
                self.assertEqual(len(files), 3)
                self.assertEqual(len(set(values)), 3)
                self.assertTrue(all(len(value) == 64 for value in values))
                self.assertTrue(all(value not in output.getvalue() for value in values))
                self.assertEqual(root.stat().st_mode & 0o777, 0o700)
                for path in files:
                    expected = 0o644 if path.name == "academic_identity" else 0o600
                    self.assertEqual(path.stat().st_mode & 0o777, expected)
                with self.assertRaises(ValueError):
                    provision.main()
                self.assertTrue(values == [p.read_text().strip() for p in files])

    def test_noninteractive_provision_is_denied_before_files(self):
        with patch.object(provision.sys.stdin, "isatty", return_value=False):
            with self.assertRaises(ValueError):
                provision.main()


class OrchestratorTests(unittest.TestCase):
    def setUp(self):
        self.ns = {
            "identity": Mock(),
            "readonly": nullcontext,
            "check_schema": Mock(return_value=None),
            "initial_day": Mock(return_value=date(2026, 10, 25)),
            "passwords": Mock(),
            "seed": Mock(),
            "CommandError": ValueError,
            "transaction": SimpleNamespace(atomic=nullcontext),
            "lock_tables": Mock(),
        }
        self.prepare = function("prepare", self.ns)

    def test_dry_run_no_credentials_no_seed(self):
        self.assertIn("DRY-RUN", self.prepare(boundary.PROJECT, boundary.DATABASE))
        self.ns["passwords"].assert_not_called()
        self.ns["seed"].assert_not_called()
        self.ns["lock_tables"].assert_not_called()

    def test_repeat_is_noop_even_apply_or_november(self):
        self.ns["check_schema"].return_value = object()
        for apply in (False, True):
            self.assertIn(
                "sin cambios",
                self.prepare(boundary.PROJECT, boundary.DATABASE, apply=apply),
            )
        self.ns["passwords"].assert_not_called()
        self.ns["initial_day"].assert_not_called()
        self.ns["seed"].assert_not_called()

    def test_wrong_identity_stops_before_schema_or_passwords(self):
        self.ns["identity"].side_effect = ValueError("denied")
        with self.assertRaises(ValueError):
            self.prepare(boundary.PROJECT, boundary.DATABASE, apply=True)
        self.ns["check_schema"].assert_not_called()
        self.ns["passwords"].assert_not_called()

    def test_nonempty_or_unknown_schema_stops_before_credentials(self):
        self.ns["check_schema"].side_effect = ValueError("nonempty")
        with self.assertRaises(ValueError):
            self.prepare(boundary.PROJECT, boundary.DATABASE, apply=True)
        self.ns["passwords"].assert_not_called()
        self.ns["seed"].assert_not_called()

    def test_apply_rechecks_and_clears_credentials(self):
        credentials = {"email": secrets.token_urlsafe(32)}
        self.ns["passwords"].return_value = credentials
        self.assertIn(
            "preparado", self.prepare(boundary.PROJECT, boundary.DATABASE, apply=True)
        )
        self.assertEqual(self.ns["identity"].call_count, 2)
        self.assertEqual(self.ns["check_schema"].call_count, 2)
        self.ns["seed"].assert_called_once()
        self.assertEqual(credentials, {})

    def test_race_with_other_seed_does_not_write(self):
        credentials = {"email": secrets.token_urlsafe(32)}
        self.ns["passwords"].return_value = credentials
        self.ns["check_schema"].side_effect = [None, object()]
        self.assertIn(
            "sin cambios", self.prepare(boundary.PROJECT, boundary.DATABASE, apply=True)
        )
        self.ns["seed"].assert_not_called()
        self.assertEqual(credentials, {})

    def test_real_october_only(self):
        ns = {
            "timezone": SimpleNamespace(localdate=lambda: date(2026, 10, 25)),
            "CommandError": ValueError,
        }
        day = function("initial_day", ns)
        self.assertEqual(day(), date(2026, 10, 25))
        for date_value in (date(2026, 11, 4), date(2026, 9, 30), date(2027, 10, 25)):
            ns["timezone"].localdate = lambda d=date_value: d
            with self.assertRaises(ValueError):
                day()

    def test_secrets_are_not_provisioned_without_tty(self):
        getter = Mock()
        ns = {
            "sys": SimpleNamespace(stdin=SimpleNamespace(isatty=lambda: False)),
            "CommandError": ValueError,
            "getpass": SimpleNamespace(getpass=getter),
        }
        with self.assertRaises(ValueError):
            function("passwords", ns)()
        getter.assert_not_called()


def load_tests(loader, tests, pattern):
    tests.addTests(loader.loadTestsFromName("test_resource_recovery"))
    return tests


if __name__ == "__main__":
    unittest.main(verbosity=2)
