"""Allowlisted support endpoints. No file/resource access or operational mutation."""

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import (
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from drivers.capabilities import driver_capabilities
from drivers.help_content import (
    HELP_VERSION,
    PRIVACY_NOTICE,
    SERVICE_NOTICE,
    help_articles,
)
from drivers.models import SupportTicket
from drivers.publication_api import RoleView
from drivers.support import (
    PRIORITIES,
    TRANSITIONS,
    assistant_answer,
    authorize,
    create_ticket,
    safe_text,
    tickets,
    update_ticket,
)


class Text(serializers.CharField):
    def to_internal_value(self, data):
        if isinstance(data, str) and len(data) > self.max_length:
            raise ValidationError("El texto supera el límite permitido.")
        if self.allow_blank and data == "":
            return ""
        return safe_text(data)


class TicketInput(serializers.Serializer):
    subject = Text(max_length=120)
    body = Text(max_length=2000)
    severity = serializers.ChoiceField(choices=SupportTicket.Severity.choices)
    privacy_confirmed = serializers.BooleanField()


class ReplyInput(serializers.Serializer):
    body = Text(max_length=2000)
    expected_version = serializers.IntegerField(min_value=1)


class AdminReplyInput(ReplyInput):
    body = Text(max_length=2000, allow_blank=True)
    state = serializers.ChoiceField(choices=SupportTicket.State.choices)
    reason = Text(max_length=300, allow_blank=True)


class AssistantInput(serializers.Serializer):
    question = Text(max_length=300)
    mode = serializers.ChoiceField(choices=["faq", "contextual"])


def parse(form_class, data):
    form = form_class(data=data)
    if not isinstance(data, dict) or set(data) != set(form.fields):
        raise ValidationError(
            {"input": ["Indica exclusivamente los campos requeridos."]}
        )
    form.is_valid(raise_exception=True)
    if "privacy_confirmed" in data and data["privacy_confirmed"] is not True:
        raise ValidationError(
            {
                "privacy_confirmed": [
                    "Confirma la revisión de privacidad antes de enviar."
                ]
            }
        )
    return form.validated_data


def page(request, *, admin=False):
    allowed = {"offset", "limit", "state"} if admin else {"offset", "limit"}
    if set(request.query_params) - allowed or any(
        len(values) != 1 for _, values in request.query_params.lists()
    ):
        raise ValidationError("Parámetros no permitidos.")
    try:
        offset, limit = (
            int(request.query_params.get("offset", 0)),
            int(request.query_params.get("limit", 25)),
        )
        if offset < 0 or not 1 <= limit <= 50:
            raise ValueError
    except ValueError as exc:
        raise ValidationError("Paginación inválida.") from exc
    return offset, limit


def no_query(request):
    if request.query_params:
        raise ValidationError("Este recurso no admite parámetros.")


def ticket_json(ticket, *, detail=False):
    body = {
        "id": ticket.pk,
        "subject": ticket.subject,
        "severity": ticket.severity,
        "state": ticket.state,
        "priority": PRIORITIES[ticket.priority_rank],
        "priority_at_creation": ticket.priority_at_creation,
        "version": ticket.version,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
    }
    if detail:
        body["allowed_transitions"] = list(TRANSITIONS[ticket.state])
        body["events"] = [
            {
                "id": e.pk,
                "author_id": e.author_id,
                "author_role": e.author_role,
                "body": e.body,
                "from_state": e.from_state,
                "to_state": e.to_state,
                "reason": e.reason,
                "occurred_at": e.occurred_at.isoformat(),
            }
            for e in ticket.events.order_by("id")
        ]
    return body


class HelpView(RoleView):
    def initial(self, request, *args, **kwargs):
        # Multi-role equivalent of RoleView; keep session + no-store behavior.
        APIView.initial(self, request, *args, **kwargs)
        if not request.user.is_authenticated or not request.user.is_active:
            raise NotAuthenticated()
        if request.user.role not in ("driver", "parent", "admin"):
            raise PermissionDenied()
        if request.user.role != "admin":
            authorize(request.user, capability="help.center")

    def get(self, request):
        no_query(request)
        caps = (
            driver_capabilities(request.user)["capabilities"]
            if request.user.role == "driver"
            else {}
        )
        return Response(
            {
                "version": HELP_VERSION,
                "service_notice": SERVICE_NOTICE,
                "privacy_notice": PRIVACY_NOTICE,
                "articles": help_articles(request.user.role),
                "assistant_modes": [
                    mode
                    for mode, code in (
                        ("faq", "assistant.faq"),
                        ("contextual", "assistant.contextual"),
                    )
                    if caps.get(code, {}).get("enabled")
                ],
            }
        )


class SupportView(RoleView):
    admin = False

    def initial(self, request, *args, **kwargs):
        APIView.initial(self, request, *args, **kwargs)
        authorize(request.user, admin=self.admin)

    def scope(self, request):
        rows = tickets()
        return rows if self.admin else rows.filter(owner=request.user)


class TicketsView(SupportView):
    def get(self, request):
        offset, limit = page(request, admin=self.admin)
        rows = self.scope(request).order_by("-updated_at", "-id")
        if self.admin:
            state = request.query_params.get("state", "active")
            if state == "active":
                rows = rows.exclude(state__in=["resolved", "closed"])
            elif state in SupportTicket.State.values:
                rows = rows.filter(state=state)
            elif state != "all":
                raise ValidationError({"state": ["Filtro de estado inválido."]})
            rows = rows.order_by("severity", "priority_rank", "created_at", "id")
        return Response(
            {
                "results": [ticket_json(t) for t in rows[offset : offset + limit]],
                "count": rows.count(),
            }
        )

    def post(self, request):
        no_query(request)
        pk = create_ticket(request.user, parse(TicketInput, request.data))
        return Response(ticket_json(tickets().get(pk=pk), detail=True), status=201)


class TicketDetailView(SupportView):
    def get(self, request, id):
        no_query(request)
        return Response(
            ticket_json(get_object_or_404(self.scope(request), pk=id), detail=True)
        )

    def post(self, request, id):
        no_query(request)
        # Check ownership before parsing content; never accept caller owner/author.
        get_object_or_404(self.scope(request), pk=id)
        pk = update_ticket(
            request.user,
            id,
            parse(AdminReplyInput if self.admin else ReplyInput, request.data),
            admin=self.admin,
        )
        return Response(ticket_json(tickets().get(pk=pk), detail=True))


class AdminTicketsView(TicketsView):
    admin = True
    http_method_names = ["get", "head", "options"]


class AdminTicketDetailView(TicketDetailView):
    admin = True


class AssistantView(SupportView):
    def post(self, request):
        no_query(request)
        result = assistant_answer(request.user, parse(AssistantInput, request.data))
        return Response({**result, "content_version": HELP_VERSION})
