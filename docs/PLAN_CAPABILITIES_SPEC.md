# Task 12 — Planes, capacidades, reportes y soporte T12.1–T12.10

Estado: T12.1–T12.9 implementadas y conservadas. La revisión UX/UI web finalizó
con 285/285 pruebas React, según la autorización actual del usuario.
T12.10 Flutter autorizada el 20-10-2026; implementación y límites de validación en
[TASK12_FLUTTER_VALIDATION.md](TASK12_FLUTTER_VALIDATION.md), pendiente de revisión humana.
Actualización 25-10-2026: funcionamiento en Samsung A54 confirmado por el usuario,
UX rechazada. Se corrigió la navegación del conductor con Hoy / Mi plan / Ayuda
persistentes y se separó el plan de la ayuda. Evidencia actual, límites de build
y nueva aceptación pendiente en [TASK12_FLUTTER_NAVIGATION_REVIEW.md](TASK12_FLUTTER_NAVIGATION_REVIEW.md).
Los informes anteriores se conservan como evidencia de sus respectivas etapas.
T12.4–T12.9 autorizadas expresamente por el usuario; sin autorización de despliegue.
Fecha: 19-10-2026. Catálogo actual: `2026-10-19.3`.
Base: decisiones de producto aprobadas en la conversación. El PDF académico completo
sigue pendiente: no se atribuyen requisitos adicionales a un documento no revisado.

## Matriz comercial y trazabilidad

Los precios son propuestas comerciales CLP/mes, sin cobros, renovación automática,
pasarela, facturas ni modificación de `PaymentRecord` (registro manual de transporte).
El código comercial es `basic`; su etiqueta en este catálogo es **Básico**.

| Beneficio | Básico $19.990 | Pro $39.990 | Elite $69.990 | Estado / evidencia / aceptación futura |
| --- | --- | --- | --- | --- |
| Gestión operativa y dashboard actual | Sí | Sí | Sí | Actual: `operations_api.py`, `daily_operation.py`, React y Flutter existentes. Conservar permisos y comportamiento. |
| Resúmenes mensuales | — | Sí | Sí | Implementado: `reports.monthly.read`, `reports.py`, endpoint mensual y React. Agregados de datos existentes. |
| Análisis ampliados y detalle | — | — | Sí | Implementado: `analytics.period_comparison`, `reports.detail.read`. Mes calendario anterior, diferencias absolutas; sin porcentajes ni historia de estados. |
| Tres reportes Excel `.xlsx` | — | — | Sí | Implementado: `reports.xlsx.export`. Tres XLSX reales de pagos manuales, recorridos/cupos y solicitudes de contacto. |
| Centro de ayuda / guía básica | Sí | Sí | Sí | Implementado: `help.center`, guías versionadas y separadas por rol; web accesible para conductores y apoderados. |
| Recepción de solicitudes 24/7 mientras funciona el servicio | Sí | Sí | Sí | Implementado: `support.requests`, tickets propios, historial y panel con permiso `manage_support`. No garantiza atención humana inmediata ni disponibilidad continua. |
| Prioridad de atención | Estándar | Preferente | Prioritaria | Implementada en cola: gravedad primero, prioridad comercial efectiva después, luego antigüedad. |
| Asistente FAQ | — | Sí | Sí | Implementado: `assistant.faq`, respuestas deterministas desde contenido revisado y versionado. |
| Asistencia contextual | — | — | Sí | Implementado: `assistant.contextual`, cinco estados propios permitidos; sin ejecutar acciones. |
| Notificaciones | Por definir | Por definir | Por definir | Diferencias pendientes del PDF. Los mensajes de resultado actuales no son push ni bandeja persistente. |
| Capacitación | Guía básica disponible | Diferencias pendientes | Diferencias pendientes | Guías comunes; no hay módulo formativo adicional; definir contenido y responsables antes de prometer sesiones. |
| Visibilidad | Elegibilidad actual | Elegibilidad actual | Elegibilidad actual | Actual: `publication.py`. No hay posicionamiento por plan; diferencias pendientes del PDF. Pagar nunca evita validaciones. |
| Mantención | Incluida | Incluida | Incluida | Compromiso operativo común; no es un permiso de API ni un SLA implementado. No restringir correcciones de seguridad por plan. |
| Funciones iniciales de apoderados | Gratuitas, sin plan propio | Gratuitas | Gratuitas | Actual: descubrimiento, comparación y contacto por rol. No se modifican. |

