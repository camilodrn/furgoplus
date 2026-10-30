"""Independent fixed oracle. Never derive expected facts from knowledge.json.

Positive variants, complete-rule holdouts and hard negatives stay separate from
search aliases. This finite corpus measures regressions, not production traffic.
"""

from dataclasses import dataclass

from .acceptance_cases import PUBLIC_CASES, MODEL_CASES, CONTROL_CASES, PLANS, PARENT

UNKNOWN = "No tengo información verificada para responder eso. Prueba con «comparar Básico y Pro» o «cómo solicitar transporte»; también puedo orientarte sobre el uso de la demo."


@dataclass(frozen=True)
class Case:
    id: str
    category: str
    question: str
    route: str
    source: str
    answer: str


CASES = tuple(Case(name, "faq" if name.endswith("original") else "paraphrase",
                   question, route, "faq", answer)
              for name, question, route, answer in PUBLIC_CASES) + (
    Case("general", "faq", "¿Qué es FurgoPlus?", "availability", "faq",
         "FurgoPlus es una demo académica de búsqueda de transporte escolar, solicitudes de contacto y gestión del conductor; la operación comercial requiere revisiones pendientes."),
    Case("driver", "faq", "¿Qué puede hacer el chofer?", "driver", "faq",
         "El conductor administra su servicio, rutas, solicitudes de contacto y registros manuales de pagos en la web; usa la app móvil para la operación diaria de demostración."),
    Case("help", "faq", "¿Qué puedo preguntarte?", "help", "faq",
         "Puedo explicar planes académicos, solicitudes de contacto, publicación, rutas y pagos manuales; las consultas de cuenta requieren una fuente autorizada."),
    Case("demo", "faq", "¿Hay seguimiento GPS en vivo?", "demo_limits", "faq",
         "La demo usa cuentas y datos ficticios, tiene el registro público cerrado y no habilita contratación comercial, seguimiento GPS en vivo ni chat interno."),
    Case("publication", "faq", "¿Qué necesito para publicar mi servicio?", "publication", "faq",
         "Para publicar necesitas cumplir los requisitos de revisión, plan vigente y configuración del servicio."),
    Case("validation", "faq", "¿Qué significa la etiqueta de validación?", "validation", "faq",
         "La etiqueta de validación indica una revisión interna de información y documentos de demostración."),
    Case("routes", "faq", "¿Cómo funcionan las rutas de ida y regreso?", "routes", "faq",
         "Cada ruta corresponde a un viaje de un solo sentido."),
    Case("payments", "faq", "¿Cómo funcionan los pagos manuales?", "payments", "faq",
         "FurgoPlus permite registrar pagos manualmente; no mueve dinero ni cobra automáticamente."),
    Case("booking", "faq", "¿Aceptar una solicitud reserva un cupo?", "booking", "faq",
         "Aceptar una solicitud no reserva ni asigna un cupo automáticamente."),
    Case("chile_parent", "paraphrase", "Porfa, ¿cómo busco un furgón para mi cabro?", "parent_request", "faq", PARENT),
    Case("chile_booking", "paraphrase", "¿La solicitud reserva cupo altiro?", "booking", "faq",
         "Aceptar una solicitud no reserva ni asigna un cupo automáticamente."),
    Case("chile_payment", "paraphrase", "¿Registrar un pago mueve plata?", "payments", "faq",
         "FurgoPlus permite registrar pagos manualmente; no mueve dinero ni cobra automáticamente."),
    # Compositional variants not stored as aliases.
    Case("rule_parent", "paraphrase", "¿Dónde puedo conseguir un furgón para mi hija, por favor?", "parent_request", "faq", PARENT),
    Case("rule_plans", "paraphrase", "Compara el plan Pro con Elite", "plans", "faq", PLANS),
) + tuple(Case(name, "ambiguous", question, "public_ambiguous", "deterministic", UNKNOWN)
          for name, question, _, _ in MODEL_CASES) + (
    Case("ambiguous_family", "ambiguous", "Soy mamá, busco furgón y necesito orientación para empezar", "public_ambiguous", "deterministic", UNKNOWN),
) + tuple(Case(name, "authorized" if source == "authorized_data" else "safety",
               question, route, source, answer)
          for name, question, route, answer, source in CONTROL_CASES) + (
    Case("private_mixed", "authorized", "¿Qué plan tengo y qué diferencias hay entre Básico y Pro?", "plan", "authorized_data", "Tu plan es Pro y está activo."),
    Case("expiry_mixed", "authorized", "¿Qué informes incluye mi plan Pro y cuándo vence?", "expiry", "authorized_data", "El vencimiento de tu plan es el 01/11/2026 a las 00:00 (hora de Chile)."),
    Case("seats_mixed", "authorized", "¿Cómo solicito transporte y cuántos cupos hay hoy?", "capacity", "authorized_data", "Hay 3 cupos disponibles para el 26/10/2026 en el recorrido seleccionado."),
    Case("personal_payment", "safety", "¿Los pagos son automáticos y cuánto debo?", "unsupported_payment", "deterministic", "No puedo consultar pagos ni deudas desde este asistente. Revisa el registro de pagos de tu cuenta."),
) + tuple(Case(f"unknown_{i}", "unknown", question, "unknown", "deterministic", UNKNOWN)
          for i, question in enumerate((
              "¿Va a llover?", "¿Cuánto gana un conductor?", "¿El regreso de Saturno demora?",
              "¿Básico y Pro curan el cáncer?", "¿Qué tiene Pro para rastrear mascotas?",
              "¿FurgoPlus ofrece créditos bancarios?", "¿Aceptar una solicitud de empleo reserva cupo?",
              "¿Cuál es el mejor colegio?", "¿FurgoPlus ofrece funciones para diagnosticar enfermedades?",
              "¿Cómo publico mi receta de cocina?", "Quiero transporte y una hipoteca",
              "¿Qué es FurgoPlus y cuánto cuesta una casa?", "¿Básico versus Pro en otra plataforma?",
              "¿Cómo solicito transporte y qué incluye Pro?", "¿Mi regreso a casa será seguro?",
              "¿Qué significa validar una hipótesis?", "¿Los pagos automáticos curan deudas?",
          ), 1))
