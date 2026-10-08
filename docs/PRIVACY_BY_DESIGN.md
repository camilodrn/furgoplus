# Privacidad por diseño — Slice 7, 07-10-2026

**BORRADOR interno que requiere revisión jurídica chilena antes de producción,
usuarios reales, datos reales de menores, apoderados o domicilios y operación
comercial. No constituye aprobación legal ni certificación.**

Auditoría sobre `b850354`, contrastada con modelos, serializers, permisos y clientes;
no presume que los documentos de planificación sean capacidades implementadas.
[Borradores/versiones/fuentes legales](legal/README.md).

## A. Implementado: inventario, fin y visibilidad

| Categoría y campos comprobados | Fin y acceso del producto | Evidencia |
| --- | --- | --- |
| Cuenta: ID, email normalizado, hash de contraseña, rol parent/driver/admin, flags de actividad/staff/superusuario, fechas de alta/actualización/último acceso y permisos Django; nombre en ParentProfile/DriverProfile | Autenticación y autorización; identidad propia por API. Django admin registra User para staff autorizado; no registra pasajeros. No se publica email de cuenta | `backend/accounts/models.py`, `accounts/admin.py`, `api/auth.py` |
| Sesión DB Django, cookies y CSRF; cookie/CSRF móvil en flutter_secure_storage; marcador web local de cierre de sesión | Mantener y cerrar sesión, rechazo de respuestas obsoletas. No se persiste una lista privada en el visor legal | `config/settings.py`, `api/auth.py`, `web/src/api.ts`, `App.tsx`, `mobile/lib/session_api.dart` |
| AuthThrottle: clave SHA256 de acción/IP para login/registro; clave de conductor/origen para uploads; contador y ventana | Limitar intentos; acceso de servidor. Hash derivado de IP no garantiza anonimización. No inventariar GPS ni huella de dispositivo inexistente | `api/auth.py:throttle`, `drivers/services.py:upload_rate`, `accounts/models.py` |
| Perfil conductor: display_name, service_summary, service_contact_email, status, intención de publicación, estado/revisiones de validación | Nombre/resumen visibles en discovery elegible para apoderados autenticados. Email de servicio privado del dueño; solo snapshot compartido al aceptar solicitud. Admin gestiona perfiles y ve información de cuenta/configuración necesaria | `accounts/models.py`, `drivers/publication.py:discovery_json`, `drivers/control_api.py`, `drivers/api.py` |
| Documentos: bytes, kind, storage_key privado generado, MIME, tamaño, sha256, uploaded_at, expires_on, is_current; versiones de revisión con nombre enviado, referencias a archivos, revisión, estado, revisor, fechas y observaciones | Revisión demo; dueño/admin autorizado, nunca discovery. Descarga admin auditada. No se guarda nombre original de archivo como campo del modelo (puede existir en el formulario local) | `drivers/models.py`, `drivers/services.py`, `drivers/api.py` |
| Ruta: ID/dueño, nombre, estado, días, inicio/término, capacidad, comunas y revisión; destination_label y destination_address privados | Configurar servicio. Discovery expone nombre/días/horarios/capacidad/cupos para fecha/cobertura, sin dirección de destino. Solo dueño opera ruta | `drivers/models.py:Route`, `publication_api.py`, `publication.py` |
| RouteRun: ruta/fecha, estado, horas de inicio/fin, snapshots de horario/capacidad/nombre y dirección de destino | Operación diaria del dueño; no demuestra GPS/asistencia. Proyección GET no crea run; el inicio materializa datos | `drivers/daily_operation.py`, `models.py:RouteRun` |
| Solicitud: parent/driver, nombre de servicio snapshot, mensaje hasta 500, consented_at, snapshot de email apoderado, snapshot email servicio solo al aceptar, estado/fechas | Contacto entre participantes, email apoderado visible al conductor desde envío; servicio visible al apoderado solo aceptada. Historial privado persiste con servicio oculto; ningún asiento automático | `drivers/contact_api.py`, `models.py:ContactRequest`, ADR 0005 |
| PassengerAssignment: ID/ruta, student_display_name (100), pickup_instruction (255), guardian_display_name (100), guardian_contact (modelo 150; API exige teléfono de 9 dígitos), starts_on/ends_on, created_at/updated_at | Cupos y operación; solo conductor dueño por API, diario móvil limitado al servicio propio. Sin vínculo con cuenta del padre, prueba de autoridad ni creación automática desde solicitud | `drivers/operations_api.py`, `daily_operation.py:roster_json`, `models.py` |
| Pago: driver/assignment, período inicio/fin, amount_clp, due_on, pending/paid/void, paid_at, created_at/updated_at | Libro manual web del dueño; ningún API de pago del apoderado, pasarela, tarjeta o cuenta bancaria. Anulación conserva historia | `drivers/operations_api.py`, `models.py:PaymentRecord` |
| Plan/asignación: Basic/Pro/Elite, estado, starts_at/ends_at | Gate administrativo de publicación, no cobro. Dueño ve su estado; admin cambia con razón/auditoría | `drivers/publication_api.py`, `models.py:DriverSubscription` |
| AdminActionLog: actor, acción, tipo/ID objetivo, occurred_at, correlation_id, motivo, antes/después y detalles mínimos | Trazabilidad de revisión/lectura documental y control de perfil/plan; admin. Sin bytes, hashes de password, mensajes, listas infantiles ni pagos de transporte | `drivers/models.py`, `control_api.py`, `services.py` |
| Review: parent/driver, score, texto, estado, is_demo, fecha | Exposición de publicadas sin autor ni vínculo de cuenta; promedio/conteo. Solo lectura por producto, sin endpoint de creación de reseñas | `drivers/models.py:Review`, `contact_api.py:ReviewDetailMixin`, `publication.py` |

