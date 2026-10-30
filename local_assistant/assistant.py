"""Orchestration separates local understanding, authorized reads and rendering."""

import re
import time
from dataclasses import dataclass, replace
from datetime import date
from typing import Protocol
from zoneinfo import ZoneInfo

from .data import AuthorizedQueries, DataUnavailable, Principal
from .guides import faq_answer
from .metrics import Diagnostics
from .ollama import ModelInvalidOutput, ModelUnavailable
from .understanding import understand

CHILE = ZoneInfo("America/Santiago")


class GuideModel(Protocol):
    def classify_guide(self, concepts: tuple[str, ...], candidates: tuple[str, ...]) -> str: ...


@dataclass(frozen=True)
class Reply:
    text: str
    source: str
    route: str = "local"
    model_attempted: bool = False
    model_status: str = "not_needed"
    elapsed_ms: float = 0
    budget_reason: str | None = None

    @property
    def model_invoked(self) -> bool | None:
        if not self.model_attempted:
            return False
        # A timeout/HTTP error cannot prove whether inference ran server-side.
        return True if self.model_status in {"ok", "unknown"} else None


STATIC = {
    "out_of_scope": "Solo puedo orientarte sobre FurgoPlus, sus funciones, planes y uso de la demo.",
    "unknown": "No tengo información verificada para responder eso. Prueba con «comparar Básico y Pro» o «cómo solicitar transporte»; también puedo orientarte sobre el uso de la demo.",
    "read_only": "Solo puedo consultar información y orientarte sobre FurgoPlus. Los cambios debes hacerlos desde la opción correspondiente de tu cuenta.",
    "private": "No puedo consultar ni compartir datos personales, documentos o credenciales por este asistente.",
    "unsupported_payment": "No puedo consultar pagos ni deudas desde este asistente. Revisa el registro de pagos de tu cuenta.",
    "date_needed": "Indica una fecha en formato AAAA-MM-DD para consultar los cupos.",
    "quota_unknown": "Este prototipo consulta asientos disponibles de un recorrido para una fecha. No tengo información verificada sobre los límites de tu plan.",
}
PLAN_STATES = {"active": "activo", "inactive": "inactivo", "suspended": "suspendido",
               "expired": "vencido", "not_started": "aún no vigente"}
VALIDATIONS = {"approved": "aprobada", "pending": "pendiente", "draft": "en borrador",
               "rejected": "rechazada", "submitted": "en revisión", "in_review": "en revisión"}
DAYS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


def display_day(day: date) -> str:
    return day.strftime("%d/%m/%Y")


