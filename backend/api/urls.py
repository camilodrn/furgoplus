from django.urls import path

from api.auth import CsrfView, LoginView, LogoutView, MeView, RegisterView
from api.contracts import ENDPOINTS
from api.views import HealthView
from drivers import api as driver_api

VIEWS = {
    "health": HealthView,
    "auth-csrf": CsrfView,
    "auth-register": RegisterView,
    "auth-login": LoginView,
    "auth-me": MeView,
    "auth-logout": LogoutView,
    "driver-profile-get": driver_api.DriverProfileView,
    "driver-profile-patch": driver_api.DriverProfileView,
    "driver-checklist": driver_api.DriverChecklistView,
    "driver-documents-get": driver_api.DriverDocumentsView,
    "driver-documents-post": driver_api.DriverDocumentsView,
    "driver-document-download": driver_api.DriverDocumentDownloadView,
    "driver-validations": driver_api.DriverValidationsView,
    "driver-submit": driver_api.DriverSubmitView,
    "admin-validations": driver_api.AdminValidationsView,
    "admin-validation-detail": driver_api.AdminValidationDetailView,
    "admin-document-download": driver_api.AdminDocumentDownloadView,
    "admin-approve": driver_api.AdminApproveView,
    "admin-reject": driver_api.AdminRejectView,
}

urlpatterns = []
registered = set()
for endpoint in ENDPOINTS:
    if endpoint.path in registered:
        continue
    registered.add(endpoint.path)
    urlpatterns.append(
        path(
            endpoint.path.replace("{id}", "<int:id>"),
            VIEWS[endpoint.name].as_view(),
            name=endpoint.name,
        )
    )
