import json
from datetime import UTC, datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.utils import timezone

from accounts.models import DriverProfile, User
from drivers.models import (
    AdminActionLog,
    Commune,
    DriverDocument,
    DriverSubscription,
    Plan,
    Route,
    RouteCoverage,
)
from drivers.publication import CHILE, publication_state
from drivers.services import CHECKLIST

BASE = "/api/v1/"
PASSWORD = "Synthetic-Only-Password-781!"


class PublicationTests(TestCase):
    def setUp(self):
        self.driver_user = User.objects.create_user(
            "driver@example.test", PASSWORD, role="driver"
        )
        self.other_user = User.objects.create_user(
            "other@example.test", PASSWORD, role="driver"
        )
        self.parent = User.objects.create_user(
            "parent@example.test", PASSWORD, role="parent"
        )
        self.admin = User.objects.create_superuser("admin@example.test", PASSWORD)
        self.driver = DriverProfile.objects.create(
            user=self.driver_user,
            display_name="Conductor Demo",
            service_summary="Servicio demo",
            service_contact_email="service@example.test",
            publication_requested=True,
            validation_state="approved",
            approved_revision=1,
        )
        self.other = DriverProfile.objects.create(
            user=self.other_user, display_name="Otro"
        )
        self.commune = Commune.objects.create(
            code="demo-norte", display_name="Comuna Demo Norte"
        )
        self.south = Commune.objects.create(
            code="demo-sur", display_name="Comuna Demo Sur"
        )
        self.now = timezone.now()
        for kind, _, expiry in CHECKLIST:
            DriverDocument.objects.create(
                driver=self.driver,
                kind=kind,
                storage_key=f"{kind}.pdf",
                content_type="application/pdf",
                byte_size=10,
                sha256="0" * 64,
                expires_on=timezone.localtime(self.now, CHILE).date()
                + timedelta(days=1)
                if expiry
                else None,
            )
        self.subscription = DriverSubscription.objects.create(
            driver=self.driver,
            plan=Plan.objects.get(code="basic"),
            status="active",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )
        self.route = Route.objects.create(
            driver=self.driver,
            label="Ruta demo",
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

    def test_plan_seed_and_complete_truth_table(self):
        self.assertEqual(
            list(Plan.objects.order_by("code").values_list("code", flat=True)),
            ["basic", "elite", "pro"],
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Plan.objects.create(code="basic", display_label="Duplicado")
        self.assertTrue(publication_state(self.driver, self.now).eligible)
        mutations = [
            (self.driver_user, "is_active", False, "account_inactive"),
            (self.driver, "status", "suspended", "driver_suspended"),
            (self.driver, "status", "deactivated", "driver_deactivated"),
            (self.driver, "publication_requested", False, "publication_not_requested"),
            (self.driver, "validation_state", "pending", "validation_not_approved"),
            (self.driver, "validation_state", "rejected", "validation_not_approved"),
            (self.driver, "approved_revision", 2, "approved_revision_stale"),
            (self.subscription, "status", "inactive", "subscription_inactive"),
            (self.subscription, "status", "suspended", "subscription_suspended"),
            (
                self.subscription,
                "starts_at",
                self.now + timedelta(seconds=1),
                "subscription_not_started",
            ),
            (self.subscription, "ends_at", self.now, "subscription_expired"),
            (self.driver, "display_name", " ", "profile_display_name_missing"),
            (self.driver, "service_summary", " ", "profile_summary_missing"),
            (self.driver, "service_contact_email", "", "service_contact_email_missing"),
            (self.route, "status", "inactive", "active_route_missing"),
            (self.route, "weekdays", [], "active_route_missing"),
            (self.route, "destination_address", "", "active_route_missing"),
        ]
        for obj, field, value, code in mutations:
            with self.subTest(code=code, value=value):
                old = getattr(obj, field)
                setattr(obj, field, value)
                if obj in (self.subscription, self.route):
                    obj.save(update_fields=[field])
                state = publication_state(self.driver, self.now)
                self.assertFalse(state.eligible)
                self.assertIn(code, state.blockers)
                setattr(obj, field, old)
                if obj in (self.subscription, self.route):
                    obj.save(update_fields=[field])
        self.subscription.delete()
        self.assertIn(
            "subscription_missing", publication_state(self.driver, self.now).blockers
        )

    def test_missing_documents_route_and_combined_gates(self):
        self.assertTrue(publication_state(self.driver, self.now).eligible)
        DriverDocument.objects.filter(
            driver=self.driver, kind="demo_identity_document"
        ).update(is_current=False)
        RouteCoverage.objects.filter(route=self.route).delete()
        self.driver.publication_requested = False
        blockers = publication_state(self.driver, self.now).blockers
        self.assertIn("required_document_missing", blockers)
        self.assertIn("active_route_missing", blockers)
        self.assertIn("publication_not_requested", blockers)
        self.assertFalse(publication_state(self.driver, self.now).eligible)

    def test_chilean_document_end_of_day(self):
        before_midnight = datetime(2026, 10, 1, 2, 59, 59, tzinfo=UTC)
        after_midnight = before_midnight + timedelta(seconds=1)
        expiring_kinds = [kind for kind, _, expiry in CHECKLIST if expiry]
        DriverDocument.objects.filter(
            driver=self.driver, kind__in=expiring_kinds
        ).update(expires_on=timezone.localtime(before_midnight, CHILE).date())
        self.assertNotIn(
            "required_document_expired",
            publication_state(self.driver, before_midnight).blockers,
        )
        self.assertIn(
            "required_document_expired",
            publication_state(self.driver, after_midnight).blockers,
        )

    def test_documents_and_local_expiration_boundary(self):
        doc = DriverDocument.objects.get(
            driver=self.driver, kind="demo_expiring_credential"
        )
        doc.expires_on = timezone.localdate(self.now)
        DriverDocument.objects.filter(pk=doc.pk).update(expires_on=doc.expires_on)
        self.assertTrue(publication_state(self.driver, self.now).eligible)
        DriverDocument.objects.filter(pk=doc.pk).update(
            expires_on=doc.expires_on - timedelta(days=1)
        )
        self.assertIn(
            "required_document_expired",
            publication_state(self.driver, self.now).blockers,
        )
        DriverDocument.objects.filter(pk=doc.pk).update(is_current=False)
        self.assertIn(
            "required_document_missing",
            publication_state(self.driver, self.now).blockers,
        )

    def test_coverage_is_derived_from_active_valid_routes(self):
        state = publication_state(self.driver, self.now)
        self.assertEqual([route.pk for route in state.routes], [self.route.pk])
        self.route.status = "inactive"
        self.route.save(update_fields=["status"])
        state = publication_state(self.driver, self.now)
        self.assertEqual(state.routes, ())
        self.assertIn("active_route_missing", state.blockers)
        self.as_user(self.parent)
        self.assertEqual(
            self.client.get(BASE + "discovery/drivers/", secure=True).json()["results"],
            [],
        )
        self.assertEqual(
            self.client.get(
                BASE + f"discovery/drivers/{self.driver.pk}/", secure=True
            ).status_code,
            404,
        )

    def test_discovery_allowlist_and_immediate_hiding(self):
        self.as_user(self.parent)
        listing = self.client.get(
            BASE + "discovery/drivers/?commune=demo-norte", secure=True
        )
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()["results"]), 1)
        self.assertEqual(
            self.client.get(
                BASE + "discovery/drivers/?commune=demo-sur", secure=True
            ).json()["results"],
            [],
        )
        detail = self.client.get(
            BASE + f"discovery/drivers/{self.driver.pk}/", secure=True
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(
            set(detail.json()),
            {
                "id",
                "display_name",
                "service_summary",
                "validation_label",
                "coverage",
                "routes",
            },
        )
        self.assertNotIn("Dirección sintética", detail.content.decode())
        self.assertNotIn("service@example.test", detail.content.decode())
        self.assertEqual(detail["Cache-Control"], "no-store")
        self.assertNotIn("service@example.test", listing.content.decode())
        self.subscription.status = "suspended"
        self.subscription.save(update_fields=["status"])
        self.assertEqual(
            self.client.get(BASE + "discovery/drivers/", secure=True).json()["results"],
            [],
        )
        hidden = self.client.get(
            BASE + f"discovery/drivers/{self.driver.pk}/", secure=True
        )
        self.assertEqual(hidden.status_code, 404)
        self.assertEqual(hidden["Cache-Control"], "no-store")
        self.as_user(self.driver_user)
        self.assertEqual(
            self.client.get(BASE + "discovery/drivers/", secure=True).status_code, 403
        )
        self.assertEqual(
            self.client.get(
                BASE + f"discovery/drivers/{self.driver.pk}/", secure=True
            ).status_code,
            403,
        )
        self.as_user(self.admin)
        self.assertEqual(
            self.client.get(BASE + "discovery/drivers/", secure=True).status_code, 403
        )
        self.assertEqual(
            self.client.get(
                BASE + f"discovery/drivers/{self.driver.pk}/", secure=True
            ).status_code,
            403,
        )

    def test_owner_route_and_publication_actions(self):
        self.as_user(self.other_user)
        self.assertEqual(
            self.client.get(
                BASE + f"driver/routes/{self.route.pk}/", secure=True
            ).status_code,
            404,
        )
        self.assertEqual(
            self.patch(f"driver/routes/{self.route.pk}/", {}).status_code, 404
        )
        self.as_user(self.driver_user)
        body = {
            "label": "Nueva",
            "status": "active",
            "weekdays": ["tuesday"],
            "start_time": "09:00",
            "end_time": "10:00",
            "seat_capacity": 2,
            "destination_label": "Destino demo",
            "destination_address": "Dirección sintética",
            "coverage_codes": ["demo-sur"],
        }
        for field, bad in (
            ("seat_capacity", 0),
            ("weekdays", []),
            ("end_time", "09:00"),
            ("coverage_codes", []),
        ):
            with self.subTest(field=field):
                self.assertEqual(
                    self.post("driver/routes/", {**body, field: bad}).status_code, 400
                )
        created = self.post("driver/routes/", body)
        self.assertEqual(created.status_code, 201, created.content)
        route = created.json()
        self.assertEqual(
            self.patch(
                f"driver/routes/{route['id']}/", {**body, "expected_revision": 0}
            ).status_code,
            409,
        )
        changed = self.patch(
            f"driver/routes/{route['id']}/",
            {**body, "status": "inactive", "expected_revision": 1},
        )
        self.assertEqual(changed.status_code, 200, changed.content)
        self.assertEqual(changed.json()["revision"], 2)
        self.assertEqual(
            self.patch(
                "driver/publication/", {"publication_requested": False}
            ).status_code,
            200,
        )
        self.assertFalse(
            self.client.get(BASE + "driver/publication/", secure=True).json()[
                "eligible"
            ]
        )
        self.driver.refresh_from_db()
        self.assertFalse(self.driver.publication_requested)

    def test_subscription_audit_and_conflict(self):
        self.as_user(self.driver_user)
        body = {
            "plan_code": "pro",
            "status": "active",
            "starts_at": (self.now - timedelta(days=1)).isoformat(),
            "ends_at": (self.now + timedelta(days=2)).isoformat(),
            "reason": "Asignación demo",
            "expected_version": None,
        }
        path = f"admin/drivers/{self.driver.pk}/subscription/"
        self.assertEqual(self.post(path, body).status_code, 403)
        self.as_user(self.admin)
        self.assertEqual(self.post(path, {**body, "reason": ""}).status_code, 400)
        self.assertEqual(
            self.post(path, {**body, "ends_at": body["starts_at"]}).status_code, 400
        )
        self.assertEqual(
            AdminActionLog.objects.filter(target_type="subscription").count(), 0
        )
        self.assertEqual(
            self.post(
                path,
                {**body, "starts_at": "2026-09-01T00:00:00"},
            ).status_code,
            400,
        )
        response = self.post(path, body)
        self.assertEqual(response.status_code, 200, response.content)
        version = response.json()["version"]
        self.subscription.refresh_from_db()
        self.assertEqual(
            (self.subscription.plan.code, self.subscription.status), ("pro", "active")
        )
        self.assertTrue(
            response.json()["publication"]["subscription"]["starts_at"].endswith("Z")
        )
        self.assertEqual(
            AdminActionLog.objects.filter(target_type="subscription").count(), 1
        )
        self.assertEqual(self.post(path, body).status_code, 409)
        self.assertEqual(
            AdminActionLog.objects.filter(target_type="subscription").count(), 1
        )
        suspension = self.post(
            path,
            {
                **body,
                "status": "suspended",
                "reason": "Pausa demo",
                "expected_version": version,
            },
        )
        self.assertEqual(suspension.status_code, 200, suspension.content)
        self.assertEqual(
            AdminActionLog.objects.filter(target_type="subscription").count(), 2
        )
        resumed = self.post(
            path,
            {
                **body,
                "status": "active",
                "reason": "Reactivación demo",
                "expected_version": suspension.json()["version"],
            },
        )
        self.assertEqual(resumed.status_code, 200, resumed.content)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "active")
        self.assertEqual(
            AdminActionLog.objects.filter(target_type="subscription").count(), 3
        )

    def test_database_rejects_invalid_subscription_window(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                DriverSubscription.objects.filter(pk=self.subscription.pk).update(
                    ends_at=self.subscription.starts_at
                )

    def test_coverage_pair_unique(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                RouteCoverage.objects.create(route=self.route, commune=self.commune)