T12.1–3 aportó el catálogo, resolución, guard y contrato. T12.4–6 habilita las
cuatro capacidades de reportes y su UI. T12.7–9 incorpora ayuda, soporte y
asistentes tras sus pruebas. Todas las capacidades del catálogo están implementadas;
`enabled` sigue dependiendo de rol, perfil, plan y vigencia cuando corresponde.
Evidencia y guion de aceptación: [TASK12_SUPPORT_VALIDATION.md](TASK12_SUPPORT_VALIDATION.md).
Los precios siguen siendo propuestas; no hay cobros automáticos.

## Decisiones de autorización

1. Para el catálogo de conductor, sesión autenticada, cuenta activa y rol conductor
   son obligatorios. El perfil
   se obtiene exclusivamente desde `request.user`; no hay parámetro de propietario.
2. El catálogo complementa los controles de rol, propiedad y dominio; no los
   sustituye. `operations.core` y `dashboard.basic` indican ausencia de restricción
   comercial adicional, no autorización para cualquier operación de esas áreas.
   Publicar, aceptar contactos, editar rutas o leer registros conserva sus reglas.
3. Una suscripción es efectiva si su código es conocido, su estado es `active`,
   ambas fechas existen, fin > inicio y `inicio <= ahora < fin`. Se evalúa en el
   servidor en cada consulta; no depende del reloj del cliente ni de un scheduler.
4. Plan ausente: `plan=null`, `subscription=null`, motivo `subscription_missing`.
   Código desconocido: `plan=null`, motivo `plan_unknown`, sin precio inventado ni
   sustitución silenciosa por Básico. La restricción DB existente evita nuevos
   códigos inválidos; se prueba defensivamente sin corromper la base.
5. Inactivo/suspendido/futuro/vencido/ventana inválida bloquea beneficios adicionales.
   Estados desconocidos de suscripción se tratan como inactivos. Se conservan los
   registros y las funciones operativas actuales bajo sus controles existentes.
6. Perfil no activo bloquea beneficios adicionales (`driver_unavailable`). No se
   exige elegibilidad de publicación para consultar el catálogo o para los
   reportes: documentos pendientes o falta de ruta no equivalen a plan inactivo.
7. Ayuda y recepción de solicitudes se diseñan accesibles para la cuenta conductora
   autenticada incluso sin suscripción vigente. También están disponibles para
   apoderados sin plan propio. La prioridad en `plan.support_priority` describe el
   plan asignado; cada ticket expone su prioridad efectiva actual. Sin suscripción
   efectiva o con perfil suspendido se aplica atención estándar, conservando siempre
   la gravedad. Una cuenta `is_active=false` no puede consultar los recursos privados.
8. Los cambios administrativos reutilizan `change_subscription`, motivo obligatorio,
   transacción, bloqueo y versión optimista con auditoría. La siguiente consulta
   refleja el cambio, sin caché de permisos ni alteraciones de datos operativos.
9. Cambios de catálogo requieren revisión, incremento de `CATALOG_VERSION`, contrato
   y pruebas. Habilitar una capacidad exige implementar y proteger primero sus
   endpoints, no solamente cambiar `implemented`.
10. `require_capability(user, code)` deniega códigos desconocidos o no habilitados
    con 403 `capability_unavailable`. Cada endpoint premium debe invocarlo además de
    comprobar rol/propiedad/dominio. Los cinco endpoints de reportes invocan este guard antes de consultar datos.

