# Task 12 — Evidencia T12.7–T12.9

Rama `task/12-plan-capabilities`. Implementación autorizada por el usuario, pendiente
de revisión humana. Catálogo `2026-10-19.3`; contenido `2026-10-19.1`.
Se conserva T12.4–T12.6 y su informe, con aceptación visual pendiente. No se trabajó
sobre Flutter/T12.10, infraestructura, otras ramas/worktrees, correo ni push.

## Funcionalidad y matriz comercial

| Función | Básico | Pro | Elite | Apoderado |
| --- | --- | --- | --- | --- |
| Centro de ayuda y tickets propios | Sí | Sí | Sí | Sí, sin plan |
| Atención comercial efectiva | Estándar | Preferente | Prioritaria | Estándar |
| FAQ con reglas y contenido revisado | — | Sí | Sí | — |
| Contexto propio del asistente | — | — | Sí | — |

La prioridad comercial exige suscripción efectiva y perfil activo. Sin plan,
vencido, futuro, suspendido o inactivo: soporte estándar, sin perder gravedad ni
historial. Cuenta desactivada (`is_active=false`): recursos privados denegados.
Ayuda y soporte siguen disponibles a un perfil conductor suspendido para permitir
consultas sobre su situación; el asistente se deniega. Cada petición premium usa
`require_capability` en Django. Los flags de las cuatro capacidades se habilitaron
tras pasar las pruebas nuevas; no se cambiaron permisos de reportes.

Las guías versionadas se mantienen en `drivers/help_content.py`. Se revisaron contra
los servicios y pantallas existentes: primeros pasos por rol, documentación y
publicación, rutas/cupos/recorridos, registro manual de pagos y solicitudes, reportes,
planes/vigencia/cambios y soporte. El apoderado recibe guías propias y comunes;
la búsqueda móvil existente se explica sin agregar funciones Flutter. React ofrece
índice con enlaces, títulos, controles con etiquetas, foco de navegación y mensajes
accesibles. La revisión editorial y aceptación visual humanas siguen pendientes.

La recepción automática y las guías pueden usarse sin horario mientras el servicio
esté disponible. No hay garantía de uptime ni atención humana inmediata 24/7. El
soporte no se presenta como canal de emergencias.

## Persistencia, permisos y privacidad

- `SupportTicket`: propietario, asunto, gravedad 1–4, estado, prioridad comercial al
  crear, versión optimista, fechas de creación/actualización. Constraints de estados,
  gravedad, prioridad y versión. Sin relación a documentos, menores o pagos.
- `SupportEvent`: autor y rol al escribir, texto, estado anterior/nuevo, motivo y
  fecha. Historial de solo adición a través de servicios/API; `save` de un evento
  existente y `delete` directo se rechazan. No hay CRUD de historial ni borrado por API.
- `SupportUsage`: un contador por usuario/acción, ventana de una hora y consumo.
  No almacena preguntas, respuestas del asistente ni transcripciones.
- Migración `drivers/0009_supportticket_supportevent_supportusage_and_more.py`:
  solo tablas/índices/constraints/permiso nuevo; sin migración de datos operativos,
  asignaciones de permisos o alteración de bases existentes.
- Propietario obtenido de sesión, sin seleccionar usuario por parámetro. GET y POST
  de ticket ajeno devuelven 404. Rol administrador no puede usar la creación propia.
- Panel: cuenta activa, `role=admin`, `is_staff=true` y permiso Django
  `drivers.manage_support` (o superusuario). Ninguno de estos requisitos por separado
  alcanza. No se creó una cuenta administrativa real ni se concedió este permiso a
  usuarios existentes. Su asignación futura debe revisarse junto con los permisos
  administrativos previos: el rol admin existente ya tiene facultades de validación.
- El permiso de soporte no es utilizado por ningún endpoint de documentos,
  pasajeros, pagos, suscripciones o validación. Los endpoints de soporte solo leen
  ticket/historial y prioridad, sin enlaces de descarga ni agregación de recursos
  privados. No aceptan `document_id`, propietario, autor, plan ni estado en creación.
- Sesión Django y CSRF en escrituras; `Cache-Control: no-store` también en errores.
  React reutiliza el guard de generación de sesión y desmonta la ayuda al reemplazar
  la cuenta; invalida lecturas antiguas y limpia contexto al refrescar permisos.

## Cola y máquina de estados

