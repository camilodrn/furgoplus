"""Current publication policy, route integrity and subscription transitions."""

import uuid
from dataclasses import dataclass
from datetime import UTC
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from accounts.models import DriverProfile
from drivers.models import (
    AdminActionLog,
    DriverDocument,
    DriverSubscription,
    Plan,
    Review,
    Route,
)
from drivers.services import CHECKLIST


class StateConflict(APIException):
    status_code = 409
    default_detail = "La información cambió. Actualiza antes de guardar."
    default_code = "stale_state"


CHILE = ZoneInfo("America/Santiago")
WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)
BLOCKER_LABELS = {
    "account_inactive": "Cuenta inactiva",
    "driver_suspended": "Conductor suspendido",
    "driver_deactivated": "Conductor desactivado",
    "publication_not_requested": "Solicita la publicación",
    "validation_not_approved": "Validación no aprobada",
    "approved_revision_stale": "La aprobación no corresponde a la revisión actual",
    "required_document_missing": "Falta un documento requerido vigente",
    "required_document_expired": "Un documento requerido está vencido",
    "subscription_missing": "Falta un plan asignado",
    "subscription_inactive": "El plan está inactivo",
    "subscription_suspended": "El plan está suspendido",
    "subscription_not_started": "El plan aún no comienza",
    "subscription_expired": "El plan terminó",
    "profile_display_name_missing": "Falta el nombre visible",
    "profile_summary_missing": "Falta el resumen del servicio",
    "service_contact_email_missing": "Falta el correo privado de contacto",
    "active_route_missing": "Falta al menos una ruta activa y completa",
}


def utc_instant(value):
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def valid_route(route):
    return (
        route.status == Route.Status.ACTIVE
        and bool(route.label.strip())
        and isinstance(route.weekdays, list)
        and bool(route.weekdays)
        and len(set(route.weekdays)) == len(route.weekdays)
        and all(day in WEEKDAYS for day in route.weekdays)
        and route.start_time < route.end_time
        and route.seat_capacity > 0
        and bool(route.destination_label.strip())
        and bool(route.destination_address.strip())
        and any(commune.is_active for commune in route.communes.all())
    )


@dataclass(frozen=True)
class PublicationState:
    blockers: tuple[str, ...]
    routes: tuple[Route, ...]
    subscription: DriverSubscription | None

    @property
    def eligible(self):
        return not self.blockers


def publication_state(driver, now=None):
    now = now or timezone.now()
    local_day = timezone.localtime(now, CHILE).date()
    blockers = []
    if not driver.user.is_active:
        blockers.append("account_inactive")
    if driver.status == "suspended":
        blockers.append("driver_suspended")
    elif driver.status != "active":
        blockers.append("driver_deactivated")
    if not driver.publication_requested:
        blockers.append("publication_not_requested")
    if driver.validation_state != "approved":
        blockers.append("validation_not_approved")
    if driver.approved_revision != driver.current_validation_revision:
        blockers.append("approved_revision_stale")
    documents = {
        item.kind: item
        for item in DriverDocument.objects.filter(driver=driver, is_current=True)
    }
    for kind, _, expiry_required in CHECKLIST:
        document = documents.get(kind)
        if document is None or (expiry_required and document.expires_on is None):
            if "required_document_missing" not in blockers:
                blockers.append("required_document_missing")
        elif document.expires_on and document.expires_on < local_day:
            if "required_document_expired" not in blockers:
                blockers.append("required_document_expired")
    subscription = (
        DriverSubscription.objects.select_related("plan").filter(driver=driver).first()
    )
    if subscription is None:
        blockers.append("subscription_missing")
    else:
        if subscription.status == "inactive":
            blockers.append("subscription_inactive")
        elif subscription.status == "suspended":
            blockers.append("subscription_suspended")
        if subscription.starts_at and now < subscription.starts_at:
            blockers.append("subscription_not_started")
        if subscription.ends_at and now >= subscription.ends_at:
            blockers.append("subscription_expired")
        if subscription.starts_at is None or subscription.ends_at is None:
            blockers.append("subscription_inactive")
    if not driver.display_name.strip():
        blockers.append("profile_display_name_missing")
    if not driver.service_summary.strip():
        blockers.append("profile_summary_missing")
    if not driver.service_contact_email.strip():
        blockers.append("service_contact_email_missing")
    routes = tuple(
        route
        for route in Route.objects.filter(driver=driver, status="active")
        .prefetch_related("communes")
        .order_by("id")
        if valid_route(route)
    )
    if not routes:
        blockers.append("active_route_missing")
    return PublicationState(tuple(dict.fromkeys(blockers)), routes, subscription)


