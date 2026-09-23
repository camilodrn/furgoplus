from django.urls import path

from api.contracts import ENDPOINTS
from api.views import HealthView

VIEWS = {"health": HealthView}
urlpatterns = [
    path(endpoint.path, VIEWS[endpoint.name].as_view(), name=endpoint.name)
    for endpoint in ENDPOINTS
]
