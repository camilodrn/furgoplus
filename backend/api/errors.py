from django.http import JsonResponse
from django.views.defaults import page_not_found
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.views import exception_handler as drf_exception_handler


def csrf_failure(request, reason=""):
    return JsonResponse(
        {"code": "csrf_failed", "message": "CSRF verification failed.", "fields": {}},
        status=403,
    )


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ParseError):
        response.data = {
            "code": "parse_error",
            "message": "Invalid JSON.",
            "fields": {},
        }
        return response

    detail = response.data
    fields = {}
    if isinstance(detail, dict):
        if "detail" in detail:
            message = str(detail["detail"])
            code = (
                str(detail["detail"].code)
                if hasattr(detail["detail"], "code")
                else "error"
            )
        else:
            message = "Invalid input."
            code = "validation_error"
            fields = {
                key: [str(item) for item in value]
                if isinstance(value, list)
                else [str(value)]
                for key, value in detail.items()
            }
    else:
        message = str(detail)
        code = "error"
    response.data = {"code": code, "message": message, "fields": fields}
    return response


def api_not_found(request, exception):
    if not request.path.startswith("/api/"):
        return page_not_found(request, exception)
    return JsonResponse(
        {"code": "not_found", "message": "Not found.", "fields": {}},
        status=status.HTTP_404_NOT_FOUND,
    )
