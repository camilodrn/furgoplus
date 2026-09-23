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
