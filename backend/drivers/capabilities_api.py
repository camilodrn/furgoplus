"""Read-only, owner-scoped capability discovery."""

from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from drivers.capabilities import driver_capabilities
from drivers.publication_api import DriverView


class DriverCapabilitiesView(DriverView):
    def get(self, request):
        if request.query_params:
            raise ValidationError({"query": ["Este recurso no admite parámetros."]})
        return Response(driver_capabilities(request.user))
