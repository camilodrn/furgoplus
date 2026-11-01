"""Reviewed against web/API behavior; version with every editorial change.

No user input or operational data is interpolated into this content.
"""

HELP_VERSION = "2026-10-19.1"
SERVICE_NOTICE = (
    "La ayuda y recepción automática de solicitudes pueden usarse sin horario "
    "mientras el servicio esté disponible. No se garantiza disponibilidad del "
    "servidor ni atención humana inmediata 24/7."
)
PRIVACY_NOTICE = (
    "Describe el problema sin nombres de menores, direcciones, contactos, "
    "contraseñas, documentos ni información de pagos privados. No adjuntes archivos. "
    "El equipo autorizado de soporte podrá leer lo que envíes."
)
ARTICLES = (
    {
        "id": "driver-start",
        "role": "driver",
        "category": "Primeros pasos",
        "title": "Primeros pasos para conductores",
        "body": "Completa Mi servicio y carga los documentos solicitados. Revisa el "
        "checklist antes de enviar a validación. Configura tus rutas y cobertura; "
        "la suscripción por sí sola no permite publicar ni evita validaciones.",
    },
    {
        "id": "parent-start",
        "role": "parent",
        "category": "Primeros pasos",
        "title": "Primeros pasos para apoderados",
        "body": "La búsqueda, comparación y solicitudes de contacto se realizan en "
        "la aplicación móvil. Filtra por comuna y revisa el servicio publicado. "
        "Una solicitud aceptada permite el contacto; no acredita contratación. "
        "La experiencia inicial de apoderados no requiere un plan propio. "
        "En esta web puedes consultar ayuda y tus tickets de soporte.",
    },
    {
        "id": "validation",
        "role": "driver",
        "category": "Validación y publicación",
        "title": "Documentos y publicación",
        "body": "Carga las versiones vigentes en Documentos y envía el checklist "
        "completo a validación. Consulta las observaciones si hay rechazo. Publicar "
        "requiere cuenta y perfil activos, revisión aprobada y vigente, suscripción "
        "efectiva y rutas activas con cobertura. Revisa los bloqueos en Publicación. "
        "Soporte no aprueba documentos ni modifica la validación.",
    },
    {
        "id": "routes",
        "role": "driver",
        "category": "Rutas y operación diaria",
        "title": "Rutas, cupos y recorridos",
        "body": "Configura días, horario dentro del mismo día, capacidad y comunas "
        "en Rutas. Registra pasajeros con fechas de vigencia en Pasajeros; los cupos "
        "se calculan para la fecha del servicio. Inicio permite iniciar un recorrido "
        "programado y finalizarlo, incluidos pendientes anteriores. Un recorrido "
        "iniciado conserva su configuración; no se registra asistencia individual.",
    },
    {
        "id": "payments",
        "role": "driver",
        "category": "Pagos, solicitudes y reportes",
        "title": "Pagos manuales y solicitudes de contacto",
        "body": "Pagos registra montos manuales de transporte, pendientes, pagados "
        "o anulados; no es una pasarela ni certificación bancaria. En Solicitudes "
        "puedes aceptar o rechazar contactos pendientes. Aceptar no crea un contrato. "
        "No envíes datos de pasajeros o pagos privados a soporte.",
    },
    {
        "id": "reports",
        "role": "driver",
        "category": "Pagos, solicitudes y reportes",
        "title": "Reportes según tu plan",
        "body": "Pro incluye resúmenes mensuales propios. Elite agrega comparación "
        "con el mes anterior, detalle y tres archivos Excel de pagos manuales, "
        "recorridos/cupos y solicitudes de contacto. Los registros no reconstruyen "
        "asistencia ni ocupación histórica. Se exige suscripción y perfil habilitados.",
    },
    {
        "id": "plans",
        "role": "driver",
        "category": "Planes y suscripción",
        "title": "Vigencia y cambios de plan",
        "body": "Básico, Pro y Elite comparten la operación básica. Los beneficios "
        "adicionales requieren suscripción activa, inicio alcanzado y fin aún no "
        "alcanzado. Un administrador autorizado registra cambios con motivo e "
        "historial; no hay renovación ni cobro automático. Plan y reportes muestra "
        "capacidades efectivas. Soporte y el asistente no cambian tu plan.",
    },
    {
        "id": "support",
        "role": "all",
        "category": "Soporte y privacidad",
        "title": "Solicitudes de soporte y asistente",
        "body": "Puedes crear tickets y consultar su historial en Ayuda y soporte. "
        "Selecciona la gravedad: incidentes críticos de seguridad van primero, "
        "independientemente del plan. Después se considera la prioridad comercial "
        "vigente: Básico estándar, Pro preferente, Elite prioritaria. Pro permite "
        "consultar FAQ; Elite añade estados propios permitidos. El asistente usa "
        "reglas y contenidos, no IA generativa, y no ejecuta acciones. La derivación "
        "requiere confirmar un ticket. No es un canal de emergencias; ante peligro "
        "inmediato utiliza los canales de emergencia correspondientes.",
    },
)


def help_articles(role):
    return [article for article in ARTICLES if article["role"] in (role, "all")]