class Assistant:
    def __init__(self, queries: AuthorizedQueries, actor: Principal, *,
                 route_id: str | None = None, today: date,
                 model: GuideModel | None = None):
        self.queries = queries
        self.actor = actor
        self.route_id = route_id
        self.today = today
        self.model = model
        self.metrics = Diagnostics()

    def ask(self, text: str) -> Reply:
        start = time.monotonic()
        reply = self._ask(text)
        reply = replace(reply, elapsed_ms=round((time.monotonic() - start) * 1000, 4))
        self.metrics.record(reply)
        return reply

    def _ask(self, text: str) -> Reply:
        if not isinstance(text, str) or not text.strip():
            return Reply("Escribe una pregunta sobre FurgoPlus.", "input")
        if len(text) > 1000:
            return Reply("Haz una pregunta más breve, de hasta 1.000 caracteres.", "input")
        question = understand(text, self.today)
        if question.candidates:
            if self.model is None:
                return Reply(STATIC["unknown"], "deterministic", "public_ambiguous", False, "disabled")
            try:
                topic = self.model.classify_guide(question.concepts, question.candidates)
                if topic not in (*question.candidates, "unknown"):
                    raise ModelInvalidOutput
                if topic == "unknown":
                    return Reply(STATIC["unknown"], "deterministic", "public_ambiguous", True, "unknown")
                # No second model call: facts and phrasing remain reviewed FAQ.
                return Reply(faq_answer(topic, question.detailed), "ollama_intent_faq", topic, True, "ok")
            except ModelUnavailable as error:
                return Reply(STATIC["unknown"], "faq_fallback", "public_ambiguous",
                             error.attempted, error.reason,
                             budget_reason=getattr(error, "budget_reason", None))
        if question.topic:
            # Known public facts never spend model budget or depend on inference.
            return Reply(faq_answer(question.topic, question.detailed), "faq", question.topic)
        if question.intents[0] in STATIC:
            return Reply(STATIC[question.intents[0]], "deterministic", question.intents[0])
        if len(question.intents) > 3:
            return Reply("Consulta hasta tres temas a la vez para darte una respuesta clara.", "input")
        try:
            # Read once per turn, no cross-user or cross-turn cache of account data.
            plan = self.queries.plan(self.actor) if any(
                i in {"plan", "expiry"} for i in question.intents
            ) else None
            publication = self.queries.publication(self.actor) if any(
                i in {"validation", "publication"} for i in question.intents
            ) else None
            answers = []
            for intent in question.intents:
                if intent == "plan":
                    if plan is None:
                        answers.append("No tienes un plan asignado.")
                    elif plan.status in PLAN_STATES and plan.label in {"Basic", "Pro", "Elite"}:
                        state = "aún no está vigente" if plan.status == "not_started" else f"está {PLAN_STATES[plan.status]}"
                        answers.append(f"Tu plan es {plan.label} y {state}.")
                    else:
                        raise DataUnavailable
                elif intent == "expiry":
                    if plan is None:
                        answers.append("No tienes un plan asignado para consultar su vencimiento.")
                    elif plan.expires_at is None:
                        answers.append("Tu plan no tiene una fecha de vencimiento informada.")
                    elif plan.expires_at.tzinfo is None:
                        raise DataUnavailable
                    else:
                        end = plan.expires_at.astimezone(CHILE)
                        answers.append(f"El vencimiento de tu plan es el {display_day(end.date())} a las {end:%H:%M} (hora de Chile).")
                elif intent in {"validation", "publication"}:
                    if intent == "validation":
                        if publication.validation not in VALIDATIONS:
                            raise DataUnavailable
                        answers.append(f"Tu validación está {VALIDATIONS[publication.validation]}.")
                    else:
                        if type(publication.visible) is not bool:
                            raise DataUnavailable
                        answers.append("Tu servicio está publicado." if publication.visible
                                       else "Tu servicio no está publicado.")
                elif intent in {"capacity", "route"}:
                    if self.route_id is None:
                        answers.append("Selecciona un recorrido de tu cuenta para consultar esa información.")
                        continue
                    if intent == "capacity":
                        snapshot = self.queries.capacity(self.actor, self.route_id, question.day)
                        if (snapshot.service_date != question.day or type(snapshot.available) is not int
                                or snapshot.available < 0):
                            raise DataUnavailable
                        answers.append(f"Hay {snapshot.available} cupos disponibles para el {display_day(snapshot.service_date)} en el recorrido seleccionado.")
                    else:
                        route = self.queries.route(self.actor, self.route_id)
                        if (not route.weekdays or any(type(d) is not int or d not in range(7) for d in route.weekdays)
                                or any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", h) for h in (route.start, route.end))):
                            raise DataUnavailable
                        days = ", ".join(DAYS[d] for d in route.weekdays)
                        answers.append(f"El recorrido seleccionado funciona los días {days}, de {route.start} a {route.end}.")
            return Reply(" ".join(answers), "authorized_data", "+".join(question.intents))
        except DataUnavailable:
            return Reply("No puedo consultar esa información para tu cuenta y fecha en este momento. Revisa la sección correspondiente o intenta más tarde.", "data_unavailable", "+".join(question.intents))
