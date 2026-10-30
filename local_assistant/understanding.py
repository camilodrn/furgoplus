"""Local understanding. Original text is never supplied to a model or logged."""

import re
from dataclasses import dataclass
from datetime import date, timedelta

from .retrieval import public_question, retrieve
from .scope import scope_guard
from .text import canonical, normalize


@dataclass(frozen=True)
class Question:
    intents: tuple[str, ...] = ()
    topic: str | None = None
    detailed: bool = False
    day: date | None = None
    concepts: tuple[str, ...] = ()
    candidates: tuple[str, ...] = ()
    retrieval_reason: str | None = None


# Only these FIXED concept labels can cross the model boundary. No substrings,
# names, numbers, dates, email addresses or original word sequences are retained.
CONCEPT_PATTERNS = {
    "family": r"\b(apoderad[oa]s?|familia|mama|papa|madre|padre)\b",
    "transport": r"\b(transporte|furgon|furgones|escolar)\b",
    "search": r"\b(buscar|busco|encontrar|encontramos|conseguir|necesito)\b",
    "contact": r"\b(contactar|contacto|solicitar|solicitud|pedir)\b",
    "start": r"\b(empezar|comenzar|orientas|orientame|arrancar)\b",
    "plans": r"\b(plan(?:es)?|basico|basic|pro|elite)\b",
    "compare": r"\b(diferencias?|comparar|compara|comparacion|versus|vs|conviene|elegir|alternativas|distinto)\b",
    "publish": r"\b(publicar|publicacion|mostrar|ofrecer)\b",
    "service": r"\b(servicio|conductor|furgoplus)\b",
    "availability": r"\b(comercial|contratar|lanzamiento|disponible|ofrece|funciones|demo|academico|experimental)\b",
}


def public_concepts(text: str) -> tuple[str, ...]:
    return tuple(key for key, pattern in CONCEPT_PATTERNS.items() if re.search(pattern, text))


def public_candidates(concepts: tuple[str, ...]) -> tuple[str, ...]:
    c = set(concepts)
    result = []
    if {"plans", "compare"} <= c:
        result.append("plans")
    if c & {"family", "transport"} and c & {"search", "contact", "start"}:
        result.append("parent_request")
    if {"publish", "service"} <= c:
        result.append("publication")
    if {"availability", "service"} <= c:
        result.append("availability")
    return tuple(result)


# Deliberately limited: ambiguity is about known public workflows, not arbitrary
# unsupported facts. Extend only with a positive AND a hard negative case.
AMBIGUITY_WORDS = frozenset((
    "soy mama papa madre padre apoderado apoderada familia busco buscar necesito "
    "furgon transporte escolar y en la demo de furgoplus orientacion para empezar "
    "comenzar ofrece funciones una academica academico servicio conductor publicar "
    "mostrar planes comparar basico basic pro elite contacto solicitud como por "
    "donde me puedes orientar con ayuda quiero saber sobre el los las un al del que funciona"
).split())


def unresolved(text: str, detailed: bool) -> Question:
    # A model can only resolve ambiguity inside this reviewed public vocabulary.
    core = normalize(public_question(text))
    words = set(re.findall(r"[a-z0-9]+", core))
    concepts = public_concepts(core)
    candidates = public_candidates(concepts) if words <= AMBIGUITY_WORDS else ()
    return Question(("unknown",), detailed=detailed, concepts=concepts,
                    candidates=candidates)


