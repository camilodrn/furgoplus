"""Participant-only contact and parent discovery additions."""

import re

from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from accounts.models import DriverProfile, ParentProfile
from drivers.models import Commune, ContactRequest, Review
from drivers.publication import CHILE, discovery_json, publication_state, utc_instant
from drivers.publication_api import DriverView, ParentView


class ContactConflict(APIException):
    status_code = 409
    default_detail = "La solicitud ya cambió. Actualiza e inténtalo de nuevo."
    default_code = "contact_conflict"


class PendingDuplicate(ContactConflict):
    default_detail = "Ya tienes una solicitud pendiente para este conductor."
    default_code = "pending_request_exists"


class EligibilityConflict(ContactConflict):
    default_detail = "El conductor ya no está disponible para aceptar solicitudes."
    default_code = "driver_ineligible"


class ParentCommunesView(ParentView):
    def get(self, request):
        return Response(
            {
                "communes": list(
                    Commune.objects.filter(is_active=True)
                    .order_by("display_name")
                    .values("code", "display_name")
                )
            }
        )


class ParentProfileView(ParentView):
    def get(self, request):
        profile = get_object_or_404(ParentProfile, user=request.user)
        return Response(
            {"display_name": profile.display_name, "email": request.user.email}
        )

    def patch(self, request):
        if set(request.data) != {"display_name"}:
            raise ValidationError(
                {"display_name": ["Solo se puede cambiar el nombre visible."]}
            )
        name = request.data.get("display_name")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValidationError(
                {"display_name": ["Indica un nombre de 1 a 100 caracteres."]}
            )
        profile = get_object_or_404(ParentProfile, user=request.user)
        profile.display_name = name.strip()
        profile.save(update_fields=["display_name"])
        return Response(
            {"display_name": profile.display_name, "email": request.user.email}
        )


class CompareView(ParentView):
    def get(self, request):
        raw = request.query_params.get("ids", "")
        parts = raw.split(",")
        if len(parts) not in (2, 3) or any(
            not re.fullmatch(r"[1-9][0-9]*", item) for item in parts
        ):
            raise ValidationError(
                {"ids": ["Selecciona 2 o 3 identificadores válidos."]}
            )
        ids = [int(item) for item in parts]
        if len(set(ids)) != len(ids):
            raise ValidationError({"ids": ["No repitas conductores."]})
        results = []
        now = timezone.now()
        for id in ids:
            driver = get_object_or_404(
                DriverProfile.objects.select_related("user"), pk=id
            )
            state = publication_state(driver, now)
            if not state.eligible:
                raise Http404()
            results.append(
                discovery_json(driver, state, timezone.localtime(now, CHILE).date())
            )
        return Response({"results": results})


def review_json(review):
    return {
        "score": review.score,
        "text": review.text,
        "created_at": utc_instant(review.created_at),
        "created_on": timezone.localtime(review.created_at, CHILE).date().isoformat(),
        "is_demo": review.is_demo,
    }


class ReviewDetailMixin:
    @staticmethod
    def with_reviews(body, driver):
        rows = Review.objects.filter(
            driver=driver, status=Review.Status.PUBLISHED
        ).order_by("-created_at", "-id")[:20]
        return {**body, "reviews": [review_json(row) for row in rows]}


class ContactInput(serializers.Serializer):
    driver_id = serializers.IntegerField(min_value=1)
    message = serializers.CharField(
        max_length=500, trim_whitespace=True, allow_blank=False
    )
    consent_share_email = serializers.BooleanField()

    def validate_consent_share_email(self, value):
        if value is not True:
            raise ValidationError("Debes aceptar compartir tu correo de cuenta.")
        return value


def parent_json(row):
    return {
        "id": row.pk,
        "driver_id": row.driver_id,
        "driver_display_name": row.driver_display_name_snapshot,
        "message": row.message,
        "status": row.status,
        "created_at": utc_instant(row.created_at),
        "updated_at": utc_instant(row.updated_at),
        "resolved_at": utc_instant(row.resolved_at) if row.resolved_at else None,
        "driver_service_email": row.driver_email_snapshot
        if row.status == ContactRequest.Status.ACCEPTED
        else None,
    }