Datos privados sujetos a controles de rol/propiedad y no-store. Admin no tiene
API de exploración general de pasajeros, pagos o cuerpos de contacto. Otros
conductores no acceden a registros ajenos. Esto describe interfaces de producto,
no impide acceso técnico de operadores de DB/archivos/backups: falta definir
privilegios mínimos, separación de funciones, auditoría y acuerdos para producción.

## B. Sintético/demo: capacidad implementada no autoriza datos reales

- Checklist `demo_identity_document`, `demo_vehicle_document`,
  `demo_expiring_credential`, formatos PDF/JPEG/PNG y vencimientos demo.
  La validación no acredita habilitación de transporte ni verificación de antecedentes.
- `seed_demo_communes` ofrece demo-norte/demo-sur, no catálogo territorial definitivo.
- `seed_demo_reviews --demo` crea reseñas de cuentas ficticias inactivas y marca
  is_demo; no corre en arranque/migración. El modelo permite otras filas: la
  procedencia/moderación de reseñas reales sigue pendiente. La lista agrega sin
  flag demo; el detalle sí etiqueta cada reseña demo.
- Cuentas, pasajeros, recogidas, contactos, domicilios y pagos de pruebas son
  sintéticos. Las tablas/API existen; no es correcto afirmar que no representan
  datos infantiles. Tampoco hay un filtro que compruebe que cada valor sea ficticio.

## C. Futuro/no implementado

No hay autocompletado, geocodificación, coordenadas estructuradas de domicilio
infantil, GPS/tracking, navegación interna, ficha infantil global, vínculo
apoderado-pasajero verificado, RUT infantil, nacimiento, salud, notas escolares,
chat, pagos electrónicos ni aceptación legal versionada. `docs/DATA_MODEL.md`
contempla dirección **o coordenadas** como concepto de ruta; el código actual
solo implementa **destination_address**. No confundir ese plan con funcionalidad.

Una futura dirección exacta de hogar o coordenadas será información operativa
privada de alto riesgo, nunca de discovery. Exigir finalidad, necesidad, autoridad,
acceso limitado a actores operativos autorizados, trazabilidad, eliminación y
revisión de proveedor/geocodificación antes de implementarla. No se implementa aquí.

## Minimización que se preserva y discrepancias para revisión humana

Sin lista pública infantil, datos infantiles en discovery, acceso de otro conductor
ni exploración general administrativa. Solo información operativa necesaria del
servicio propio. No añadir por defecto RUT infantil, nacimiento, salud, antecedentes
escolares ni categorías sensibles preventivas. El mensaje de contacto no debe
solicitar datos infantiles. Compartir email del apoderado sigue explícito y por
servicio desde envío; el email de servicio sigue bajo aceptación de solicitud.

Discrepancias/riesgos concretos que no se ocultan ni cambian en esta slice:

