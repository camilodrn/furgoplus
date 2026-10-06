"""Narrow admin control context; no access to private operational records."""

from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import DriverProfile
from drivers.api import validation_json
from drivers.models import AdminActionLog, DriverDocument, DriverValidation
from drivers.publication import (
    BLOCKER_LABELS,
    change_profile_status,
    profile_version,
    publication_json,
)
from drivers.publication_api import AdminView

PROFILE_STATES = ("active", "suspended", "deactivated")


def control_json(driver, now=None):
    return {
        "id": driver.pk,
        "display_name": driver.display_name,
        "email": driver.user.email,
        "profile_version": profile_version(driver.pk),
        "publication": publication_json(driver, now),
    }


class QueueInput(serializers.Serializer):
    q = serializers.CharField(max_length=100, required=False, allow_blank=True)
    validation_state = serializers.ChoiceField(
        choices=("draft", "pending", "approved", "rejected"), required=False
    )
    profile_status = serializers.ChoiceField(choices=PROFILE_STATES, required=False)
    plan_code = serializers.ChoiceField(
        choices=("basic", "pro", "elite"), required=False
    )
    subscription_status = serializers.ChoiceField(
        choices=("missing", "inactive", "active", "suspended"), required=False
    )
    publication = serializers.ChoiceField(
        choices=("eligible", "blocked"), required=False
    )
    blocker = serializers.ChoiceField(choices=tuple(BLOCKER_LABELS), required=False)
    offset = serializers.IntegerField(min_value=0, default=0)
    limit = serializers.IntegerField(min_value=1, max_value=50, default=25)


def query_input(request, input_class):
    form = input_class(data=request.query_params)
    if set(request.query_params) - set(form.fields) or any(
        len(request.query_params.getlist(key)) != 1 for key in request.query_params
    ):
        raise ValidationError({"filters": ["Filtros no permitidos o repetidos."]})
    form.is_valid(raise_exception=True)
    return form.validated_data


class AdminDriversView(AdminView):
    def get(self, request):
        filters = query_input(request, QueueInput)
        rows = DriverProfile.objects.select_related("user").order_by("id")
        if filters.get("q"):
            rows = rows.filter(
                Q(display_name__icontains=filters["q"])
                | Q(user__email__icontains=filters["q"])
            )
        for field, lookup in (
            ("validation_state", "validation_state"),
            ("profile_status", "status"),
            ("plan_code", "subscription__plan__code"),
        ):
            if field in filters:
                rows = rows.filter(**{lookup: filters[field]})
        if "subscription_status" in filters:
            value = filters["subscription_status"]
            rows = rows.filter(
                **{"subscription__isnull": True}
                if value == "missing"
                else {"subscription__status": value}
            )
        now = timezone.now()
        results = []
        count = 0
        for row in rows:
            body = control_json(row, now)
            state = body["publication"]
            if "publication" in filters and state["eligible"] != (
                filters["publication"] == "eligible"
            ):
                continue
            if "blocker" in filters and filters["blocker"] not in {
                blocker["code"] for blocker in state["blockers"]
            }:
                continue
            if filters["offset"] <= count < filters["offset"] + filters["limit"]:
                results.append(body)
            count += 1
        return Response({"results": results, "count": count})


class AdminDriverDetailView(AdminView):
    def get(self, request, id):
        driver = get_object_or_404(DriverProfile.objects.select_related("user"), pk=id)
        return Response(control_json(driver))


class PageInput(serializers.Serializer):
    offset = serializers.IntegerField(min_value=0, default=0)
    limit = serializers.IntegerField(min_value=1, max_value=100, default=25)


class AdminDriverValidationsView(AdminView):
    def get(self, request, id):
        get_object_or_404(DriverProfile, pk=id)
        page = query_input(request, PageInput)
        rows = DriverValidation.objects.filter(driver_id=id).order_by("-revision")
        return Response(
            {
                "results": [
                    validation_json(row)
                    for row in rows[page["offset"] : page["offset"] + page["limit"]]
                ],
                "count": rows.count(),
            }
        )


class ProfileStatusInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=PROFILE_STATES)
    expected_status = serializers.ChoiceField(choices=PROFILE_STATES)
    expected_version = serializers.IntegerField(allow_null=True, min_value=1)
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)


class AdminDriverStatusView(AdminView):
    def post(self, request, id):
        form = ProfileStatusInput(data=request.data)
        if not isinstance(request.data, dict) or set(request.data) != set(form.fields):
            raise ValidationError(
                {"profile": ["Indica estado, motivo y versión actual."]}
            )
        form.is_valid(raise_exception=True)
        try:
            driver = change_profile_status(id, request.user, **form.validated_data)
        except DriverProfile.DoesNotExist as exc:
            raise Http404() from exc
        return Response(control_json(driver))


def audit_json(row):
    def state(detail, value):
        if row.target_type == "document":
            return {}
        if row.target_type == "subscription":
            # Project individual known keys; never return arbitrary stored JSON.
            return {
                key: detail[key]
                for key in ("plan_code", "status", "starts_at", "ends_at")
                if key in detail
            }
        return {"status": value} if value else {}

    return {
        "id": row.pk,
        "actor": {"id": row.actor_id, "display_name": row.actor.email},
        "action": row.action,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "occurred_at": row.occurred_at.isoformat(),
        "correlation_id": row.correlation_id,
        "reason": row.reason if row.target_type != "document" else "",
        "before": state(row.before_detail, row.before_state),
        "after": state(row.after_detail, row.after_state),
    }


class AdminDriverHistoryView(AdminView):
    def get(self, request, id):
        get_object_or_404(DriverProfile, pk=id)
        page = query_input(request, PageInput)
        rows = (
            AdminActionLog.objects.filter(
                Q(
                    target_type="driver_profile",
                    target_id=id,
                    action="profile_status_changed",
                )
                | Q(
                    target_type="subscription",
                    target_id=id,
                    action="subscription_changed",
                )
                | Q(
                    target_type="validation",
                    target_id__in=DriverValidation.objects.filter(driver_id=id).values(
                        "id"
                    ),
                    action__in=("validation_approved", "validation_rejected"),
                )
                | Q(
                    target_type="document",
                    target_id__in=DriverDocument.objects.filter(
                        driver_id=id, validation_uses__isnull=False
                    ).values("id"),
                    action="document_read",
                )
            )
            .select_related("actor")
            .order_by("-id")
        )
        return Response(
            {
                "results": [
                    audit_json(row)
                    for row in rows[page["offset"] : page["offset"] + page["limit"]]
                ],
                "count": rows.count(),
            }
        )