def driver_json(row):
    return {
        "id": row.pk,
        "parent_display_name": row.parent.display_name,
        "parent_email": row.parent_email_snapshot,
        "message": row.message,
        "status": row.status,
        "created_at": utc_instant(row.created_at),
        "updated_at": utc_instant(row.updated_at),
        "resolved_at": utc_instant(row.resolved_at) if row.resolved_at else None,
    }


class ParentRequestsView(ParentView):
    def get(self, request):
        rows = ContactRequest.objects.filter(parent__user=request.user).order_by(
            "-created_at", "-id"
        )
        return Response({"results": [parent_json(row) for row in rows]})

    def post(self, request):
        form = ContactInput(data=request.data)
        form.is_valid(raise_exception=True)
        if (
            set(request.data) != set(form.fields)
            or request.data.get("consent_share_email") is not True
        ):
            raise ValidationError(
                {"request": ["Indica conductor, mensaje y consentimiento."]}
            )
        data = form.validated_data
        try:
            with transaction.atomic():
                driver = get_object_or_404(
                    DriverProfile.objects.select_related("user").select_for_update(),
                    pk=data["driver_id"],
                )
                if not publication_state(driver).eligible:
                    raise Http404()
                parent = get_object_or_404(ParentProfile, user=request.user)
                if ContactRequest.objects.filter(
                    parent=parent, driver=driver, status="pending"
                ).exists():
                    raise PendingDuplicate()
                row = ContactRequest.objects.create(
                    parent=parent,
                    driver=driver,
                    driver_display_name_snapshot=driver.display_name,
                    message=data["message"],
                    consented_at=timezone.now(),
                    parent_email_snapshot=request.user.email,
                )
        except IntegrityError as exc:
            raise PendingDuplicate() from exc
        return Response(parent_json(row), status=201)


class ParentRequestDetailView(ParentView):
    def get(self, request, id):
        row = get_object_or_404(ContactRequest, pk=id, parent__user=request.user)
        return Response(parent_json(row))


class ParentCancelView(ParentView):
    def post(self, request, id):
        with transaction.atomic():
            row = get_object_or_404(
                ContactRequest.objects.select_for_update(),
                pk=id,
                parent__user=request.user,
            )
            if row.status != ContactRequest.Status.PENDING:
                raise ContactConflict()
            row.status = ContactRequest.Status.CANCELLED
            row.resolved_at = timezone.now()
            row.save(update_fields=["status", "resolved_at", "updated_at"])
        return Response(parent_json(row))


class DriverRequestsView(DriverView):
    def get(self, request):
        rows = (
            ContactRequest.objects.select_related("parent")
            .filter(driver__user=request.user)
            .order_by("-created_at", "-id")
        )
        return Response({"results": [driver_json(row) for row in rows]})


class DriverRequestDetailView(DriverView):
    def get(self, request, id):
        row = get_object_or_404(
            ContactRequest.objects.select_related("parent"),
            pk=id,
            driver__user=request.user,
        )
        return Response(driver_json(row))


class DriverDecisionView(DriverView):
    decision = None

    def post(self, request, id):
        with transaction.atomic():
            driver = get_object_or_404(
                DriverProfile.objects.select_related("user").select_for_update(),
                user=request.user,
            )
            row = get_object_or_404(
                ContactRequest.objects.select_related("parent").select_for_update(),
                pk=id,
                driver=driver,
            )
            if row.status != ContactRequest.Status.PENDING:
                raise ContactConflict()
            if self.decision == ContactRequest.Status.ACCEPTED:
                if not publication_state(driver).eligible:
                    raise EligibilityConflict()
                row.driver_email_snapshot = driver.service_contact_email
            row.status = self.decision
            row.resolved_at = timezone.now()
            row.save(
                update_fields=[
                    "status",
                    "driver_email_snapshot",
                    "resolved_at",
                    "updated_at",
                ]
            )
        return Response(driver_json(row))


class DriverAcceptView(DriverDecisionView):
    decision = ContactRequest.Status.ACCEPTED


class DriverDeclineView(DriverDecisionView):
    decision = ContactRequest.Status.DECLINED
