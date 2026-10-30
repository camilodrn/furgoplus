"""Deterministic synthetic evaluation. No sockets or model by default."""

from .acceptance_cases import PUBLIC_CASES
from .assistant import Assistant
from .data import DEMO_DAY, Principal, SyntheticQueries
from .ollama import ModelUnavailable


class OfflineModel:
    def classify_guide(self, concepts, candidates) -> str:
        raise ModelUnavailable


CASES = (
    ("plan", "¿Qué plan tengo?", "Tu plan es Pro y está activo.", "authorized_data"),
    ("expiry", "¿Cuándo vence mi plan?", "El vencimiento de tu plan es el 01/11/2026 a las 00:00 (hora de Chile).", "authorized_data"),
    ("capacity", "¿Cuántos cupos hay hoy?", "Hay 3 cupos disponibles para el 26/10/2026 en el recorrido seleccionado.", "authorized_data"),
    ("validation", "¿Cómo va mi validación?", "Tu validación está aprobada.", "authorized_data"),
    ("publication", "¿Está publicado mi servicio?", "Tu servicio está publicado.", "authorized_data"),
    ("route", "¿Cuál es el horario?", "El recorrido seleccionado funciona los días lunes, martes, miércoles, jueves, viernes, de 07:30 a 08:15.", "authorized_data"),
    ("faq", "¿Aceptar una solicitud reserva un cupo?", "Aceptar una solicitud no reserva ni asigna un cupo automáticamente.", "faq"),
    ("unknown", "¿Va a llover?", "No tengo información verificada para responder eso. Prueba con «comparar Básico y Pro» o «cómo solicitar transporte»; también puedo orientarte sobre el uso de la demo.", "deterministic"),
    ("offline", "Soy mamá, busco furgón y necesito orientación para empezar", "No tengo información verificada para responder eso. Prueba con «comparar Básico y Pro» o «cómo solicitar transporte»; también puedo orientarte sobre el uso de la demo.", "faq_fallback"),
) + tuple((name, question, expected, "faq") for name, question, route, expected in PUBLIC_CASES)


def main() -> int:
    failures = 0
    for name, question, expected, source in CASES:
        assistant = Assistant(SyntheticQueries(), Principal("demo-a"), today=DEMO_DAY,
                              route_id="demo-a-route", model=OfflineModel() if name == "offline" else None)
        reply = assistant.ask(question)
        ok = reply.text == expected and reply.source == source
        failures += not ok
        print(f"{'PASS' if ok else 'FAIL'} {name}")
    print(f"{len(CASES) - failures}/{len(CASES)} casos sintéticos correctos")
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
