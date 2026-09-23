from datetime import timedelta

from django.contrib.sessions.models import Session
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from accounts.models import AuthThrottle, DriverProfile, ParentProfile, User

BASE = "/api/v1/auth/"
PASSWORD = "Synthetic-Only-Password-781!"


class AuthTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def csrf(self):
        response = self.client.get(BASE + "csrf/", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertIn("csrftoken", response.cookies)
        return response.json()["csrf_token"]

    def post(self, path, body, token=None, origin="https://testserver"):
        headers = {"HTTP_ORIGIN": origin}
        if token is not None:
            headers["HTTP_X_CSRFTOKEN"] = token
        return self.client.post(
            BASE + path, body, content_type="application/json", secure=True, **headers
        )

    def register(self, role="parent"):
        token = self.csrf()
        body = {
            "email": " PERSON@Example.Test ",
            "password": PASSWORD,
            "role": role,
            "display_name": "Sample User",
        }
        return self.post("register/", body, token)

    def login(self, email="person@example.test", password=PASSWORD):
        token = self.csrf()
        return self.post("login/", {"email": email, "password": password}, token)

    def test_registration_is_csrf_protected_and_does_not_login(self):
        token = self.csrf()
        body = {
            "email": "person@example.test",
            "password": PASSWORD,
            "role": "parent",
            "display_name": "Sample",
        }
        for supplied, origin in (
            (None, "https://testserver"),
            ("wrong", "https://testserver"),
            (token, "https://foreign.example"),
        ):
            response = self.post("register/", body, supplied, origin)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json()["code"], "csrf_failed")
        response = self.post("register/", body, token)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["email"], "person@example.test")
        self.assertEqual(response.json()["role"], "parent")
        self.assertEqual(
            ParentProfile.objects.get(user__email="person@example.test").display_name,
            "Sample",
        )
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["code"],
            "not_authenticated",
        )

    def test_driver_defaults_and_public_role_flag_rejection(self):
        response = self.register("driver")
        self.assertEqual(response.status_code, 201)
        profile = DriverProfile.objects.get(user__email="person@example.test")
        self.assertEqual(
            (profile.status, profile.validation_state, profile.publication_requested),
            ("active", "draft", False),
        )
        self.assertEqual(profile.current_validation_revision, 1)
        self.assertIsNone(profile.approved_revision)
        token = self.csrf()
        for role in ("admin", "unknown"):
            response = self.post(
                "register/",
                {
                    "email": "other@example.test",
                    "password": PASSWORD,
                    "role": role,
                    "display_name": "Other",
                },
                token,
            )
            self.assertEqual(response.status_code, 400)
        response = self.post(
            "register/",
            {
                "email": "other@example.test",
                "password": PASSWORD,
                "role": "parent",
                "display_name": "Other",
                "is_staff": True,
            },
            token,
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="other@example.test").exists())

    def test_login_rotation_expiry_logout_and_session_reuse(self):
        self.register()
        before = self.csrf()
        missing = self.post(
            "login/", {"email": "person@example.test", "password": PASSWORD}
        )
        self.assertEqual(missing.json()["code"], "csrf_failed")
        response = self.post(
            "login/", {"email": "person@example.test", "password": PASSWORD}, before
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("sessionid", response.cookies)
        self.assertIn("csrftoken", response.cookies)
        self.assertNotIn("password", response.json())
        key = self.client.cookies["sessionid"].value
        session = Session.objects.get(session_key=key)
        self.assertAlmostEqual(
            (session.expire_date - timezone.now()).total_seconds(), 12 * 3600, delta=30
        )
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["role"], "parent"
        )
        self.assertEqual(
            Session.objects.get(session_key=key).expire_date, session.expire_date
        )
        self.assertEqual(self.post("logout/", {}, before).json()["code"], "csrf_failed")
        fresh = response.json()["csrf_token"]
        self.assertEqual(
            self.post("logout/", {}, fresh, "https://foreign.example").json()["code"],
            "csrf_failed",
        )
        done = self.post("logout/", {}, fresh)
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json(), {"ok": True})
        self.assertEqual(done.cookies["sessionid"].value, "")
        self.assertFalse(Session.objects.filter(session_key=key).exists())
        self.client.cookies["sessionid"] = key
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["code"],
            "not_authenticated",
        )

    def test_invalid_credentials_disabled_expired_and_changed_password(self):
        self.register()
        for email, password in (
            ("missing@example.test", PASSWORD),
            ("person@example.test", "bad"),
        ):
            response = self.login(email, password)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(
                response.json()["fields"], {"credentials": ["Invalid credentials."]}
            )
        user = User.objects.get(email="person@example.test")
        user.is_active = False
        user.save()
        self.assertEqual(self.login().status_code, 400)
        user.is_active = True
        user.save()
        self.assertEqual(self.login().status_code, 200)
        key = self.client.cookies["sessionid"].value
        Session.objects.filter(session_key=key).update(
            expire_date=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["code"],
            "not_authenticated",
        )
        self.assertEqual(self.login().status_code, 200)
        user.set_password("New-Synthetic-Password-781!")
        user.save()
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["code"],
            "not_authenticated",
        )
        self.assertEqual(
            self.login(password="New-Synthetic-Password-781!").status_code, 200
        )
        user.is_active = False
        user.save()
        self.assertEqual(
            self.client.get(BASE + "me/", secure=True).json()["code"],
            "not_authenticated",
        )

    def test_anonymous_logout_and_throttle(self):
        token = self.csrf()
        response = self.post("logout/", {}, token)
        self.assertEqual(response.json()["code"], "not_authenticated")
        for _ in range(10):
            self.assertEqual(
                self.post(
                    "login/", {"email": "nobody@example.test", "password": "bad"}, token
                ).status_code,
                400,
            )
        response = self.post(
            "login/", {"email": "nobody@example.test", "password": "bad"}, token
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "throttled")
        self.assertEqual(AuthThrottle.objects.get().attempts, 11)

    @override_settings(
        DEBUG=False,
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        SECURE_SSL_REDIRECT=False,
    )
    def test_https_cookie_properties_and_login_csrf_negatives(self):
        token = self.csrf()
        csrf_cookie = self.client.cookies["csrftoken"]
        self.assertTrue(csrf_cookie["secure"])
        self.assertTrue(csrf_cookie["httponly"])
        self.assertEqual(csrf_cookie["samesite"], "Lax")
        self.assertEqual(csrf_cookie["path"], "/")
        self.assertFalse(csrf_cookie["domain"])
        self.assertEqual(
            self.post(
                "register/",
                {
                    "email": "person@example.test",
                    "password": PASSWORD,
                    "role": "parent",
                    "display_name": "Sample",
                },
                token,
            ).status_code,
            201,
        )
        credentials = {"email": "person@example.test", "password": PASSWORD}
        for supplied, origin in (
            (None, "https://testserver"),
            ("bad", "https://testserver"),
            (token, "https://foreign.example"),
        ):
            response = self.post("login/", credentials, supplied, origin)
            self.assertEqual(response.json()["code"], "csrf_failed")
        response = self.post("login/", credentials, token)
        self.assertEqual(response.status_code, 200)
        session_cookie = response.cookies["sessionid"]
        self.assertTrue(session_cookie["secure"])
        self.assertTrue(session_cookie["httponly"])
        self.assertEqual(session_cookie["samesite"], "Lax")
        self.assertEqual(session_cookie["path"], "/")
        self.assertFalse(session_cookie["domain"])
        self.assertEqual(self.post("logout/", {}, token).json()["code"], "csrf_failed")

    def test_registration_throttle_and_generic_duplicate(self):
        token = self.csrf()
        body = {
            "email": "person@example.test",
            "password": PASSWORD,
            "role": "parent",
            "display_name": "Sample",
        }
        self.assertEqual(self.post("register/", body, token).status_code, 201)
        self.assertEqual(
            self.post("register/", body, token).json()["code"], "validation_error"
        )
        for index in range(3):
            self.post(
                "register/", {**body, "email": f"person{index}@example.test"}, token
            )
        response = self.post(
            "register/", {**body, "email": "extra@example.test"}, token
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "throttled")

    def test_malformed_json_has_generic_error_without_body_echo(self):
        token = self.csrf()
        response = self.client.post(
            BASE + "login/",
            '{"password":"synthetic",',
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {
                "code": "parse_error",
                "message": "Invalid JSON.",
                "fields": {},
            },
        )

    def test_empty_post_data_uses_generic_validation_paths(self):
        token = self.csrf()
        for path, field in (("register/", "account"), ("login/", "credentials")):
            response = self.post(path, {}, token)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["code"], "validation_error")
            self.assertEqual(response.json()["message"], "Invalid input.")
            self.assertIn(field, response.json()["fields"])

    def test_no_role_update_endpoint_and_admin_provisioning(self):
        admin = User.objects.create_superuser("admin@example.test", PASSWORD)
        self.assertEqual(
            (admin.role, admin.is_active, admin.is_staff, admin.is_superuser),
            ("admin", True, True, True),
        )
        self.assertEqual(self.login("admin@example.test").json()["role"], "admin")
        token = self.csrf()
        response = self.post("me/", {"role": "driver"}, token)
        self.assertEqual(response.status_code, 405)
        self.assertEqual(User.objects.get(pk=admin.pk).role, "admin")