La cola administrativa muestra activas por defecto, y permite consultar el historial
completo, resueltas o cerradas. Orden estable: **gravedad ascendente** (1 crítica,
2 alta, 3 normal, 4 baja), **prioridad comercial efectiva** (Elite, Pro, estándar),
luego fecha de creación e ID. Se calcula en SQL al leer; el cambio de plan/vigencia
se refleja en la próxima consulta, sin caché de prioridad. Se conserva la prioridad
original como evidencia. Apoderados y usuarios sin beneficio efectivo son estándar.

El usuario declara gravedad. Términos explícitos de seguridad, accidente, peligro,
amenaza, acoso o filtración elevan a crítica y registran motivo si cambia la gravedad.
Es una regla conservadora, no un detector semántico de incidentes. El plan nunca
puede relegar un ticket crítico frente a uno de gravedad inferior. La gravedad no
se puede reducir a través de esta API.

| Estado anterior | Transiciones administrativas permitidas |
| --- | --- |
| Abierta (`open`) | En revisión, esperando usuario, resuelta |
| En revisión (`in_progress`) | Esperando usuario, resuelta |
| Esperando usuario (`waiting_user`) | En revisión, resuelta |
| Resuelta (`resolved`) | En revisión, cerrada |
| Cerrada (`closed`) | Ninguna; historial consultable |

El administrador puede responder conservando estado; un cambio exige motivo.
No se permite una operación vacía. El propietario puede responder a una abierta o
en revisión conservando su estado; una respuesta a esperando usuario o resuelta
pasa a en revisión. No puede cambiar estado directamente ni responder a cerradas.
Cada respuesta/cambio incrementa versión y registra evento/fecha/autoría. Se exige
`expected_version`; una versión vieja devuelve 409, sin repetir la escritura.
Transacción y bloqueo de ticket impiden decisiones simultáneas sobre la misma versión.

## Límites y validación

- Cinco tickets por hora/cuenta, diez tickets activos simultáneos; treinta
  respuestas por hora/cuenta (también administradores); sesenta consultas del
  asistente por hora/cuenta. Contadores persistidos y bloqueo de usuario para evitar
  carreras al crear o consumir el último cupo; 429 al exceder. No depende de memoria
  local por worker. Fallos de validación no crean ticket/evento.
- Máximo doscientos eventos por ticket; al alcanzar el límite se conserva historial
  y se indica crear otra solicitud. No se implementa archivado automático.
- Asunto de 120 caracteres, cuerpo 2000, motivo administrativo 300 y pregunta 300.
  Solo texto simple; rechaza HTML, enlaces, controles/bidi, correos y secuencias largas
  de dígitos de aspecto identificador/contacto. Se rechazan campos adicionales y
  payloads incorrectos. No hay adjuntos. Se escapa todo el texto al renderizar React.
- Creación exige `privacy_confirmed` booleano exactamente `true`, enviado después
  de revisión del usuario. La UI reinicia la confirmación al editar asunto/cuerpo.
- Listas paginadas: offset no negativo y limit 1–50, predeterminado 25. No admite
  filtros de propietario ni parámetros repetidos/desconocidos. `state` solo en cola admin.

La validación no puede reconocer todos los nombres, secretos o datos sensibles en
texto libre. No se afirma anonimización semántica automática: se muestra advertencia,
se pide revisión y solo se permite acceso a propietario y administradores autorizados.
Es necesario definir responsable, retención, tratamiento de contenido accidentalmente
sensible y operación del soporte antes de una futura publicación; no se agregó correo,
push, SLA, borrado, asignación de agentes ni funciones ajenas a esta etapa.

## Asistente verificable

`kind=rules_and_content`. No usa modelos generativos, servicios externos, claves API,
embeddings ni red. Normaliza acentos y aplica reglas de temas para devolver literalmente
un artículo de ayuda revisado y versionado. No presenta texto del usuario como respuesta.
Consultas desconocidas o solicitudes de cambios, datos ajenos o menores reciben una
salida clara fuera de alcance. Las reglas pueden producir falsos positivos/negativos;
la guía de origen está enlazada para revisión.

Pro: modo `faq`, sin contexto. Elite: además modo `contextual` y exclusivamente
cinco valores propios: estado de perfil, estado de validación, solicitud de publicación
(sí/no, sin afirmar elegibilidad), etiqueta de plan y estado de suscripción. No consulta
listas de documentos, nombres o contactos de pasajeros, rutas, pagos, observaciones
privadas ni cuentas ajenas. No tiene herramientas para mutar cuentas, planes,
validaciones u operaciones. No conserva pregunta/respuesta. Permisos se revisan en cada
POST; una baja a Pro bloquea contexto y una baja a Básico bloquea también FAQ.

