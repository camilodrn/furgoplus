from django.urls import path

from api.auth import CsrfView, LoginView, LogoutView, MeView, RegisterView
from api.contracts import ENDPOINTS
from api.views import HealthView

VIEWS = {
    "health": HealthView,
    "auth-csrf": CsrfView,
    "auth-register": RegisterView,
    "auth-login": LoginView,
    "auth-me": MeView,
    "auth-logout": LogoutView,
}
urlpatterns = [
    path(endpoint.path, VIEWS[endpoint.name].as_view(), name=endpoint.name)
    for endpoint in ENDPOINTS
]