No se alteró `publication_state`: mantiene todas sus comprobaciones actuales.
El cálculo incorpora rechazo defensivo de códigos/ventanas inválidas; una
prueba de frontera fija inicio inclusivo y fin exclusivo. T12.1–6 no agregó modelos
ni migraciones. T12.7–9 agrega únicamente los tres modelos de soporte y la migración
0009; conserva seed de etiquetas, controles anteriores y reportes.

## Contrato nuevo

`GET /api/v1/driver/capabilities/` — operación OpenAPI `getDriverCapabilities`.
Sesión Django; respuesta `Cache-Control: no-store`, también en errores.
No admite parámetros de consulta (400). No admite escritura (405 para una sesión
válida que supere CSRF). No existe variante con ID de otro conductor (404).
Anónimo, rol distinto o cuenta desactivada: 403 según la convención de autenticación
existente; conductor sin perfil: 404. GET no crea datos ni entradas de auditoría.

| Campo | Semántica |
| --- | --- |
| `catalog_version` | Versión del catálogo y política publicados. |
| `evaluated_at` | Instante del servidor, ISO 8601 con zona. No es una reserva de permisos futuros. |
| `plan` | Plan asignado reconocido, o null. Código, etiqueta, precio mensual CLP, moneda, período, `commercial_proposal=true`, `automatic_billing=false`, prioridad comercial. Puede existir aunque la suscripción esté vencida. |
| `subscription` | Estado almacenado, inicio/fin ISO 8601 o null y `effective`. No expone historial ni IDs. `effective` describe solo la suscripción, no los permisos completos del perfil. |
| `blockers` | Motivos de perfil/suscripción para beneficios adicionales. No implica bloqueo total de la operación existente. |
| `capabilities` | Objeto de claves explícitas: `included_in_plan`, `implemented`, `enabled`, `blockers` por capacidad. |

`included_in_plan` es la promesa del plan asignado, incluso vencido; no usarlo como
permiso. `enabled` aplica disponibilidad y reglas de vigencia/perfil cuando corresponde.
Una capacidad común puede estar habilitada aunque `included_in_plan=false` por falta
de plan: no hay nueva restricción comercial sobre operaciones existentes.

Motivos estables: `subscription_missing`, `plan_unknown`, `subscription_inactive`,
`subscription_suspended`, `subscription_invalid_window`, `subscription_not_started`,
`subscription_expired`, `driver_unavailable`, `plan_not_included`, `not_implemented`.
No se exponen emails, nombres, contactos, menores, documentos ni datos de otra cuenta.

React consume los tipos generados `DriverCapabilities`, `MonthlyReport` y
`AdvancedReport`. La sección Plan y reportes refresca al recuperar foco/visibilidad,
cada 30 segundos mientras está visible, al vencer y tras denegaciones. Cada acción
se autoriza en Django. Flutter queda fuera del alcance de esta integración.

## Límites de datos de reportes

- Pagos: son anotaciones manuales, no prueba bancaria, ingresos certificados ni
  cobros de suscripción. Separar anulados; definir explícitamente el filtro temporal.
- Recorridos/cupos: `RouteRun` conserva snapshots de horario y capacidad; no existe
  nómina histórica inmutable ni asistencia. Distinguir ejecuciones registradas de
  cupos calculados para una fecha con asignaciones actuales. No inferir cancelación
  por ausencia de ejecución ni reconstruir ocupación histórica como hecho probado.
- Contactos: estados y tiempos registrados; aceptación no acredita contratación.
  No exportar texto de mensajes, emails ni identidad de menores.
- Excel: generar `.xlsx` real, tipos de celda seguros para texto no confiable,
  fechas/moneda explícitas, rangos acotados, autorización y `no-store` al descargar.
  XlsxWriter 3.2.9, generación en memoria y límite de 10.000 registros por detalle;
  véase la revisión y evidencia en `TASK12_REPORTS_VALIDATION.md`.

## Compatibilidad y riesgos

- La etiqueta sembrada histórica es `Basic`; el catálogo comercial usa `Básico` sin
  cambiar filas existentes. Las pantallas anteriores pueden conservar `Basic` hasta
  la integración de UI autorizada. Los códigos permanecen estables.
