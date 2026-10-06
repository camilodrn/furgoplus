import json
from datetime import timedelta
from threading import Barrier, Thread
from unittest.mock import patch

from django.db import close_old_connections, transaction
from django.test import Client, TestCase, TransactionTestCase
from django.utils import timezone

from accounts.models import DriverProfile, User
from drivers import test_contact
from drivers.models import (
    AdminActionLog,
    ContactRequest,
    DriverDocument,
    DriverSubscription,
    DriverValidation,
    PassengerAssignment,
    PaymentRecord,
    Plan,
    ValidationDocument,
)
from drivers.publication import CHILE
from drivers.test_contact import Fixture


class AdminControlTests(Fixture, TestCase):
    def setUp(self):
        self.setup_fixture()
        self.control = f"admin/drivers/{self.driver.pk}/"

    def change_status(self, status, reason="Motivo sintético", **overrides):
        current = self.get(self.control).json()
        return self.post(
            self.control + "status/",
            {
                "status": status,
                "expected_status": current["publication"]["profile_status"],
                "expected_version": current["profile_version"],
                "reason": reason,
                **overrides,
            },
        )

    def test_queue_authoritative_filters_pagination_and_search(self):
        self.as_user(self.admin)
        queries = {
            "q=conductor": [self.driver.pk],
            "q=DRIVER%40example.test&validation_state=approved": [self.driver.pk],
            "profile_status=active&plan_code=basic&subscription_status=active": [
                self.driver.pk
            ],
            "publication=eligible": [self.driver.pk],
            "publication=blocked&subscription_status=missing&validation_state=draft": [
                self.other_driver.pk
            ],
            "blocker=subscription_missing": [self.other_driver.pk],
            "q=no-match": [],
        }
        for query, expected in queries.items():
            with self.subTest(query=query):
                response = self.get("admin/drivers/?" + query)
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(
                    [row["id"] for row in response.json()["results"]], expected
                )
                self.assertIn("no-store", response["Cache-Control"])
        response = self.get("admin/drivers/?offset=1&limit=1").json()
        self.assertEqual(response["count"], 2)
        self.assertEqual(
            [row["id"] for row in response["results"]], [self.other_driver.pk]
        )
        self.change_status("suspended")
        self.assertEqual(
            self.get("admin/drivers/?profile_status=suspended").json()["count"], 1
        )
        for query in (
            "plan_code=gold",
            "profile_status=missing",
            "blocker=unknown",
            "limit=51",
            "offset=-1",
            "q=a&q=b",
            "ranking=best",
        ):
            self.assertEqual(self.get("admin/drivers/?" + query).status_code, 400)

    def test_control_authorization_disabled_account_staff_csrf_and_unknown_ids(self):
        paths = ("", "history/", "validations/", "subscription/", "publication/")
        # Publication lives at this existing per-driver path.
        for user in (self.parent_user, self.driver_user, self.other_driver_user):
            self.as_user(user)
            self.assertEqual(self.get("admin/drivers/").status_code, 403)
            for suffix in paths:
                response = self.get(self.control + suffix)
                self.assertEqual(response.status_code, 403, response.content)
                self.assertIn("no-store", response["Cache-Control"])
            self.assertEqual(self.post(self.control + "status/", {}).status_code, 403)
            self.assertEqual(
                self.post(self.control + "subscription/", {}).status_code, 403
            )
        self.as_user(self.admin)
        for suffix in ("", "history/", "validations/", "subscription/"):
            self.assertEqual(
                self.get("admin/drivers/999999/" + suffix).status_code, 404
            )
        self.assertEqual(
            self.post(
                "admin/drivers/999999/status/",
                {
                    "status": "suspended",
                    "expected_status": "active",
                    "expected_version": None,
                    "reason": "Motivo",
                },
            ).status_code,
            404,
        )
        response = self.client.post(
            "/api/v1/" + self.control + "status/",
            "{}",
            content_type="application/json",
            secure=True,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "csrf_failed")
        self.admin.is_staff = False
        self.admin.save(update_fields=["is_staff"])
        self.assertEqual(self.get(self.control).status_code, 403)
        self.admin.is_staff = True
        self.admin.is_active = False
        self.admin.save(update_fields=["is_staff", "is_active"])
        self.assertEqual(self.get(self.control).json()["code"], "not_authenticated")
        self.client.logout()
        self.assertEqual(self.get("admin/drivers/").json()["code"], "not_authenticated")

    def test_reason_exact_input_and_invalid_or_stale_transition(self):
        self.as_user(self.admin)
        for reason in ("", "   ", "x" * 1001):
            self.assertEqual(self.change_status("suspended", reason).status_code, 400)
        self.assertEqual(self.change_status("suspended", extra="no").status_code, 400)
        self.assertEqual(self.post(self.control + "status/", []).status_code, 400)
        self.assertEqual(self.change_status("active").status_code, 409)
        self.assertEqual(
            self.change_status("suspended", expected_status="deactivated").status_code,
            409,
        )
        self.assertEqual(
            self.change_status("suspended", expected_version=999999).status_code, 409
        )
        self.assertEqual(AdminActionLog.objects.count(), 0)
        self.assertEqual(self.change_status("suspended").status_code, 200)
        self.assertEqual(self.change_status("active").status_code, 200)
        # Status alone would allow a stale attempt after restoration.
        self.assertEqual(
            self.change_status("suspended", expected_version=None).status_code, 409
        )
        self.assertEqual(self.change_status("deactivated").status_code, 200)
        self.assertEqual(self.change_status("suspended").status_code, 409)

    def test_all_profile_transitions_minimal_atomic_audit_and_unchanged_other_gates(
        self,
    ):
        self.as_user(self.admin)
        before = DriverProfile.objects.values().get(pk=self.driver.pk)
        subscription_before = DriverSubscription.objects.values().get(
            driver=self.driver
        )
        for status in (
            "suspended",
            "deactivated",
            "active",
            "deactivated",
            "active",
            "suspended",
            "active",
        ):
            response = self.change_status(status, "  Control sintético  ")
            self.assertEqual(response.status_code, 200, response.content)
            entry = AdminActionLog.objects.latest("id")
            self.assertEqual(entry.actor, self.admin)
            self.assertEqual(entry.action, "profile_status_changed")
            self.assertEqual(entry.target_type, "driver_profile")
            self.assertEqual(entry.target_id, self.driver.pk)
            self.assertEqual(entry.reason, "Control sintético")
            self.assertEqual(entry.before_detail, {"status": entry.before_state})
            self.assertEqual(entry.after_detail, {"status": status})
            self.assertEqual(len(entry.correlation_id), 36)
            self.assertEqual(response.json()["profile_version"], entry.pk)
        after = DriverProfile.objects.values().get(pk=self.driver.pk)
        self.assertEqual(before, after)
        self.assertEqual(
            subscription_before,
            DriverSubscription.objects.values().get(driver=self.driver),
        )
        count = AdminActionLog.objects.count()
        with patch(
            "drivers.publication.AdminActionLog.objects.create",
            side_effect=RuntimeError("audit failed"),
        ):
            with self.assertRaises(RuntimeError):
                self.change_status("suspended")
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.status, "active")
        self.assertEqual(AdminActionLog.objects.count(), count)

    def test_suspend_deactivate_restore_immediate_discovery_and_participant_history(
        self,
    ):
        second = test_contact.ContactTests._eligible_extra(self, 3)
        self.as_user(self.parent_user)
        self.assertEqual(
            self.get(
                f"discovery/compare/?ids={self.driver.pk},{second.pk}"
            ).status_code,
            200,
        )
        request = self.post("parent/contact-requests/", self.payload())
        self.assertEqual(request.status_code, 201, request.content)
        request_id = request.json()["id"]
        for status in ("suspended", "deactivated"):
            self.as_user(self.admin)
            self.assertEqual(self.change_status(status).status_code, 200)
            self.as_user(self.parent_user)
            self.assertEqual(
                self.get(f"discovery/drivers/{self.driver.pk}/").status_code, 404
            )
            self.assertEqual(
                [row["id"] for row in self.get("discovery/drivers/").json()["results"]],
                [second.pk],
            )
            self.assertEqual(
                self.get(
                    f"discovery/compare/?ids={self.driver.pk},{second.pk}"
                ).status_code,
                404,
            )
            self.assertEqual(
                self.post("parent/contact-requests/", self.payload()).status_code, 404
            )
            self.assertEqual(
                self.get(f"parent/contact-requests/{request_id}/").status_code, 200
            )
            self.as_user(self.driver_user)
            for path in (
                "driver/profile/",
                "driver/publication/",
                "driver/summary/",
                "driver/routes/",
                "driver/documents/",
                "driver/validations/",
                "driver/contact-requests/",
            ):
                self.assertEqual(self.get(path).status_code, 200)
            self.assertEqual(
                self.get(f"driver/contact-requests/{request_id}/").status_code, 200
            )
            self.assertEqual(
                self.post(
                    f"driver/contact-requests/{request_id}/accept/", {}
                ).status_code,
                409,
            )
            self.as_user(self.admin)
            response = self.change_status("active")
            self.assertTrue(response.json()["publication"]["eligible"])
            self.as_user(self.parent_user)
            self.assertEqual(
                self.get(f"discovery/drivers/{self.driver.pk}/").status_code, 200
            )
        self.as_user(self.other_parent_user)
        self.assertEqual(
            self.get(f"parent/contact-requests/{request_id}/").status_code, 404
        )
        self.as_user(self.other_driver_user)
        self.assertEqual(
            self.get(f"driver/contact-requests/{request_id}/").status_code, 404
        )

    def test_restore_rechecks_every_existing_gate(self):
        now = timezone.now()
        yesterday = timezone.localtime(now, CHILE).date() - timedelta(days=1)
        gates = {
            "account_inactive": lambda: User.objects.filter(
                pk=self.driver_user.pk
            ).update(is_active=False),
            "publication_not_requested": lambda: DriverProfile.objects.filter(
                pk=self.driver.pk
            ).update(publication_requested=False),
            "validation_not_approved": lambda: DriverProfile.objects.filter(
                pk=self.driver.pk
            ).update(validation_state="rejected"),
            "approved_revision_stale": lambda: DriverProfile.objects.filter(
                pk=self.driver.pk
            ).update(current_validation_revision=2),
            "required_document_missing": lambda: DriverDocument.objects.filter(
                driver=self.driver
            ).delete(),
            "required_document_expired": lambda: DriverDocument.objects.filter(
                driver=self.driver
            ).update(expires_on=yesterday),
            "subscription_missing": lambda: DriverSubscription.objects.filter(
                driver=self.driver
            ).delete(),
            "subscription_inactive": lambda: DriverSubscription.objects.filter(
                driver=self.driver
            ).update(status="inactive"),
            "subscription_suspended": lambda: DriverSubscription.objects.filter(
                driver=self.driver
            ).update(status="suspended"),
            "subscription_expired": lambda: DriverSubscription.objects.filter(
                driver=self.driver
            ).update(
                starts_at=now - timedelta(days=2), ends_at=now - timedelta(days=1)
            ),
            "subscription_not_started": lambda: DriverSubscription.objects.filter(
                driver=self.driver
            ).update(
                starts_at=now + timedelta(days=1), ends_at=now + timedelta(days=2)
            ),
            "profile_display_name_missing": lambda: DriverProfile.objects.filter(
                pk=self.driver.pk
            ).update(display_name=""),
            "profile_summary_missing": lambda: DriverProfile.objects.filter(
                pk=self.driver.pk
            ).update(service_summary=""),
            "service_contact_email_missing": lambda: DriverProfile.objects.filter(
                pk=self.driver.pk
            ).update(service_contact_email=""),
            "active_route_missing": lambda: self.driver.routes.update(
                status="inactive"
            ),
        }
        for blocker, apply_gate in gates.items():
            with self.subTest(blocker=blocker), transaction.atomic():
                self.as_user(self.admin)
                self.assertEqual(self.change_status("suspended").status_code, 200)
                apply_gate()
                response = self.change_status("active")
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.json()["publication"]["eligible"])
                self.assertIn(
                    blocker,
                    [b["code"] for b in response.json()["publication"]["blockers"]],
                )
                self.as_user(self.parent_user)
                self.assertEqual(
                    self.get(f"discovery/drivers/{self.driver.pk}/").status_code, 404
                )
                self.assertEqual(
                    self.post("parent/contact-requests/", self.payload()).status_code,
                    404,
                )
                transaction.set_rollback(True)

    def test_subscription_mutations_audited_and_immediately_derived(self):
        self.as_user(self.admin)
        version = None
        for plan, status in (
            ("pro", "suspended"),
            ("elite", "inactive"),
            ("basic", "active"),
        ):
            response = self.post(
                self.control + "subscription/",
                {
                    "plan_code": plan,
                    "status": status,
                    "starts_at": (timezone.now() - timedelta(days=1)).isoformat(),
                    "ends_at": (timezone.now() + timedelta(days=1)).isoformat(),
                    "reason": "Cambio sintético",
                    "expected_version": version,
                },
            )
            self.assertEqual(response.status_code, 200, response.content)
            version = response.json()["version"]
            log = AdminActionLog.objects.get(pk=version)
            self.assertEqual(log.action, "subscription_changed")
            self.assertEqual(log.after_detail["plan_code"], plan)
            self.assertEqual(log.after_detail["status"], status)
            self.assertEqual(
                response.json()["publication"]["eligible"], status == "active"
            )
            self.as_user(self.parent_user)
            self.assertEqual(
                self.get(f"discovery/drivers/{self.driver.pk}/").status_code,
                200 if status == "active" else 404,
            )
            self.as_user(self.admin)

    def test_admin_and_cross_driver_private_ids_remain_denied(self):
        assignment = PassengerAssignment.objects.create(
            route=self.route,
            student_display_name="Estudiante secreto",
            pickup_instruction="Recogida secreta",
            guardian_display_name="Tutor secreto",
            guardian_contact="912345678",
            starts_on=timezone.now().date(),
        )
        payment = PaymentRecord.objects.create(
            driver=self.driver,
            assignment=assignment,
            service_period_start=timezone.now().date(),
            service_period_end=timezone.now().date(),
            amount_clp=1000,
            due_on=timezone.now().date(),
        )
        self.as_user(self.parent_user)
        request_id = self.post("parent/contact-requests/", self.payload()).json()["id"]
        self.as_user(self.admin)
        paths = (
            "driver/passenger-assignments/",
            f"driver/passenger-assignments/{assignment.pk}/",
            "driver/payments/",
            f"driver/payments/{payment.pk}/",
            "driver/today/",
            "driver/contact-requests/",
            f"driver/contact-requests/{request_id}/",
            "parent/contact-requests/",
            f"parent/contact-requests/{request_id}/",
            f"driver/routes/{self.route.pk}/",
            "parent/profile/",
        )
        for path in paths:
            self.assertEqual(self.get(path).status_code, 403)
        for path in (
            f"driver/passenger-assignments/{assignment.pk}/end/",
            f"driver/payments/{payment.pk}/void/",
            f"driver/runs/{999999}/end/",
            f"driver/routes/{self.route.pk}/start/",
            f"driver/contact-requests/{request_id}/accept/",
        ):
            self.assertEqual(self.post(path, {}).status_code, 403)
        self.as_user(self.other_driver_user)
        for path in (
            f"driver/passenger-assignments/{assignment.pk}/",
            f"driver/payments/{payment.pk}/",
            f"driver/routes/{self.route.pk}/",
            f"driver/contact-requests/{request_id}/",
        ):
            self.assertEqual(self.get(path).status_code, 404)
        for status in ("suspended", "deactivated"):
            self.as_user(self.admin)
            self.assertEqual(self.change_status(status).status_code, 200)
            self.as_user(self.driver_user)
            self.assertEqual(
                self.get(f"driver/passenger-assignments/{assignment.pk}/").status_code,
                200,
            )
            self.assertEqual(
                self.get(f"driver/payments/{payment.pk}/").status_code, 200
            )
        self.driver_user.is_active = False
        self.driver_user.save(update_fields=["is_active"])
        self.assertEqual(
            self.get("driver/summary/").json()["code"], "not_authenticated"
        )

    def test_history_allowlist_context_observations_and_no_mutation_api(self):
        self.as_user(self.admin)
        self.change_status("suspended")
        revision = DriverValidation.objects.create(
            driver=self.driver,
            revision=1,
            display_name_snapshot="Conductor Demo",
            state="rejected",
            observations="Corrige la revisión",
            reviewer=self.admin,
            reviewed_at=timezone.now(),
        )
        document = self.driver.documents.first()
        ValidationDocument.objects.create(
            validation=revision, document=document, kind=document.kind
        )
        for action, target, target_id in (
            ("validation_rejected", "validation", revision.pk),
            ("document_read", "document", document.pk),
            ("unrelated", "payment", 999999),
            ("profile_status_changed", "driver_profile", self.other_driver.pk),
        ):
            AdminActionLog.objects.create(
                actor=self.admin,
                action=action,
                target_type=target,
                target_id=target_id,
                correlation_id="synthetic",
                before_detail={"storage_key": "secret", "message": "private"},
                after_detail={"password": "secret", "guardian_contact": "secret"},
            )
        AdminActionLog.objects.create(
            actor=self.admin,
            action="subscription_changed",
            target_type="subscription",
            target_id=self.driver.pk,
            correlation_id="subscription-synthetic",
            before_detail={
                "plan_code": "basic",
                "status": "inactive",
                "message": "private",
            },
            after_detail={
                "plan_code": "pro",
                "status": "active",
                "starts_at": None,
                "ends_at": None,
                "storage_key": "private",
            },
        )
        history = self.get(self.control + "history/")
        self.assertIn("no-store", history["Cache-Control"])
        self.assertEqual(history.json()["count"], 4)
        for entry in history.json()["results"]:
            self.assertEqual(
                set(entry),
                {
                    "id",
                    "actor",
                    "action",
                    "target_type",
                    "target_id",
                    "occurred_at",
                    "correlation_id",
                    "reason",
                    "before",
                    "after",
                },
            )
            self.assertEqual(set(entry["actor"]), {"id", "display_name"})
        subscription_log = history.json()["results"][0]
        self.assertEqual(
            subscription_log["before"], {"plan_code": "basic", "status": "inactive"}
        )
        self.assertEqual(
            subscription_log["after"],
            {
                "plan_code": "pro",
                "status": "active",
                "starts_at": None,
                "ends_at": None,
            },
        )
        serialized = json.dumps(history.json())
        for field in (
            "storage_key",
            "password",
            "guardian_contact",
            "pickup_instruction",
            "student_display_name",
            "amount_clp",
            "message",
            "service_contact_email",
        ):
            self.assertNotIn(field, serialized)
        self.assertEqual(
            self.get(self.control + "history/?offset=1&limit=1").json()["count"], 4
        )
        revisions = self.get(self.control + "validations/").json()
        self.assertEqual(revisions["results"][0]["observations"], "Corrige la revisión")
        self.assertNotIn("documents", revisions["results"][0])
        self.assertEqual(self.post(self.control + "history/", {}).status_code, 405)
        self.assertEqual(
            self.client.delete(
                "/api/v1/" + self.control + "history/",
                secure=True,
                HTTP_X_CSRFTOKEN=self.token,
                HTTP_ORIGIN="https://testserver",
            ).status_code,
            405,
        )

    def test_accepted_participant_contact_history_remains_private_after_suspension(
        self,
    ):
        self.as_user(self.parent_user)
        request_id = self.post("parent/contact-requests/", self.payload()).json()["id"]
        self.as_user(self.driver_user)
        self.assertEqual(
            self.post(f"driver/contact-requests/{request_id}/accept/", {}).status_code,
            200,
        )
        before = self.get(f"driver/contact-requests/{request_id}/").json()
        self.as_user(self.admin)
        self.assertEqual(self.change_status("suspended").status_code, 200)
        self.assertEqual(
            self.get(f"driver/contact-requests/{request_id}/").status_code, 403
        )
        self.as_user(self.driver_user)
        self.assertEqual(
            self.get(f"driver/contact-requests/{request_id}/").json(), before
        )
        self.as_user(self.parent_user)
        self.assertEqual(
            self.get(f"parent/contact-requests/{request_id}/").json()["status"],
            "accepted",
        )
        self.assertEqual(ContactRequest.objects.get(pk=request_id).status, "accepted")


