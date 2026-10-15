"""Real HTTP and database regressions for illustrative registration."""

from django.test import Client, TestCase, override_settings

from accounts.models import AuthThrottle, DriverProfile, ParentProfile, User
from api.test_auth import BASE, PASSWORD


@override_settings(DEMO_MODE=True)
class DemoRegistrationTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.token = self.client.get(BASE + "csrf/", secure=True).json()["csrf_token"]

    def post(self, path, body, token=None):
        return self.client.post(
            BASE + path,
            body,
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=token or self.token,
        )

    def test_both_roles_are_closed_before_parsing_counters_or_writes(self):
        for role in ("driver", "parent"):
            with self.subTest(role=role), self.assertNumQueries(0):
                response = self.post(
                    "register/",
                    {
                        "role": role,
                        "email": f"{role}@example.test",
                        "password": PASSWORD,
                        "display_name": "Persona Demo",
                    },
                )
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "registration_disabled")
                self.assertEqual(response.json()["fields"], {})
                self.assertEqual(response["Cache-Control"], "no-store")
                self.assertNotIn("sessionid", response.cookies)
        response = self.post("register/", '{"broken":')
        self.assertEqual(response.json()["code"], "registration_disabled")
        self.assertFalse(User.objects.exists())
        self.assertFalse(ParentProfile.objects.exists())
        self.assertFalse(DriverProfile.objects.exists())
        self.assertFalse(AuthThrottle.objects.exists())

    def test_csrf_login_logout_and_session_restoration_still_work(self):
        User.objects.create_user("parent@example.test", PASSWORD, role="parent")
        response = self.post("register/", {}, token="invalid")
        self.assertEqual(response.json()["code"], "csrf_failed")
        response = self.post(
            "login/", {"email": "parent@example.test", "password": PASSWORD}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["role"], "parent"
        )
        token = response.json()["csrf_token"]
        self.assertEqual(self.post("logout/", {}, token).status_code, 200)
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["code"],
            "not_authenticated",
        )

    def test_anonymous_visitors_get_no_discovery_or_private_operational_data(self):
        for path in (
            "discovery/drivers/",
            "discovery/communes/",
            "discovery/drivers/1/",
            "parent/contact-requests/",
            "driver/profile/",
            "driver/today/",
            "driver/passenger-assignments/",
            "driver/payments/",
            "driver/documents/1/download/",
            "admin/drivers/",
            "admin/validations/",
        ):
            with self.subTest(path=path):
                response = self.client.get("/api/v1/" + path, secure=True)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "not_authenticated")

    @override_settings(DEMO_MODE=False)
    def test_normal_registration_remains_available_for_both_roles(self):
        for role, profile in (("parent", ParentProfile), ("driver", DriverProfile)):
            response = self.post(
                "register/",
                {
                    "role": role,
                    "email": f"{role}@example.test",
                    "password": PASSWORD,
                    "display_name": "Persona Demo",
                },
            )
            self.assertEqual(response.status_code, 201)
            self.assertTrue(
                profile.objects.filter(user__email=f"{role}@example.test").exists()
            )
            self.assertNotIn("sessionid", response.cookies)