def understand(text: str, today: date) -> Question:
    t = normalize(text)
    guard = scope_guard(t)
    if guard:
        return Question((guard,))
    # Reviewed complete support phrasings, including technical vocabulary.
    # Offer approved help without interpreting errors or requesting secrets.
    if re.fullmatch(
        r"en furgoplus (?:aparece un error (?:sql|html|de api)|"
        r"mi token (?:expiro|ha expirado)|falla la exportacion xlsx)[.?! ]*", t
    ):
        return Question(topic="help")
    detailed = bool(re.search(r"\b(detall\w*|explica\w*|mas informacion)\b", t))
    if re.search(r"\b(telefono|domicilio|rut|credencial|contrasena|token|"
                 r"documento|pasajeros|nomina|lista de (ninos|estudiantes))\b", t):
        return Question(("private",))
    # State/date/availability requests win over public knowledge, including
    # mixed questions. Facts about a named plan ("qué incluye mi plan Pro")
    # remain public; a lookup of the account's assigned plan does not.
    account_request = bool(re.search(
        r"\b(que plan (?:tengo|tiene mi cuenta)|cual es mi plan|plan asignado|"
        r"(?:mi|tu|su) plan (?:esta|sigue)|estado (?:de (?:mi|la) |del )?plan|"
        r"venc\w*|caduca\w*|expira\w*|cuando termina|"
        r"cuantos? (?:cupos|asientos)|(?:hay|quedan|tiene) cupos|"
        r"(?:mi|tu|su) (?:pago|deuda|factura)|cuanto debo|(?:esta|sigue) publicad[oa]|"
        r"como va mi validacion|estado de mi validacion)\b", t))
    mutation = bool(re.match(
        r"(?:por favor,?\s+)?(cambia\w*|modifica\w*|elimina\w*|borra\w*|ejecuta\w*|"
        r"actualiza\w*|publica(?:r|lo|me)?|reserva(?:r|me)?|"
        r"paga(?:r|me)?|cancela\w*|activa\w*|desactiva\w*)\b", t.lstrip("¿¡ ")))
    if mutation:
        return Question(("read_only",))
    if not account_request:
        match = retrieve(text)
        if match.topic:
            return Question(topic=match.topic, detailed=detailed,
                            retrieval_reason=match.reason)
        if match.reason == "conflicting_evidence":
            return Question(("unknown",), detailed=detailed)
    # Payments, including their due date, are outside the authorized adapter.
    if re.search(r"\b(pago\w*|deuda\w*|cobro\w*|factura\w*)\b", t):
        if account_request or canonical(t) in {"pagos", "pago", "deuda", "cobros", "facturas"}:
            return Question(("unsupported_payment",))
        return unresolved(text, detailed)
    if re.search(r"\b(como|puedo)\b", t) and re.search(
        r"\b(cambiar|modificar|eliminar|borrar|reservar|cancelar|activar|actualizar)\b", t
    ):
        return Question(("read_only",))
    matches = []
    personal_plan = bool(re.search(
        r"\b(mi plan|que plan (?:tengo|tiene mi cuenta)|cual es mi plan|plan.*(?:tengo|asignado)|"
        r"estado.*plan|plan\s+y|y\s+plan|plan\s*,)\b", t
    ) or t.strip("¿?¡! .") == "plan")
    short_query = canonical(t)
    account_scope = (account_request or personal_plan or bool(re.search(
        r"\bmi (?:validacion|revision|publicacion|servicio|recorrido|ruta|horario)\b", t))
        or bool(re.fullmatch(
            r"(?:plan|vencimiento|cupos|asientos|publicacion|validacion|recorrido|ruta|horario|revision)"
            r"(?: y (?:plan|vencimiento|cupos|validacion|publicacion|recorrido|horario))*", short_query))
        or bool(re.fullmatch(r"(?:cupos|asientos) (?:hoy|manana|pasado manana|el .+|\d{4} .+)", short_query))
        or short_query in {"cual es el horario", "validacion y publicacion"})
    if not account_scope:
        return unresolved(text, detailed)
    for pattern, intent in (
        (r"\bplan\b", "plan"),
        (r"\b(venc\w*|caduca\w*|expira\w*|cuando termina)\b", "expiry"),
        (r"\b(cupos?|asientos?|disponibilidad)\b", "capacity"),
        (r"\b(validacion|validado|revision|aprobado)\b", "validation"),
        (r"\b(publicacion|publicado|visible|publicada)\b", "publication"),
        (r"\b(recorridos?|rutas?|horarios?)\b", "route"),
    ):
        match = re.search(pattern, t)
        if match and (intent != "plan" or personal_plan):
            matches.append((match.start(), intent))
    if not matches:
        return unresolved(text, detailed)
    if re.search(r"cupos? (?:de(?:l)? |en el )?plan|limite.*plan|cuota.*plan", t):
        return Question(("quota_unknown",))
    if any(i == "expiry" for _, i in matches) and not re.search(
        r"\b(que plan|cual\w* plan|plan.*tengo|plan\s+y|y\s+plan|plan\s*,|estado.*plan)\b", t
    ):
        matches = [(pos, intent) for pos, intent in matches if intent != "plan"]
    # A route mentioned in a capacity question is the object, not a second ask.
    intents = tuple(intent for _, intent in sorted(matches)
                    if intent != "route" or not any(i == "capacity" for _, i in matches))
    day = today
    if "capacity" in intents:
        explicit = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
        if explicit:
            if len(re.findall(r"\b\d{4}-\d{2}-\d{2}\b", t)) != 1:
                return Question(("date_needed",))
            try:
                day = date.fromisoformat(explicit.group())
            except ValueError:
                return Question(("date_needed",))
        elif "pasado manana" in t:
            day += timedelta(days=2)
        elif re.search(r"\bmanana\b", t):
            day += timedelta(days=1)
        elif re.search(r"\b(ayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo|"
                       r"semana|mes|ano|proxim\w*|siguiente|enero|febrero|marzo|abril|mayo|"
                       r"junio|julio|agosto|septiembre|octubre|noviembre|diciembre|"
                       r"\d{1,2}[/.-]\d{1,2}|\d{1,2} de|el \d{1,2})\b", t):
            return Question(("date_needed",))
    return Question(intents, detailed=detailed, day=day)