class ProfileControlConcurrencyTests(Fixture, TransactionTestCase):
    def setUp(self):
        Plan.objects.get_or_create(code="basic", defaults={"display_label": "Basic"})
        self.setup_fixture()

    def test_competing_profile_controls_one_commit_one_conflict(self):
        barrier = Barrier(2)
        results = []
        errors = []

        def control(status):
            close_old_connections()
            try:
                client = Client(enforce_csrf_checks=True)
                client.force_login(self.admin)
                token = client.get("/api/v1/auth/csrf/", secure=True).json()[
                    "csrf_token"
                ]
                barrier.wait(timeout=10)
                response = client.post(
                    f"/api/v1/admin/drivers/{self.driver.pk}/status/",
                    json.dumps(
                        {
                            "status": status,
                            "expected_status": "active",
                            "expected_version": None,
                            "reason": "Concurrent control",
                        }
                    ),
                    content_type="application/json",
                    secure=True,
                    HTTP_ORIGIN="https://testserver",
                    HTTP_X_CSRFTOKEN=token,
                )
                results.append(response.status_code)
            except Exception as exc:
                errors.append(exc)
            finally:
                close_old_connections()

        threads = [
            Thread(target=control, args=(status,))
            for status in ("suspended", "deactivated")
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])
        self.assertEqual(sorted(results), [200, 409])
        self.assertEqual(
            AdminActionLog.objects.filter(action="profile_status_changed").count(), 1
        )
        self.driver.refresh_from_db()
        self.assertEqual(
            self.driver.status,
            AdminActionLog.objects.get(action="profile_status_changed").after_state,
        )
