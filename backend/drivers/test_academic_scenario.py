"""Integration tests for an ephemeral test DB ONLY. Never run by provisioning.

SQLite tests replace the PostgreSQL read-only/lock primitives and identity probe;
the guard itself is tested separately, including rejection before connecting.
Domain validators, views, ownership checks and transitions stay active.
"""

import hashlib
import json
import secrets
import tempfile
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIRequestFactory, force_authenticate

from academic_boundary import DATABASE, PROJECT
from accounts.models import DriverProfile, User
from drivers.academic_scenario import (
    ACCOUNTS,
    check_schema,
    identity,
    invoke,
    prepare,
    table_models,
)
from drivers.capabilities import driver_capabilities, require_capability
from drivers.models import (
    AdminActionLog,
    ContactRequest,
    DriverDocument,
    DriverSubscription,
    PassengerAssignment,
    PaymentRecord,
    Route,
    RouteRun,
    SupportEvent,
    SupportTicket,
)
from drivers.operations_api import AssignmentsView
from drivers.publication import publication_state
from drivers.publication_api import AdminSubscriptionView
from drivers.support import authorize


@override_settings(DEMO_MODE=True)
class AcademicScenarioTests(TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix="furgoplus-academic-tests-")
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.canary = self.root / "existing-canary"
        self.canary.write_bytes(b"preserve")
        override = override_settings(
            PRIVATE_UPLOAD_ROOT=self.root, ACADEMIC_IDENTITY=secrets.token_hex(32)
        )
        override.enable()
        self.addCleanup(override.disable)
        self.values = {email: secrets.token_urlsafe(32) for email, _, _ in ACCOUNTS}
        self.prompt = patch(
            "drivers.academic_scenario.passwords", side_effect=lambda: dict(self.values)
        )
        self.credentials = self.prompt.start()
        self.addCleanup(self.prompt.stop)
        for target, replacement in (
            ("identity", lambda *args: None),
            ("readonly", transaction.atomic),
            ("lock_tables", lambda: None),
            ("initial_day", timezone.localdate),
        ):
            context = patch(f"drivers.academic_scenario.{target}", replacement)
            context.start()
            self.addCleanup(context.stop)

    def load(self):
        output = StringIO()
        call_command(
            "prepare_academic_scenario",
            "--apply",
            "--expect-project",
            PROJECT,
            "--expect-database",
            DATABASE,
            stdout=output,
        )
        self.assertTrue(
            all(value not in output.getvalue() for value in self.values.values()),
            "The command must never emit credentials",
        )
        return output.getvalue()

    def digest(self):
        # Compare complete state without exposing password hashes in assertion logs.
        values = {
            table: list(model.objects.order_by("pk").values())
            for table, model in table_models().items()
        }
        return hashlib.sha256(
            json.dumps(values, sort_keys=True, default=str).encode()
        ).hexdigest()

    def test_empty_dry_run_creates_nothing_and_prompts_nobody(self):
        before = self.digest()
        self.assertIn("DRY-RUN", prepare(PROJECT, DATABASE))
        self.assertEqual(before, self.digest())
        self.credentials.assert_not_called()
        self.assertEqual(list(self.root.iterdir()), [self.canary])

    def test_complete_seed_domain_and_real_creation_times(self):
        start = timezone.now()
        self.load()
        end = timezone.now()
        self.assertEqual(User.objects.count(), 5)
        self.assertEqual(DriverSubscription.objects.count(), 3)
        self.assertEqual(Route.objects.count(), 3)
        self.assertEqual(PassengerAssignment.objects.count(), 9)
        self.assertEqual(PaymentRecord.objects.count(), 9)
        self.assertEqual(DriverDocument.objects.count(), 9)
        self.assertEqual(RouteRun.objects.count(), 0)
        self.assertEqual(SupportTicket.objects.count(), 6)
        self.assertEqual(SupportEvent.objects.count(), 11)
        self.assertEqual(
            set(ContactRequest.objects.values_list("status", flat=True)),
            {"pending", "accepted", "declined", "cancelled"},
        )
        self.assertEqual(
            set(SupportTicket.objects.values_list("state", flat=True)),
            {"open", "in_progress", "waiting_user", "resolved", "closed"},
        )
        for model in (
            User,
            PassengerAssignment,
            PaymentRecord,
            ContactRequest,
            SupportTicket,
        ):
            self.assertFalse(
                model.objects.exclude(
                    created_at__gte=start, created_at__lte=end
                ).exists()
            )
        for driver in DriverProfile.objects.all():
            self.assertTrue(publication_state(driver).eligible)
            self.assertEqual(
                set(
                    PaymentRecord.objects.filter(driver=driver).values_list(
                        "status", flat=True
                    )
                ),
                {"pending", "paid", "void"},
            )
        self.assertEqual(self.canary.read_bytes(), b"preserve")

    def test_repeat_apply_and_dry_run_preserve_every_field_and_files(self):
        self.load()
        before = self.digest()
        files = {p.name: p.read_bytes() for p in self.root.iterdir()}
        self.credentials.reset_mock()
        self.assertIn("sin cambios", self.load())
        self.assertIn("sin cambios", prepare(PROJECT, DATABASE))
        self.assertEqual(before, self.digest())
        self.assertEqual(files, {p.name: p.read_bytes() for p in self.root.iterdir()})
        self.credentials.assert_not_called()

    def test_manual_password_and_subscription_changes_are_preserved(self):
        self.load()
        admin = User.objects.get(role="admin")
        driver = User.objects.get(email=ACCOUNTS[1][0])
        driver.set_password(secrets.token_urlsafe(32))
        driver.save(update_fields=["password"])
        log = AdminActionLog.objects.filter(
            action="subscription_changed", target_id=driver.driver_profile.pk
        ).last()
        sub = driver.driver_profile.subscription
        invoke(
            AdminSubscriptionView,
            admin,
            "post",
            {
                "plan_code": "basic",
                "status": "suspended",
                "starts_at": sub.starts_at.isoformat(),
                "ends_at": sub.ends_at.isoformat(),
                "reason": "Prueba sintética de suspensión.",
                "expected_version": log.pk,
            },
            id=driver.driver_profile.pk,
        )
        before = self.digest()
        self.load()
        self.assertEqual(before, self.digest())
        sub.refresh_from_db()
        self.assertEqual(sub.status, "suspended")

    def test_preexisting_account_is_never_adopted_or_overwritten(self):
        user = User.objects.create_user(
            ACCOUNTS[1][0], secrets.token_urlsafe(32), role="driver"
        )
        before = self.digest()
        with self.assertRaises(CommandError):
            self.load()
        self.assertEqual(before, self.digest())
        self.assertEqual(User.objects.get(pk=user.pk).role, "driver")
        self.credentials.assert_not_called()

    def test_foreign_account_after_seed_rejects_before_credentials(self):
        self.load()
        User.objects.create_user(
            "foreign@example.test", secrets.token_urlsafe(32), role="parent"
        )
        before = self.digest()
        self.credentials.reset_mock()
        with self.assertRaises(CommandError):
            self.load()
        self.assertEqual(before, self.digest())
        self.credentials.assert_not_called()

    def test_unknown_schema_is_denied(self):
        with connection.cursor() as cursor:
            cursor.execute("CREATE TABLE academic_unknown (id integer)")
        try:
            with self.assertRaises(CommandError):
                check_schema(migrated=True)
        finally:
            with connection.cursor() as cursor:
                cursor.execute("DROP TABLE academic_unknown")
        self.credentials.assert_not_called()

    def test_rollback_removes_only_new_documents(self):
        from drivers.academic_scenario import seed

        def fail_after_seed(*args):
            seed(*args)
            raise CommandError("Synthetic failure before commit")

        with (
            patch("drivers.academic_scenario.seed", side_effect=fail_after_seed),
            self.assertRaises(CommandError),
        ):
            self.load()
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(DriverDocument.objects.count(), 0)
        self.assertEqual(list(self.root.iterdir()), [self.canary])

    def test_missing_document_is_not_replaced(self):
        self.load()
        row = DriverDocument.objects.first()
        path = self.root / row.storage_key
        path.unlink()
        before = self.digest()
        with self.assertRaises(CommandError):
            self.load()
        self.assertEqual(before, self.digest())
        self.assertFalse(path.exists())

    def test_date_change_before_commit_rolls_back(self):
        from datetime import timedelta

        day = timezone.localdate()
        with (
            patch(
                "drivers.academic_scenario.initial_day",
                side_effect=[day, day, day + timedelta(days=1)],
            ),
            self.assertRaises(CommandError),
        ):
            self.load()
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(list(self.root.iterdir()), [self.canary])

    def test_caps_priorities_support_permission_and_parent_denials(self):
        self.load()
        for index, code, priority in (
            (1, "basic", "standard"),
            (2, "pro", "preferred"),
            (3, "elite", "priority"),
        ):
            user = User.objects.get(email=ACCOUNTS[index][0])
            caps = driver_capabilities(user)
            self.assertEqual(caps["plan"]["code"], code)
            self.assertTrue(caps["subscription"]["effective"])
            self.assertEqual(
                caps["capabilities"]["reports.monthly.read"]["enabled"], code != "basic"
            )
            self.assertEqual(
                caps["capabilities"]["reports.detail.read"]["enabled"], code == "elite"
            )
            self.assertEqual(
                caps["capabilities"]["reports.xlsx.export"]["enabled"], code == "elite"
            )
            self.assertEqual(
                caps["capabilities"]["assistant.faq"]["enabled"], code != "basic"
            )
            self.assertEqual(
                caps["capabilities"]["assistant.contextual"]["enabled"], code == "elite"
            )
            self.assertEqual(
                set(
                    SupportTicket.objects.filter(owner=user).values_list(
                        "priority_at_creation", flat=True
                    )
                ),
                {priority},
            )
        authorize(User.objects.get(role="admin"), admin=True)
        parent = User.objects.get(role="parent")
        authorize(parent)
        with self.assertRaises(PermissionDenied):
            require_capability(parent, "reports.monthly.read")
        with self.assertRaises(PermissionDenied):
            authorize(parent, admin=True)

    def test_capacity_and_foreign_assignment_are_enforced(self):
        self.load()
        driver = User.objects.get(email=ACCOUNTS[1][0])
        route = Route.objects.get(driver=driver.driver_profile)
        data = {
            "route_id": route.pk,
            "student_display_name": "Pasajero ficticio adicional",
            "pickup_instruction": "Parada ficticia",
            "guardian_display_name": "Tutor ficticio",
            "guardian_contact": "000000000",
            "starts_on": timezone.localdate().isoformat(),
            "ends_on": None,
        }
        invoke(AssignmentsView, driver, "post", data)
        with self.assertRaises(CommandError):
            invoke(AssignmentsView, driver, "post", data)
        request = APIRequestFactory().post("/api/v1/", data, format="json")
        force_authenticate(request, user=User.objects.get(email=ACCOUNTS[2][0]))
        self.assertEqual(AssignmentsView.as_view()(request).status_code, 404)


class AcademicIdentityDenialTests(TestCase):
    def test_real_guard_rejects_nonacademic_settings_without_querying(self):
        with self.assertNumQueries(0), self.assertRaises(CommandError):
            identity(PROJECT, DATABASE)
