from django.urls import path

from api.auth import CsrfView, LoginView, LogoutView, MeView, RegisterView
from api.contracts import ENDPOINTS
from api.views import HealthView
from drivers import api as driver_api
from drivers import contact_api, operations_api, publication_api

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
    "driver-publication-get": publication_api.DriverPublicationView,
    "driver-publication-patch": publication_api.DriverPublicationView,
    "driver-communes": publication_api.CommunesView,
    "driver-routes-get": publication_api.RoutesView,
    "driver-routes-post": publication_api.RoutesView,
    "driver-route-get": publication_api.RouteDetailView,
    "driver-route-patch": publication_api.RouteDetailView,
    "driver-summary": operations_api.DriverSummaryView,
    "assignments-get": operations_api.AssignmentsView,
    "assignments-post": operations_api.AssignmentsView,
    "assignment-get": operations_api.AssignmentDetailView,
    "assignment-patch": operations_api.AssignmentDetailView,
    "assignment-end": operations_api.AssignmentEndView,
    "payments-get": operations_api.PaymentsView,
    "payments-post": operations_api.PaymentsView,
    "payment-get": operations_api.PaymentDetailView,
    "payment-paid": operations_api.PaymentPaidView,
    "payment-void": operations_api.PaymentVoidView,
    "admin-plans": publication_api.PlansView,
    "admin-publication": publication_api.AdminPublicationView,
    "admin-subscription-get": publication_api.AdminSubscriptionView,
    "admin-subscription-post": publication_api.AdminSubscriptionView,
    "discovery-list": publication_api.DiscoveryListView,
    "discovery-detail": publication_api.DiscoveryDetailView,
    "discovery-communes": contact_api.ParentCommunesView,
    "discovery-compare": contact_api.CompareView,
    "parent-profile-get": contact_api.ParentProfileView,
    "parent-profile-patch": contact_api.ParentProfileView,
    "parent-requests-get": contact_api.ParentRequestsView,
    "parent-requests-post": contact_api.ParentRequestsView,
    "parent-request-detail": contact_api.ParentRequestDetailView,
    "parent-request-cancel": contact_api.ParentCancelView,
    "driver-requests-get": contact_api.DriverRequestsView,
    "driver-request-detail": contact_api.DriverRequestDetailView,
    "driver-request-accept": contact_api.DriverAcceptView,
    "driver-request-decline": contact_api.DriverDeclineView,
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
