from datetime import date, datetime, time, timedelta
from io import BytesIO
from threading import Thread
from unittest import skipUnless
from unittest.mock import patch
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from accounts.models import DriverProfile, ParentProfile, User
from drivers.models import (
    ContactRequest,
    DriverSubscription,
    PassengerAssignment,
    PaymentRecord,
    Plan,
    Route,
    RouteRun,
)
from drivers.publication import CHILE, change_subscription
from drivers.reports import detail_rows, queries, report_snapshot, summarize
from drivers.reports_xlsx import write_cell

BASE = "/api/v1/driver/reports/"


class ReportTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("driver@example.test", role="driver")
        self.driver = DriverProfile.objects.create(user=self.user, display_name="Uno")
        self.other_user = User.objects.create_user("other@example.test", role="driver")
        self.other = DriverProfile.objects.create(
            user=self.other_user, display_name="Otro"
        )
        self.parent_user = User.objects.create_user(
            "parent@example.test", role="parent"
        )
        self.parent = ParentProfile.objects.create(
            user=self.parent_user, display_name="Privado"
        )
        self.admin = User.objects.create_superuser(
            "admin@example.test", "Synthetic-12345!"
        )
        self.sub = DriverSubscription.objects.create(
            driver=self.driver,
            plan=Plan.objects.get(code="pro"),
            status="active",
            starts_at=timezone.now() - timedelta(days=1),
            ends_at=timezone.now() + timedelta(days=30),
        )
        self.client.force_login(self.user)

    def get(self, suffix="monthly/", query=None):
        return self.client.get(
            BASE + suffix, {"month": "2026-10"} if query is None else query, secure=True
        )

    def data(self, driver):
        route = Route.objects.create(
            driver=driver,
            label="=PRIVATE()",
            status="active",
            weekdays=["monday"],
            start_time=time(8),
            end_time=time(9),
            seat_capacity=8,
            destination_label="Privado",
            destination_address="Dirección privada",
        )
        assignment = PassengerAssignment.objects.create(
            route=route,
            student_display_name="Menor privado",
            pickup_instruction="Casa privada",
            guardian_display_name="Adulto privado",
            guardian_contact="912345678",
            starts_on=date(2026, 1, 1),
        )
        for status, amount in (("pending", 1000), ("paid", 2000), ("void", 3000)):
            PaymentRecord.objects.create(
                driver=driver,
                assignment=assignment,
                service_period_start=date(2026, 9, 1),
                service_period_end=date(2026, 10, 31),
                due_on=date(2026, 10, 1),
                amount_clp=amount,
                status=status,
                paid_at=timezone.now() if status == "paid" else None,
            )
        RouteRun.objects.create(
            route=route,
            service_date=date(2026, 10, 31),
            state="planned",
            weekdays_snapshot=["monday"],
            start_time_snapshot=time(8),
            end_time_snapshot=time(9),
            seat_capacity_snapshot=6,
            destination_label_snapshot="Privado",
            destination_address_snapshot="Casa privada",
        )
        for i, status in enumerate(ContactRequest.Status.values):
            ContactRequest.objects.create(
                driver=driver,
                parent=self.parent,
                driver_display_name_snapshot="Privado",
                message="=PRIVATE()",
                consented_at=timezone.now(),
                parent_email_snapshot="secret@example.test",
                created_at=datetime(2026, 10, 1, 0, i, tzinfo=CHILE),
                status=status,
            )
        return route, assignment

    def test_empty_and_defaults(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response.json()["summary"]["payment_count"], 0)
        self.assertEqual(response.json()["summary"]["recorded_capacity_total"], 0)
        self.assertEqual(
            self.get(query={}).json()["period"]["timezone"], "America/Santiago"
        )

    def elite(self):
        self.sub.plan = Plan.objects.get(code="elite")
        self.sub.save()

    def test_advanced_comparison_is_cohort_not_historical_balance(self):
        self.elite()
        _, assignment = self.data(self.driver)
        PaymentRecord.objects.create(
            driver=self.driver,
            assignment=assignment,
            service_period_start=date(2026, 9, 1),
            service_period_end=date(2026, 9, 30),
            due_on=date(2026, 9, 30),
            amount_clp=800,
        )
        body = self.get("advanced/").json()
        self.assertEqual(body["previous"]["period"]["month"], "2026-09")
        self.assertEqual(body["previous"]["summary"]["non_void_amount_clp"], 800)
        self.assertEqual(len(body["details"]["payments"]), 3)
        self.assertEqual(
            body["details"]["contacts"][0]["created_at"], "2026-10-01T00:00:00-03:00"
        )
        self.assertEqual(
            self.get("advanced/", {"month": "2000-01"}).json()["previous"]["period"][
                "month"
            ],
            "1999-12",
        )

    def test_every_download_and_detail_rechecks_plan_expiry_and_profile(self):
        endpoints = ("advanced/", "payments.xlsx", "runs.xlsx", "contacts.xlsx")
        for code in ("basic", "pro", "elite"):
            self.sub.plan = Plan.objects.get(code=code)
            self.sub.save()
            for endpoint in endpoints:
                response = self.get(endpoint)
                self.assertEqual(response.status_code, 200 if code == "elite" else 403)
                self.assertEqual(response["Cache-Control"], "no-store")
        for state in ("suspended", "inactive"):
            self.sub.status = state
            self.sub.save()
            for endpoint in endpoints:
                self.assertEqual(self.get(endpoint).status_code, 403)
        self.sub.status = "active"
        self.sub.starts_at = timezone.now() + timedelta(days=1)
        self.sub.ends_at = timezone.now() + timedelta(days=2)
        self.sub.save()
        for endpoint in endpoints:
            self.assertEqual(self.get(endpoint).status_code, 403)
        self.sub.starts_at = timezone.now() - timedelta(days=1)
        self.sub.ends_at = timezone.now()
        self.sub.save()
        for endpoint in endpoints:
            self.assertEqual(self.get(endpoint).status_code, 403)
        self.sub.ends_at = timezone.now() + timedelta(days=1)
        self.sub.save()
        self.driver.status = "suspended"
        self.driver.save()
        for endpoint in endpoints:
            self.assertEqual(self.get(endpoint).status_code, 403)
        for user in (self.parent_user, self.admin, self.other_user):
            self.client.force_login(user)
            for endpoint in endpoints:
                self.assertEqual(self.get(endpoint).status_code, 403)

    def test_report_contracts_and_read_only_endpoints(self):
        from api.contracts import (
            ADVANCED_REPORT,
            MONTHLY_REPORT,
            XLSX_MIME,
            openapi_document,
        )

        self.elite()
        for suffix, schema in (
            ("monthly/", MONTHLY_REPORT),
            ("advanced/", ADVANCED_REPORT),
        ):
            body = self.get(suffix).json()
            self.assertEqual(set(body), set(schema["required"]))
            self.assertEqual(
                self.client.post(BASE + suffix, {}, secure=True).status_code, 405
            )
        paths = openapi_document()["paths"]
        for suffix in (
            "monthly/",
            "advanced/",
            "payments.xlsx",
            "runs.xlsx",
            "contacts.xlsx",
        ):
            operation = paths[BASE + suffix]["get"]
            self.assertEqual(operation["security"], [{"SessionCookie": []}])
            self.assertEqual([p["name"] for p in operation["parameters"]], ["month"])
            if suffix.endswith("xlsx"):
                self.assertEqual(
                    set(operation["responses"]["200"]["content"]), {XLSX_MIME}
                )
                self.assertEqual(
                    operation["responses"]["200"]["headers"]["Cache-Control"]["schema"][
                        "const"
                    ],
                    "no-store",
                )

    def test_xlsx_real_private_consistent_and_no_formulas(self):
        self.elite()
        self.data(self.driver)
        _, other_assignment = self.data(self.other)
        PaymentRecord.objects.create(
            driver=self.other,
            assignment=other_assignment,
            service_period_start=date(2026, 10, 1),
            service_period_end=date(2026, 10, 31),
            due_on=date(2026, 10, 20),
            amount_clp=999999,
        )
        for kind, count in (("payments", 3), ("runs", 1), ("contacts", 4)):
            response = self.get(kind + ".xlsx")
            self.assertEqual(response.status_code, 200)
            self.assertIn("spreadsheetml.sheet", response["Content-Type"])
            self.assertIn("attachment;", response["Content-Disposition"])
            with ZipFile(BytesIO(response.content)) as archive:
                self.assertIn("[Content_Types].xml", archive.namelist())
                xml = "".join(
                    archive.read(n).decode()
                    for n in archive.namelist()
                    if n.endswith(".xml")
                )
                for secret in (
                    "Menor privado",
                    "Casa privada",
                    "secret@example",
                    "PRIVATE()",
                    "912345678",
                    "999999",
                ):
                    self.assertNotIn(secret, xml)
                self.assertNotIn("<f>", xml)
                self.assertNotIn("<hyperlink ", xml)
                detail = ET.fromstring(archive.read("xl/worksheets/sheet2.xml"))
                ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                self.assertEqual(
                    len(detail.findall("s:sheetData/s:row", ns)), count + 1
                )
                if kind == "payments":
                    amounts = [
                        int(c.find("s:v", ns).text)
                        for c in detail.findall("s:sheetData/s:row/s:c", ns)
                        if c.attrib["r"].startswith("F") and c.attrib.get("t") != "s"
                    ]
                    self.assertEqual(sum(amounts), 6000)
        for kind in ("payments", "runs", "contacts"):
            self.assertEqual(
                self.get(kind + ".xlsx", {"driver_id": self.other.pk}).status_code, 400
            )
        with patch("drivers.reports.LIMIT", 1):
            self.assertEqual(self.get("payments.xlsx").status_code, 400)
            self.assertEqual(self.get("advanced/").status_code, 400)

    def test_untrusted_excel_text_is_always_string(self):
        from xlsxwriter import Workbook

        output = BytesIO()
        with Workbook(output, {"in_memory": True}) as book:
            sheet = book.add_worksheet()
            for i, value in enumerate(
                (
                    "=1+1",
                    "+SUM(A1)",
                    "-1+1",
                    "@SUM(A1)",
                    "\t=1+1",
                    "\n=1+1",
                    "https://example.test",
                )
            ):
                write_cell(sheet, i, 0, value)
        with ZipFile(output) as archive:
            xml = archive.read("xl/worksheets/sheet1.xml").decode()
            self.assertNotIn("<f>", xml)
            self.assertNotIn("hyperlink", xml)
            self.assertEqual(xml.count('t="s"'), 7)

    def test_totals_ownership_and_privacy(self):
        self.data(self.driver)
        self.data(self.other)
        body = self.get().json()
        summary = body["summary"]
        self.assertEqual(summary["payment_count"], 3)
        self.assertEqual(summary["payments"]["void"], {"count": 1, "amount_clp": 3000})
        self.assertEqual(summary["non_void_amount_clp"], 3000)
        self.assertEqual(summary["contact_count"], 4)
        self.assertEqual(summary["run_count"], 1)
        self.assertEqual(summary["recorded_capacity_total"], 6)
        self.assertEqual(len(body["current_capacity"]["routes"]), 1)
        self.assertEqual(body["current_capacity"]["routes"][0]["available_seats"], 7)
        for private in (
            "Menor privado",
            "Casa privada",
            "secret@example",
            "PRIVATE()",
            "912345678",
        ):
            self.assertNotIn(private, str(body))

    def test_calendar_edges_local_time_and_month_validation(self):
        _, assignment = self.data(self.driver)
        for due in (date(2026, 9, 30), date(2026, 11, 1)):
            PaymentRecord.objects.create(
                driver=self.driver,
                assignment=assignment,
                service_period_start=due,
                service_period_end=due,
                due_on=due,
                amount_clp=9000,
            )
        # At 02:59 UTC it is still September in Santiago; October starts at 03:00 UTC.
        for stamp in ("2026-10-01T02:59:59+00:00", "2026-11-01T03:00:00+00:00"):
            ContactRequest.objects.create(
                driver=self.driver,
                parent=self.parent,
                driver_display_name_snapshot="Uno",
                message="Privado",
                consented_at=timezone.now(),
                parent_email_snapshot="private@example.test",
                created_at=datetime.fromisoformat(stamp),
                status="declined",
            )
        body = self.get().json()
        self.assertEqual(body["summary"]["contact_count"], 4)
        self.assertEqual(body["summary"]["payment_count"], 3)
        self.assertEqual(
            self.get(query={"month": "2024-02"}).json()["period"]["end_exclusive"],
            "2024-03-01",
        )
        self.assertEqual(
            self.get(query={"month": "2026-12"}).json()["period"]["end_exclusive"],
            "2027-01-01",
        )
        for query in (
            {"month": "2026-13"},
            {"month": "2026-1"},
            {"month": "1999-01"},
            {"month": "2026-02-30"},
            {"driver_id": self.other.pk},
            {"month": ["2026-10", "2026-09"]},
        ):
            self.assertEqual(self.get(query=query).status_code, 400)

    def test_plans_expiry_admin_changes_roles_and_cross_access(self):
        version = None
        for code, expected in (
            ("basic", 403),
            ("pro", 200),
            ("elite", 200),
            ("basic", 403),
        ):
            _, version = change_subscription(
                self.driver.pk,
                self.admin,
                plan_code=code,
                status="active",
                starts_at=self.sub.starts_at,
                ends_at=self.sub.ends_at,
                reason="Test report",
                expected_version=version,
            )
            self.assertEqual(self.get().status_code, expected)
        self.sub.refresh_from_db()
        self.sub.plan = Plan.objects.get(code="elite")
        self.sub.ends_at = timezone.now()
        self.sub.save()
        self.assertEqual(self.get().status_code, 403)
        self.sub.ends_at = timezone.now() + timedelta(days=1)
        for status in ("inactive", "suspended"):
            self.sub.status = status
            self.sub.save()
            self.assertEqual(self.get().status_code, 403)
        for user in (self.parent_user, self.admin, self.other_user):
            self.client.force_login(user)
            self.assertEqual(self.get().status_code, 403)
        self.client.logout()
        self.assertEqual(self.get().status_code, 403)
        self.client.force_login(self.user)
        self.assertEqual(self.get("monthly/999/").status_code, 404)


