"""Real domain/ORM/file tests in an isolated test DB, never the operator's DB."""

import secrets
import tempfile
from datetime import UTC, datetime
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.apps import apps
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from PIL import Image

from accounts.models import DriverProfile, User
from drivers.demo_scenario import ACCOUNTS, LABEL, VERSION, invoke, snapshot
from drivers.models import (
    AdminActionLog,
    ContactRequest,
    DriverDocument,
    DriverValidation,
    PassengerAssignment,
    PaymentRecord,
    Route,
    RouteRun,
)
from drivers.publication import publication_state
from drivers.publication_api import AdminSubscriptionView


@override_settings(
    DEMO_MODE=True, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
)
class DemoScenarioTests(TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="furgoplus-scenario-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / "private"
        override = override_settings(PRIVATE_UPLOAD_ROOT=self.root)
        override.enable()
        self.addCleanup(override.disable)
        self.admin_password = secrets.token_urlsafe(32)
        self.admin = User.objects.create_superuser(
            "admin-demo@example.test", self.admin_password
        )
        self.a = User.objects.create_user(
            ACCOUNTS[0][0], secrets.token_urlsafe(32), role="driver"
        )
        self.profile = DriverProfile.objects.create(
            user=self.a,
            display_name="Conductor Demo A original",
            service_summary="Resumen sintético Demo conservado",
            service_contact_email="contacto-demo-a@example.test",
        )

    def run_command(self, apply=False):
        output = StringIO()
        call_command(
            "prepare_demo_scenario", "--apply" if apply else "--dry-run", stdout=output
        )
        return output.getvalue()

    def apply(self):
        passwords = [
            secrets.token_urlsafe(32)
            for row in ACCOUNTS
            if not User.objects.filter(email=row[0]).exists()
        ]
        with (
            patch("drivers.demo_scenario.sys.stdin.isatty", return_value=True),
            patch(
                "drivers.demo_scenario.getpass.getpass",
                side_effect=[
                    value for password in passwords for value in (password, password)
                ],
            ),
        ):
            output = self.run_command(True)
        for password in passwords:
            self.assertNotIn(password, output)
        return output

    def counts(self):
        return {
            model._meta.label: model.objects.count()
            for label in ("accounts", "drivers")
            for model in apps.get_app_config(label).get_models()
        }

    def test_dry_run_has_no_writes_files_or_password_requests(self):
        before = self.counts()
        with (
            patch("drivers.demo_scenario.getpass.getpass") as prompt,
            patch("drivers.demo_scenario.png_document") as image,
        ):
            self.assertIn("DRY-RUN", self.run_command())
            prompt.assert_not_called()
            image.assert_not_called()
        self.assertEqual(self.counts(), before)
        self.assertFalse(self.root.exists())

    def test_initial_apply_transitions_and_second_apply_are_idempotent(self):
        a_hash, admin_hash = self.a.password, self.admin.password
        self.apply()
        self.profile.refresh_from_db()
        self.a.refresh_from_db()
        self.admin.refresh_from_db()
        self.assertEqual((self.a.password, self.admin.password), (a_hash, admin_hash))
        self.assertEqual(self.profile.display_name, "Conductor Demo A original")
        self.assertEqual(
            self.profile.service_summary, "Resumen sintético Demo conservado"
        )
        self.assertEqual(
            self.profile.service_contact_email, "contacto-demo-a@example.test"
        )
        for email in (ACCOUNTS[0][0], ACCOUNTS[1][0]):
            self.assertTrue(
                publication_state(DriverProfile.objects.get(user__email=email)).eligible
            )
        control = DriverProfile.objects.get(user__email=ACCOUNTS[2][0])
        self.assertEqual(control.validation_state, "pending")
        self.assertFalse(publication_state(control).eligible)
        self.assertEqual(DriverDocument.objects.count(), 9)
        self.assertEqual(DriverValidation.objects.filter(state="approved").count(), 2)
        self.assertEqual(
            AdminActionLog.objects.filter(
                action="validation_approved", actor=self.admin
            ).count(),
            2,
        )
        self.assertEqual(
            AdminActionLog.objects.filter(
                action="subscription_changed", actor=self.admin
            ).count(),
            2,
        )
        self.assertEqual(Route.objects.count(), 3)
        self.assertEqual(PassengerAssignment.objects.count(), 3)
        self.assertEqual(PaymentRecord.objects.get().status, "pending")
        self.assertEqual(ContactRequest.objects.filter(status="pending").count(), 1)
        self.assertEqual(ContactRequest.objects.filter(status="accepted").count(), 1)
        self.assertFalse(RouteRun.objects.exists())
        before, state, files = self.counts(), snapshot(), sorted(self.root.iterdir())
        with patch("drivers.demo_scenario.getpass.getpass") as prompt:
            self.assertIn("Sin cambios", self.run_command(True))
            prompt.assert_not_called()
        self.assertEqual(self.counts(), before)
        self.assertEqual(snapshot(), state)
        self.assertEqual(sorted(self.root.iterdir()), files)
        for row in DriverDocument.objects.all():
            with Image.open(self.root / row.storage_key) as image:
                self.assertEqual(image.info["Description"], LABEL)
                self.assertEqual(image.info["Scenario"], VERSION)
        self.assertFalse(User.objects.exclude(email__endswith="@example.test").exists())
        self.assertFalse(
            User.objects.exclude(pk=self.admin.pk).filter(is_staff=True).exists()
        )

    def test_unknown_existing_operations_conflict_before_any_changes(self):
        Route.objects.create(
            driver=self.profile,
            label="Ruta Demo anterior",
            status="inactive",
            weekdays=["monday"],
            start_time="07:00",
            end_time="08:00",
            seat_capacity=4,
            destination_label="Destino Demo",
            destination_address="Dirección ficticia",
        )
        before = self.counts()
        with (
            self.assertRaises(CommandError),
            patch("drivers.demo_scenario.getpass.getpass") as prompt,
        ):
            self.run_command(True)
        prompt.assert_not_called()
        self.assertEqual(self.counts(), before)

    def test_manual_changes_are_not_reset_or_duplicated(self):
        self.apply()
        contact = ContactRequest.objects.get(status="pending")
        contact.message = "Cambio ficticio posterior"
        contact.save(update_fields=["message"])
        before = self.counts()
        with self.assertRaises(CommandError):
            self.run_command(True)
        self.assertEqual(self.counts(), before)
        contact.refresh_from_db()
        self.assertEqual(contact.message, "Cambio ficticio posterior")

    def test_altered_file_is_not_overwritten(self):
        self.apply()
        file = self.root / DriverDocument.objects.first().storage_key
        file.write_bytes(b"synthetic altered file")
        with self.assertRaises(CommandError):
            self.run_command(True)
        self.assertEqual(file.read_bytes(), b"synthetic altered file")

    def test_invalid_actor_mode_account_or_real_email_is_rejected(self):
        for changes in ({"role": "parent"}, {"is_active": False}, {"is_staff": False}):
            original = {key: getattr(self.admin, key) for key in changes}
            for key, value in changes.items():
                setattr(self.admin, key, value)
            self.admin.save()
            with self.assertRaises(CommandError):
                self.run_command(True)
            for key, value in original.items():
                setattr(self.admin, key, value)
            self.admin.save()
        with override_settings(DEMO_MODE=False), self.assertRaises(CommandError):
            self.run_command(True)
        self.profile.service_contact_email = "example@real.example.com"
        self.profile.save()
        with self.assertRaises(CommandError):
            self.run_command(True)
        self.assertFalse(self.root.exists())
        # The adapter still enforces endpoint role permissions.
        with self.assertRaises(CommandError):
            invoke(AdminSubscriptionView, self.a, "post", {}, id=self.profile.pk)

    def test_reused_passwords_or_nonterminal_stop_before_writes(self):
        before = self.counts()
        with (
            patch("drivers.demo_scenario.sys.stdin.isatty", return_value=False),
            self.assertRaises(CommandError),
        ):
            self.run_command(True)
        with (
            patch("drivers.demo_scenario.sys.stdin.isatty", return_value=True),
            patch(
                "drivers.demo_scenario.getpass.getpass",
                return_value=self.admin_password,
            ),
            self.assertRaises(CommandError),
        ):
            self.run_command(True)
        self.assertEqual(self.counts(), before)

    def test_reuse_check_does_not_upgrade_or_write_existing_password_hash(self):
        original = self.admin.password
        with (
            override_settings(
                PASSWORD_HASHERS=[
                    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
                    "django.contrib.auth.hashers.MD5PasswordHasher",
                ]
            ),
            patch("drivers.demo_scenario.sys.stdin.isatty", return_value=True),
            patch(
                "drivers.demo_scenario.getpass.getpass",
                return_value=self.admin_password,
            ),
            self.assertRaises(CommandError),
        ):
            self.run_command(True)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.password, original)

    def test_domain_failure_rolls_back_new_accounts_files_and_audits(self):
        before = self.counts()
        original = self.a.password
        self.root.mkdir()
        canary = self.root / ".existing-synthetic-canary"
        canary.write_bytes(b"KEEP ORIGINAL SYNTHETIC FILE")
        with patch("drivers.demo_scenario.invoke", wraps=invoke) as calls:

            def fail(view, *args, **kwargs):
                if view.__name__ == "AdminSubscriptionView":
                    raise CommandError("Synthetic failure")
                return invoke(view, *args, **kwargs)

            calls.side_effect = fail
            with self.assertRaises(CommandError):
                self.apply()
        self.assertEqual(self.counts(), before)
        self.assertEqual(User.objects.get(pk=self.a.pk).password, original)
        self.assertEqual(list(self.root.iterdir()), [canary])
        self.assertEqual(canary.read_bytes(), b"KEEP ORIGINAL SYNTHETIC FILE")

    def test_dates_use_chile_and_expired_scenarios_stop_without_renewal(self):
        with patch(
            "drivers.demo_scenario.timezone.now",
            return_value=datetime(2026, 10, 14, 2, tzinfo=UTC),
        ):
            self.apply()
        log = AdminActionLog.objects.get(action="demo_scenario_prepared")
        self.assertEqual(log.after_detail["day"], "2026-10-13")
        before = self.counts()
        with (
            patch(
                "drivers.demo_scenario.timezone.now",
                return_value=datetime(2027, 10, 14, tzinfo=UTC),
            ),
            self.assertRaises(CommandError),
        ):
            self.run_command(True)
        self.assertEqual(self.counts(), before)


@override_settings(
    DEMO_MODE=True, PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
)
class FreshDemoScenarioTests(TestCase):
    def test_initial_target_with_only_administrator(self):
        User.objects.create_superuser(
            "admin-demo@example.test", secrets.token_urlsafe(32)
        )
        values = [secrets.token_urlsafe(32) for _ in ACCOUNTS]
        with (
            tempfile.TemporaryDirectory(
                prefix="furgoplus-fresh-scenario-test-"
            ) as directory,
            override_settings(PRIVATE_UPLOAD_ROOT=Path(directory)),
            patch("drivers.demo_scenario.sys.stdin.isatty", return_value=True),
            patch(
                "drivers.demo_scenario.getpass.getpass",
                side_effect=[part for value in values for part in (value, value)],
            ),
        ):
            call_command("prepare_demo_scenario", "--apply", stdout=StringIO())
            self.assertEqual(User.objects.count(), 6)
            self.assertEqual(DriverDocument.objects.count(), 9)
            self.assertEqual(len(list(Path(directory).iterdir())), 9)
