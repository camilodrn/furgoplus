import json
from datetime import time, timedelta
from threading import Barrier, Thread

from django.db import IntegrityError, close_old_connections, transaction
from django.test import Client, TestCase, TransactionTestCase
from django.utils import timezone

from accounts.models import DriverProfile, ParentProfile, User
from drivers.models import (
    Commune,
    ContactRequest,
    DriverDocument,
    DriverSubscription,
    Plan,
    Review,
    Route,
    RouteCoverage,
)
from drivers.publication import CHILE
from drivers.services import CHECKLIST

BASE = "/api/v1/"
PASSWORD = "Synthetic-Only-Password-781!"


class Fixture:
    def setup_fixture(self):
        self.parent_user = User.objects.create_user(
            "parent@example.test", PASSWORD, role="parent"
        )
        self.parent = ParentProfile.objects.create(
            user=self.parent_user, display_name="Familia Demo"
        )
        self.other_parent_user = User.objects.create_user(
            "other-parent@example.test", PASSWORD, role="parent"
        )
        self.other_parent = ParentProfile.objects.create(
            user=self.other_parent_user, display_name="Otra familia"
        )
        self.driver_user = User.objects.create_user(
            "driver@example.test", PASSWORD, role="driver"
        )
        self.driver = DriverProfile.objects.create(
            user=self.driver_user,
            display_name="Conductor Demo",
            service_summary="Servicio sintético",
            service_contact_email="service@example.test",
            publication_requested=True,
            validation_state="approved",
            approved_revision=1,
        )
        self.other_driver_user = User.objects.create_user(
            "other-driver@example.test", PASSWORD, role="driver"
        )
        self.other_driver = DriverProfile.objects.create(
            user=self.other_driver_user, display_name="Otro"
        )
        self.admin = User.objects.create_superuser("admin@example.test", PASSWORD)
        self.commune = Commune.objects.create(
            code="demo-norte", display_name="Comuna Demo Norte"
        )
        Commune.objects.create(
            code="demo-hidden", display_name="Comuna Demo Oculta", is_active=False
        )
        now = timezone.now()
        for kind, _, expiry in CHECKLIST:
            DriverDocument.objects.create(
                driver=self.driver,
                kind=kind,
                storage_key=f"{kind}.pdf",
                content_type="application/pdf",
                byte_size=10,
                sha256="0" * 64,
                expires_on=timezone.localtime(now, CHILE).date() + timedelta(days=1)
                if expiry
                else None,
            )
        # TransactionTestCase flushes rows seeded by migrations between methods.
        plan, _ = Plan.objects.get_or_create(
            code="basic", defaults={"display_label": "Basic"}
        )
        self.subscription = DriverSubscription.objects.create(
            driver=self.driver,
            plan=plan,
            status="active",
            starts_at=now - timedelta(days=1),
            ends_at=now + timedelta(days=1),
        )
        self.route = Route.objects.create(
            driver=self.driver,
            label="Ruta Demo",
            status="active",
            weekdays=["monday", "friday"],
            start_time=time(7),
            end_time=time(8),
            seat_capacity=3,
            destination_label="Escuela Demo",
            destination_address="Dirección sintética",
        )
        RouteCoverage.objects.create(route=self.route, commune=self.commune)
        self.client = Client(enforce_csrf_checks=True)

    def as_user(self, user):
        self.client.force_login(user)
        self.token = self.get("auth/csrf/").json()["csrf_token"]

    def get(self, path):
        return self.client.get(BASE + path, secure=True)

    def post(self, path, body):
        return self.client.post(
            BASE + path,
            json.dumps(body),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def payload(self):
        return {
            "driver_id": self.driver.pk,
            "message": "Consulta de servicio",
            "consent_share_email": True,
        }


class ContactTests(Fixture, TestCase):
    def setUp(self):
        self.setup_fixture()

    def test_communes_and_role_gate(self):
        self.as_user(self.parent_user)
        response = self.get("discovery/communes/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["communes"],
            [{"code": "demo-norte", "display_name": "Comuna Demo Norte"}],
        )
        for user in (self.driver_user, self.admin):
            self.as_user(user)
            self.assertEqual(self.get("discovery/communes/").status_code, 403)
        self.client.logout()
        self.assertEqual(self.get("discovery/communes/").status_code, 403)

    def test_reviews_public_boundary_and_constraints(self):
        self.as_user(self.parent_user)
        empty = self.get(f"discovery/drivers/{self.driver.pk}/").json()
        self.assertEqual(
            (empty["review_average"], empty["review_count"], empty["reviews"]),
            (None, 0, []),
        )
        Review.objects.create(
            parent=self.parent,
            driver=self.driver,
            score=5,
            text="Demo",
            status="published",
            is_demo=True,
        )
        Review.objects.create(
            parent=self.other_parent,
            driver=self.driver,
            score=1,
            text="Oculta",
            status="hidden",
        )
        detail = self.get(f"discovery/drivers/{self.driver.pk}/").json()
        self.assertEqual((detail["review_average"], detail["review_count"]), (5, 1))
        self.assertEqual(len(detail["reviews"]), 1)
        self.assertTrue(detail["reviews"][0]["is_demo"])
        self.assertNotIn("parent", json.dumps(detail))
        for private in (
            "service_contact_email",
            "destination_address",
            "subscription",
            "document",
            "email",
        ):
            self.assertNotIn(private, json.dumps(detail))
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Review.objects.create(
                    parent=self.parent, driver=self.driver, score=4, status="published"
                )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Review.objects.create(
                    parent=self.other_parent,
                    driver=self.other_driver,
                    score=6,
                    status="published",
                )

    def test_compare_validation_eligibility_order_and_role(self):
        self.as_user(self.parent_user)
        for ids in (
            str(self.driver.pk),
            "1,2,3,4",
            f"{self.driver.pk},{self.driver.pk}",
            "abc,2",
        ):
            self.assertEqual(self.get(f"discovery/compare/?ids={ids}").status_code, 400)
        self.assertEqual(
            self.get(
                f"discovery/compare/?ids={self.driver.pk},{self.other_driver.pk}"
            ).status_code,
            404,
        )
        self.as_user(self.driver_user)
        self.assertEqual(self.get("discovery/compare/?ids=1,2").status_code, 403)
        self.as_user(self.admin)
        self.assertEqual(self.get("discovery/compare/?ids=1,2").status_code, 403)

    def _eligible_extra(self, number):
        user = User.objects.create_user(
            f"driver-{number}@example.test", PASSWORD, role="driver"
        )
        driver = DriverProfile.objects.create(
            user=user,
            display_name=f"Conductor Demo {number}",
            service_summary="Servicio sintético",
            service_contact_email=f"service-{number}@example.test",
            publication_requested=True,
            validation_state="approved",
            approved_revision=1,
        )
        now = timezone.now()
        for kind, _, expiry in CHECKLIST:
            DriverDocument.objects.create(
                driver=driver,
                kind=kind,
                storage_key=f"{number}-{kind}.pdf",
                content_type="application/pdf",
                byte_size=10,
                sha256="0" * 64,
                expires_on=timezone.localtime(now, CHILE).date() + timedelta(days=1)
                if expiry
                else None,
            )
        DriverSubscription.objects.create(
            driver=driver,
            plan=Plan.objects.get(code="basic"),
            status="active",
            starts_at=now - timedelta(days=1),
            ends_at=now + timedelta(days=1),
        )
        route = Route.objects.create(
            driver=driver,
            label=f"Ruta Demo {number}",
            status="active",
            weekdays=["monday"],
            start_time=time(7),
            end_time=time(8),
            seat_capacity=2,
            destination_label="Escuela Demo",
            destination_address="Dirección sintética",
        )
        RouteCoverage.objects.create(route=route, commune=self.commune)
        return driver

    def test_compare_two_and_three_use_search_summary_in_requested_order(self):
        second = self._eligible_extra(2)
        third = self._eligible_extra(3)
        self.as_user(self.parent_user)
        search = self.get("discovery/drivers/?commune=demo-norte").json()["results"]
        by_id = {item["id"]: item for item in search}
        for ids in ([second.pk, self.driver.pk], [third.pk, second.pk, self.driver.pk]):
            response = self.get("discovery/compare/?ids=" + ",".join(map(str, ids)))
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response["Cache-Control"], "no-store")
            self.assertEqual(response.json()["results"], [by_id[id] for id in ids])

    def test_create_duplicate_consent_and_privacy(self):
        self.as_user(self.parent_user)
        for change in (
            {"consent_share_email": False},
            {"consent_share_email": None},
            {"message": "x" * 501},
            {"message": "  "},
        ):
            self.assertEqual(
                self.post(
                    "parent/contact-requests/", {**self.payload(), **change}
                ).status_code,
                400,
            )
        response = self.post(
            "parent/contact-requests/",
            {**self.payload(), "email": "client@example.test"},
        )
        self.assertEqual(response.status_code, 400)
        response = self.post("parent/contact-requests/", self.payload())
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response["Cache-Control"], "no-store")
        row = ContactRequest.objects.get()
        self.assertEqual(row.parent_email_snapshot, self.parent_user.email)
        self.assertIsNone(response.json()["driver_service_email"])
        self.assertEqual(
            self.post("parent/contact-requests/", self.payload()).status_code, 409
        )
        self.assertEqual(ContactRequest.objects.count(), 1)
        self.assertEqual(self.route.seat_capacity, 3)

    def test_ownership_transitions_snapshots_and_hidden_history(self):
        self.as_user(self.parent_user)
        created = self.post("parent/contact-requests/", self.payload()).json()
        path = f"parent/contact-requests/{created['id']}/"
        self.as_user(self.other_parent_user)
        self.assertEqual(self.get(path).status_code, 404)
        self.assertEqual(self.post(path + "cancel/", {}).status_code, 404)
        self.as_user(self.other_driver_user)
        self.assertEqual(
            self.get(f"driver/contact-requests/{created['id']}/").status_code,
            404,
        )
        self.assertEqual(
            self.post(
                f"driver/contact-requests/{created['id']}/accept/", {}
            ).status_code,
            404,
        )
        self.as_user(self.admin)
        self.assertEqual(self.get("driver/contact-requests/").status_code, 403)
        self.assertEqual(self.get("parent/contact-requests/").status_code, 403)
        self.as_user(self.driver_user)
        incoming = self.get(f"driver/contact-requests/{created['id']}/").json()
        self.assertEqual(incoming["parent_email"], self.parent_user.email)
        self.assertNotIn("driver_service_email", incoming)
        self.driver.service_contact_email = "updated@example.test"
        self.driver.save(update_fields=["service_contact_email"])
        accepted = self.post(f"driver/contact-requests/{created['id']}/accept/", {})
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertEqual(
            self.post(
                f"driver/contact-requests/{created['id']}/decline/", {}
            ).status_code,
            409,
        )
        self.driver.service_contact_email = "later@example.test"
        self.driver.save(update_fields=["service_contact_email"])
        self.parent_user.email = "later-parent@example.test"
        self.parent_user.save(update_fields=["email"])
        self.subscription.status = "suspended"
        self.subscription.save(update_fields=["status"])
        self.as_user(self.parent_user)
        history = self.get(path).json()
        self.assertEqual(history["driver_service_email"], "updated@example.test")
        self.assertEqual(
            self.post("parent/contact-requests/", self.payload()).status_code, 404
        )
        self.assertEqual(
            self.get(f"discovery/drivers/{self.driver.pk}/").status_code,
            404,
        )
        self.assertEqual(
            self.get(
                f"discovery/compare/?ids={self.driver.pk},{self.other_driver.pk}"
            ).status_code,
            404,
        )

    def test_hidden_pending_can_decline_or_cancel_but_not_accept(self):
        self.as_user(self.parent_user)
        first = self.post("parent/contact-requests/", self.payload()).json()["id"]
        self.subscription.status = "suspended"
        self.subscription.save(update_fields=["status"])
        self.as_user(self.driver_user)
        self.assertEqual(
            self.post(f"driver/contact-requests/{first}/accept/", {}).status_code, 409
        )
        self.assertEqual(
            self.post(f"driver/contact-requests/{first}/decline/", {}).status_code, 200
        )
        self.assertEqual(
            self.post(f"driver/contact-requests/{first}/accept/", {}).status_code, 409
        )
        self.subscription.status = "active"
        self.subscription.save(update_fields=["status"])
        self.as_user(self.parent_user)
        second = self.post("parent/contact-requests/", self.payload()).json()["id"]
        self.subscription.status = "suspended"
        self.subscription.save(update_fields=["status"])
        self.assertEqual(
            self.post(f"parent/contact-requests/{second}/cancel/", {}).status_code, 200
        )
        self.assertIsNone(
            self.get(f"parent/contact-requests/{second}/").json()[
                "driver_service_email"
            ]
        )

    def test_parent_profile_only_name(self):
        self.as_user(self.parent_user)
        path = "parent/profile/"
        self.assertEqual(self.get(path).json()["display_name"], "Familia Demo")
        self.assertEqual(
            self.client.patch(
                BASE + path,
                json.dumps({"display_name": "Nuevo nombre"}),
                content_type="application/json",
                secure=True,
                HTTP_ORIGIN="https://testserver",
                HTTP_X_CSRFTOKEN=self.token,
            ).status_code,
            200,
        )
        self.assertEqual(self.parent_user.email, "parent@example.test")


class ContactConcurrencyTests(Fixture, TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.setup_fixture()

    def test_two_parallel_creates_leave_one_pending(self):
        barrier = Barrier(2)
        outcomes = []

        def attempt():
            close_old_connections()
            client = Client(enforce_csrf_checks=True)
            client.force_login(self.parent_user)
            token = client.get(BASE + "auth/csrf/", secure=True).json()["csrf_token"]
            barrier.wait(timeout=10)
            response = client.post(
                BASE + "parent/contact-requests/",
                json.dumps(self.payload()),
                content_type="application/json",
                secure=True,
                HTTP_ORIGIN="https://testserver",
                HTTP_X_CSRFTOKEN=token,
            )
            outcomes.append(response.status_code)
            close_old_connections()

        threads = [Thread(target=attempt) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(sorted(outcomes), [201, 409])
        self.assertEqual(ContactRequest.objects.filter(status="pending").count(), 1)