La respuesta permite ofrecer soporte; **no crea un ticket**. “Preparar solicitud de
soporte” abre formulario vacío, sin copiar la pregunta/transcripción. El usuario escribe
un texto revisado y confirma el envío con checkbox y botón. Cancelar no envía nada.

## Contratos

| Método y recurso `/api/v1/` | Alcance |
| --- | --- |
| GET `help/` | Versión, avisos, artículos del rol y modos efectivos del asistente |
| GET / POST `support/tickets/` | Listar propios / crear con confirmación |
| GET / POST `support/tickets/{id}/` | Historial propio / responder con versión |
| GET `admin/support/tickets/` | Cola activa o historial filtrado, permiso específico |
| GET / POST `admin/support/tickets/{id}/` | Historial / respuesta y transición administrativa |
| POST `assistant/` | `question`, `mode`; contenido, contexto permitido y oferta de ticket |

Los nueve contratos nuevos (por método) están en `api/support_contracts.py`, integrados
en el registro existente. `openapi.json` y tipos TypeScript se regeneraron; los
esquemas tienen listas explícitas de propiedades. No se cambiaron los cinco contratos
ni las tres exportaciones Excel de reportes.

## Validación y evidencia

Comandos de backend, siempre con Python temporal y PostgreSQL desechable:

```bash
TASK12_PYTHON=/tmp/furgoplus-task12-venv/bin/python bash backend/scripts/test_task12_postgres.sh
/tmp/furgoplus-task12-venv/bin/ruff check backend
/tmp/furgoplus-task12-venv/bin/ruff format --check backend
/tmp/furgoplus-task12-venv/bin/python backend/manage.py generate_openapi --check --settings=config.settings_task12_tests
```

El script usa `postgres:17.6-alpine3.22`, puerto local 55432, almacenamiento tmpfs,
credenciales sintéticas y bases `task12_isolated` / `test_task12_isolated`. Crea, migra,
comprueba y elimina su propio contenedor. No carga archivos `.env` ni usa variables
DB de una instalación existente. La generación y primera aplicación de 0009 también
se hicieron contra un contenedor con estos mismos límites. No se probaron nuevas
migraciones en SQLite ni se migró ninguna base existente.

```bash
npm run test --prefix web -- --maxWorkers=2
npm run build --prefix web
npm run contract:check --prefix web
npm run lint --prefix web
npm run format:check --prefix web
git diff --check
```

Resultados finales:

- Django/PostgreSQL: **180/180**, incluidos 27 casos nuevos de soporte/asistente
  (dos con concurrencia real), más las pruebas previas de reportes y exportaciones.
- React: **275/275** con `--maxWorkers=2`, 18 archivos de pruebas; 253 casos anteriores
  más 22 nuevos de ayuda/soporte y privacidad de sesión. Duración final 47,86 s.
- Build de producción (incluye TypeScript), contrato TypeScript, lint Oxlint y
  formato Prettier de toda la web: aprobados.
- `check`, generación/aplicación de 0009 y `migrate --check` en PostgreSQL aislado:
  aprobados; `makemigrations --check --dry-run`: sin cambios.
- Ruff check/formato de todo backend, OpenAPI `--check` y `git diff --check`: aprobados.

Evidencia de cobertura:
propietario/rol/permisos, cuentas desactivadas, perfiles/suscripciones suspendidos,
vencimiento, cambios Elite→Pro→Básico, rechazo de campos y contenido, CSRF,
prioridad/gravedad/FIFO, máquina de estados, versión optimista y concurrencia real,
cuotas persistidas y sus límites, privacidad, FAQ/contexto y derivación confirmada.
Flujo Django completo: conductor crea → administrador responde → conductor consulta y
responde. UI: autoría, fechas chilenas, confirmación, rol admin, historial, errores,
revocación de permisos y rechazo de resultados obsoletos por sesión/plan.

La primera regresión React con workers por defecto tuvo un timeout en una prueba
operativa existente (5 s). Las dos repeticiones completas con dos workers pasaron (270/270 antes de los
últimos casos y 275/275 al cierre), sin ampliar el timeout ni alterar esa prueba. Se conserva el resultado de ese intento en esta evidencia.
No hubo navegador conectado disponible para inspección visual real. Las pruebas DOM
y el build no sustituyen aceptación visual humana de escritorio/móvil.

## Archivos de esta etapa

Nuevos:

