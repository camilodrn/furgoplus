"""The small API registry is the source for URL registration and OpenAPI output."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Endpoint:
    path: str
    name: str
    method: str
    operation_id: str
    summary: str
    response_schema: dict
    success_status: int = 200
    request_schema: dict | None = None


HEALTH_BODY = {"status": "ok"}
HEALTH = Endpoint(
    path="health/",
    name="health",
    method="get",
    operation_id="getHealth",
    summary="Health status",
    response_schema={
        "type": "object",
        "additionalProperties": False,
        "required": ["status"],
        "properties": {"status": {"type": "string", "enum": ["ok"]}},
    },
)
IDENTITY = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "email", "role", "display_name"],
    "properties": {
        "id": {"type": "integer"},
        "email": {"type": "string", "format": "email"},
        "role": {"type": "string", "enum": ["parent", "driver", "admin"]},
        "display_name": {"type": ["string", "null"]},
    },
}
CSRF = {
    "type": "object",
    "additionalProperties": False,
    "required": ["csrf_token"],
    "properties": {"csrf_token": {"type": "string"}},
}
REGISTER = {
    "type": "object",
    "additionalProperties": False,
    "required": ["email", "password", "role", "display_name"],
    "properties": {
        "email": {"type": "string", "format": "email"},
        "password": {"type": "string", "format": "password", "writeOnly": True},
        "role": {"type": "string", "enum": ["parent", "driver"]},
        "display_name": {"type": "string", "maxLength": 100},
    },
}
LOGIN = {
    "type": "object",
    "additionalProperties": False,
    "required": ["email", "password"],
    "properties": {
        "email": {"type": "string", "format": "email"},
        "password": {"type": "string", "format": "password", "writeOnly": True},
    },
}
ENDPOINTS = (
    HEALTH,
    Endpoint("auth/csrf/", "auth-csrf", "get", "getCsrf", "CSRF bootstrap", CSRF),
    Endpoint(
        "auth/register/",
        "auth-register",
        "post",
        "register",
        "Public parent or driver registration",
        IDENTITY,
        201,
        REGISTER,
    ),
    Endpoint(
        "auth/login/",
        "auth-login",
        "post",
        "login",
        "Session login",
        {
            **IDENTITY,
            "required": [*IDENTITY["required"], "csrf_token"],
            "properties": {**IDENTITY["properties"], "csrf_token": {"type": "string"}},
        },
        200,
        LOGIN,
    ),
    Endpoint("auth/me/", "auth-me", "get", "getMe", "Current identity", IDENTITY),
    Endpoint(
        "auth/logout/",
        "auth-logout",
        "post",
        "logout",
        "Current-session logout",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["ok"],
            "properties": {"ok": {"type": "boolean", "const": True}},
        },
    ),
)


def openapi_document():
    paths = {}
    for endpoint in ENDPOINTS:
        operation = {
            "operationId": endpoint.operation_id,
            "summary": endpoint.summary,
            "responses": {
                str(endpoint.success_status): {
                    "description": "Successful response",
                    "content": {
                        "application/json": {"schema": endpoint.response_schema}
                    },
                },
                "default": {
                    "description": "API error",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    },
                },
            },
        }
        if endpoint.request_schema:
            operation["requestBody"] = {
                "required": True,
                "content": {"application/json": {"schema": endpoint.request_schema}},
            }
        if endpoint.name in {"auth-register", "auth-login", "auth-logout"}:
            operation["parameters"] = [
                {
                    "name": "X-CSRFToken",
                    "in": "header",
                    "required": True,
                    "description": (
                        "Masked token from csrf/ or login; "
                        "csrftoken cookie is also required."
                    ),
                    "schema": {"type": "string"},
                }
            ]
        if endpoint.name in {"auth-me", "auth-logout"}:
            operation["security"] = [{"SessionCookie": []}]
        if endpoint.name == "auth-login":
            operation["description"] = (
                "Database session with fixed 12-hour expiry; "
                "rotates session and CSRF secret."
            )
        if endpoint.name == "auth-csrf":
            operation["description"] = (
                "Sets a host-only CSRF cookie and returns a masked token. No-store."
            )
        paths[f"/api/v1/{endpoint.path}"] = {endpoint.method: operation}
    return {
        "openapi": "3.1.0",
        "info": {"title": "FurgoPlus API", "version": "1.0.0"},
        "paths": paths,
        "components": {
            "securitySchemes": {
                "SessionCookie": {"type": "apiKey", "in": "cookie", "name": "sessionid"}
            },
            "schemas": {
                "Error": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["code", "message", "fields"],
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "fields": {"type": "object", "additionalProperties": True},
                    },
                }
            },
        },
    }


# Task 03 private validation boundary. JSON schemas expose only allowlisted fields.
STRING = {"type": "string"}
INTEGER = {"type": "integer"}
NULLABLE_STRING = {"type": ["string", "null"]}
NULLABLE_INTEGER = {"type": ["integer", "null"]}
DOC = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "id",
        "version",
        "kind",
        "content_type",
        "byte_size",
        "uploaded_at",
        "expires_on",
        "is_current",
    ],
    "properties": {
        "id": INTEGER,
        "version": INTEGER,
        "kind": STRING,
        "content_type": STRING,
        "byte_size": INTEGER,
        "uploaded_at": STRING,
        "expires_on": {"type": ["string", "null"], "format": "date"},
        "is_current": {"type": "boolean"},
    },
}
PROFILE = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "display_name",
        "service_summary",
        "service_contact_email",
        "validation_state",
        "current_validation_revision",
        "approved_revision",
    ],
    "properties": {
        "display_name": STRING,
        "service_summary": STRING,
        "service_contact_email": STRING,
        "validation_state": STRING,
        "current_validation_revision": INTEGER,
        "approved_revision": NULLABLE_INTEGER,
    },
}
PROFILE_UPDATE = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "display_name": {"type": "string", "maxLength": 100},
        "service_summary": {"type": "string", "maxLength": 2000},
        "service_contact_email": {"type": "string", "format": "email"},
    },
}
SNAPSHOT_DOC = {
    **DOC,
    "required": [field for field in DOC["required"] if field != "is_current"],
    "properties": {
        field: value
        for field, value in DOC["properties"].items()
        if field != "is_current"
    },
}
VALIDATION = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "id",
        "revision",
        "state",
        "submitted_at",
        "reviewed_at",
        "observations",
        "display_name_snapshot",
    ],
    "properties": {
        "id": INTEGER,
        "revision": INTEGER,
        "state": {
            "type": "string",
            "enum": ["pending", "approved", "rejected", "superseded"],
        },
        "submitted_at": STRING,
        "reviewed_at": NULLABLE_STRING,
        "observations": NULLABLE_STRING,
        "display_name_snapshot": STRING,
    },
}
VALIDATION_DETAIL = {
    **VALIDATION,
    "required": [*VALIDATION["required"], "documents"],
    "properties": {
        **VALIDATION["properties"],
        "documents": {"type": "array", "items": SNAPSHOT_DOC},
    },
}
DOCUMENT_CHANGE = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "kind",
        "status",
        "previous_version",
        "current_version",
        "previous_content_type",
        "current_content_type",
        "previous_expires_on",
        "current_expires_on",
    ],
    "properties": {
        "kind": STRING,
        "status": {
            "type": "string",
            "enum": ["unchanged", "replaced", "added", "removed"],
        },
        "previous_version": NULLABLE_INTEGER,
        "current_version": NULLABLE_INTEGER,
        "previous_content_type": NULLABLE_STRING,
        "current_content_type": NULLABLE_STRING,
        "previous_expires_on": {"type": ["string", "null"], "format": "date"},
        "current_expires_on": {"type": ["string", "null"], "format": "date"},
    },
}
IDENTITY_CHANGE = {
    "type": "object",
    "additionalProperties": False,
    "required": ["field", "previous_value", "current_value"],
    "properties": {
        "field": {"type": "string", "enum": ["display_name"]},
        "previous_value": STRING,
        "current_value": STRING,
    },
}
COMPARISON = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "previous_revision",
        "changed_document_count",
        "unchanged_document_count",
        "changed_identity_field_count",
        "has_material_changes",
        "document_changes",
        "identity_changes",
    ],
    "properties": {
        "previous_revision": NULLABLE_INTEGER,
        "changed_document_count": INTEGER,
        "unchanged_document_count": INTEGER,
        "changed_identity_field_count": INTEGER,
        "has_material_changes": {"type": "boolean"},
        "document_changes": {"type": "array", "items": DOCUMENT_CHANGE},
        "identity_changes": {"type": "array", "items": IDENTITY_CHANGE},
    },
}
ADMIN_VALIDATION = {
    **VALIDATION,
    "required": [*VALIDATION["required"], "driver", "comparison"],
    "properties": {
        **VALIDATION["properties"],
        "comparison": COMPARISON,
        "driver": {
            "type": "object",
            "additionalProperties": False,
            "required": ["id", "display_name", "email"],
            "properties": {"id": INTEGER, "display_name": STRING, "email": STRING},
        },
    },
}
ADMIN_DETAIL = {
    **ADMIN_VALIDATION,
    "required": [*ADMIN_VALIDATION["required"], "documents"],
    "properties": {
        **ADMIN_VALIDATION["properties"],
        "documents": {"type": "array", "items": SNAPSHOT_DOC},
    },
}
BINARY = {"type": "string", "format": "binary"}
UPLOAD = {
    "type": "object",
    "additionalProperties": False,
    "required": ["kind", "file"],
    "properties": {
        "kind": STRING,
        "expires_on": {"type": "string", "format": "date"},
        "file": BINARY,
    },
}
OBSERVATION = {
    "type": "object",
    "additionalProperties": False,
    "required": ["observations"],
    "properties": {
        "observations": {"type": "string", "minLength": 1, "maxLength": 1000}
    },
}
CHECKLIST = {
    "type": "object",
    "additionalProperties": False,
    "required": ["demo_only", "allowed_content_types", "max_bytes", "items"],
    "properties": {
        "demo_only": {"type": "boolean", "const": True},
        "allowed_content_types": {"type": "array", "items": STRING},
        "max_bytes": INTEGER,
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["kind", "label", "requires_expiry"],
                "properties": {
                    "kind": STRING,
                    "label": STRING,
                    "requires_expiry": {"type": "boolean"},
                },
            },
        },
    },
}
ENDPOINTS += (
    Endpoint(
        "driver/profile/",
        "driver-profile-get",
        "get",
        "getDriverProfile",
        "Own driver onboarding profile",
        PROFILE,
    ),
    Endpoint(
        "driver/profile/",
        "driver-profile-patch",
        "patch",
        "patchDriverProfile",
        "Update own profile basics",
        PROFILE,
        200,
        PROFILE_UPDATE,
    ),
    Endpoint(
        "driver/validation/checklist/",
        "driver-checklist",
        "get",
        "getDriverChecklist",
        "Synthetic demo checklist",
        CHECKLIST,
    ),
    Endpoint(
        "driver/documents/",
        "driver-documents-get",
        "get",
        "getDriverDocuments",
        "Own document versions",
        {
            "type": "object",
            "required": ["documents"],
            "properties": {"documents": {"type": "array", "items": DOC}},
        },
    ),
    Endpoint(
        "driver/documents/",
        "driver-documents-post",
        "post",
        "uploadDriverDocument",
        "Upload one private demo document",
        DOC,
        201,
        UPLOAD,
    ),
    Endpoint(
        "driver/documents/{id}/download/",
        "driver-document-download",
        "get",
        "downloadDriverDocument",
        "Download own private document",
        BINARY,
    ),
    Endpoint(
        "driver/validations/",
        "driver-validations",
        "get",
        "getDriverValidations",
        "Own validation history",
        {
            "type": "object",
            "required": [
                "validation_state",
                "current_validation_revision",
                "approved_revision",
                "validations",
            ],
            "properties": {
                "validation_state": STRING,
                "current_validation_revision": INTEGER,
                "approved_revision": NULLABLE_INTEGER,
                "validations": {"type": "array", "items": VALIDATION_DETAIL},
            },
        },
    ),
    Endpoint(
        "driver/validations/submit/",
        "driver-submit",
        "post",
        "submitDriverValidation",
        "Submit immutable revision",
        VALIDATION_DETAIL,
    ),
    Endpoint(
        "admin/validations/",
        "admin-validations",
        "get",
        "getAdminValidations",
        "Validation queue or history, latest 50",
        {
            "type": "object",
            "required": ["results"],
            "properties": {"results": {"type": "array", "items": ADMIN_VALIDATION}},
        },
    ),
    Endpoint(
        "admin/validations/{id}/",
        "admin-validation-detail",
        "get",
        "getAdminValidation",
        "Submitted revision detail",
        ADMIN_DETAIL,
    ),
    Endpoint(
        "admin/documents/{id}/download/",
        "admin-document-download",
        "get",
        "downloadAdminDocument",
        "Audited private review download",
        BINARY,
    ),
    Endpoint(
        "admin/validations/{id}/approve/",
        "admin-approve",
        "post",
        "approveValidation",
        "Approve current pending revision",
        ADMIN_DETAIL,
        200,
        OBSERVATION,
    ),
    Endpoint(
        "admin/validations/{id}/reject/",
        "admin-reject",
        "post",
        "rejectValidation",
        "Reject current pending revision",
        ADMIN_DETAIL,
        200,
        OBSERVATION,
    ),
)

PLAN_CODE = {"type": "string", "enum": ["basic", "pro", "elite"]}
SUBSCRIPTION_STATUS = {"type": "string", "enum": ["inactive", "active", "suspended"]}
ROUTE_STATUS = {"type": "string", "enum": ["active", "inactive"]}
WEEKDAY = {
    "type": "string",
    "enum": [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ],
}
BLOCKER_CODE = {
    "type": "string",
    "enum": [
        "account_inactive",
        "driver_suspended",
        "driver_deactivated",
        "publication_not_requested",
        "validation_not_approved",
        "approved_revision_stale",
        "required_document_missing",
        "required_document_expired",
        "subscription_missing",
        "subscription_inactive",
        "subscription_suspended",
        "subscription_not_started",
        "subscription_expired",
        "profile_display_name_missing",
        "profile_summary_missing",
        "service_contact_email_missing",
        "active_route_missing",
    ],
}
COMMUNE = {
    "type": "object",
    "additionalProperties": False,
    "required": ["code", "display_name"],
    "properties": {"code": STRING, "display_name": STRING},
}
COMMUNES = {
    "type": "object",
    "additionalProperties": False,
    "required": ["communes"],
    "properties": {"communes": {"type": "array", "items": COMMUNE}},
}
SUBSCRIPTION = {
    "type": "object",
    "additionalProperties": False,
    "required": ["plan_code", "plan_label", "status", "starts_at", "ends_at"],
    "properties": {
        "plan_code": PLAN_CODE,
        "plan_label": STRING,
        "status": SUBSCRIPTION_STATUS,
        "starts_at": {"type": ["string", "null"], "format": "date-time"},
        "ends_at": {"type": ["string", "null"], "format": "date-time"},
    },
}
PROFILE_STATUS = {"type": "string", "enum": ["active", "suspended", "deactivated"]}
PUBLICATION = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "profile_status",
        "publication_requested",
        "eligible",
        "blockers",
        "validation_state",
        "current_validation_revision",
        "approved_revision",
        "subscription",
        "active_route_count",
        "coverage",
    ],
    "properties": {
        "profile_status": PROFILE_STATUS,
        "publication_requested": {"type": "boolean"},
        "eligible": {"type": "boolean"},
        "blockers": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["code", "message"],
                "properties": {"code": BLOCKER_CODE, "message": STRING},
            },
        },
        "validation_state": {
            "type": "string",
            "enum": ["draft", "pending", "approved", "rejected"],
        },
        "current_validation_revision": INTEGER,
        "approved_revision": NULLABLE_INTEGER,
        "subscription": {"oneOf": [SUBSCRIPTION, {"type": "null"}]},
        "active_route_count": INTEGER,
        "coverage": {"type": "array", "items": COMMUNE},
    },
}
ROUTE_INPUT = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "label",
        "status",
        "weekdays",
        "start_time",
        "end_time",
        "seat_capacity",
        "destination_label",
        "destination_address",
        "coverage_codes",
    ],
    "properties": {
        "label": STRING,
        "status": ROUTE_STATUS,
        "weekdays": {"type": "array", "minItems": 1, "items": WEEKDAY},
        "start_time": STRING,
        "end_time": STRING,
        "seat_capacity": INTEGER,
        "destination_label": STRING,
        "destination_address": STRING,
        "coverage_codes": {"type": "array", "minItems": 1, "items": STRING},
    },
}
ROUTE = {
    **ROUTE_INPUT,
    "required": [
        "id",
        "revision",
        "next_service_date",
        "used_seats",
        "available_seats",
        *ROUTE_INPUT["required"],
    ],
    "properties": {
        "id": INTEGER,
        "revision": INTEGER,
        "next_service_date": {"type": "string", "format": "date"},
        "used_seats": INTEGER,
        "available_seats": INTEGER,
        **ROUTE_INPUT["properties"],
    },
}
ROUTE_UPDATE = {
    **ROUTE_INPUT,
    "required": [*ROUTE_INPUT["required"], "expected_revision"],
    "properties": {**ROUTE_INPUT["properties"], "expected_revision": INTEGER},
}
ASSIGNMENT_INPUT = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "route_id",
        "student_display_name",
        "pickup_instruction",
        "guardian_display_name",
        "guardian_contact",
        "starts_on",
        "ends_on",
    ],
    "properties": {
        "route_id": INTEGER,
        "student_display_name": STRING,
        "pickup_instruction": STRING,
        "guardian_display_name": STRING,
        "guardian_contact": {
            "type": "string",
            "minLength": 9,
            "maxLength": 9,
            "pattern": "^[0-9]{9}$",
        },
        "starts_on": {"type": "string", "format": "date"},
        "ends_on": {"type": ["string", "null"], "format": "date"},
    },
}
ASSIGNMENT = {
    **ASSIGNMENT_INPUT,
    "required": ["id", "created_at", "updated_at", *ASSIGNMENT_INPUT["required"]],
    "properties": {
        **ASSIGNMENT_INPUT["properties"],
        "id": INTEGER,
        "created_at": STRING,
        "updated_at": STRING,
    },
}
PAYMENT_INPUT = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "assignment_id",
        "service_period_start",
        "service_period_end",
        "amount_clp",
        "due_on",
    ],
    "properties": {
        "assignment_id": INTEGER,
        "service_period_start": {"type": "string", "format": "date"},
        "service_period_end": {"type": "string", "format": "date"},
        "amount_clp": INTEGER,
        "due_on": {"type": "string", "format": "date"},
    },
}
PAYMENT = {
    **PAYMENT_INPUT,
    "required": [
        "id",
        "status",
        "paid_at",
        "created_at",
        "updated_at",
        *PAYMENT_INPUT["required"],
    ],
    "properties": {
        **PAYMENT_INPUT["properties"],
        "id": INTEGER,
        "status": {"type": "string", "enum": ["pending", "paid", "void"]},
        "paid_at": {"type": ["string", "null"], "format": "date-time"},
        "created_at": STRING,
        "updated_at": STRING,
    },
}
SUMMARY_ROUTE = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "id",
        "label",
        "status",
        "seat_capacity",
        "next_service_date",
        "used_seats",
        "available_seats",
    ],
    "properties": {
        "id": INTEGER,
        "label": STRING,
        "status": ROUTE_STATUS,
        "seat_capacity": INTEGER,
        "next_service_date": {"type": "string", "format": "date"},
        "used_seats": INTEGER,
        "available_seats": INTEGER,
    },
}
DRIVER_SUMMARY = {
    "type": "object",
    "additionalProperties": False,
    "required": ["publication", "routes", "active_assignments", "payment_counts"],
    "properties": {
        "publication": PUBLICATION,
        "routes": {"type": "array", "items": SUMMARY_ROUTE},
        "active_assignments": INTEGER,
        "payment_counts": {
            "type": "object",
            "additionalProperties": False,
            "required": ["pending", "paid", "void"],
            "properties": {"pending": INTEGER, "paid": INTEGER, "void": INTEGER},
        },
    },
}
DISCOVERY_ROUTE = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "id",
        "label",
        "weekdays",
        "start_time",
        "end_time",
        "seat_capacity",
        "used_seats",
        "available_seats",
        "next_service_date",
        "coverage",
    ],
    "properties": {
        "id": INTEGER,
        "label": STRING,
        "weekdays": {"type": "array", "items": WEEKDAY},
        "start_time": STRING,
        "end_time": STRING,
        "seat_capacity": INTEGER,
        "used_seats": INTEGER,
        "available_seats": INTEGER,
        "next_service_date": {"type": "string", "format": "date"},
        "coverage": {"type": "array", "items": COMMUNE},
    },
}
DISCOVERY_DRIVER = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "id",
        "display_name",
        "service_summary",
        "validation_label",
        "coverage",
        "routes",
        "review_average",
        "review_count",
    ],
    "properties": {
        "id": INTEGER,
        "display_name": STRING,
        "service_summary": STRING,
        "validation_label": {"type": "string", "enum": ["Validado"]},
        "coverage": {"type": "array", "items": COMMUNE},
        "routes": {"type": "array", "items": DISCOVERY_ROUTE},
        "review_average": {"type": ["number", "null"]},
        "review_count": INTEGER,
    },
}
SUBSCRIPTION_INPUT = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "plan_code",
        "status",
        "starts_at",
        "ends_at",
        "reason",
        "expected_version",
    ],
    "properties": {
        "plan_code": PLAN_CODE,
        "status": SUBSCRIPTION_STATUS,
        "starts_at": {"type": ["string", "null"], "format": "date-time"},
        "ends_at": {"type": ["string", "null"], "format": "date-time"},
        "reason": STRING,
        "expected_version": NULLABLE_INTEGER,
    },
}
ENDPOINTS += (
    Endpoint(
        "driver/publication/",
        "driver-publication-get",
        "get",
        "getDriverPublication",
        "Own publication status",
        PUBLICATION,
    ),
    Endpoint(
        "driver/publication/",
        "driver-publication-patch",
        "patch",
        "patchDriverPublication",
        "Request or withdraw publication",
        PUBLICATION,
        200,
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["publication_requested"],
            "properties": {"publication_requested": {"type": "boolean"}},
        },
    ),
    Endpoint(
        "driver/communes/",
        "driver-communes",
        "get",
        "getDriverCommunes",
        "Standardized commune catalog",
        COMMUNES,
    ),
    Endpoint(
        "driver/routes/",
        "driver-routes-get",
        "get",
        "getDriverRoutes",
        "Own routes",
        {
            "type": "object",
            "required": ["routes"],
            "properties": {"routes": {"type": "array", "items": ROUTE}},
        },
    ),
    Endpoint(
        "driver/routes/",
        "driver-routes-post",
        "post",
        "createDriverRoute",
        "Create own route",
        ROUTE,
        201,
        ROUTE_INPUT,
    ),
    Endpoint(
        "driver/routes/{id}/",
        "driver-route-get",
        "get",
        "getDriverRoute",
        "Own route",
        ROUTE,
    ),
    Endpoint(
        "driver/routes/{id}/",
        "driver-route-patch",
        "patch",
        "patchDriverRoute",
        "Update own route",
        ROUTE,
        200,
        ROUTE_UPDATE,
    ),
    Endpoint(
        "driver/summary/",
        "driver-summary",
        "get",
        "getDriverSummary",
        "Own operational summary",
        DRIVER_SUMMARY,
    ),
    Endpoint(
        "driver/passenger-assignments/",
        "assignments-get",
        "get",
        "getDriverAssignments",
        "Own passenger assignments",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["assignments"],
            "properties": {"assignments": {"type": "array", "items": ASSIGNMENT}},
        },
    ),
    Endpoint(
        "driver/passenger-assignments/",
        "assignments-post",
        "post",
        "createDriverAssignment",
        "Create own passenger assignment",
        ASSIGNMENT,
        201,
        ASSIGNMENT_INPUT,
    ),
    Endpoint(
        "driver/passenger-assignments/{id}/",
        "assignment-get",
        "get",
        "getDriverAssignment",
        "Own passenger assignment",
        ASSIGNMENT,
    ),
    Endpoint(
        "driver/passenger-assignments/{id}/",
        "assignment-patch",
        "patch",
        "patchDriverAssignment",
        "Update own passenger assignment",
        ASSIGNMENT,
        200,
        {
            "type": "object",
            "additionalProperties": False,
            "properties": ASSIGNMENT_INPUT["properties"],
        },
    ),
    Endpoint(
        "driver/passenger-assignments/{id}/end/",
        "assignment-end",
        "post",
        "endDriverAssignment",
        "End own passenger assignment",
        ASSIGNMENT,
        200,
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["ends_on"],
            "properties": {"ends_on": {"type": "string", "format": "date"}},
        },
    ),
    Endpoint(
        "driver/payments/",
        "payments-get",
        "get",
        "getDriverPayments",
        "Own manual transport payments",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["payments"],
            "properties": {"payments": {"type": "array", "items": PAYMENT}},
        },
    ),
    Endpoint(
        "driver/payments/",
        "payments-post",
        "post",
        "createDriverPayment",
        "Create pending transport payment",
        PAYMENT,
        201,
        PAYMENT_INPUT,
    ),
    Endpoint(
        "driver/payments/{id}/",
        "payment-get",
        "get",
        "getDriverPayment",
        "Own manual transport payment",
        PAYMENT,
    ),
    Endpoint(
        "driver/payments/{id}/mark-paid/",
        "payment-paid",
        "post",
        "markDriverPaymentPaid",
        "Mark pending payment paid",
        PAYMENT,
        200,
        {"type": "object", "additionalProperties": False, "properties": {}},
    ),
    Endpoint(
        "driver/payments/{id}/void/",
        "payment-void",
        "post",
        "voidDriverPayment",
        "Void pending or paid payment",
        PAYMENT,
        200,
        {"type": "object", "additionalProperties": False, "properties": {}},
    ),
    Endpoint(
        "admin/plans/",
        "admin-plans",
        "get",
        "getAdminPlans",
        "Plan catalog",
        {
            "type": "object",
            "required": ["plans"],
            "properties": {
                "plans": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["code", "display_label"],
                        "properties": {"code": PLAN_CODE, "display_label": STRING},
                    },
                }
            },
        },
    ),
    Endpoint(
        "admin/drivers/{id}/publication/",
        "admin-publication",
        "get",
        "getAdminPublication",
        "Driver publication status",
        PUBLICATION,
    ),
    Endpoint(
        "admin/drivers/{id}/subscription/",
        "admin-subscription-get",
        "get",
        "getAdminSubscription",
        "Current subscription and version",
        {
            "type": "object",
            "required": ["publication", "version"],
            "properties": {"publication": PUBLICATION, "version": NULLABLE_INTEGER},
        },
    ),
    Endpoint(
        "admin/drivers/{id}/subscription/",
        "admin-subscription-post",
        "post",
        "changeAdminSubscription",
        "Audited subscription mutation",
        {
            "type": "object",
            "required": ["publication", "version"],
            "properties": {"publication": PUBLICATION, "version": INTEGER},
        },
        200,
        SUBSCRIPTION_INPUT,
    ),
    Endpoint(
        "discovery/drivers/",
        "discovery-list",
        "get",
        "listDiscoverableDrivers",
        "Eligible drivers",
        {
            "type": "object",
            "required": ["results"],
            "properties": {"results": {"type": "array", "items": DISCOVERY_DRIVER}},
        },
    ),
    Endpoint(
        "discovery/drivers/{id}/",
        "discovery-detail",
        "get",
        "getDiscoverableDriver",
        "Eligible driver detail",
        DISCOVERY_DRIVER,
    ),
)

REVIEW = {
    "type": "object",
    "additionalProperties": False,
    "required": ["score", "text", "created_at", "created_on", "is_demo"],
    "properties": {
        "score": {"type": "integer", "minimum": 1, "maximum": 5},
        "text": STRING,
        "created_at": {"type": "string", "format": "date-time"},
        "created_on": {"type": "string", "format": "date"},
        "is_demo": {"type": "boolean"},
    },
}
DISCOVERY_DETAIL = {
    **DISCOVERY_DRIVER,
    "required": [*DISCOVERY_DRIVER["required"], "reviews"],
    "properties": {
        **DISCOVERY_DRIVER["properties"],
        "reviews": {"type": "array", "items": REVIEW},
    },
}
CONTACT_STATUS = {
    "type": "string",
    "enum": ["pending", "accepted", "declined", "cancelled"],
}
CONTACT_COMMON = {
    "id": INTEGER,
    "message": STRING,
    "status": CONTACT_STATUS,
    "created_at": {"type": "string", "format": "date-time"},
    "updated_at": {"type": "string", "format": "date-time"},
    "resolved_at": {"type": ["string", "null"], "format": "date-time"},
}
PARENT_CONTACT = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        *CONTACT_COMMON,
        "driver_id",
        "driver_display_name",
        "driver_service_email",
    ],
    "properties": {
        **CONTACT_COMMON,
        "driver_id": INTEGER,
        "driver_display_name": STRING,
        "driver_service_email": {"type": ["string", "null"], "format": "email"},
    },
}
DRIVER_CONTACT = {
    "type": "object",
    "additionalProperties": False,
    "required": [*CONTACT_COMMON, "parent_display_name", "parent_email"],
    "properties": {
        **CONTACT_COMMON,
        "parent_display_name": STRING,
        "parent_email": {"type": "string", "format": "email"},
    },
}
PARENT_PROFILE = {
    "type": "object",
    "additionalProperties": False,
    "required": ["display_name", "email"],
    "properties": {
        "display_name": STRING,
        "email": {"type": "string", "format": "email"},
    },
}
ENDPOINTS += (
    Endpoint(
        "discovery/communes/",
        "discovery-communes",
        "get",
        "getDiscoveryCommunes",
        "Active parent communes",
        COMMUNES,
    ),
    Endpoint(
        "discovery/compare/",
        "discovery-compare",
        "get",
        "compareDiscoverableDrivers",
        "Compare 2–3 eligible drivers",
        {
            "type": "object",
            "required": ["results"],
            "properties": {"results": {"type": "array", "items": DISCOVERY_DRIVER}},
        },
    ),
    Endpoint(
        "parent/profile/",
        "parent-profile-get",
        "get",
        "getParentProfile",
        "Own parent profile",
        PARENT_PROFILE,
    ),
    Endpoint(
        "parent/profile/",
        "parent-profile-patch",
        "patch",
        "patchParentProfile",
        "Edit parent display name",
        PARENT_PROFILE,
        200,
        {
            "type": "object",
            "required": ["display_name"],
            "properties": {"display_name": {"type": "string", "maxLength": 100}},
        },
    ),
    Endpoint(
        "parent/contact-requests/",
        "parent-requests-get",
        "get",
        "getParentContactRequests",
        "Own contact history",
        {
            "type": "object",
            "required": ["results"],
            "properties": {"results": {"type": "array", "items": PARENT_CONTACT}},
        },
    ),
    Endpoint(
        "parent/contact-requests/",
        "parent-requests-post",
        "post",
        "createParentContactRequest",
        "Create consented contact request",
        PARENT_CONTACT,
        201,
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["driver_id", "message", "consent_share_email"],
            "properties": {
                "driver_id": INTEGER,
                "message": {"type": "string", "minLength": 1, "maxLength": 500},
                "consent_share_email": {"type": "boolean", "const": True},
            },
        },
    ),
    Endpoint(
        "parent/contact-requests/{id}/",
        "parent-request-detail",
        "get",
        "getParentContactRequest",
        "Own contact detail",
        PARENT_CONTACT,
    ),
    Endpoint(
        "parent/contact-requests/{id}/cancel/",
        "parent-request-cancel",
        "post",
        "cancelParentContactRequest",
        "Cancel pending request",
        PARENT_CONTACT,
    ),
    Endpoint(
        "driver/contact-requests/",
        "driver-requests-get",
        "get",
        "getDriverContactRequests",
        "Own incoming requests",
        {
            "type": "object",
            "required": ["results"],
            "properties": {"results": {"type": "array", "items": DRIVER_CONTACT}},
        },
    ),
    Endpoint(
        "driver/contact-requests/{id}/",
        "driver-request-detail",
        "get",
        "getDriverContactRequest",
        "Own incoming detail",
        DRIVER_CONTACT,
    ),
    Endpoint(
        "driver/contact-requests/{id}/accept/",
        "driver-request-accept",
        "post",
        "acceptDriverContactRequest",
        "Accept pending request",
        DRIVER_CONTACT,
    ),
    Endpoint(
        "driver/contact-requests/{id}/decline/",
        "driver-request-decline",
        "post",
        "declineDriverContactRequest",
        "Decline pending request",
        DRIVER_CONTACT,
    ),
)

RUN = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "id",
        "route_id",
        "service_date",
        "state",
        "start_time",
        "end_time",
        "seat_capacity",
        "destination_label",
        "destination_address",
        "started_at",
        "ended_at",
    ],
    "properties": {
        "id": INTEGER,
        "route_id": INTEGER,
        "service_date": {"type": "string", "format": "date"},
        "state": {"type": "string", "enum": ["planned", "in_progress", "completed"]},
        "start_time": STRING,
        "end_time": STRING,
        "seat_capacity": INTEGER,
        "destination_label": STRING,
        "destination_address": STRING,
        "started_at": {"type": ["string", "null"], "format": "date-time"},
        "ended_at": {"type": ["string", "null"], "format": "date-time"},
    },
}
TODAY_ROSTER = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "student_display_name",
        "pickup_instruction",
        "guardian_display_name",
        "guardian_contact",
    ],
    "properties": {
        "student_display_name": STRING,
        "pickup_instruction": STRING,
        "guardian_display_name": STRING,
        "guardian_contact": STRING,
    },
}
TODAY_ROUTE = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "route_id",
        "label",
        "start_time",
        "end_time",
        "seat_capacity",
        "used_seats",
        "available_seats",
        "destination_label",
        "destination_address",
        "roster",
        "run",
    ],
    "properties": {
        "route_id": INTEGER,
        "label": STRING,
        "start_time": STRING,
        "end_time": STRING,
        "seat_capacity": INTEGER,
        "used_seats": INTEGER,
        "available_seats": INTEGER,
        "destination_label": STRING,
        "destination_address": STRING,
        "roster": {"type": "array", "items": TODAY_ROSTER},
        "run": {"anyOf": [RUN, {"type": "null"}]},
    },
}
UNFINISHED_RUN = {
    **RUN,
    "required": [*RUN["required"], "label"],
    "properties": {**RUN["properties"], "label": STRING},
}
ENDPOINTS += (
    Endpoint(
        "driver/today/",
        "driver-today",
        "get",
        "getDriverToday",
        "Today's owner routes and unfinished earlier runs",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["service_date", "routes", "unfinished_runs"],
            "properties": {
                "service_date": {"type": "string", "format": "date"},
                "routes": {"type": "array", "items": TODAY_ROUTE},
                "unfinished_runs": {"type": "array", "items": UNFINISHED_RUN},
            },
        },
    ),
    Endpoint(
        "driver/routes/{id}/start/",
        "route-start",
        "post",
        "startDriverRoute",
        "Start today's scheduled owner route",
        RUN,
    ),
    Endpoint(
        "driver/runs/{id}/end/",
        "run-end",
        "post",
        "endDriverRun",
        "Complete own current or earlier unfinished run",
        RUN,
    ),
)

# Detail adds published review display; search and comparison stay on one summary.
ENDPOINTS = tuple(
    Endpoint(
        e.path,
        e.name,
        e.method,
        e.operation_id,
        e.summary,
        DISCOVERY_DETAIL if e.name == "discovery-detail" else e.response_schema,
        e.success_status,
        e.request_schema,
    )
    for e in ENDPOINTS
)

# The original generated schema builder is retained for auth; enrich Task 03 operations.
_base_openapi_document = openapi_document


def openapi_document():
    document = _base_openapi_document()
    for endpoint in ENDPOINTS:
        if endpoint.name in {
            "health",
            "auth-csrf",
            "auth-register",
            "auth-login",
            "auth-me",
            "auth-logout",
        }:
            continue
        path = f"/api/v1/{endpoint.path}"
        operation = {
            "operationId": endpoint.operation_id,
            "summary": endpoint.summary,
            "security": [{"SessionCookie": []}],
            "responses": {
                str(endpoint.success_status): {
                    "description": "Private non-cacheable response",
                    "content": (
                        {
                            mime: {"schema": endpoint.response_schema}
                            for mime in ("application/pdf", "image/jpeg", "image/png")
                        }
                        if endpoint.name.endswith("download")
                        else {"application/json": {"schema": endpoint.response_schema}}
                    ),
                },
                "default": {
                    "description": "API error",
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Error"}
                        }
                    },
                },
            },
        }
        if "{id}" in path:
            operation["parameters"] = [
                {"name": "id", "in": "path", "required": True, "schema": INTEGER}
            ]
        if endpoint.name == "admin-validations":
            operation.setdefault("parameters", []).append(
                {
                    "name": "state",
                    "in": "query",
                    "schema": {
                        "type": "string",
                        "enum": [
                            "pending",
                            "approved",
                            "rejected",
                            "superseded",
                            "all",
                        ],
                        "default": "pending",
                    },
                }
            )
        if endpoint.name == "discovery-list":
            operation.setdefault("parameters", []).append(
                {"name": "commune", "in": "query", "schema": STRING}
            )
        if endpoint.name == "discovery-compare":
            operation.setdefault("parameters", []).append(
                {"name": "ids", "in": "query", "required": True, "schema": STRING}
            )
        if endpoint.request_schema:
            mime = (
                "multipart/form-data"
                if endpoint.name == "driver-documents-post"
                else "application/json"
            )
            operation["requestBody"] = {
                "required": True,
                "content": {mime: {"schema": endpoint.request_schema}},
            }
        if endpoint.method in {"patch", "post"}:
            operation.setdefault("parameters", []).append(
                {
                    "name": "X-CSRFToken",
                    "in": "header",
                    "required": True,
                    "description": (
                        "Masked token from auth/csrf or login, "
                        "paired with the CSRF cookie"
                    ),
                    "schema": STRING,
                }
            )
        document["paths"].setdefault(path, {})[endpoint.method] = operation
    return document


# Task 08: explicit per-driver administration, never generic model/log CRUD.
def control_object(properties):
    return {
        "type": "object",
        "additionalProperties": False,
        "required": list(properties),
        "properties": properties,
    }


ADMIN_DRIVER = control_object(
    {
        "id": INTEGER,
        "display_name": STRING,
        "email": {"type": "string", "format": "email"},
        "profile_version": NULLABLE_INTEGER,
        "publication": PUBLICATION,
    }
)
PROFILE_STATUS_INPUT = control_object(
    {
        "status": PROFILE_STATUS,
        "expected_status": PROFILE_STATUS,
        "expected_version": {**NULLABLE_INTEGER, "minimum": 1},
        "reason": {"type": "string", "minLength": 1, "maxLength": 1000},
    }
)
AUDIT_STATE = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "status": STRING,
        "plan_code": PLAN_CODE,
        "starts_at": {"type": ["string", "null"], "format": "date-time"},
        "ends_at": {"type": ["string", "null"], "format": "date-time"},
    },
}
ADMIN_ACTION = control_object(
    {
        "id": INTEGER,
        "actor": control_object({"id": INTEGER, "display_name": STRING}),
        "action": {
            "type": "string",
            "enum": [
                "profile_status_changed",
                "subscription_changed",
                "validation_approved",
                "validation_rejected",
                "document_read",
            ],
        },
        "target_type": {
            "type": "string",
            "enum": [
                "driver_profile",
                "subscription",
                "validation",
                "document",
            ],
        },
        "target_id": INTEGER,
        "occurred_at": {"type": "string", "format": "date-time"},
        "correlation_id": STRING,
        "reason": STRING,
        "before": AUDIT_STATE,
        "after": AUDIT_STATE,
    }
)


def control_page(item):
    return control_object(
        {"results": {"type": "array", "items": item}, "count": INTEGER}
    )


ENDPOINTS += (
    Endpoint(
        "admin/drivers/",
        "admin-drivers",
        "get",
        "getAdminDrivers",
        "Search current driver control queue (admin only)",
        control_page(ADMIN_DRIVER),
    ),
    Endpoint(
        "admin/drivers/{id}/",
        "admin-driver-detail",
        "get",
        "getAdminDriver",
        "Selected driver control state (admin only)",
        ADMIN_DRIVER,
    ),
    Endpoint(
        "admin/drivers/{id}/status/",
        "admin-driver-status",
        "post",
        "changeAdminDriverStatus",
        "Audited profile transition with reason and optimistic version (admin only)",
        ADMIN_DRIVER,
        200,
        PROFILE_STATUS_INPUT,
    ),
    Endpoint(
        "admin/drivers/{id}/history/",
        "admin-driver-history",
        "get",
        "getAdminDriverHistory",
        "Allowlisted selected-driver audit history (admin only)",
        control_page(ADMIN_ACTION),
    ),
    Endpoint(
        "admin/drivers/{id}/validations/",
        "admin-driver-validations",
        "get",
        "getAdminDriverValidations",
        "Retained selected-driver validation observations (admin only)",
        control_page(VALIDATION),
    ),
)

_control_openapi_document = openapi_document


def openapi_document():
    document = _control_openapi_document()
    for name in ("admin-drivers", "admin-driver-history", "admin-driver-validations"):
        endpoint = next(e for e in ENDPOINTS if e.name == name)
        operation = document["paths"][f"/api/v1/{endpoint.path}"]["get"]
        filters = {
            "offset": {"type": "integer", "minimum": 0, "default": 0},
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 50 if name == "admin-drivers" else 100,
                "default": 25,
            },
        }
        if name == "admin-drivers":
            filters.update(
                {
                    "q": {"type": "string", "maxLength": 100},
                    "validation_state": PUBLICATION["properties"]["validation_state"],
                    "profile_status": PROFILE_STATUS,
                    "plan_code": PLAN_CODE,
                    "subscription_status": {
                        "type": "string",
                        "enum": ["missing", "inactive", "active", "suspended"],
                    },
                    "publication": {"type": "string", "enum": ["eligible", "blocked"]},
                    "blocker": BLOCKER_CODE,
                }
            )
        operation.setdefault("parameters", []).extend(
            {"name": key, "in": "query", "schema": value}
            for key, value in filters.items()
        )
    return document


# Task 12: commercial inclusion is not effective availability.
CAPABILITY_STATE = control_object(
    {
        "included_in_plan": {"type": "boolean"},
        "implemented": {"type": "boolean"},
        "enabled": {"type": "boolean"},
        "blockers": {"type": "array", "items": STRING},
    }
)
COMMERCIAL_PLAN = control_object(
    {
        "code": PLAN_CODE,
        "label": STRING,
        "monthly_price_clp": {"type": "integer", "minimum": 0},
        "currency": {"type": "string", "const": "CLP"},
        "billing_period": {"type": "string", "const": "month"},
        "commercial_proposal": {"type": "boolean", "const": True},
        "automatic_billing": {"type": "boolean", "const": False},
        "support_priority": {
            "type": "string",
            "enum": ["standard", "preferred", "priority"],
        },
    }
)
CAPABILITY_SUBSCRIPTION = control_object(
    {
        "status": STRING,
        "starts_at": {"type": ["string", "null"], "format": "date-time"},
        "ends_at": {"type": ["string", "null"], "format": "date-time"},
        "effective": {"type": "boolean"},
    }
)
DRIVER_CAPABILITIES = control_object(
    {
        "catalog_version": STRING,
        "evaluated_at": {"type": "string", "format": "date-time"},
        "plan": {"oneOf": [COMMERCIAL_PLAN, {"type": "null"}]},
        "subscription": {"oneOf": [CAPABILITY_SUBSCRIPTION, {"type": "null"}]},
        "blockers": {"type": "array", "items": STRING},
        "capabilities": control_object(
            {
                code: CAPABILITY_STATE
                for code in (
                    "operations.core",
                    "dashboard.basic",
                    "reports.monthly.read",
                    "reports.detail.read",
                    "reports.xlsx.export",
                    "analytics.period_comparison",
                    "help.center",
                    "support.requests",
                    "assistant.faq",
                    "assistant.contextual",
                )
            }
        ),
    }
)
ENDPOINTS += (
    Endpoint(
        "driver/capabilities/",
        "driver-capabilities",
        "get",
        "getDriverCapabilities",
        "Own effective capabilities; inclusion is separate from availability",
        DRIVER_CAPABILITIES,
    ),
)

DATE = {"type": "string", "format": "date"}
DATETIME = {"type": "string", "format": "date-time"}
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
REPORT_PERIOD = control_object(
    {
        "month": STRING,
        "start": DATE,
        "end_exclusive": DATE,
        "timezone": {"type": "string", "const": "America/Santiago"},
    }
)
REPORT_SUMMARY = control_object(
    {
        "payments": control_object(
            {
                s: control_object({"count": INTEGER, "amount_clp": INTEGER})
                for s in ("pending", "paid", "void")
            }
        ),
        "payment_count": INTEGER,
        "non_void_amount_clp": INTEGER,
        "runs": control_object(
            {s: INTEGER for s in ("planned", "in_progress", "completed")}
        ),
        "run_count": INTEGER,
        "recorded_capacity_total": INTEGER,
        "contacts": control_object(
            {s: INTEGER for s in ("pending", "accepted", "declined", "cancelled")}
        ),
        "contact_count": INTEGER,
    }
)
REPORT_CAPACITY = control_object(
    {
        "as_of": DATE,
        "routes": {
            "type": "array",
            "items": control_object(
                {
                    "route_id": INTEGER,
                    "status": STRING,
                    "seat_capacity": INTEGER,
                    "next_service_date": DATE,
                    "used_seats": INTEGER,
                    "available_seats": INTEGER,
                }
            ),
        },
    }
)
MONTHLY_REPORT = control_object(
    {
        "period": REPORT_PERIOD,
        "generated_at": DATETIME,
        "summary": REPORT_SUMMARY,
        "current_capacity": REPORT_CAPACITY,
        "notes": {"type": "array", "items": STRING},
    }
)
ENDPOINTS += (
    Endpoint(
        "driver/reports/monthly/",
        "driver-reports-monthly",
        "get",
        "getDriverMonthlyReport",
        "Own monthly cohorts (Pro and Elite)",
        MONTHLY_REPORT,
    ),
)

_reports_openapi_document = openapi_document

REPORT_DETAILS = control_object(
    {
        "payments": {
            "type": "array",
            "items": control_object(
                {
                    "id": INTEGER,
                    "service_period_start": DATE,
                    "service_period_end": DATE,
                    "due_on": DATE,
                    "status": STRING,
                    "amount_clp": INTEGER,
                }
            ),
        },
        "runs": {
            "type": "array",
            "items": control_object(
                {
                    "id": INTEGER,
                    "route_id": INTEGER,
                    "service_date": DATE,
                    "state": STRING,
                    "seat_capacity_snapshot": INTEGER,
                    "start_time_snapshot": STRING,
                    "end_time_snapshot": STRING,
                }
            ),
        },
        "contacts": {
            "type": "array",
            "items": control_object(
                {
                    "id": INTEGER,
                    "created_at": DATETIME,
                    "status": STRING,
                    "resolved_at": {"type": ["string", "null"], "format": "date-time"},
                }
            ),
        },
    }
)
ADVANCED_REPORT = control_object(
    {
        **MONTHLY_REPORT["properties"],
        "previous": control_object(
            {"period": REPORT_PERIOD, "summary": REPORT_SUMMARY}
        ),
        "details": REPORT_DETAILS,
    }
)
ENDPOINTS += (
    Endpoint(
        "driver/reports/advanced/",
        "driver-reports-advanced",
        "get",
        "getDriverAdvancedReport",
        "Own minimal detail and previous-month cohorts (Elite)",
        ADVANCED_REPORT,
    ),
)
for report_kind in ("payments", "runs", "contacts"):
    ENDPOINTS += (
        Endpoint(
            f"driver/reports/{report_kind}.xlsx",
            f"driver-reports-{report_kind}-xlsx",
            "get",
            f"exportDriver{report_kind.title()}Xlsx",
            "Private Excel export (Elite)",
            {"type": "string", "format": "binary"},
        ),
    )


def openapi_document():
    document = _reports_openapi_document()
    for endpoint in ENDPOINTS:
        if endpoint.name.startswith("driver-reports-"):
            operation = document["paths"][f"/api/v1/{endpoint.path}"]["get"]
            operation["parameters"] = [
                {
                    "name": "month",
                    "in": "query",
                    "schema": {
                        "type": "string",
                        "pattern": r"^20[0-9]{2}-(0[1-9]|1[0-2])$",
                    },
                    "description": "Mes calendario America/Santiago; por defecto mes "
                    "actual. Solo un valor; sin otros parámetros.",
                }
            ]
            if endpoint.name.endswith("-xlsx"):
                operation["responses"]["200"]["content"] = {
                    XLSX_MIME: {"schema": endpoint.response_schema}
                }
                operation["responses"]["200"]["headers"] = {
                    "Cache-Control": {
                        "schema": {"type": "string", "const": "no-store"}
                    },
                    "Content-Disposition": {"schema": STRING},
                }
    return document


# Import after the shared schema helpers; no changes to report endpoints.
from api.support_contracts import build_endpoints  # noqa: E402

ENDPOINTS += build_endpoints()
_support_openapi_document = openapi_document


def openapi_document():
    document = _support_openapi_document()
    for name in ("support-list", "admin-support-list"):
        endpoint = next(e for e in ENDPOINTS if e.name == name)
        document["paths"][f"/api/v1/{endpoint.path}"]["get"]["parameters"] = [
            {
                "name": "offset",
                "in": "query",
                "schema": {**INTEGER, "minimum": 0, "default": 0},
            },
            {
                "name": "limit",
                "in": "query",
                "schema": {**INTEGER, "minimum": 1, "maximum": 50, "default": 25},
            },
        ]
    document["paths"]["/api/v1/admin/support/tickets/"]["get"]["parameters"].append(
        {
            "name": "state",
            "in": "query",
            "schema": {
                "type": "string",
                "enum": [
                    "active",
                    "all",
                    "open",
                    "in_progress",
                    "waiting_user",
                    "resolved",
                    "closed",
                ],
                "default": "active",
            },
        }
    )
    return document
