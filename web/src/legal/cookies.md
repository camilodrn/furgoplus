# Cookies y almacenamiento

Borrador informativo v0.1 · 31-10-2026. Requiere revisión jurídica chilena antes de producción. Describe el código auditado y el entorno académico, sin certificar cumplimiento legal ni el despliegue productivo.

## 1. Finalidades y responsable

FurgoPlus utiliza almacenamiento estrictamente necesario para autenticar cuentas, proteger solicitudes y completar el cierre de sesión. El servidor y la aplicación FurgoPlus controlan las tecnologías descritas. La identidad legal del operador y su canal de privacidad todavía deben definirse; no se inventa un responsable o proveedor externo.

## 2. Cookies técnicas

sessionid mantiene la sesión y los permisos de la cuenta. El inicio de sesión establece una caducidad de hasta 12 horas; cerrar sesión la invalida en el servidor cuando se confirma. csrftoken protege las solicitudes frente a suplantación entre sitios; su duración configurada es de 52 semanas y puede renovarse al solicitar protección CSRF. Ambas cookies se limitan al host, usan Path=/, HttpOnly y SameSite=Lax. No se exponen a JavaScript; la aplicación recibe un token CSRF de protección en la respuesta de la API y lo mantiene en memoria, sin guardarlo en localStorage.

## 3. Otros mecanismos necesarios

La web usa el marcador furgoplus-signed-out en sessionStorage. Solo indica que un cierre de sesión no se ha confirmado; no contiene contraseñas, cookies ni tokens. Se retira al confirmar el cierre y su sesión de almacenamiento termina con la pestaña, según el comportamiento de restauración del navegador. No se encontraron usos de localStorage, IndexedDB o service workers en el código de la aplicación. La caché HTTP de archivos estáticos y el historial pertenecen al funcionamiento del navegador y no constituyen una nueva categoría de seguimiento de FurgoPlus.

## 4. Preferencias y terceros

La versión auditada no incorpora analítica de visitas, píxeles publicitarios ni SDK de seguimiento opcional. No se solicitan decisiones Aceptar/Rechazar sin efecto y no se registra una preferencia ficticia. Si se incorporan tecnologías opcionales, deberán bloquearse hasta contar con la autorización correspondiente y permitir retirada y eliminación de identificadores controlables antes de activarlas en el producto. Un cambio futuro requiere actualizar este inventario y revisar su fundamento jurídico. La información permanece accesible desde Cookies y almacenamiento y enlaza con Privacidad.

## 5. Android y servicios externos

La aplicación Android nativa conserva la sesión en almacenamiento seguro del dispositivo bajo furgoplus.session.v1, vinculada al host y a su vencimiento. El token y la cookie CSRF permanecen en memoria. No se incorporan banners web ni se detectaron SDK de seguimiento opcional. La acción Abrir en mapas puede abrir Google Maps con el destino solo cuando el usuario la solicita; no requiere ubicación del dispositivo ni implica carga previa de un píxel. En datos de ensayo, la apertura externa está deshabilitada. El proveedor externo aplica sus condiciones cuando se abre su servicio.

## 6. Entornos, control y revisión legal

En el entorno académico HTTP local, Secure está desactivado por configuración de desarrollo. La configuración HTTPS de producción lo activa; su despliegue real debe verificarse por separado. Puedes borrar cookies y almacenamiento en las opciones del navegador; hacerlo puede cerrar la sesión, sin eliminar la cuenta o los datos operativos del servidor. Borrar datos de Android también puede retirar la sesión local. Los bloqueos indiscriminados de cookies técnicas pueden impedir autenticación y solicitudes seguras.

Al 31 de octubre de 2026, esta información considera la Ley 19.628 y la entrada en vigor prevista de la Ley 21.719 el 1 de diciembre de 2026, conforme al texto publicado en la Biblioteca del Congreso Nacional. Deben revisarse eventuales reformas y el texto vigente antes de producción. La incorporación de este panel no certifica cumplimiento jurídico integral. Los datos de apoderados y menores requieren especial minimización, acceso limitado y revisión profesional; una preferencia de cookies no autoriza su tratamiento.
