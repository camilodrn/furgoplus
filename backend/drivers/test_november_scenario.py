import secrets
from datetime import datetime
from io import BytesIO
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from xml.etree import ElementTree
from zipfile import ZipFile

from django.core.management.base import CommandError
from django.db import connection, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from drivers.capacity import capacity_snapshot
from drivers.models import AdminActionLog, ContactRequest, Plan, Route, Student
from drivers.november_scenario import (
    ACCOUNTS,
    ACTION,
    DB,
    VERSION,
    mobile_email,
    prepare,
    verify_destination,
)
from drivers.publication import CHILE

BASE = "/api/v1/"
SLOT = "rehearsal"
XML = {"sheet": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


@override_settings(DEMO_MODE=True, DEMO_REGISTRATION_ENABLED=True)
class NovemberScenarioTests(TransactionTestCase):
    def setUp(self):
        for code in ("basic", "pro", "elite"):
            Plan.objects.get_or_create(
                code=code, defaults={"display_label": code.title()}
            )
        directory = TemporaryDirectory(prefix="furgo-t16-test-")
        self.addCleanup(directory.cleanup)
        self.enterContext(override_settings(PRIVATE_UPLOAD_ROOT=directory.name))
        # Only the target connection, clock and provisioning locks are faked on
        # SQLite. Use the existing domain actions, models and HTTP endpoints.
        self.enterContext(patch("drivers.november_scenario.verify_destination"))
        self.enterContext(
            patch(
                "django.utils.timezone.now",
                return_value=datetime(2026, 11, 24, 12, tzinfo=CHILE),
            )
        )
        if connection.vendor != "postgresql":
            self.enterContext(
                patch("drivers.november_scenario.readonly", transaction.atomic)
            )
            self.enterContext(patch("drivers.november_scenario.lock_tables"))
        self.credentials = {
            email: secrets.token_urlsafe(25) for email, _, _ in ACCOUNTS
        }
        self.prompt = self.enterContext(
            patch(
                "drivers.november_scenario.passwords",
                side_effect=lambda _: dict(self.credentials),
            )
        )

    def test_preview_and_apply_are_repeatable_and_reserve_the_mobile_account(self):
        self.assertIn("DRY-RUN", prepare(SLOT))
        self.prompt.assert_not_called()
        self.assertFalse(User.objects.exists())
        self.assertNotIn(
            next(iter(self.credentials.values())), prepare(SLOT, apply=True)
        )
        self.assertIn("sin cambios", prepare(SLOT, apply=True))
        self.prompt.assert_called_once()
        self.assertEqual(User.objects.count(), 6)
        self.assertEqual(Student.objects.count(), 29)
        self.assertEqual(AdminActionLog.objects.filter(action=ACTION).count(), 1)
        self.assertFalse(User.objects.filter(email=mobile_email(SLOT)).exists())
        basic = User.objects.get(email="t16-basic@example.test")
        self.client.force_login(basic)
        route = Route.objects.filter(driver=basic.driver_profile).order_by("pk").first()
        assignment_path = BASE + "driver/passenger-assignments/"
        assignment = {
            "route_id": route.pk,
            "student_display_name": "Estudiante ficticio 20",
            "pickup_instruction": "Parada ficticia",
            "guardian_display_name": "Responsable ficticio",
            "guardian_contact": "000000000",
            "starts_on": "2026-11-24",
            "ends_on": None,
        }
        self.assertEqual(
            self.client.post(
                assignment_path,
                assignment,
                content_type="application/json",
                secure=True,
            ).status_code,
            201,
        )
        self.assertEqual(capacity_snapshot(route)["available_seats"], 1)
        unexpected = self.client.post(
            assignment_path,
            {**assignment, "student_display_name": "Estudiante ficticio 21"},
            content_type="application/json",
            secure=True,
        )
        self.assertEqual(
            (unexpected.status_code, unexpected.json()["code"]),
            (409, "student_limit_reached"),
        )
        self.assertEqual(
            self.client.get(assignment_path, secure=True).json()["student_usage"][
                "active"
            ],
            20,
        )

    def test_does_not_adopt_a_database_with_existing_accounts(self):
        User.objects.create_user("other@example.test", role="parent")
        with self.assertRaisesMessage(CommandError, "Base no vacía"):
            prepare(SLOT, apply=True)
        self.prompt.assert_not_called()
        self.assertEqual(User.objects.count(), 1)

    def test_seeded_data_supports_contact_and_three_real_exports(self):
        prepare(SLOT, apply=True)
        driver = User.objects.get(email="t16-elite@example.test")
        driver_id = driver.driver_profile.pk
        mobile = APIClient(enforce_csrf_checks=True)
        token = mobile.get(BASE + "auth/csrf/", secure=True).json()["csrf_token"]
        email, password = mobile_email(SLOT), secrets.token_urlsafe(25)

        def post(path, payload, csrf):
            return mobile.post(
                BASE + path,
                payload,
                format="json",
                secure=True,
                HTTP_ORIGIN="https://testserver",
                HTTP_X_CSRFTOKEN=csrf,
            )

        registration = post(
            "auth/register/",
            {
                "email": email,
                "password": password,
                "role": "parent",
                "display_name": "Apoderado ficticio móvil",
            },
            token,
        )
        self.assertEqual(registration.status_code, 201)
        login = post("auth/login/", {"email": email, "password": password}, token)
        self.assertEqual(login.status_code, 200)
        discovery = mobile.get(
            BASE + "discovery/drivers/", {"commune": "t16-elite"}, secure=True
        )
        self.assertEqual(
            [result["id"] for result in discovery.json()["results"]], [driver_id]
        )
        detail = mobile.get(f"{BASE}discovery/drivers/{driver_id}/", secure=True).json()
        self.assertTrue(any(route["available_seats"] > 0 for route in detail["routes"]))
        contact = post(
            "parent/contact-requests/",
            {
                "driver_id": driver_id,
                "message": "Consulta ficticia para el ensayo.",
                "consent_share_email": True,
            },
            login.json()["csrf_token"],
        )
        self.assertEqual(contact.status_code, 201)
        request_id = contact.json()["id"]
        self.assertTrue(
            ContactRequest.objects.filter(pk=request_id, driver_id=driver_id).exists()
        )
        self.client.force_login(driver)
        inbox = self.client.get(BASE + "driver/contact-requests/", secure=True).json()
        self.assertTrue(
            any(
                row["id"] == request_id and row["status"] == "pending"
                for row in inbox["results"]
            )
        )
        self.assertIn("Cuenta móvil ya registrada", prepare(SLOT, apply=True))

        report_path = BASE + "driver/reports/"
        report = self.client.get(
            report_path + "advanced/", {"month": "2026-11"}, secure=True
        ).json()
        self.assertEqual(report["previous"]["period"]["month"], "2026-10")
        self.assertEqual(report["summary"]["non_void_amount_clp"], 175000)
        self.assertEqual(report["previous"]["summary"]["non_void_amount_clp"], 86000)
        for kind, metric, current, previous in (
            ("payments", "payment_count", 6, 4),
            ("runs", "run_count", 5, 3),
            ("contacts", "contact_count", 6, 3),
        ):
            with self.subTest(kind=kind):
                self.assertEqual(report["summary"][metric], current)
                self.assertEqual(report["previous"]["summary"][metric], previous)
                self.assertEqual(len(report["details"][kind]), current)
                export = self.client.get(
                    report_path + kind + ".xlsx", {"month": "2026-11"}, secure=True
                )
                self.assertEqual(export.status_code, 200)
                self.assertIn(f"{kind}-2026-11.xlsx", export["Content-Disposition"])
                with ZipFile(BytesIO(export.content)) as workbook:
                    sheet = ElementTree.fromstring(
                        workbook.read("xl/worksheets/sheet1.xml")
                    )
                    totals = [
                        [
                            int(cell.findtext("sheet:v", namespaces=XML))
                            for cell in row.findall("sheet:c", XML)
                            if cell.get("t") != "s"
                        ]
                        for row in sheet.findall(".//sheet:row", XML)
                    ]
                    self.assertEqual(
                        next(row for row in totals if row),
                        [current, previous, current - previous],
                    )
                    detail = ElementTree.fromstring(
                        workbook.read("xl/worksheets/sheet2.xml")
                    )
                    self.assertEqual(
                        len(detail.findall(".//sheet:row", XML)), current + 1
                    )

        october = self.client.get(
            report_path + "advanced/", {"month": "2026-10"}, secure=True
        ).json()
        self.assertEqual(october["summary"]["contact_count"], 3)
        for plan, monthly_status in (("basic", 403), ("pro", 200)):
            self.client.force_login(User.objects.get(email=f"t16-{plan}@example.test"))
            self.assertEqual(
                self.client.get(report_path + "monthly/", secure=True).status_code,
                monthly_status,
            )
            for path in ("advanced/", "payments.xlsx", "runs.xlsx", "contacts.xlsx"):
                self.assertEqual(
                    self.client.get(report_path + path, secure=True).status_code, 403
                )


class NovemberDestinationTests(TestCase):
    def test_normal_settings_reject_the_command_before_connecting(self):
        with patch("drivers.november_scenario.connection.cursor") as cursor:
            with self.assertRaisesMessage(
                CommandError, "Destino Task 16 no autorizado"
            ):
                verify_destination(SLOT)
            cursor.assert_not_called()

    def test_requires_the_server_mark_for_the_requested_slot(self):
        database = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": DB,
            "USER": DB,
            "HOST": "task16-db",
            "PORT": "5432",
        }
        cursor = MagicMock()
        cursor.__enter__.return_value = cursor
        config = SimpleNamespace(
            DATABASES={"default": database},
            SETTINGS_MODULE="config.settings",
            DEMO_MODE=True,
            DEMO_REGISTRATION_ENABLED=True,
        )
        with (
            patch.dict("os.environ", {"FURGOPLUS_TASK16_SLOT": SLOT}),
            patch("drivers.november_scenario.settings", config),
            patch("drivers.november_scenario.connection.cursor", return_value=cursor),
        ):
            cursor.fetchone.return_value = (
                DB,
                DB,
                DB,
                DB,
                5432,
                f"{VERSION}:presentation",
            )
            with self.assertRaisesMessage(CommandError, "no tiene la marca"):
                verify_destination(SLOT)
            cursor.fetchone.return_value = (DB, DB, DB, DB, 5432, f"{VERSION}:{SLOT}")
            verify_destination(SLOT)