- El generador TypeScript necesitó citar claves JSON porque las capacidades usan
  puntos (`reports.xlsx.export`). No cambia el significado de tipos anteriores.
- No hay cobros automáticos ni SLA humano. La atención, asignación del permiso
  administrativo y retención de tickets necesitan responsables y decisiones
  operativas antes de publicación. No se asignan permisos en migraciones.
- El PDF puede precisar diferencias pendientes. No se asignaron capacidades ficticias
  de notificaciones, capacitación o posicionamiento.
- Esta etapa no cambia r4 ni habilita allí el endpoint. Se necesita revisión y una
  autorización posterior para cualquier despliegue o cambio del escenario r4.

## Evidencia histórica T12.1–T12.3

Las pruebas nuevas cubren matriz comercial, funciones aún no implementadas,
fronteras temporales, ausencia/suspensión/inactividad, perfil no activo, código
inválido, guard del servidor, roles, aislamiento, actualización administrativa y
contrato. En la primera etapa se simulaba una capacidad futura solo en tests.
La regresión incluye publicación, operaciones, administración y registro cerrado.
Los resultados concretos y límites de ejecución se entregan en el cierre de esta etapa.

Secuencia posteriormente autorizada y completada:

1. T12.4: definir filtros y resultados esperados de los tres reportes, construir
   consultas limitadas al propietario y resúmenes Pro; pruebas de fechas y datos vacíos.
2. T12.5: detalle/análisis Elite y exportación `.xlsx` con pruebas de autorización,
   fórmulas/celdas, privacidad y consistencia. Activar capacidades solo al completarlos.
3. T12.6: integrar catálogo/reportes en React y preparar el escenario docente con
   cuentas sintéticas comparables. Acordar aparte alcance Flutter y entorno de ensayo.

La autorización posterior permitió completar estas tres tareas, en este orden.
La especificación detallada, contratos, pruebas, riesgos, archivos y guion docente
actualizados están en [TASK12_REPORTS_VALIDATION.md](TASK12_REPORTS_VALIDATION.md).

### Resultados históricos de T12.1–T12.3 (no son la validación final)

- Python 3.14, Django 5.2.18 y dependencias de `backend/requirements.txt` en venv
  temporal `/tmp/furgoplus-task12-venv`. Settings temporales con SQLite `:memory:`,
  claves de prueba y almacenamiento temporal; no se cargó configuración privada
  ni se conectó a PostgreSQL existente. El runner crea y destruye su propia DB.
- 45/45 pruebas aprobadas: `drivers.test_capabilities`, `api.test_contracts`,
  `drivers.test_publication`, `drivers.test_operations.OperationsTests`,
  `drivers.test_controls.AdminControlTests`, `api.test_demo_registration`.
- Tras reforzar negativas del guard (suspensión, inactividad y otro usuario), las
  nueve pruebas nuevas se repitieron: 9/9. No sumarlas como 54 pruebas distintas.
- Primer intento: 45 aprobadas / 47 ejecutadas; dos fallos por ejecutar pruebas
  PostgreSQL de concurrencia sobre SQLite (`FinalSeatConcurrencyTests` y
  `ProfileControlConcurrencyTests`). No se modificaron esas pruebas ni se declara
  validada la concurrencia. Queda pendiente su ejecución sobre PostgreSQL aislado.
- `makemigrations --check --dry-run`: sin cambios. No se crearon migraciones.
- OpenAPI `--check`, Ruff check/formato de archivos Python afectados y
  `git diff --check`: aprobados.
- Web: regeneración y `contract:check`, `typecheck`, `lint` y Prettier de los dos
  archivos afectados: aprobados. No se cambió UI; no se ejecutó suite Flutter.
- `npm ci --ignore-scripts` conservó el lockfile e informó cuatro vulnerabilidades
  (una moderada, una alta y dos críticas). Aviso del instalador, sin análisis de
  explotabilidad en esta tarea; pendiente evaluación separada, sin `audit fix`.
- Sin commit, push, merge, deploy, cambios de infraestructura, otros worktrees ni r4.
