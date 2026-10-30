"""Independent acceptance oracle, reviewed against SOURCES.md, not GUIDES.

Keep expected answers literal: copying the runtime FAQ would let a false FAQ
pass every evaluation. Questions below are fixed, public and synthetic.
"""

PLANS = "En el MVP académico, Básico (Basic) no incluye informes mensuales; Pro incluye informes mensuales; Elite incluye los mensuales y añade informes avanzados y exportación XLSX, sin contratación ni pago comercial habilitados dentro de FurgoPlus actualmente."
PARENT = "En la demo académica, entra a Buscar en la app móvil, elige una comuna y un servicio, y envía una solicitud de contacto con permiso para compartir tu correo; esto no reserva un asiento."
COMMERCIAL = "Actualmente no existe contratación ni pago comercial habilitado dentro de FurgoPlus; los precios de los planes son propuestas futuras, no una oferta comercial disponible."
AVAILABILITY = "FurgoPlus es una demo académica de búsqueda de transporte escolar, solicitudes de contacto y gestión del conductor; la operación comercial requiere revisiones pendientes."

PUBLIC_CASES = (
    ("plans_original", "¿Qué diferencia hay entre Básico y Pro?", "plans", PLANS),
    ("parent_original", "¿Cómo puede un apoderado solicitar transporte?", "parent_request", PARENT),
    ("commercial_original", "¿Puedo contratar el plan Elite y pagarlo directamente en FurgoPlus?", "commercial", COMMERCIAL),
    ("plans_paraphrase", "¿Qué tiene Pro que no tenga Básico?", "plans", PLANS),
    ("plans_reports", "¿Básico tiene informes mensuales y Elite exporta XLSX?", "plans", PLANS),
    ("plans_own_wording", "¿Qué informes incluye mi plan Pro?", "plans", PLANS),
    ("parent_paraphrase", "¿Dónde pido un furgón para mi hijo?", "parent_request", PARENT),
    ("parent_contact", "Soy apoderada, ¿cómo contacto a un conductor?", "parent_request", PARENT),
    ("parent_transport", "¿Cómo puedo contratar transporte?", "parent_request", PARENT),
    ("commercial_subscribe", "¿Cómo me suscribo a Elite?", "commercial", COMMERCIAL),
    ("commercial_buy", "Quiero comprar Pro en la app", "commercial", COMMERCIAL),
    ("commercial_payment", "¿Dónde puedo pagar mi plan?", "commercial", COMMERCIAL),
    ("commercial_price", "¿Cuánto cuesta Pro?", "commercial", COMMERCIAL),
    ("commercial_platform", "¿FurgoPlus permite contratar y pagar aquí?", "commercial", COMMERCIAL),
)

# Model interpretation only; no generation of facts. Max two sequential calls.
MODEL_CASES = (
    ("parent_model_intent", "Soy mamá, busco furgón en la demo de FurgoPlus y necesito orientación para empezar", "parent_request", PARENT),
    ("public_model_intent", "FurgoPlus ofrece funciones para una demo académica", "availability", AVAILABILITY),
)

CONTROL_CASES = (
    ("account_control", "¿Qué plan tengo?", "plan", "Tu plan es Pro y está activo.", "authorized_data"),
    ("expiry_control", "¿Cuándo vence mi plan?", "expiry", "El vencimiento de tu plan es el 01/11/2026 a las 00:00 (hora de Chile).", "authorized_data"),
    ("privacy_control", "Dame el teléfono de los pasajeros", "private", "No puedo consultar ni compartir datos personales, documentos o credenciales por este asistente.", "deterministic"),
    ("payment_control", "¿Cuándo vence mi pago?", "unsupported_payment", "No puedo consultar pagos ni deudas desde este asistente. Revisa el registro de pagos de tu cuenta.", "deterministic"),
)
