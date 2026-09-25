import json
from datetime import date, time, timedelta
from threading import Barrier, Thread

from django.db import close_old_connections, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import ValidationError

from accounts.models import DriverProfile, ParentProfile, User
from drivers.capacity import capacity_snapshot, next_service_date, validate_capacity
from drivers.models import (
    DriverDocument,
    DriverSubscription,
    PassengerAssignment,
    PaymentRecord,
    Plan,
    Route,
    RouteCoverage,
)
from drivers.services import CHECKLIST
from drivers.test_publication import PublicationTests

BASE = "/api/v1/"


class OperationsTests(TestCase):
    def setUp(self):
        PublicationTests.setUp(self)
        self.route.weekdays = ["monday"]
        self.route.seat_capacity = 1
        self.route.save(update_fields=["weekdays", "seat_capacity"])
        self.monday = date(2026, 9, 28)
        self.payload = {
            "route_id": self.route.id,
            "student_display_name": "Estudiante Ficticio",
            "pickup_instruction": "Parada imaginaria",
            "guardian_display_name": "Apoderado Ficticio",
            "guardian_contact": "912345678",
            "starts_on": "2026-09-28",
            "ends_on": None,
        }

    def as_user(self, user):
        self.client.force_login(user)
        self.token = self.client.get(BASE + "auth/csrf/", secure=True).json()[
            "csrf_token"
        ]

    def post(self, path, body):
        return self.client.post(
            BASE + path,
            json.dumps(body),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def patch(self, path, body):
        return self.client.patch(
            BASE + path,
            json.dumps(body),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def get(self, path):
        return self.client.get(BASE + path, secure=True)

    def create_assignment(self):
        self.as_user(self.driver_user)
        response = self.post("driver/passenger-assignments/", self.payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIn("no-store", response["Cache-Control"])
        return response.json()["id"]

    def test_owner_roles_interval_and_capacity(self):
        assignment_id = self.create_assignment()
        self.assertEqual(self.get("driver/passenger-assignments/").status_code, 200)
        self.assertEqual(
            self.get(f"driver/passenger-assignments/{assignment_id}/").status_code, 200
        )
        self.assertEqual(
            self.post("driver/passenger-assignments/", self.payload).status_code, 400
        )
        bad = {**self.payload, "starts_on": "2026-09-29", "ends_on": "2026-09-28"}
        self.assertEqual(
            self.post("driver/passenger-assignments/", bad).status_code, 400
        )
        # Two assignments can overlap without competing on any scheduled Monday.
        tuesday = {**self.payload, "starts_on": "2026-09-29", "ends_on": "2026-10-04"}
        self.assertEqual(
            self.post("driver/passenger-assignments/", tuesday).status_code, 201
        )
        self.assertEqual(
            self.patch(
                f"driver/passenger-assignments/{assignment_id}/",
                {"ends_on": "2026-10-05"},
            ).status_code,
            200,
        )
        self.assertEqual(
            self.patch(
                f"driver/passenger-assignments/{assignment_id}/", {"route_id": 999}
            ).status_code,
            400,
        )
        self.assertEqual(self.get("driver/summary/").status_code, 200)

        for user in (self.other_user, self.parent, self.admin):
            self.as_user(user)
            expected = 404 if user == self.other_user else 403
            self.assertEqual(
                self.get(f"driver/passenger-assignments/{assignment_id}/").status_code,
                expected,
            )
            self.assertEqual(
                self.patch(
                    f"driver/passenger-assignments/{assignment_id}/",
                    {"guardian_display_name": "X"},
                ).status_code,
                expected,
            )
            self.assertEqual(
                self.get("driver/passenger-assignments/").status_code,
                200 if user == self.other_user else 403,
            )
            self.assertEqual(
                self.post("driver/passenger-assignments/", self.payload).status_code,
                404 if user == self.other_user else 403,
            )
        self.client.logout()
        self.assertEqual(self.get("driver/passenger-assignments/").status_code, 403)

    def test_guardian_phone_is_nine_digits_for_mvp_demo(self):
        self.as_user(self.driver_user)
        for value in ("12345678", "1234567890", "12345abcd", "91234567a"):
            response = self.post(
                "driver/passenger-assignments/",
                {**self.payload, "guardian_contact": value},
            )
            self.assertEqual(response.status_code, 400)
            self.assertIn("guardian_contact", response.json())
        response = self.post("driver/passenger-assignments/", self.payload)
        self.assertEqual(response.status_code, 201)
        assignment_id = response.json()["id"]
        for value in ("12345678", "1234567890", "12345abcd"):
            response = self.patch(
                f"driver/passenger-assignments/{assignment_id}/",
                {"guardian_contact": value},
            )
            self.assertEqual(response.status_code, 400)
        self.assertEqual(
            PassengerAssignment.objects.get(pk=assignment_id).guardian_contact,
            "912345678",
        )

    def test_next_service_date_is_explicit_and_deterministic(self):
        self.assertEqual(
            next_service_date(["monday"], date(2026, 9, 24)), date(2026, 9, 28)
        )
        self.assertEqual(
            next_service_date(["monday"], date(2026, 9, 28)), date(2026, 9, 28)
        )
        self.assertEqual(
            capacity_snapshot(self.route, date(2026, 9, 24)),
            {
                "next_service_date": "2026-09-28",
                "used_seats": 0,
                "available_seats": 1,
            },
        )

    def test_route_schedule_interval_change_and_end(self):
        assignment_id = self.create_assignment()
        body = {
            "label": self.route.label,
            "status": self.route.status,
            "weekdays": self.route.weekdays,
            "start_time": "07:00",
            "end_time": "08:00",
            "seat_capacity": 1,
            "destination_label": self.route.destination_label,
            "destination_address": self.route.destination_address,
            "coverage_codes": [self.commune.code],
            "expected_revision": self.route.revision,
        }
        # A changed schedule that intersects a second assignment must be rejected.
        second = {**self.payload, "starts_on": "2026-09-29", "ends_on": "2026-10-04"}
        self.assertEqual(
            self.post("driver/passenger-assignments/", second).status_code, 201
        )
        self.assertEqual(
            self.patch(
                f"driver/routes/{self.route.id}/",
                {**body, "weekdays": ["monday", "tuesday"]},
            ).status_code,
            400,
        )
        self.assertEqual(
            self.post(
                f"driver/passenger-assignments/{assignment_id}/end/",
                {"ends_on": "2026-09-28"},
            ).status_code,
            200,
        )
        self.assertEqual(
            PassengerAssignment.objects.get(pk=assignment_id).ends_on, self.monday
        )
        future = self.post(
            "driver/passenger-assignments/", {**self.payload, "starts_on": "2026-10-05"}
        )
        self.assertEqual(future.status_code, 201)
        self.assertEqual(
            self.patch(
                f"driver/passenger-assignments/{assignment_id}/",
                {"ends_on": "2026-10-05"},
            ).status_code,
            400,
        )
        self.assertEqual(
            self.get(f"driver/passenger-assignments/{assignment_id}/").json()[
                "ends_on"
            ],
            "2026-09-28",
        )

    def test_capacity_reduction_below_demand_rejected(self):
        self.route.seat_capacity = 2
        self.route.save(update_fields=["seat_capacity"])
        self.create_assignment()
        self.assertEqual(
            self.post("driver/passenger-assignments/", self.payload).status_code, 201
        )
        body = {
            "label": self.route.label,
            "status": self.route.status,
            "weekdays": self.route.weekdays,
            "start_time": "07:00",
            "end_time": "08:00",
            "seat_capacity": 1,
            "destination_label": self.route.destination_label,
            "destination_address": self.route.destination_address,
            "coverage_codes": [self.commune.code],
            "expected_revision": self.route.revision,
        }
        self.assertEqual(
            self.patch(f"driver/routes/{self.route.id}/", body).status_code, 400
        )
        self.route.refresh_from_db()
        self.assertEqual(self.route.seat_capacity, 2)

    def test_public_availability_and_private_allowlist(self):
        self.other.display_name = "Otro conductor ficticio"
        self.other.service_summary = "Servicio ficticio"
        self.other.service_contact_email = "otro@example.test"
        self.other.publication_requested = True
        self.other.validation_state = "approved"
        self.other.approved_revision = 1
        self.other.save()
        for kind, _, expiry in CHECKLIST:
            DriverDocument.objects.create(
                driver=self.other,
                kind=kind,
                storage_key=f"other-{kind}.pdf",
                content_type="application/pdf",
                byte_size=10,
                sha256="1" * 64,
                expires_on=date(2030, 1, 1) if expiry else None,
            )
        DriverSubscription.objects.create(
            driver=self.other,
            plan=Plan.objects.get(code="basic"),
            status="active",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )
        other_route = Route.objects.create(
            driver=self.other,
            label="Otra ruta ficticia",
            status="active",
            weekdays=["monday"],
            start_time=time(7),
            end_time=time(8),
            seat_capacity=2,
            destination_label="Escuela ficticia",
            destination_address="Dirección ficticia",
        )
        RouteCoverage.objects.create(route=other_route, commune=self.commune)
        self.as_user(self.parent)
        before = self.get(f"discovery/drivers/{self.driver.id}/")
        self.assertEqual(before.status_code, 200)
        service_date = before.json()["routes"][0]["next_service_date"]
        self.assertEqual(before.json()["routes"][0]["available_seats"], 1)
        self.as_user(self.driver_user)
        assignment = self.post(
            "driver/passenger-assignments/", {**self.payload, "starts_on": service_date}
        ).json()
        PaymentRecord.objects.create(
            driver=self.driver,
            assignment=PassengerAssignment.objects.get(pk=assignment["id"]),
            service_period_start=date.fromisoformat(service_date),
            service_period_end=date.fromisoformat(service_date),
            amount_clp=777777,
            due_on=date.fromisoformat(service_date),
        )
        self.as_user(self.parent)
        ParentProfile.objects.create(user=self.parent, display_name="Familia Ficticia")
        contact = self.post(
            "parent/contact-requests/",
            {
                "driver_id": self.driver.id,
                "message": "Consulta ficticia",
                "consent_share_email": True,
            },
        )
        self.assertEqual(contact.status_code, 201, contact.content)
        self.assertNotIn("Estudiante Ficticio", contact.content.decode())
        self.assertNotIn("777777", contact.content.decode())
        for path in (
            "discovery/drivers/",
            f"discovery/drivers/{self.driver.id}/",
            f"discovery/compare/?ids={self.driver.id},{self.other.id}",
        ):
            response = self.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn("Estudiante Ficticio", response.content.decode())
            self.assertNotIn("Apoderado Ficticio", response.content.decode())
            self.assertNotIn("777777", response.content.decode())
            self.assertNotIn("Parada imaginaria", response.content.decode())
            route = (response.json().get("results") or [response.json()])[0]["routes"][
                0
            ]
            self.assertEqual(route["next_service_date"], service_date)
            self.assertEqual((route["used_seats"], route["available_seats"]), (1, 0))
        self.as_user(self.driver_user)
        self.patch(
            f"driver/passenger-assignments/{assignment['id']}/",
            {"ends_on": service_date},
        )
        self.driver.publication_requested = False
        self.driver.save(update_fields=["publication_requested"])
        self.as_user(self.parent)
        self.assertEqual(
            self.get(f"discovery/drivers/{self.driver.id}/").status_code, 404
        )

    def test_payment_transitions_ownership_and_subscription_isolation(self):
        assignment_id = self.create_assignment()
        payload = {
            "assignment_id": assignment_id,
            "service_period_start": "2026-09-28",
            "service_period_end": "2026-10-28",
            "amount_clp": 50000,
            "due_on": "2026-10-05",
        }
        self.assertEqual(
            self.post("driver/payments/", {**payload, "amount_clp": 0}).status_code, 400
        )
        for invalid_amount in (-1, 3.5, "", "1.5"):
            self.assertEqual(
                self.post(
                    "driver/payments/", {**payload, "amount_clp": invalid_amount}
                ).status_code,
                400,
            )
        self.assertEqual(
            self.post(
                "driver/payments/", {**payload, "service_period_end": "2026-09-27"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.post(
                "driver/payments/", {**payload, "paid_at": "2026-09-28T00:00:00Z"}
            ).status_code,
            400,
        )
        record = self.post("driver/payments/", payload)
        self.assertEqual(record.status_code, 201)
        self.assertIn("no-store", record["Cache-Control"])
        payment_id = record.json()["id"]
        paid = self.post(f"driver/payments/{payment_id}/mark-paid/", {})
        self.assertEqual(paid.status_code, 200)
        paid_at = paid.json()["paid_at"]
        self.assertIsNotNone(paid_at)
        self.assertEqual(
            self.post(f"driver/payments/{payment_id}/void/", {}).json()["paid_at"],
            paid_at,
        )
        self.assertEqual(
            self.post(f"driver/payments/{payment_id}/mark-paid/", {}).status_code, 409
        )
        pending = self.post("driver/payments/", payload).json()
        voided = self.post(f"driver/payments/{pending['id']}/void/", {})
        self.assertEqual(voided.status_code, 200)
        self.assertIsNone(voided.json()["paid_at"])
        self.assertEqual(
            self.post(f"driver/payments/{pending['id']}/void/", {}).status_code, 409
        )
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "active")
        for user in (self.other_user, self.parent, self.admin):
            self.as_user(user)
            expected = 404 if user == self.other_user else 403
            self.assertEqual(
                self.get(f"driver/payments/{payment_id}/").status_code, expected
            )
            self.assertEqual(
                self.post(f"driver/payments/{payment_id}/void/", {}).status_code,
                expected,
            )
            self.assertEqual(
                self.post("driver/payments/", payload).status_code, expected
            )
            if user == self.admin:
                general = self.get(f"admin/drivers/{self.driver.id}/publication/")
                self.assertEqual(general.status_code, 200)
                self.assertNotIn("Estudiante Ficticio", general.content.decode())
                self.assertNotIn("50000", general.content.decode())
        self.client.logout()
        self.assertEqual(self.get("driver/payments/").status_code, 403)


class FinalSeatConcurrencyTests(TransactionTestCase):
    def test_postgresql_route_lock_serializes_final_seat(self):
        self.assertEqual(transaction.get_connection().vendor, "postgresql")
        user = User.objects.create_user(
            "concurrent@example.test", "Synthetic-Only-Password-781!", role="driver"
        )
        driver = DriverProfile.objects.create(
            user=user, display_name="Conductor Ficticio"
        )
        route = Route.objects.create(
            driver=driver,
            label="Ruta ficticia",
            status="active",
            weekdays=["monday"],
            start_time=time(7),
            end_time=time(8),
            seat_capacity=1,
            destination_label="Escuela ficticia",
            destination_address="Dirección ficticia",
        )
        barrier = Barrier(2)
        results = []

        def attempt(index):
            close_old_connections()
            barrier.wait()
            try:
                with transaction.atomic():
                    locked = Route.objects.select_for_update().get(pk=route.pk)
                    validate_capacity(
                        locked, replacement=(None, date(2026, 9, 28), None)
                    )
                    PassengerAssignment.objects.create(
                        route=locked,
                        student_display_name=f"Estudiante Ficticio {index}",
                        pickup_instruction="Parada ficticia",
                        guardian_display_name="Apoderado Ficticio",
                        guardian_contact="912345678",
                        starts_on=date(2026, 9, 28),
                    )
                results.append("created")
            except ValidationError:
                results.append("full")
            finally:
                close_old_connections()

        threads = [Thread(target=attempt, args=(index,)) for index in (1, 2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
            self.assertFalse(thread.is_alive())
        self.assertCountEqual(results, ["created", "full"])
        self.assertEqual(
            capacity_snapshot(route, date(2026, 9, 28))["available_seats"], 0
        )
        self.assertEqual(PassengerAssignment.objects.filter(route=route).count(), 1)
