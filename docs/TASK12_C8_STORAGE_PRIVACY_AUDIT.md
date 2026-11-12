# T12 · C8: cookies, almacenamiento y privacidad

31-10-2026. **Implementado para la realidad auditada: solo tecnologías necesarias.** No se añadió un banner de consentimiento, botones Aceptar/Rechazar ni preferencias ficticias. El acceso permanente **Cookies y almacenamiento** abre el panel desde el acceso, registro y cuenta lateral compartidos. El documento de Privacidad v0.2 se comparte con Android; no se añadió un banner web a la app nativa.

[Panel y evidencia auténtica](evidence/task12-c7-c8/index.html) · [Metadatos iniciales](evidence/task12-c7-c8/checks/first-visit.json) · [Tras iniciar sesión](evidence/task12-c7-c8/checks/authenticated-storage.json) · [Tras cerrar sesión](evidence/task12-c7-c8/checks/after-logout.json) · [Zoom real](evidence/task12-c7-c8/web/cookies-real-zoom-200.json).

## Inventario real

Se revisaron React, dependencias, API de sesión, ajustes Django académicos/productivos, Flutter, sus dependencias y manifiesto. Se contrastó el almacenamiento en Chromium real, guardando únicamente nombres y atributos, **sin valores de cookies, contraseñas ni tokens**.

| Tecnología | Propósito y origen/responsable técnico | Duración | Atributos / evidencia |
|---|---|---|---|
| `sessionid` · cookie | Django/FurgoPlus: sesión y permisos. | Login fija **12 horas**. El valor general de Django es 14 días, pero no es la duración efectiva de este login. Logout confirmado elimina la cookie/invalida la sesión. | HttpOnly, SameSite=Lax, Path=/, host-only sin Domain configurado. Secure=false observado en HTTP académico; la configuración HTTPS productiva prevé true. Metadatos reales tras acceso, sin valor. |
| `csrftoken` · cookie | Django/FurgoPlus: protección de solicitudes frente a origen ajeno. | **31.449.600 s = 52 semanas**, renovable al obtener CSRF. | Mismos atributos anteriores. Observada en primera visita, recarga y tras logout. No accesible a `document.cookie` por HttpOnly. |
| Token CSRF en memoria | La respuesta de la API entrega la protección necesaria al cliente para enviar solicitudes. | Vida del adaptador de sesión/proceso; se renueva según el flujo existente. | Memoria React/Flutter; no añadido a localStorage. No es un token de sesión nuevo. |
| `furgoplus-signed-out` · sessionStorage | React/FurgoPlus: impide restaurar un cierre no confirmado. Solo marcador «1», sin credenciales. | Hasta confirmar el cierre o terminar la sesión de almacenamiento de la pestaña, según restauración del navegador. | Verificado en fuente y pruebas de cierre incierto. No queda presente después del cierre confirmado real. No se cambió este mecanismo. |
| `furgoplus.session.v1` · almacenamiento seguro Android | `SecureAuthStorage`/flutter_secure_storage existente: conserva cookie de sesión y metadatos de host/vencimiento. | Hasta caducidad, cierre o eliminación por el flujo existente. | No se leyeron valores privados del dispositivo. Fuente y regresión del adaptador; backup Android deshabilitado. La sesión se conservó al actualizar el APK. |
| Resto de estado nativo | Controladores y pantallas: datos operativos/drafts necesarios en memoria durante la sesión. CSRF solo en memoria. | Ciclo de sesión/vista/proceso según flujo existente. | Sin nuevo almacenamiento persistente ni SDK de seguimiento. |

**No se encontraron usos de localStorage, IndexedDB, service workers, analítica de visitas, píxeles publicitarios o SDK opcionales de seguimiento en la aplicación.** Chromium mostró listas vacías de claves locales, IndexedDB y service workers en los recorridos documentados. La capacidad de reportes llamada `analytics.period_comparison` es una comparación de datos del servicio, no un SDK de telemetría. La caché HTTP de recursos y el socket de desarrollo de Vite no se presentan como nuevas categorías opcionales de seguimiento.

La entidad jurídica operadora/responsable y el canal oficial de privacidad siguen pendientes antes de producción. «FurgoPlus» identifica aquí al servidor/aplicación técnica; no se inventa un responsable legal ni se certifica esa identificación.

## Terceros y entornos

