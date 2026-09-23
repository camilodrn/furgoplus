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
ENDPOINTS = (HEALTH,)


def openapi_document():
    paths = {}
    for endpoint in ENDPOINTS:
        paths[f"/api/v1/{endpoint.path}"] = {
            endpoint.method: {
                "operationId": endpoint.operation_id,
                "summary": endpoint.summary,
                "responses": {
                    "200": {
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
        }
    return {
        "openapi": "3.1.0",
        "info": {"title": "FurgoPlus API", "version": "1.0.0"},
        "paths": paths,
        "components": {
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