@skipUnless(connection.vendor == "postgresql", "Requires real PostgreSQL snapshots")
class ReportSnapshotTests(TransactionTestCase):
    def setUp(self):
        # TransactionTestCase flushes seeded plans between concurrency cases.
        for code in ("basic", "pro", "elite"):
            Plan.objects.get_or_create(code=code, defaults={"display_label": code})
        ReportTests.setUp(self)
        ReportTests.data(self, self.driver)

    def test_totals_and_detail_share_snapshot_during_concurrent_write(self):
        errors = []

        def change():
            close_old_connections()
            try:
                PaymentRecord.objects.filter(
                    driver_id=self.driver.pk, status="pending"
                ).update(amount_clp=7000)
            except Exception as exc:
                errors.append(exc)
            finally:
                close_old_connections()

        start, end = date(2026, 10, 1), date(2026, 11, 1)
        with report_snapshot():
            summary = summarize(queries(self.driver, start, end))
            thread = Thread(target=change)
            thread.start()
            thread.join(timeout=10)
            self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            rows = detail_rows(queries(self.driver, start, end), "payments")
            self.assertEqual(
                sum(r["amount_clp"] for r in rows if r["status"] != "void"),
                summary["non_void_amount_clp"],
            )
            with connection.cursor() as cursor:
                cursor.execute("SHOW transaction_read_only")
                self.assertEqual(cursor.fetchone()[0], "on")
        self.assertEqual(
            PaymentRecord.objects.get(driver=self.driver, status="pending").amount_clp,
            7000,
        )

    def test_real_endpoint_uses_read_snapshot_without_outer_test_transaction(self):
        response = self.client.get(BASE + "monthly/", {"month": "2026-10"}, secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["summary"]["non_void_amount_clp"], 3000)