1. `PassengerAssignment.pickup_instruction`, `guardian_contact`, mensaje y archivos
   son capaces de recibir datos reales o excesivos. No hay verificación de ficción
   ni autorización del apoderado; prohibición de datos reales es una restricción de
   operación del prototipo, no un bloqueo automático del backend.
2. Ya existe **dirección exacta de destino de ruta** y snapshot al iniciar run.
   Una instrucción libre puede incluir un domicilio infantil aunque no haya campo
   estructurado o coordenadas. Restringir prueba a direcciones ficticias. No afirmar
   que el MVP no maneja ninguna dirección.
3. Asignaciones/documentos/revisiones/pagos/historial usan PROTECT y/o rechazan delete;
   no hay eliminación integral ni calendario de retención. Terminar/anular/ocultar
   no equivale a borrar. Resolver la tensión entre trazabilidad y eliminación antes
   de datos reales; no adoptar retención perpetua por inercia.
4. El permiso de compartir email guarda fecha y snapshot, pero **no versión del
   texto**. No prueba aceptación legal, autoridad del apoderado, consentimiento
   infantil, categorías sensibles ni marketing. No ampliar su alcance.
5. No se encontraron contradicciones en los serializers con las fronteras públicas
   y por rol indicadas. La política no limita operadores de infraestructura por sí
   sola. La existencia de pruebas de permisos no demuestra cumplimiento jurídico.

## Menores: bloqueadores de producción

No incorporar datos reales de niños/adolescentes hasta: definir entidad operadora
responsable y contacto; completar revisión jurídica chilena; definir autorización
lícita/consentimiento y evidencia de autoridad de apoderados; documentar fines y
visibilidad; aprobar retención/eliminación; establecer incidentes/contacto;
completar revisión de seguridad. No habilitar datos reales de apoderados/domicilios
ni usuarios reales u operación comercial sin esa revisión.

Al 07-10-2026 rige Ley 19.628; Ley 21.719 entrará en vigor el 01-12-2026 y contiene
reglas explícitas de niños/adolescentes. Diseñar hacia mayor transparencia,
minimización y derechos sin presentar el régimen futuro como ya vigente.
Evidencia de autorización y versión exacta según [pendientes legales](legal/README.md);
ninguna checkbox aislada sustituye esa evidencia.

## Retención, derechos, seguridad e incidentes pendientes

Definir plazos por cuenta, sesión/throttle, contactos, archivos/versiones,
asignaciones/runs, pagos, reseñas, auditoría y respaldos; justificación de cada
plazo, purga técnica, excepciones y responsables. El comando
`cleanup_private_uploads` maneja archivos huérfanos, no una política general de
retención ni borrado de datos de personas. No inventar plazos resueltos.

Diseñar canal oficial de acceso/corrección/eliminación/bloqueo y derechos aplicables,
verificación proporcional de identidad/representación, registro, responsable,
plazo legal, respuesta y trazabilidad. Contemplar archivos, snapshots y respaldos
sin exponer información ajena. No hay endpoint general ni contacto oficial hoy.

Controles comprobados: propiedad/rol servidor, CSRF/sesión, cookies protegidas en
configuración no-debug, almacenamiento de sesión nativo, respuestas privadas
no-store, descargas privadas y auditoría administrativa. Pendientes: revisión de
accesos y seguridad de producción, malware/cuarentena, gestión de secretos,
respaldos y ensayo de recuperación conjunto DB/archivos, proceso de incidentes,
canal de usuarios, evaluación de brechas y notificaciones tras revisión legal.
No se afirma que estén ejecutados u organizados en producción. Evitar datos
infantiles/contactos/tokens en logs; revisar proxy/hosting y accesos técnicos.

## Mapas, terceros y transferencias

`mobile/lib/driver_home.dart:destinationUri` construye URL HTTPS de Google Maps
con `api=1` y `destination`; `LaunchMode.externalApplication` delega al dispositivo.
Confirmación explica compartir destino, no lista ni credenciales. No se garantiza
que Google Maps sea la única app que lo atienda. El prototipo no recoge GPS ni
incluye motor de navegación. Permisos y tratamiento posterior son externos.

Compose configura PostgreSQL y volúmenes locales; flutter_secure_storage es una
biblioteca, no prueba de un encargado remoto. No se encontró proveedor contratado,
región productiva o transferencia internacional definida. Identificar alojamiento,
encargados, ubicación, contratos, transferencias y reglas antes de producción;
no inventar nombres ni prometer residencia en Chile.