def publication_json(driver, now=None):
    state = publication_state(driver, now)
    coverage = {
        commune.code: {"code": commune.code, "display_name": commune.display_name}
        for route in state.routes
        for commune in route.communes.all()
        if commune.is_active
    }
    subscription = state.subscription
    return {
        "publication_requested": driver.publication_requested,
        "eligible": state.eligible,
        "blockers": [
            {"code": code, "message": BLOCKER_LABELS[code]} for code in state.blockers
        ],
        "validation_state": driver.validation_state,
        "current_validation_revision": driver.current_validation_revision,
        "approved_revision": driver.approved_revision,
        "subscription": (
            {
                "plan_code": subscription.plan.code,
                "plan_label": subscription.plan.display_label,
                "status": subscription.status,
                "starts_at": utc_instant(subscription.starts_at)
                if subscription.starts_at
                else None,
                "ends_at": utc_instant(subscription.ends_at)
                if subscription.ends_at
                else None,
            }
            if subscription
            else None
        ),
        "active_route_count": len(state.routes),
        "coverage": sorted(coverage.values(), key=lambda item: item["code"]),
    }


def discovery_json(driver, state, today=None):
    from drivers.capacity import capacity_snapshot

    today = today or timezone.localtime(timezone.now(), CHILE).date()
    coverage = {
        commune.code: {"code": commune.code, "display_name": commune.display_name}
        for route in state.routes
        for commune in route.communes.all()
        if commune.is_active
    }
    routes = []
    for route in state.routes:
        snapshot = capacity_snapshot(route, today)
        routes.append(
            {
                "id": route.pk,
                "label": route.label,
                "weekdays": route.weekdays,
                "start_time": route.start_time.strftime("%H:%M"),
                "end_time": route.end_time.strftime("%H:%M"),
                "seat_capacity": route.seat_capacity,
                **snapshot,
                "coverage": sorted(
                    (
                        {"code": c.code, "display_name": c.display_name}
                        for c in route.communes.all()
                        if c.is_active
                    ),
                    key=lambda item: item["code"],
                ),
            }
        )
    rating = Review.objects.filter(
        driver=driver, status=Review.Status.PUBLISHED
    ).aggregate(average=Avg("score"), count=Count("id"))
    return {
        "id": driver.pk,
        "display_name": driver.display_name,
        "service_summary": driver.service_summary,
        "validation_label": "Validado",
        "coverage": sorted(coverage.values(), key=lambda item: item["code"]),
        "routes": routes,
        "review_average": round(rating["average"], 2)
        if rating["average"] is not None
        else None,
        "review_count": rating["count"],
    }


def change_subscription(
    driver_id, actor, *, plan_code, status, starts_at, ends_at, reason, expected_version
):
    if not reason.strip():
        raise ValidationError({"reason": ["Indica un motivo."]})
    if status not in DriverSubscription.Status.values:
        raise ValidationError({"status": ["Estado inválido."]})
    if (starts_at is None) != (ends_at is None) or (starts_at and ends_at <= starts_at):
        raise ValidationError({"ends_at": ["El fin debe ser posterior al inicio."]})
    if status == "active" and not starts_at:
        raise ValidationError({"starts_at": ["Se requiere vigencia para activar."]})
    with transaction.atomic():
        driver = DriverProfile.objects.select_for_update().get(pk=driver_id)
        current = (
            DriverSubscription.objects.select_for_update().filter(driver=driver).first()
        )
        # The latest audit ID is the optimistic version of this assignment.
        last_log = (
            AdminActionLog.objects.filter(
                target_type="subscription", target_id=driver_id
            )
            .order_by("-id")
            .first()
        )
        current_version = last_log.pk if last_log else None
        if expected_version != current_version:
            raise StateConflict()
        plan = Plan.objects.get(code=plan_code)
        before = current.status if current else "none"
        before_detail = (
            {
                "plan_code": current.plan.code,
                "status": current.status,
                "starts_at": utc_instant(current.starts_at)
                if current.starts_at
                else None,
                "ends_at": utc_instant(current.ends_at) if current.ends_at else None,
            }
            if current
            else {}
        )
        if current is None:
            current = DriverSubscription(driver=driver)
        current.plan = plan
        current.status = status
        current.starts_at = starts_at
        current.ends_at = ends_at
        current.save()
        log = AdminActionLog.objects.create(
            actor=actor,
            action="subscription_changed",
            target_type="subscription",
            target_id=driver_id,
            correlation_id=str(uuid.uuid4()),
            reason=reason.strip(),
            before_state=before,
            after_state=status,
            before_detail=before_detail,
            after_detail={
                "plan_code": plan.code,
                "status": status,
                "starts_at": utc_instant(starts_at) if starts_at else None,
                "ends_at": utc_instant(ends_at) if ends_at else None,
            },
        )
        return current, log.pk