No hay llamadas de seguimiento de terceros en el recorrido web comprobado; no se activaron integraciones para justificar un panel. En Android, **Google Maps** es un destino externo que se abre solo mediante la acción existente del usuario, compartiendo el destino y sin pedir ubicación del dispositivo. Está deshabilitado para datos de ensayo. La política real del proveedor está disponible en [Privacidad de Google](https://policies.google.com/privacy?hl=es); no se cargó ese servicio para las capturas de C7.

El entorno académico usa HTTP local y cookies sin Secure; HttpOnly y SameSite=Lax se mantienen. Las configuraciones de producción/demo HTTPS fijan Secure=true y host-only. **No se inspeccionó ni modificó el despliegue productivo**: headers reales, proxy, dominio, TLS y duración efectiva deben verificarse allí por separado. Las cookies no se aíslan por puerto; los ensayos locales se hicieron en contextos temporales separados, sin usar el servicio antiguo 15173 ni copiar sesiones del perfil personal.

## Experiencia y límites de las preferencias

`StoragePrivacy.tsx` centraliza el inventario y presenta propósito/duración antes del detalle técnico. `LegalAccess` reutiliza el lector modal y su retorno de foco. El panel ofrece acceso a Privacidad y una sección de información detallada, sin bloquear automáticamente la navegación. La identidad y el sistema de superficies, tipografía, foco y azul #0752AC se conservan; no se instaló una biblioteca o servicio de consentimiento.

`optionalTechnologies` está vacío deliberadamente. El componente e inventario son reutilizables, pero **no implementan ni prometen un gestor de consentimiento para integraciones futuras inexistentes**. Incorporar una tecnología opcional exige primero su bloqueo previo, decisión libre/granular, persistencia versionada y retirada con eliminación de identificadores controlables, además de actualizar el inventario y revisar su base jurídica. No basta añadir una entrada al registro para cargarla.

No se guardó una decisión para «solo necesarias» y no se reescribieron las cookies técnicas. Para retirar el almacenamiento necesario se explican las opciones del navegador y sus consecuencias: puede cerrar sesión, sin borrar cuenta ni registros del servidor. No se introdujo un botón de borrado indiscriminado. La confirmación de cookies no se confunde con consentimiento sobre datos de apoderados o menores.

## Comprobaciones

| Situación | Resultado real / límite |
|---|---|
| Primera visita aislada | Solo csrftoken. Sin banner automático, decisiones ficticias, localStorage, IndexedDB o service workers. |
| Abrir/cerrar panel y recargar | Información disponible; no se crean preferencias ni se alteran claves de autenticación. |
| Aceptación/rechazo/personalización/revocación de opcionales | **No aplican**: no hay tecnologías opcionales ni botones sin efecto. No se inventaron categorías para marcar esas pruebas como aprobadas. |
| Acceso y cierre reales | Login académico asistido por usuario, sin registrar su contraseña. Cookies csrftoken + sessionid. Logout autorizado y confirmado: queda solo csrftoken; después de recargar `/auth/me/` devuelve 403 legítimo y no se restaura la sesión. |
| Rechazo y sesión | No existe rechazo de necesarias u opcionales inexistentes. El panel es informativo y no interviene en CSRF, sesiones ni permisos; regresión de sesión y pruebas específicas confirman que no escribe almacenamiento. |
| Perfil privado/aislado | El contexto nuevo de Playwright es temporal, sin copiar el perfil personal. Primera visita y recarga comprobadas ahí; el ensayo de zoom usó otro perfil temporal separado. |
| Responsive | Capturas auténticas a **320, 390, 768 y 1440 px**, sin desbordamiento horizontal. |
| Teclado/foco | Tab llega a Cerrar y a Detalles técnicos; Enter expande. Escape devuelve foco al disparador visible o al contenido. Enlace Leer Privacidad enfoca su título. |
| Zoom real | Chrome `tabs.setZoom(2)` en una ventana aislada con extensión local de ensayo sin permisos. Resultado: zoom=2, devicePixelRatio=2, viewport lógico=720 y scrollWidth=720 con ventana de 1440; font-size raíz sigue 16px. No se sustituye zoom por CSS. La extensión no forma parte del producto ni se añadió al perfil del usuario. |
| Accesibilidad automática | C8 a cuatro anchos, teclado/detalle y zoom: cero violaciones axe detectadas. Las capturas incluyen resultados; no es certificación ni lectura hablada real. |
| Android | Dependencias y almacenamiento necesario revisados; sesión conservada y Privacidad v0.2 abierta en el A54 con el APK final. Sin banner, categorías opcionales ni analítica nueva. |

**React 397/397**; dos pruebas nuevas verifican información sin consentimiento ficticio, ausencia de escrituras de almacenamiento/API y navegación a Privacidad. Tras el último ajuste de distribución del enlace del pie, **7/7** de los consumidores directos. Tipos, lint, contratos y build aprobados. **Flutter 213/213** y análisis sin incidencias. No se cambiaron expectativas de sesión/permisos para ocultar errores; las actualizaciones editoriales reflejan el nuevo enlace, versión y último párrafo legal.

## Textos legales y dependencias pendientes

Se añadió `web/src/legal/cookies.md` y se actualizó Privacidad a **v0.2 · 31-10-2026**, compartida mediante el enlace de assets Android existente. Se describen tecnologías, responsables técnicos, duración, controles y límites; el borrador y la necesidad de revisión profesional permanecen visibles.

La fecha prevista de entrada en vigor de la Ley 21.719 es **1 de diciembre de 2026**, según el [texto publicado en BCN](https://www.bcn.cl/leychile/Navegar/imprimir?idNorma=1209272). Se considera también la Ley 19.628 aplicable al corte de la auditoría. Existe una [propuesta gubernamental de aplazamiento](https://www.economia.gob.cl/2026/09/01/gobierno-propone-ampliar-plazo-para-implementar-nueva-ley-de-proteccion-de-datos-y-institucionalidad.htm); una propuesta no se trata como una modificación ya vigente. Deben comprobarse cambios normativos y revisar profesionalmente textos, responsable, bases jurídicas y tratamiento de datos de apoderados/menores antes de producción. El panel no certifica cumplimiento integral.

Pendientes explícitos: lectura hablada con lector de pantalla/TalkBack, verificación real del entorno HTTPS productivo y revisión jurídica. No se agregan bloqueos a la navegación ni se declara esos pendientes aceptados por el usuario. Las futuras integraciones opcionales requieren implementación y validación propias; no están autorizadas ni activadas por este trabajo.

Sin cambios de Django, contratos, infraestructura, datos de negocio, frameworks o dependencias. Las únicas escrituras autenticadas del ensayo web fueron el inicio y cierre de sesión expresamente solicitados; no se enviaron formularios de negocio. Sin commit, push, merge o deploy.
