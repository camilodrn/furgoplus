"""Real HTTP/session/CSRF regressions; process races require PostgreSQL explicitly."""

import hashlib
import json
import multiprocessing
from datetime import timedelta
from unittest import skipUnless

from django.db import connection, connections
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import AuthThrottle
from drivers.contact_throttle import ACCOUNT_LIMIT, IP_LIMIT
from drivers.models import ContactRequest
from drivers.test_contact import BASE, Fixture

PATH = BASE + "parent/contact-requests/"


def bucket(kind, value):
    return hashlib.sha256(f"contact-create:{kind}:{value}".encode()).hexdigest()


class ContactThrottleTests(Fixture, TestCase):
    def setUp(self):
        self.setup_fixture()
        self.as_user(self.parent_user)

    def attempt(self, address="203.0.113.10", body=None, **headers):
        return self.client.post(
            PATH,
            json.dumps(self.payload() if body is None else body),
            content_type="application/json",
            secure=True,
            REMOTE_ADDR=address,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
            **headers,
        )

    def test_account_limit_survives_rotating_ips_and_blocks_domain_writes(self):
        for number in range(ACCOUNT_LIMIT):
            response = self.attempt(f"203.0.113.{number + 1}", {"driver_id": 0})
            self.assertEqual(response.status_code, 400)
        response = self.attempt("198.51.100.2")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "throttled")
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertFalse(ContactRequest.objects.exists())
        row = AuthThrottle.objects.get(key=bucket("account", self.parent_user.pk))
        self.assertEqual(row.attempts, ACCOUNT_LIMIT + 1)

    def test_ip_limit_is_shared_between_accounts(self):
        from accounts.models import ParentProfile, User

        third = User.objects.create_user("third@example.test", role="parent")
        ParentProfile.objects.create(user=third, display_name="Familia Demo C")
        for number in range(IP_LIMIT):
            user = (self.parent_user, self.other_parent_user, third)[number % 3]
            self.as_user(user)
            self.assertEqual(self.attempt(body={}).status_code, 400)
        self.as_user(third)
        response = self.attempt()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "throttled")
        # The same account still has budget from another source.
        self.assertEqual(self.attempt("198.51.100.2").status_code, 201)

    def test_duplicate_and_missing_targets_consume_budget(self):
        self.assertEqual(self.attempt().status_code, 201)
        self.assertEqual(self.attempt().status_code, 409)
        missing = {**self.payload(), "driver_id": self.driver.pk + 1000}
        self.assertEqual(self.attempt(body=missing).status_code, 404)
        self.assertEqual(
            AuthThrottle.objects.get(
                key=bucket("account", self.parent_user.pk)
            ).attempts,
            3,
        )

    def test_auth_role_and_csrf_failures_do_not_allocate_counters(self):
        self.assertEqual(
            self.client.post(PATH, {}, secure=True).json()["code"], "csrf_failed"
        )
        self.token = "invalid"
        self.assertEqual(self.attempt().json()["code"], "csrf_failed")
        for user in (self.driver_user, self.admin):
            self.as_user(user)
            self.assertEqual(self.attempt().status_code, 403)
        self.client.logout()
        self.assertEqual(self.attempt().json()["code"], "not_authenticated")
        self.assertFalse(AuthThrottle.objects.exists())

    def test_expired_windows_reset_and_rejected_counters_persist_and_saturate(self):
        for _ in range(ACCOUNT_LIMIT + 3):
            self.attempt(body={})
        self.assertEqual(
            AuthThrottle.objects.get(
                key=bucket("account", self.parent_user.pk)
            ).attempts,
            ACCOUNT_LIMIT + 1,
        )
        AuthThrottle.objects.update(
            window_started_at=timezone.now() - timedelta(hours=1, seconds=1)
        )
        self.assertEqual(self.attempt().status_code, 201)
        self.assertEqual(
            set(AuthThrottle.objects.values_list("attempts", flat=True)), {1}
        )

    @override_settings(
        MIDDLEWARE=[
            "config.demo_proxy.DemoProxyMiddleware",
            "django.contrib.sessions.middleware.SessionMiddleware",
            "django.middleware.csrf.CsrfViewMiddleware",
            "django.contrib.auth.middleware.AuthenticationMiddleware",
        ],
        DEMO_TRUSTED_PROXY_IP="172.30.81.2",
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    )
    def test_spoofed_forwarding_headers_cannot_rotate_ip_bucket(self):
        # setUp already used the Client handler before the middleware override.
        # Build a fresh handler so this is an integration of the real boundary.
        self.client = Client(enforce_csrf_checks=True)
        self.client.force_login(self.parent_user)
        self.token = self.client.get(
            BASE + "auth/csrf/",
            REMOTE_ADDR="172.30.81.2",
            HTTP_X_FURGOPLUS_CLIENT_IP="203.0.113.10",
        ).json()["csrf_token"]
        for number in range(3):
            response = self.attempt(
                "172.30.81.2",
                body={},
                HTTP_X_FURGOPLUS_CLIENT_IP="203.0.113.10",
                HTTP_CF_CONNECTING_IP=f"198.51.100.{number + 1}",
                HTTP_X_FORWARDED_FOR=f"198.51.100.{number + 1}",
                HTTP_FORWARDED=f"for=198.51.100.{number + 1}",
            )
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["code"], "validation_error")
        row = AuthThrottle.objects.get(key=bucket("ip", "203.0.113.10"))
        self.assertEqual(row.attempts, 3)
        self.assertEqual(AuthThrottle.objects.count(), 2)
        response = self.attempt("172.30.81.2", HTTP_X_FURGOPLUS_CLIENT_IP="invalid")
        self.assertEqual(response.json()["code"], "invalid_proxy_ip")
        row.refresh_from_db()
        self.assertEqual(row.attempts, 3)


