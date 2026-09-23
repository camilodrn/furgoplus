from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from api.errors import exception_handler


class HealthTests(SimpleTestCase):
    def test_health_is_public_and_stable(self):
        response = APIClient().get("/api/v1/health/", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

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
