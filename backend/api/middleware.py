from django.http import JsonResponse


class ApiNotFoundMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if (
            request.path.startswith("/api/")
            and response.status_code == 404
            and not response.get("Content-Type", "").startswith("application/json")
        ):
            return JsonResponse(
                {"code": "not_found", "message": "Not found.", "fields": {}},
                status=404,
            )
        return response
