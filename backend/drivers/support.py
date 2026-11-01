"""Support services: explicit authorization, bounded writes and append-only history."""

import re
import unicodedata
from datetime import timedelta

from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import (
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)

from accounts.models import User
from api.auth import Throttled
from drivers.capabilities import driver_capabilities, require_capability
from drivers.help_content import help_articles
from drivers.models import SupportEvent, SupportTicket, SupportUsage
from drivers.publication import StateConflict

TRANSITIONS = {
    "open": ("in_progress", "waiting_user", "resolved"),
    "in_progress": ("waiting_user", "resolved"),
    "waiting_user": ("in_progress", "resolved"),
    "resolved": ("in_progress", "closed"),
    "closed": (),
}
PRIORITIES = {1: "priority", 2: "preferred", 3: "standard"}


def authorize(user, *, admin=False, capability="support.requests"):
    if not user.is_authenticated or not user.is_active:
        raise NotAuthenticated()
    if admin:
        if (
            user.role != "admin"
            or not user.is_staff
            or not user.has_perm("drivers.manage_support")
        ):
            raise PermissionDenied()
    elif user.role not in ("driver", "parent"):
        raise PermissionDenied()
    elif user.role == "driver":
        require_capability(user, capability)


def priority_expression(now=None):
    """Dynamic queue ordering: severity precedes current effective commercial tier."""
    now = now or timezone.now()
    valid = Q(
        owner__role="driver",
        owner__is_active=True,
        owner__driver_profile__status="active",
        owner__driver_profile__subscription__status="active",
        owner__driver_profile__subscription__starts_at__lte=now,
        owner__driver_profile__subscription__ends_at__gt=now,
    )
    return Case(
        When(
            valid & Q(owner__driver_profile__subscription__plan__code="elite"),
            then=Value(1),
        ),
        When(
            valid & Q(owner__driver_profile__subscription__plan__code="pro"),
            then=Value(2),
        ),
        default=Value(3),
        output_field=IntegerField(),
    )


def tickets():
    return SupportTicket.objects.annotate(priority_rank=priority_expression())


def consume(user, action, limit):
    # User row serializes first-counter creation and writes across workers.
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        now = timezone.now()
        row, _ = SupportUsage.objects.get_or_create(
            user=user, action=action, defaults={"window_started_at": now}
        )
        if now - row.window_started_at >= timedelta(hours=1):
            row.window_started_at, row.attempts = now, 0
        if row.attempts >= limit:
            raise Throttled()
        row.attempts += 1
        row.save()


def safe_text(value):
    if not isinstance(value, str):
        raise ValidationError("Indica texto simple.")
    value = value.strip()
    # Reject active markup, links, control/bidi characters and obvious secrets/PII.
    # This is a guardrail, not a claim of automatic semantic anonymization.
    if (
        not value
        or any(
            unicodedata.category(c).startswith("C") and c not in "\n\t" for c in value
        )
        or re.search(
            r"[<>]|https?://|www\.|\S+@\S+|\b\d[\d .+()-]{6,}\d\b", value, re.I
        )
    ):
        raise ValidationError(
            "Usa texto simple sin enlaces, contactos, identificadores "
            "ni datos privados."
        )
    return value


def create_ticket(user, data):
    authorize(user)
    if data.get("privacy_confirmed") is not True:
        raise ValidationError(
            {"privacy_confirmed": ["Confirma la revisión de privacidad."]}
        )
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        if (
            SupportTicket.objects.filter(owner=user)
            .exclude(state__in=["resolved", "closed"])
            .count()
            >= 10
        ):
            raise ValidationError(
                {
                    "support": [
                        "Tienes diez solicitudes activas; continúa en una existente."
                    ]
                }
            )
        consume(user, "ticket", 5)
        # Explicit critical reports and obvious safety terms escalate.
        text = (data["subject"] + " " + data["body"]).lower()
        severity = (
            1
            if re.search(
                r"seguridad|accidente|peligro|amenaza|acoso|filtraci[oó]n", text
            )
            else data["severity"]
        )
        priority = "standard"
        if user.role == "driver":
            caps = driver_capabilities(user)
            if not caps["blockers"] and caps["plan"]:
                priority = caps["plan"]["support_priority"]
        ticket = SupportTicket.objects.create(
            owner=user,
            subject=data["subject"],
            severity=severity,
            priority_at_creation=priority,
        )
        SupportEvent.objects.create(
            ticket=ticket,
            author=user,
            author_role=user.role,
            body=data["body"],
            to_state="open",
            reason="Gravedad elevada por términos de seguridad"
            if severity != data["severity"]
            else "",
        )
        return ticket.pk


