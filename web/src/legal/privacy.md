# Privacidad

Borrador — requiere revisión legal antes de producción

Aviso de Privacidad v0.1 — 07-10-2026. Este borrador requiere revisión jurídica chilena antes del lanzamiento en producción, el uso con personas reales, datos reales de niños, niñas o adolescentes, datos reales de apoderados o domicilios y cualquier operación comercial. No constituye aprobación legal ni certificación.

## 1. Qué es FurgoPlus y quién responde

FurgoPlus es un prototipo para buscar servicios de transporte escolar, solicitar contacto y probar herramientas operativas del conductor. Las pruebas deben usar datos y documentos sintéticos. La entidad legal operadora y responsable del tratamiento, su identificación y el canal oficial de privacidad aún deben definirse antes de producción. Este borrador no ofrece un contacto oficial que todavía no existe.

## 2. Marco legal de esta versión

Al 07 de octubre de 2026, el marco de protección de datos personales actualmente aplicable es la Ley 19.628. La Ley 21.719 tiene su entrada en vigencia prevista para el 01 de diciembre de 2026. El diseño busca anticipar sus mayores exigencias de transparencia, minimización, derechos y protección de niños, niñas y adolescentes, sin afirmar cumplimiento de ninguna de ellas.

## 3. Cuenta y seguridad de acceso

La cuenta contiene correo electrónico, nombre para mostrar y rol de apoderado, conductor o administrador, además de identificadores, estados y fechas de cuenta. La contraseña se recibe para autenticar y se almacena como un resumen criptográfico, no como texto legible. Se manejan sesiones, cookies y tokens de protección de solicitudes. En móvil, las credenciales de sesión se conservan mediante almacenamiento seguro del dispositivo.

Estos datos permiten registrar cuentas, iniciar y cerrar sesión y limitar el acceso según el rol. Para limitar intentos de acceso, el servidor utiliza una clave derivada de la dirección IP y de la acción, contadores y fechas; las cargas de documentos también tienen límites. Una clave derivada no equivale a anonimato garantizado.

## 4. Servicio público y datos privados del conductor

La búsqueda está disponible para apoderados autenticados. Muestra nombre del servicio, descripción, comunas de cobertura, rutas con nombre, días, horarios, capacidad y disponibilidad para una fecha, etiqueta de validación y reseñas publicadas sin identidad del autor. Las reseñas actuales son ejemplos sintéticos; su detalle indica que son de demostración. No hay un listado público de pasajeros.

El correo de cuenta y el correo privado de contacto del servicio no aparecen en búsqueda. El conductor administra su propio perfil, rutas, solicitudes y registros operativos. La dirección y el nombre del destino de ruta, así como sus versiones operativas al iniciar un recorrido, son información privada del conductor; la búsqueda no muestra esa dirección.

## 5. Solicitudes de contacto: permiso específico

Al enviar una solicitud, el apoderado autoriza expresamente compartir su propio correo con el servicio/conductor seleccionado. El conductor recibe el correo y el mensaje desde el envío, incluso antes de aceptar. Se guardan participantes, mensaje, fecha del permiso, copia del correo compartido, estado y fechas de la solicitud. Si el conductor acepta, el apoderado puede ver la copia del correo de contacto del servicio registrada al aceptar. El historial sigue disponible para los participantes aunque el servicio deje de aparecer en búsqueda.

Este permiso se limita a ese intercambio de correo: no es aceptación de este Aviso ni de los Términos, autorización sobre datos de menores o datos sensibles, ni permiso para marketing. No incluyas nombres de niños, domicilios ni información sensible en el mensaje. Aceptar una solicitud no asigna un cupo; las partes coordinan el servicio fuera de FurgoPlus.

## 6. Pasajeros y apoderados: información operativa de alto riesgo

El prototipo permite al conductor registrar manualmente nombre para mostrar del estudiante, instrucción de recogida, nombre del apoderado, teléfono de contacto y fechas de inicio y término de la asignación a su ruta. Se usan para probar cupos y la lista operativa del servicio propio. Solo el conductor dueño accede por las interfaces del producto; otros conductores, la búsqueda y la administración no tienen acceso general a esas listas. El vínculo entre cuenta de apoderado y autoridad sobre un menor no está verificado por este flujo.

No se solicitan por defecto RUT infantil, fecha de nacimiento, información médica ni antecedentes escolares. Los campos libres y archivos podrían contener información indebida: no ingreses categorías sensibles «por si acaso». No hay autocompletado de direcciones, geocodificación, coordenadas precisas del hogar infantil ni seguimiento GPS en este MVP. Una instrucción libre de recogida sí podría revelar un domicilio y debe tratarse como privada.

## 7. Restricción sobre menores y datos reales

