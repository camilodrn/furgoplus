"""Database-free regressions for the homelab's IP, TLS and CSRF boundary."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from django.http import JsonResponse
from django.test import Client, RequestFactory, SimpleTestCase, override_settings
from django.urls import path
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie

from config.demo_proxy import DemoProxyMiddleware


@ensure_csrf_cookie
def bootstrap(request):
    from django.middleware.csrf import get_token

    return JsonResponse({"csrf_token": get_token(request)})


@csrf_protect
def protected(request):
    return JsonResponse({"ok": True})


urlpatterns = [
    path("api/v1/auth/csrf/", bootstrap),
    path("api/v1/protected/", protected),
]


@override_settings(
    DEMO_TRUSTED_PROXY_IP="172.30.81.2",
    SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
)
class DemoProxyTests(SimpleTestCase):
    def probe(self, peer="172.30.81.2", address="203.0.113.10", **headers):
        request = RequestFactory().get(
            "/api/v1/protected/",
            REMOTE_ADDR=peer,
            HTTP_X_FURGOPLUS_CLIENT_IP=address,
            **headers,
        )
        response = DemoProxyMiddleware(
            lambda request: JsonResponse(
                {"address": request.META["REMOTE_ADDR"], "secure": request.is_secure()}
            )
        )(request)
        return request, response, json.loads(response.content)

    def test_trusted_proxy_propagates_distinct_visitors_to_existing_throttles(self):
        for address in ("203.0.113.10", "203.0.113.11"):
            _, response, body = self.probe(address=address)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(body, {"address": address, "secure": True})

    def test_forwarding_chain_cannot_override_normalized_address(self):
        request, _, body = self.probe(
            HTTP_X_FORWARDED_FOR="198.51.100.99, 127.0.0.1",
            HTTP_CF_CONNECTING_IP="198.51.100.99",
            HTTP_X_FORWARDED_HOST="attacker.example.test",
            HTTP_FORWARDED="for=198.51.100.99;proto=http",
        )
        self.assertEqual(body["address"], "203.0.113.10")
        for name in (
            "HTTP_X_FURGOPLUS_CLIENT_IP",
            "HTTP_X_FORWARDED_FOR",
            "HTTP_X_FORWARDED_HOST",
            "HTTP_CF_CONNECTING_IP",
            "HTTP_FORWARDED",
        ):
            self.assertNotIn(name, request.META)

    def test_untrusted_peer_cannot_assert_client_ip_or_https(self):
        for peer in ("198.51.100.5", "172.30.81.3", "127.0.0.1"):
            _, _, body = self.probe(peer=peer, HTTP_X_FORWARDED_PROTO="https")
            self.assertEqual(body, {"address": peer, "secure": False})

    def test_rejects_missing_malformed_chained_or_scoped_addresses(self):
        for address in (
            "",
            "not-an-ip",
            "203.0.113.10, 198.51.100.2",
            "203.0.113.10:1234",
            " 203.0.113.10 ",
            "fe80::1%eth0",
        ):
            _, response, body = self.probe(address=address)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(body["code"], "invalid_proxy_ip")

    def test_ipv6_is_canonical_and_mapped_ipv4_shares_ipv4_bucket(self):
        for address, expected in (
            ("2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"),
            ("::ffff:203.0.113.10", "203.0.113.10"),
        ):
            _, _, body = self.probe(address=address)
            self.assertEqual(body["address"], expected)

    def test_untrusted_wsgi_scheme_is_not_accepted_as_tls(self):
        request = RequestFactory().get(
            "/api/v1/protected/",
            secure=True,
            REMOTE_ADDR="127.0.0.1",
            HTTP_X_FORWARDED_PROTO="https",
        )
        DemoProxyMiddleware(lambda request: JsonResponse({}))(request)
        self.assertFalse(request.is_secure())

    def test_only_loopback_get_health_probe_may_use_proxy_scheme(self):
        factory = RequestFactory()
        for method, peer, expected in (
            ("get", "127.0.0.1", True),
            ("post", "127.0.0.1", False),
            ("get", "198.51.100.5", False),
        ):
            request = getattr(factory, method)(
                "/api/v1/health/", REMOTE_ADDR=peer, HTTP_X_FORWARDED_PROTO="https"
            )
            DemoProxyMiddleware(lambda request: JsonResponse({}))(request)
            self.assertEqual(request.is_secure(), expected)


@override_settings(
    ROOT_URLCONF="config.test_demo_proxy",
    MIDDLEWARE=[
        "config.demo_proxy.DemoProxyMiddleware",
        "django.middleware.security.SecurityMiddleware",
        "django.middleware.csrf.CsrfViewMiddleware",
    ],
    DEMO_TRUSTED_PROXY_IP="172.30.81.2",
    ALLOWED_HOSTS=["demo.furgoplus.cl"],
    DEBUG=False,
    SECURE_SSL_REDIRECT=True,
    SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    CSRF_TRUSTED_ORIGINS=["https://demo.furgoplus.cl"],
    CSRF_COOKIE_SECURE=True,
    CSRF_COOKIE_HTTPONLY=True,
    CSRF_COOKIE_SAMESITE="Lax",
    CSRF_COOKIE_DOMAIN=None,
    CSRF_FAILURE_VIEW="django.views.csrf.csrf_failure",
)
class DemoCsrfTests(SimpleTestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.headers = {
            "REMOTE_ADDR": "172.30.81.2",
            "HTTP_HOST": "demo.furgoplus.cl",
            "HTTP_X_FURGOPLUS_CLIENT_IP": "203.0.113.10",
        }
        self.bootstrap = self.client.get("/api/v1/auth/csrf/", **self.headers)
        self.token = self.bootstrap.json()["csrf_token"]

    def test_bootstrap_is_https_without_redirect_and_cookie_is_secure_host_only(self):
        self.assertEqual(self.bootstrap.status_code, 200)
        cookie = self.bootstrap.cookies["csrftoken"]
        self.assertTrue(cookie["secure"])
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")
        self.assertEqual(cookie["domain"], "")

    def test_same_origin_write_with_token_succeeds(self):
        response = self.client.post(
            "/api/v1/protected/",
            HTTP_ORIGIN="https://demo.furgoplus.cl",
            HTTP_X_CSRFTOKEN=self.token,
            **self.headers,
        )
        self.assertEqual(response.status_code, 200)

    def test_foreign_origin_missing_token_and_missing_referer_are_rejected(self):
        for extra in (
            {
                "HTTP_ORIGIN": "https://attacker.example.test",
                "HTTP_X_CSRFTOKEN": self.token,
            },
            {"HTTP_ORIGIN": "https://demo.furgoplus.cl"},
            {"HTTP_X_CSRFTOKEN": self.token},
        ):
            response = self.client.post("/api/v1/protected/", **self.headers, **extra)
            self.assertEqual(response.status_code, 403)

    def test_wrong_host_is_rejected(self):
        headers = {**self.headers, "HTTP_HOST": "attacker.example.test"}
        response = self.client.get("/api/v1/auth/csrf/", **headers)
        self.assertEqual(response.status_code, 400)


class DemoSettingsTests(SimpleTestCase):
    def probe(self, **overrides):
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / "key"
            password = Path(directory) / "password"
            # Deterministic test placeholders; never deployment credentials.
            key.write_text("x" * 64)
            password.write_text("y" * 32)
            environment = {
                **os.environ,
                "DJANGO_SECRET_KEY_FILE": str(key),
                "DB_PASSWORD_FILE": str(password),
                "DEMO_CADDY_IP": "172.30.81.2",
                "DEMO_SYNTHETIC_ONLY": "true",
                "DJANGO_DEBUG": "true",
                "DJANGO_ALLOWED_HOSTS": "*",
                **overrides,
            }
            return subprocess.run(
                [
                    sys.executable,
                    "-c",
                    "import config.settings_demo as s; "
                    "assert not s.DEBUG; "
                    "assert s.DEMO_MODE; "
                    "assert s.ALLOWED_HOSTS == ['demo.furgoplus.cl']; "
                    "assert s.API_PUBLIC_ORIGIN == s.WEB_PUBLIC_ORIGIN; "
                    "assert s.SESSION_COOKIE_SECURE and s.CSRF_COOKIE_SECURE; "
                    "assert s.SESSION_COOKIE_HTTPONLY and s.CSRF_COOKIE_HTTPONLY; "
                    "assert s.SESSION_COOKIE_DOMAIN is None; "
                    "assert s.SESSION_ENGINE == 'django.contrib.sessions.backends.db'; "
                    "assert s.SECURE_SSL_REDIRECT; "
                    "assert not s.SECURE_HSTS_INCLUDE_SUBDOMAINS; "
                    "assert not s.SECURE_HSTS_PRELOAD; "
                    "assert not {'security.W005', 'security.W021'} & "
                    "set(getattr(s, 'SILENCED_SYSTEM_CHECKS', [])); "
                    "assert s.SECURE_PROXY_SSL_HEADER == "
                    "('HTTP_X_FORWARDED_PROTO', 'https'); "
                    "assert s.CSRF_TRUSTED_ORIGINS == ['https://demo.furgoplus.cl']; "
                    "assert s.MIDDLEWARE[0] == 'config.demo_proxy.DemoProxyMiddleware'",
                ],
                cwd=Path(__file__).resolve().parents[1],
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )

    def test_demo_forces_secure_same_origin_defaults(self):
        result = self.probe(FURGOPLUS_DEMO_MODE="false")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_fails_without_explicit_synthetic_acknowledgement(self):
        result = self.probe(DEMO_SYNTHETIC_ONLY="false")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Acknowledge synthetic-only", result.stderr)

    def test_fails_without_secret_file(self):
        result = self.probe(DJANGO_SECRET_KEY_FILE="/nonexistent/demo-test-key")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Cannot read DJANGO_SECRET_KEY_FILE", result.stderr)

    def test_fails_for_broad_proxy_trust(self):
        for address in ("*", "172.30.81.0/29", ""):
            result = self.probe(DEMO_CADDY_IP=address)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Caddy's exact internal IP", result.stderr)


@override_settings(
    MIDDLEWARE=["django.middleware.security.SecurityMiddleware"],
    SECURE_HSTS_SECONDS=31536000,
    SECURE_HSTS_INCLUDE_SUBDOMAINS=False,
    SECURE_HSTS_PRELOAD=False,
)
class DemoHstsTests(SimpleTestCase):
    def test_deliberate_hsts_warnings_remain_visible(self):
        from django.core.checks.security.base import (
            check_sts_include_subdomains,
            check_sts_preload,
        )

        warnings = check_sts_include_subdomains(None) + check_sts_preload(None)
        self.assertEqual(
            [warning.id for warning in warnings], ["security.W005", "security.W021"]
        )