def process_attempts(user_id, address, count, barrier, queue):
    """Linux fork inherits Django's *test* DB config, never the deployment DB."""
    connections.close_all()
    try:
        from accounts.models import User

        client = Client(enforce_csrf_checks=True)
        client.force_login(User.objects.get(pk=user_id))
        token = client.get(BASE + "auth/csrf/", secure=True).json()["csrf_token"]
        barrier.wait(timeout=20)
        outcomes = []
        for _ in range(count):
            response = client.post(
                PATH,
                json.dumps({}),
                content_type="application/json",
                secure=True,
                REMOTE_ADDR=address,
                HTTP_ORIGIN="https://testserver",
                HTTP_X_CSRFTOKEN=token,
            )
            outcomes.append(response.status_code)
        queue.put(outcomes)
    finally:
        connections.close_all()


@skipUnless(
    connection.vendor == "postgresql"
    and "fork" in multiprocessing.get_all_start_methods(),
    "Requires isolated PostgreSQL and Linux fork; SQLite cannot prove row locks.",
)
class ContactThrottleProcessTests(Fixture, TransactionTestCase):
    def setUp(self):
        self.setup_fixture()

    def race(self, actors, count):
        context = multiprocessing.get_context("fork")
        barrier = context.Barrier(len(actors))
        queue = context.Queue()
        connections.close_all()
        processes = [
            context.Process(
                target=process_attempts, args=(user_id, address, count, barrier, queue)
            )
            for user_id, address in actors
        ]
        for process in processes:
            process.start()
        try:
            outcomes = [queue.get(timeout=30) for _ in processes]
            for process in processes:
                process.join(timeout=10)
                self.assertEqual(process.exitcode, 0)
        finally:
            for process in processes:
                if process.is_alive():
                    process.terminate()
                process.join(timeout=10)
            queue.close()
        return [status for batch in outcomes for status in batch]

    def test_account_budget_across_processes_and_distinct_ips_from_empty_table(self):
        outcomes = self.race(
            [(self.parent_user.pk, f"203.0.113.{n}") for n in (10, 11)], 6
        )
        self.assertEqual(outcomes.count(400), ACCOUNT_LIMIT)
        self.assertEqual(outcomes.count(429), 2)
        self.assertFalse(ContactRequest.objects.exists())

    def test_ip_budget_across_processes_and_distinct_accounts_from_empty_table(self):
        from accounts.models import ParentProfile, User

        third = User.objects.create_user("third@example.test", role="parent")
        ParentProfile.objects.create(user=third, display_name="Familia Demo C")
        outcomes = self.race(
            [
                (user.pk, "203.0.113.10")
                for user in (self.parent_user, self.other_parent_user, third)
            ],
            8,
        )
        self.assertEqual(outcomes.count(400), IP_LIMIT)
        self.assertEqual(outcomes.count(429), 4)
