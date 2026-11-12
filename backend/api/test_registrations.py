"""HTTP, permissions and database checks for the fair account report."""

from datetime import UTC, datetime

from django.test import Client, TestCase, override_settings

from accounts.models import DriverProfile, ParentProfile, User
from api.contracts import openapi_document
from api.test_auth import PASSWORD

URL = "/api/v1/admin/registrations/"


class RegistrationsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin@example.test", PASSWORD)
        self.parent = User.objects.create_user(
            "parent@example.test", PASSWORD, role="parent"
        )
        ParentProfile.objects.create(user=self.parent, display_name="Apoderada Feria")
        self.driver = User.objects.create_user(
            "driver@example.test", PASSWORD, role="driver"
        )
        DriverProfile.objects.create(user=self.driver, display_name="Conductor Feria")
        self.client.force_login(self.admin)

    def get(self, query=""):
        return self.client.get(URL + query, secure=True)

    def test_active_staff_administrator_gets_only_report_fields(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        body = response.json()
        self.assertEqual(set(body), {"totals", "count", "results"})
        self.assertEqual(body["totals"], {"parent": 1, "driver": 1, "admin": 1})
        self.assertEqual(body["count"], 3)
        for row in body["results"]:
            self.assertEqual(
                set(row), {"id", "display_name", "email", "role", "created_at"}
            )
        self.assertNotIn(PASSWORD, response.content.decode())
        self.assertNotIn(self.admin.password, response.content.decode())

    def test_denies_anonymous_parent_driver_nonstaff_admin_and_inactive_admin(self):
        nonstaff = User.objects.create_user(
            "nonstaff@example.test", PASSWORD, role="admin"
        )
        inactive = User.objects.create_superuser(
            "inactive@example.test", PASSWORD, is_active=False
        )
        # Staff alone never grants the administrative role.
        self.driver.is_staff = True
        self.driver.save(update_fields=["is_staff"])
        for user, code in (
            (None, "not_authenticated"),
            (self.parent, "permission_denied"),
            (self.driver, "permission_denied"),
            (nonstaff, "permission_denied"),
            (inactive, "not_authenticated"),
        ):
            with self.subTest(user=user):
                self.client.logout()
                if user:
                    self.client.force_login(user)
                response = self.get()
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], code)
                self.assertEqual(response["Cache-Control"], "no-store")
                self.assertNotIn("results", response.json())

    @override_settings(DEMO_MODE=True, DEMO_REGISTRATION_ENABLED=True)
    def test_registered_parent_appears_after_admin_login_and_fresh_read(self):
        self.assertEqual(self.get().json()["totals"]["parent"], 1)
        mobile = Client(enforce_csrf_checks=True)
        csrf = mobile.get("/api/v1/auth/csrf/", secure=True).json()["csrf_token"]
        response = mobile.post(
            "/api/v1/auth/register/",
            {
                "email": "profesora@example.test",
                "password": PASSWORD,
                "role": "parent",
                "display_name": "Apoderada nueva",
            },
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, 201)
        account_id = response.json()["id"]
        browser = Client(enforce_csrf_checks=True)
        token = browser.get("/api/v1/auth/csrf/", secure=True).json()["csrf_token"]
        login = browser.post(
            "/api/v1/auth/login/",
            {"email": self.admin.email, "password": PASSWORD},
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(login.status_code, 200)
        body = browser.get(URL, secure=True).json()
        self.assertEqual(body["totals"]["parent"], 2)
        self.assertEqual(body["results"][0]["id"], account_id)
        self.assertEqual(body["results"][0]["display_name"], "Apoderada nueva")
        self.assertEqual(body["results"][0]["email"], "profesora@example.test")
        self.assertEqual(body["results"][0]["role"], "parent")

    def test_filters_are_combined_and_do_not_change_global_totals(self):
        for query in ("?q=apoderada&role=parent", "?q=PARENT%40EXAMPLE.TEST"):
            body = self.get(query).json()
            self.assertEqual(body["count"], 1)
            self.assertEqual(body["results"][0]["id"], self.parent.pk)
            self.assertEqual(body["totals"], {"parent": 1, "driver": 1, "admin": 1})
        self.assertEqual(self.get("?q=apoderada&role=driver").json()["results"], [])

    def test_pagination_is_bounded_stable_and_newest_first(self):
        instant = datetime(2026, 11, 4, 3, 15, tzinfo=UTC)
        User.objects.update(created_at=instant)
        first = self.get("?limit=2").json()
        second = self.get("?limit=2&offset=2").json()
        self.assertEqual(
            [r["id"] for r in first["results"] + second["results"]],
            [self.driver.pk, self.parent.pk, self.admin.pk],
        )
        self.assertEqual(first["count"], 3)
        self.assertEqual(self.get("?offset=999").json()["results"], [])
        # The HTTP boundary preserves the actual instant, including day boundaries.
        date = first["results"][0]["created_at"]
        self.assertEqual(datetime.fromisoformat(date.replace("Z", "+00:00")), instant)
        User.objects.bulk_create(
            [User(email=f"more{i}@example.test", role="parent") for i in range(55)]
        )
        self.assertEqual(len(self.get().json()["results"]), 25)
        self.assertEqual(len(self.get("?limit=50").json()["results"]), 50)

    def test_rejects_invalid_unknown_and_repeated_filters(self):
        for query in (
            "?limit=0",
            "?limit=51",
            "?limit=no",
            "?offset=-1",
            "?role=staff",
            "?q=" + "a" * 101,
            "?password=x",
            "?role=parent&role=driver",
            "?offset=0&offset=1",
        ):
            with self.subTest(query=query):
                response = self.get(query)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["code"], "validation_error")
                self.assertEqual(response["Cache-Control"], "no-store")

    def test_counts_inactive_and_missing_profiles_but_reserves_nonfictional_email(self):
        external = User.objects.create_user(
            "private@school.invalid", PASSWORD, role="parent", is_active=False
        )
        body = self.get("?role=parent").json()
        row = next(r for r in body["results"] if r["id"] == external.pk)
        self.assertIsNone(row["display_name"])
        self.assertIsNone(row["email"])
        self.assertEqual(body["totals"]["parent"], 2)
        self.assertEqual(self.get("?q=school.invalid").json()["count"], 0)

    def test_empty_results_and_read_only_endpoint(self):
        body = self.get("?q=sin-coincidencias").json()
        self.assertEqual(body["count"], 0)
        self.assertEqual(body["results"], [])
        before = User.objects.count()
        self.assertEqual(self.client.post(URL, {}, secure=True).status_code, 405)
        self.assertEqual(User.objects.count(), before)

    def test_contract_describes_session_filters_limits_and_allowlist(self):
        operation = openapi_document()["paths"][URL]["get"]
        self.assertEqual(operation["security"], [{"SessionCookie": []}])
        params = {p["name"]: p["schema"] for p in operation["parameters"]}
        self.assertEqual(set(params), {"q", "role", "limit", "offset"})
        self.assertEqual(params["limit"]["maximum"], 50)
        schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        self.assertFalse(
            schema["properties"]["results"]["items"]["additionalProperties"]
        )