def update_ticket(user, ticket_id, data, *, admin=False):
    authorize(user, admin=admin)
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        scope = SupportTicket.objects.select_for_update()
        if not admin:
            scope = scope.filter(owner=user)
        ticket = get_object_or_404(scope, pk=ticket_id)
        if ticket.version != data["expected_version"]:
            raise StateConflict()
        before = ticket.state
        after = (
            data["state"]
            if admin
            else ("in_progress" if before in ("waiting_user", "resolved") else before)
        )
        if admin:
            if after != before and after not in TRANSITIONS[before]:
                raise ValidationError({"state": ["Transición no permitida."]})
            if after != before and not data["reason"]:
                raise ValidationError({"reason": ["Indica el motivo del cambio."]})
            if after == before and not data["body"]:
                raise ValidationError(
                    {"body": ["Escribe una respuesta o cambia el estado."]}
                )
        if before == "closed":
            raise ValidationError(
                {
                    "support": [
                        "La solicitud cerrada conserva su historial. "
                        "Crea otra si es necesario."
                    ]
                }
            )
        if ticket.events.count() >= 200:
            raise ValidationError(
                {"support": ["Historial completo; crea otra solicitud."]}
            )
        consume(user, "reply", 30)
        ticket.state, ticket.updated_at = after, timezone.now()
        ticket.version += 1
        ticket.save(update_fields=["state", "updated_at", "version"])
        SupportEvent.objects.create(
            ticket=ticket,
            author=user,
            author_role=user.role,
            body=data["body"],
            from_state=before,
            to_state=after,
            reason=data.get("reason", ""),
        )
        return ticket.pk


def assistant_answer(user, data):
    authorize(user, capability="assistant.faq")
    # Parent accounts have help/support but no commercial assistant entitlement.
    if user.role != "driver":
        raise PermissionDenied()
    if data["mode"] == "contextual":
        require_capability(user, "assistant.contextual")
    consume(user, "assistant", 60)
    articles = help_articles(user.role)
    question = unicodedata.normalize("NFKD", data["question"].lower())
    question = "".join(c for c in question if not unicodedata.combining(c))
    topics = {
        "driver-start": ("primeros pasos", "comenzar", "empezar"),
        "validation": (
            "validacion",
            "validar",
            "documento",
            "documentos",
            "publicacion",
            "publicar",
        ),
        "routes": ("ruta", "rutas", "cupo", "cupos", "recorrido", "recorridos"),
        "payments": (
            "pago",
            "pagos",
            "solicitud de contacto",
            "solicitudes de contacto",
        ),
        "reports": ("reporte", "reportes", "excel"),
        "plans": ("plan", "planes", "suscripcion", "vigencia"),
        "support": ("soporte", "asistente"),
    }
    topic = next(
        (
            key
            for key, words in topics.items()
            if question == key
            or any(
                re.search(r"\b" + re.escape(word) + r"\b", question) for word in words
            )
        ),
        None,
    )
    if re.search(
        r"otro|ajeno|menor|contrasena|descarga|modifica|cambia|aprueba|ignora", question
    ):
        topic = None
    article = next((a for a in articles if a["id"] == topic), None)
    answer = (
        article["body"]
        if article
        else (
            "Esta consulta está fuera del alcance del asistente. "
            "Consulta el centro de ayuda o confirma la creación de un ticket."
        )
    )
    context = []
    if article and data["mode"] == "contextual":
        # Only own scalar states; no private operational resources queried.
        from accounts.models import DriverProfile

        profile = get_object_or_404(DriverProfile, user=user)
        caps = driver_capabilities(user)
        labels = {
            "active": "Activo",
            "suspended": "Suspendido",
            "inactive": "Inactivo",
            "deactivated": "Desactivado",
            "draft": "Borrador",
            "pending": "Pendiente",
            "approved": "Aprobada",
            "rejected": "Rechazada",
        }
        context = [
            {"label": "Perfil", "value": labels.get(profile.status, "No disponible")},
            {
                "label": "Validación",
                "value": labels.get(profile.validation_state, "No disponible"),
            },
            {
                "label": "Publicación solicitada",
                "value": "Sí" if profile.publication_requested else "No",
            },
            {"label": "Plan", "value": caps["plan"]["label"]},
            {
                "label": "Suscripción",
                "value": labels.get(caps["subscription"]["status"], "No disponible"),
            },
        ]
    return {
        "answer": answer,
        "article_id": article["id"] if article else None,
        "context": context,
        "can_offer_ticket": True,
        "kind": "rules_and_content",
    }
