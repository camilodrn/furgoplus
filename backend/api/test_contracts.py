from django.test import SimpleTestCase

from api.contracts import openapi_document


class Task06ContractTests(SimpleTestCase):
    def test_public_route_schema_is_dated_and_private_fields_are_absent(self):
        paths = openapi_document()["paths"]
        route = paths["/api/v1/discovery/drivers/"]["get"]["responses"]["200"][
            "content"
        ]["application/json"]["schema"]["properties"]["results"]["items"]["properties"][
            "routes"
        ]["items"]
        self.assertTrue(
            {"next_service_date", "used_seats", "available_seats"}
            <= set(route["required"])
        )
        self.assertFalse(
            {
                "student_display_name",
                "pickup_instruction",
                "guardian_contact",
                "amount_clp",
                "paid_at",
                "destination_address",
            }
            & set(route["properties"])
        )

    def test_private_owner_contract_has_no_payment_client_timestamp(self):
        paths = openapi_document()["paths"]
        payment = paths["/api/v1/driver/payments/"]["post"]
        properties = payment["requestBody"]["content"]["application/json"]["schema"][
            "properties"
        ]
        self.assertNotIn("paid_at", properties)
        self.assertIn(
            "paid_at",
            payment["responses"]["201"]["content"]["application/json"]["schema"][
                "properties"
            ],
        )
        for path in (
            "/api/v1/driver/passenger-assignments/",
            "/api/v1/driver/payments/",
        ):
            self.assertIn("get", paths[path])
            self.assertIn("post", paths[path])

    def test_daily_operation_is_private_and_public_contract_remains_allowlisted(self):
        paths = openapi_document()["paths"]
        today = paths["/api/v1/driver/today/"]["get"]
        self.assertEqual(today["security"], [{"SessionCookie": []}])
        self.assertIn(
            "unfinished_runs",
            today["responses"]["200"]["content"]["application/json"]["schema"][
                "properties"
            ],
        )
        for path in (
            "/api/v1/discovery/drivers/",
            "/api/v1/discovery/drivers/{id}/",
            "/api/v1/discovery/compare/",
            "/api/v1/parent/contact-requests/",
        ):
            body = str(paths[path]["get"]["responses"]["200"])
            for secret in (
                "roster",
                "guardian_contact",
                "pickup_instruction",
                "destination_address",
                "started_at",
                "ended_at",
                "run_state",
            ):
                self.assertNotIn(secret, body)