- `backend/drivers/help_content.py`, `support.py`, `support_api.py`, `test_support.py`.
- `backend/drivers/migrations/0009_supportticket_supportevent_supportusage_and_more.py`.
- `backend/api/support_contracts.py`.
- `web/src/HelpSupport.tsx`, `HelpSupport.test.tsx`, `HelpSupportSession.test.tsx`, `help-support.css`.
- `docs/TASK12_SUPPORT_VALIDATION.md`.

Modificados sobre el trabajo T12.1–6 ya presente:

- `backend/drivers/models.py`: tres modelos de soporte.
- `backend/drivers/capabilities.py`, `test_capabilities.py`: versión/activación y matriz.
- `backend/api/contracts.py`, `urls.py`, `openapi.json`: contratos y rutas nuevas.
- `web/src/App.tsx`, `api.ts`, `api-types.ts`, `web/scripts/generate-api-types.mjs`: acceso
  a ayuda por rol, cliente y tipos generados.
- `docs/PLAN_CAPABILITIES_SPEC.md`: matriz comercial y estado actual.

Sin cambios en archivos de implementación/pruebas/informe de reportes, dependencias,
infraestructura, Flutter ni los restantes archivos preexistentes modificados. El diff
contra Git también contiene trabajo anterior sin commit; no atribuirlo a esta etapa.

## Guion de aceptación humana

Ejecutar solamente en un entorno de revisión aislado, con datos sintéticos, luego de
revisar 0009. No se autoriza con este guion aplicar migraciones en una base existente.
Preparar conductor Básico, Pro, Elite, otro conductor, apoderado, administrador con
`manage_support` y administrador sin ese permiso. Mantener el reloj/fechas de vigencia
controlados. No enviar mensajes reales ni incorporar información personal.

1. Abrir “Ayuda y soporte” en escritorio y ancho 390 px. Comprobar navegación por
   teclado, foco, etiquetas, índice/enlaces de guías, versión, lectura sin desbordes,
   feedback y avisos de disponibilidad y privacidad. Apoderado ve guías de su rol;
   conductor ve las cinco áreas solicitadas. Revisar la redacción editorial.
2. Básico crea un ticket normal con texto sintético. Verificar botón bloqueado sin
   confirmación, consentimiento reiniciado al editar y ausencia de envío al cancelar.
   Abrir historial, fechas, autoría, estado y prioridad estándar.
3. Administrador sin permiso no puede abrir cola ni detalle por API. Con permiso,
   abrir cola activa, responder al ticket y pasarlo a esperando usuario con motivo.
   El conductor actualiza, consulta la respuesta y responde; pasa a en revisión.
4. Resolver y cerrar desde administración; filtrar resueltas/cerradas o todo el
   historial. Confirmar historial completo, sin formulario al cerrar. Dos revisiones
   simultáneas sobre la misma versión: una acepta y la otra devuelve conflicto.
5. Crear un crítico con Básico y uno alto con Elite. El crítico encabeza la cola.
   A igual gravedad, Elite precede a Pro y estándar; iguales prioridades usan antigüedad.
   Cambiar plan/vigencia con el control existente: próxima consulta cambia prioridad
   efectiva, conserva prioridad original y no modifica gravedad ni datos operativos.
6. Desde otra cuenta intentar detalle y respuesta con ID del primer conductor (404),
   filtros de propietario/campos extra (400), y cuentas inactivas (403). Verificar que
   soporte no incorpora enlaces o información de documentos, menores o pagos privados.
7. Básico y apoderado no pueden usar asistente (403 directo). Pro consulta planes,
   rutas y reportes: respuesta con guía/versión y sin contexto. Elite ve únicamente
   los cinco estados propios. Solicitar datos ajenos o cambios produce fuera de alcance.
8. Preparar derivación desde una respuesta: no hay ticket antes de revisar el nuevo
   formulario y confirmar. No se copia la consulta. Cancelar no escribe nada. Confirmar
   crea un solo ticket que aparece en el historial y en la cola administrativa.
9. Con contexto abierto, bajar Elite a Pro/Básico o suspender perfil/suscripción;
   refrescar/foco elimina respuesta previa y restringe modos. API deniega consulta
   antigua. Cambiar de cuenta/cerrar sesión elimina tickets, borradores y respuestas.
10. En el mismo ensayo comprobar flujos operativos existentes por plan y las tres
    descargas Excel Elite. La aceptación visual previa de reportes sigue pendiente;
    no se declara aceptada por esta etapa.

Al terminar, detener Task 12 y solicitar revisión humana. T12.10 requiere autorización
posterior. Sin commit, push, merge ni deploy en esta entrega.