Los datos de niños, niñas y adolescentes presentan un riesgo especial. Está bloqueado por política del prototipo incorporar datos reales de menores hasta definir la entidad responsable, completar revisión jurídica chilena, definir el modelo lícito de autorización o consentimiento, representar adecuadamente la autoridad del apoderado, documentar fines y visibilidad, decidir conservación y eliminación, disponer de procedimientos de incidentes y contacto y completar la revisión de seguridad de producción. Las pruebas continúan con información sintética, incluidos contactos y domicilios ficticios.

Un casillero de interfaz no demuestra autorización. El uso real requerirá evidencia auditable de quién autorizó, con qué autoridad, para qué fines, cuándo y sobre qué versión exacta del texto, conforme al modelo que apruebe la revisión legal. Esa infraestructura no existe para autorizaciones sobre menores ni aceptación de documentos legales. La Ley 21.719 contempla reglas explícitas para niños y adolescentes a partir del 01 de diciembre de 2026; no se presentan como vigentes a la fecha de este borrador.

## 8. Documentos y revisión administrativa

La lista de validación actual solicita únicamente documentos demo de identidad, vehículo y credencial con vencimiento. Se almacenan archivos privados PDF/JPEG/PNG, tipo, tamaño, huella criptográfica, fecha de carga, vencimiento cuando corresponde y versiones. Se conservan el nombre enviado, documentos de cada revisión, estados, observaciones, revisor y fechas. El conductor dueño y administradores autorizados acceden a estos documentos; el acceso administrativo a archivos queda registrado. No se publican archivos ni sus rutas de almacenamiento.

Esta revisión de demostración no acredita permisos de transporte, seguros, antecedentes ni seguridad del servicio. No cargues documentos reales: están pendientes criterios legales de revisión, tratamiento de archivos maliciosos y reglas de conservación.

## 9. Pagos, planes e historial

El conductor lleva un registro manual privado de pagos de transporte ligado a su propia asignación: período, monto en pesos chilenos, vencimiento, estado y fecha de pago cuando corresponde. No se capturan tarjetas ni cuentas bancarias ni se procesa dinero. Los planes son asignaciones administrativas con estado y vigencia, sin pasarela ni cobro automático.

La administración gestiona validaciones, estados del perfil, planes e historial de acciones con actor, fecha, motivo, referencia y cambios. No dispone de navegación general por pasajeros, pagos de transporte o mensajes de contacto. Los controles de aplicación no impiden por sí solos el acceso técnico de quienes operan la infraestructura: su autorización y supervisión deben definirse antes de producción.

## 10. Mapas externos y proveedores

Al elegir Abrir en mapas, FurgoPlus entrega la dirección de destino a una aplicación externa para iniciar la búsqueda o navegación. El lanzador actual construye un enlace de Google Maps que el dispositivo abre externamente; la aplicación que lo atienda depende del dispositivo. FurgoPlus no tiene motor de navegación interno ni recoge ubicación continua. No envía en ese enlace listas de pasajeros, nombres, correos ni credenciales. La aplicación externa determina sus permisos y tratamiento de datos.

El repositorio configura una base PostgreSQL, almacenamiento privado de archivos y almacenamiento seguro de sesión móvil. Estas tecnologías no identifican por sí solas proveedores contratados. No están definidos el proveedor de alojamiento de producción, la ubicación de los datos ni eventuales transferencias internacionales. Deben identificarse los encargados, destinos y condiciones aplicables antes de usar datos reales; no se promete que los datos permanezcan en Chile.

## 11. Conservación, derechos y solicitudes

No se han aprobado plazos de conservación por categoría. El prototipo retiene versiones e historiales y restringe el borrado de registros relacionados; terminar una asignación, anular un pago o cerrar sesión no elimina esos datos. Esto no autoriza conservación indefinida. Deben acordarse plazos, excepciones justificadas y eliminación también en archivos y respaldos.

Las personas tienen derechos de información y acceso, corrección y, según corresponda, eliminación o bloqueo conforme al marco aplicable. La revisión legal debe concretar el procedimiento y los derechos adicionales pertinentes cuando entren en vigencia. Hoy no hay un canal oficial de privacidad ni un flujo general de solicitudes. Antes de producción se debe habilitar un canal, verificar identidad y representación de forma proporcional, registrar solicitudes y respuestas y fijar responsables y plazos según la ley. La edición del nombre de cuenta no sustituye ese procedimiento.

## 12. Límites de seguridad y cambios

El prototipo incorpora controles de rol y propiedad, protección de sesión y respuestas privadas sin caché. No ofrece seguridad absoluta. Quedan pendientes revisión de accesos de producción, pruebas de seguridad, respaldo y recuperación, proceso de incidentes, canal de contacto y evaluación y notificación de brechas según revisión legal. No se afirma que exista una organización madura para responder incidentes.

Esta versión es un borrador fechado, disponible para lectura sin aceptación obligatoria. Una futura versión aprobada deberá conservar su contenido exacto y, si corresponde registrar aceptación, asociarlo de forma auditable a cuenta, fecha y versión. Leer este aviso o compartir el correo en una solicitud no registra aceptación legal.
