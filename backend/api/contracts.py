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
