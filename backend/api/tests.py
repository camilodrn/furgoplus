from io import BytesIO

from django.core.handlers.wsgi import WSGIRequest
from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from api.errors import exception_handler


class HealthTests(SimpleTestCase):
    def test_health_is_public_and_stable(self):
        response = APIClient().get("/api/v1/health/", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    @override_settings(
        DEBUG=False,
        SECURE_SSL_REDIRECT=True,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    )
    def test_internal_health_check_uses_trusted_proxy_scheme(self):
        client = APIClient()
        redirected = client.get("/api/v1/health/")
        self.assertEqual(redirected.status_code, 301)
        response = client.get("/api/v1/health/", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_wsgi_request_without_content_length_has_empty_body(self):
        request = WSGIRequest(
            {
                "REQUEST_METHOD": "POST",
                "PATH_INFO": "/api/v1/auth/login/",
                "SCRIPT_NAME": "",
                "CONTENT_TYPE": "application/json",
                "HTTP_TRANSFER_ENCODING": "chunked",
                "SERVER_NAME": "testserver",
                "SERVER_PORT": "80",
                "wsgi.version": (1, 0),
                "wsgi.input": BytesIO(b'{"email":"parent@example.test"}'),
                "wsgi.errors": BytesIO(),
                "wsgi.url_scheme": "http",
                "wsgi.multithread": False,
                "wsgi.multiprocess": False,
                "wsgi.run_once": False,
            }
        )
        self.assertEqual(request.body, b"")

    @override_settings(DEBUG=False)
    def test_unknown_api_route_has_error_envelope(self):
        response = APIClient().get("/api/v1/missing/", secure=True)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"code": "not_found", "message": "Not found.", "fields": {}},
        )

    def test_unknown_api_route_is_json_in_development(self):
        response = APIClient().get("/api/v1/missing/", secure=True)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "not_found")

    def test_validation_error_has_field_details(self):
        response = exception_handler(
            ValidationError({"email": ["Invalid address."]}), {}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {
                "code": "validation_error",
                "message": "Invalid input.",
                "fields": {"email": ["Invalid address."]},
            },
        )

    def test_permission_denied_has_distinct_code(self):
        response = exception_handler(PermissionDenied(), {})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "permission_denied")
