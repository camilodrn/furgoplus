from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from accounts.models import DriverProfile, User
from api.contracts import DRIVER_CAPABILITIES, openapi_document
from drivers.capabilities import (
    CAPABILITIES,
    Capability,
    driver_capabilities,
    require_capability,
    subscription_blockers,
)
from drivers.models import AdminActionLog, DriverSubscription, Plan
from drivers.publication import change_subscription

URL = "/api/v1/driver/capabilities/"


class CapabilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("driver@example.test", role="driver")
        self.driver = DriverProfile.objects.create(user=self.user, display_name="Uno")
        self.other = User.objects.create_user("other@example.test", role="driver")
        DriverProfile.objects.create(user=self.other, display_name="Dos")
        self.now = timezone.now()
        self.subscription = DriverSubscription.objects.create(
            driver=self.driver,
            plan=Plan.objects.get(code="basic"),
            status="active",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )

    def read(self):
        return driver_capabilities(self.user, now=self.now)

    def test_commercial_matrix_and_shipped_features(self):
        for code, price, priority in (
            ("basic", 19990, "standard"),
            ("pro", 39990, "preferred"),
            ("elite", 69990, "priority"),
        ):
            with self.subTest(plan=code):
                self.subscription.plan = Plan.objects.get(code=code)
                self.subscription.save()
                body = self.read()
                self.assertEqual(body["plan"]["monthly_price_clp"], price)
                self.assertEqual(body["plan"]["support_priority"], priority)
                self.assertFalse(body["plan"]["automatic_billing"])
                self.assertTrue(body["subscription"]["effective"])
                if code == "basic":
                    with self.assertRaises(PermissionDenied):
                        require_capability(self.user, "reports.monthly.read")
                else:
                    require_capability(self.user, "reports.monthly.read")
                caps = body["capabilities"]
                self.assertTrue(caps["dashboard.basic"]["enabled"])
                self.assertEqual(
                    caps["reports.monthly.read"]["included_in_plan"], code != "basic"
                )
                self.assertEqual(
                    caps["reports.xlsx.export"]["included_in_plan"], code == "elite"
                )
                self.assertEqual(
                    caps["assistant.faq"]["included_in_plan"], code != "basic"
                )
                self.assertEqual(
                    caps["assistant.contextual"]["included_in_plan"], code == "elite"
                )
                for name, state in caps.items():
                    self.assertTrue(state["implemented"])
                    common = name in {
                        "operations.core",
                        "dashboard.basic",
                        "help.center",
                        "support.requests",
                    }
                    self.assertEqual(
                        state["enabled"], common or state["included_in_plan"]
                    )
                    self.assertNotIn("not_implemented", state["blockers"])

    def test_start_inclusive_end_exclusive_and_absent_plan(self):
        start, end = self.subscription.starts_at, self.subscription.ends_at
        for instant, effective, blocker in (
            (start - timedelta(microseconds=1), False, "subscription_not_started"),
            (start, True, None),
            (end - timedelta(microseconds=1), True, None),
            (end, False, "subscription_expired"),
        ):
            with self.subTest(instant=instant):
                body = driver_capabilities(self.user, now=instant)
                self.assertEqual(body["subscription"]["effective"], effective)
                if blocker:
                    self.assertIn(blocker, body["blockers"])
                self.assertTrue(body["capabilities"]["operations.core"]["enabled"])
        body = driver_capabilities(self.other)
        self.assertIsNone(body["plan"])
        self.assertIsNone(body["subscription"])
        self.assertEqual(body["blockers"], ["subscription_missing"])

    def test_suspension_inactive_and_profile_do_not_remove_existing_operations(self):
        for status in ("suspended", "inactive"):
            self.subscription.status = status
            self.subscription.save()
            body = self.read()
            self.assertIn("subscription_" + status, body["blockers"])
            self.assertTrue(body["capabilities"]["dashboard.basic"]["enabled"])
        self.subscription.status = "active"
        self.subscription.save()
        for status in ("suspended", "deactivated", "unknown"):
            self.driver.status = status
            self.driver.save()
            self.assertIn("driver_unavailable", self.read()["blockers"])

    def test_invalid_windows_and_unknown_codes_fail_closed_without_corrupting_db(self):
        for start, end in (
            (None, None),
            (self.now, None),
            (None, self.now),
            (self.now, self.now),
            (self.now, self.now - timedelta(days=1)),
        ):
            candidate = SimpleNamespace(
                plan=SimpleNamespace(code="elite"),
                status="active",
                starts_at=start,
                ends_at=end,
            )
            self.assertIn(
                "subscription_invalid_window",
                subscription_blockers(candidate, self.now),
            )
        candidate = SimpleNamespace(
            plan=SimpleNamespace(code="unknown"),
            status="active",
            starts_at=self.now - timedelta(days=1),
            ends_at=self.now + timedelta(days=1),
        )
        self.assertEqual(subscription_blockers(candidate, self.now), ["plan_unknown"])
        with patch("drivers.capabilities.DriverSubscription.objects") as manager:
            query = manager.select_related.return_value.filter.return_value
            query.first.return_value = candidate
            body = self.read()
        self.assertIsNone(body["plan"])
        self.assertFalse(body["subscription"]["effective"])
        self.assertFalse(body["capabilities"]["reports.xlsx.export"]["enabled"])

    def test_server_gate_requires_inclusion_release_and_current_subscription(self):
        with self.assertRaises(PermissionDenied):
            require_capability(self.user, "unknown")
        with self.assertRaises(PermissionDenied):
            require_capability(self.user, "reports.monthly.read")
        # Exercise the reusable guard with an explicit released definition.
        released = dict(CAPABILITIES)
        released["reports.monthly.read"] = Capability(frozenset({"pro", "elite"}), True)
        with patch("drivers.capabilities.CAPABILITIES", released):
            with self.assertRaises(PermissionDenied):
                require_capability(self.user, "reports.monthly.read")
            self.subscription.plan = Plan.objects.get(code="pro")
            self.subscription.save()
            require_capability(self.user, "reports.monthly.read")
            for status in ("suspended", "inactive"):
                self.subscription.status = status
                self.subscription.save()
                with self.assertRaises(PermissionDenied):
                    require_capability(self.user, "reports.monthly.read")
            self.subscription.status = "active"
            with self.assertRaises(PermissionDenied):
                require_capability(self.other, "reports.monthly.read")
            self.subscription.ends_at = self.now
            self.subscription.save()
            with self.assertRaises(PermissionDenied):
                require_capability(self.user, "reports.monthly.read")
            self.subscription.ends_at = self.now + timedelta(days=1)
            self.subscription.save()
            self.driver.status = "suspended"
            self.driver.save()
            with self.assertRaises(PermissionDenied):
                require_capability(self.user, "reports.monthly.read")

    def test_role_inactive_account_and_missing_profile(self):
        users = [
            AnonymousUser(),
            User.objects.create_user("parent@example.test", role="parent"),
            User.objects.create_superuser("admin@example.test", "Synthetic-test-781!"),
        ]
        for user in users:
            with self.assertRaises(PermissionDenied):
                driver_capabilities(user)
            self.client.logout()
            if user.is_authenticated:
                self.client.force_login(user)
            self.assertEqual(self.client.get(URL, secure=True).status_code, 403)
        self.user.is_active = False
        self.user.save()
        with self.assertRaises(PermissionDenied):
            self.read()
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(URL, secure=True).status_code, 403)
        missing = User.objects.create_user("missing@example.test", role="driver")
        self.client.force_login(missing)
        self.assertEqual(self.client.get(URL, secure=True).status_code, 404)

    def test_endpoint_is_private_read_only_and_cannot_select_other_owner(self):
        self.client.force_login(self.user)
        before = AdminActionLog.objects.count()
        response = self.client.get(URL, secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        body = response.json()
        self.assertEqual(set(body), set(DRIVER_CAPABILITIES["required"]))
        self.assertEqual(
            set(body["capabilities"]),
            set(DRIVER_CAPABILITIES["properties"]["capabilities"]["required"]),
        )
        self.assertNotIn("email", str(body))
        self.assertEqual(
            self.client.get(URL, {"driver_id": self.other.pk}, secure=True).status_code,
            400,
        )
        self.assertEqual(self.client.post(URL, {}, secure=True).status_code, 405)
        self.assertEqual(
            self.client.get(URL + str(self.other.pk) + "/", secure=True).status_code,
            404,
        )
        self.client.force_login(self.other)
        self.assertIsNone(self.client.get(URL, secure=True).json()["plan"])
        self.assertEqual(AdminActionLog.objects.count(), before)
        self.assertEqual(DriverSubscription.objects.count(), 1)

    def test_admin_change_is_visible_next_request_with_existing_audit(self):
        admin = User.objects.create_superuser(
            "admin@example.test", "Synthetic-test-781!"
        )
        version = None
        self.client.force_login(self.user)
        for code in ("elite", "pro", "basic"):
            _, version = change_subscription(
                self.driver.pk,
                admin,
                plan_code=code,
                status="active",
                starts_at=self.subscription.starts_at,
                ends_at=self.subscription.ends_at,
                reason="Synthetic capability test",
                expected_version=version,
            )
            self.assertEqual(
                self.client.get(URL, secure=True).json()["plan"]["code"], code
            )
        self.assertEqual(AdminActionLog.objects.count(), 3)

    def test_contract_is_session_protected_and_catalog_keys_match(self):
        operation = openapi_document()["paths"][URL]["get"]
        self.assertEqual(operation["security"], [{"SessionCookie": []}])
        self.assertNotIn("parameters", operation)
        self.assertEqual(
            operation["responses"]["200"]["content"]["application/json"]["schema"],
            DRIVER_CAPABILITIES,
        )
        self.assertEqual(
            set(CAPABILITIES),
            set(DRIVER_CAPABILITIES["properties"]["capabilities"]["properties"]),
        )
