# T12 · Coherencia integral Android: conductor y apoderado

Fecha: 29-10-2026. Rama: `task/12-plan-capabilities`.
Revisión académica: 04-11-2026. Aceptación humana pendiente.

## Diagnóstico previo a implementar

Contrastados `docs/design/task12-product-prototype/`, `CORRESPONDENCIA.md`,
`TASK12_DRIVER_IMPLEMENTATION.md`, el diseño `.21st`, las capturas históricas y los
widgets y pruebas actuales. El HTML acredita intención, no ejecución Android.
La autorización actual amplía los lotes históricos al apoderado Flutter.
Ayuda web aprobada queda fuera del lote y no se rediseña.

| Perfil / pantalla | Completo al retomar | Brecha a completar |
| --- | --- | --- |
| Conductor · Hoy | Ruta, horario, estado de servidor, acción, recuperación incierta, otros recorridos | Singular/plural de capacidad y aviso de datos sintéticos |
| Conductor · Información del recorrido | Destino, fecha, estado, capacidad, pasajeros, mapas externo sin GPS | Impedir navegación externa con cuentas de ensayo; regreso coherente |
| Conductor · Pasajeros | Manifiesto, búsqueda normalizada, recogida, contacto desplegable, páginas de 10 | Eliminar «Página 1 de 1», separar usados/disponibles y dar salida a búsqueda vacía |
| Conductor · Mi plan | Capacidades reales, estado y beneficios, detalles desplegables | Vencimiento único, beneficios principales antes de detalles; no repetir fechas |
| Ambos · Ayuda | Entrada de guías/solicitudes; artículo, formulario, hilo, permisos y privacidad | Guías con búsqueda y tema bajo demanda, evitar categorías acumuladas, contador sin página innecesaria |
| Ambos · Cuenta | Identidad, cierre y legales; edición del nombre solo apoderado | Quitar regreso duplicado conductor y unificar composición y espacio |
| Ambos · Legales | Lector local, borrador identificado, Atrás y aislamiento por sesión | Revisar escala grande y recuperación accesible |
| Apoderado · Buscar/resultados | Filtro de comuna, catálogo, actualización, selección de hasta tres | Resumen de resultados y acción de comuna más clara; recuperación vacía |
| Apoderado · Comparación/detalle | Rutas/cupos/fechas públicos, reseñas demo, detalles bajo demanda | Capacidad coherente con conductor, avisos sintéticos, revisión responsive |
| Apoderado · Contacto | Revalidación, correo concreto, consentimiento, incierto y duplicado | Conservar y verificar flujo completo, teclado y errores |
| Apoderado · Solicitudes/detalle | Estados reales, correo solo tras aceptación, actualización/cancelación existentes | Resumen de pendientes, contexto de cada estado, sin ocultar pocos registros |
| Apoderado · Navegación/Ayuda | Tres destinos persistentes; Ayuda por icono de cabecera | Ayuda como destino visible y seleccionado; regreso conserva contexto |

## Cierre y evidencia

Lote implementado y verificado con el motor Flutter. Aceptación humana pendiente.
Los resultados siguientes pertenecen a esta ejecución; las imágenes de widgets
no son capturas Samsung.

## Matriz final por pantalla

«Implementado» significa widgets operativos y comprobación automatizada; ninguna
fila declara aceptación humana ni ejecución física en Samsung. Las imágenes de
[la galería](evidence/task12-flutter-integral/native/gallery.html) usan widgets
Flutter reales, Roboto/Material y transportes sintéticos de solo lectura.

| Perfil / pantalla | Resumen → acción → detalles | Estados y operaciones conservados | Evidencia / aceptación pendiente |
| --- | --- | --- | --- |
| Conductor · Hoy | Fecha del servidor, ruta/hora/estado, acción existente; pasajeros y otras rutas a continuación | Planificado/en curso/finalizado, vacío, error, resultado incierto, pendientes anteriores y consulta antes de repetir | Captura Hoy; probar lectura/Atrás en Samsung sin iniciar ni finalizar |
| Conductor · Información del recorrido | Destino, horario, fecha, estado/cupos y acceso al manifiesto | Mapas externo existente sin GPS para datos reales; botón deshabilitado y explicación en cuentas de ensayo | Captura recorrido; no abrir mapas ni realizar viajes reales en aceptación |
| Conductor · Pasajeros | Ocupados/disponibles, búsqueda, recogida; contacto desplegable | Búsqueda normalizada, limpiar búsqueda, contactos cerrados al cambiar consulta/página/ruta; páginas solo cuando hay más de diez | Captura pasajeros; TalkBack y teclado Samsung pendientes |
| Conductor · Navegación secundaria | Hoy / Mi plan / Ayuda; Cuenta en cabecera | Pasajeros desde detalle regresa al detalle, luego Hoy; cuenta preserva contexto; identidad nueva limpia información privada | Pruebas de Atrás, sesión y respuesta tardía |
| Conductor · Mi plan | Nombre, estado y vencimiento único; tres beneficios principales; más beneficios y condiciones desplegables | Básico/Pro/Elite/sin plan/suspendido/vencido/futuro, permisos efectivos y fechas del servidor | Captura plan; sin contratación, cobros, renovaciones, reportes ni Excel móvil |
| Ambos · Ayuda | Guías o solicitudes; asistente existente solo si está autorizado | Entrada por tarea, disponibilidad y privacidad bajo demanda | Capturas Ayuda por rol; Ayuda web no se modifica |
| Ambos · Guías / artículo | Buscar una guía, filtro de tema desplegable, abrir un artículo | Solo contenido permitido para el rol; búsqueda sin tildes, vacío recuperable, regreso conserva consulta | Capturas guías/artículo; no se sustituye el contenido versionado |
| Ambos · Soporte / formulario / hilo | Bandeja, crear o abrir solicitud, última conversación y respuesta; metadatos a consulta | Paginación de servidor preservada; una solicitud sin «Página 1»; gravedad, privacidad explícita, permisos, conflictos, resultado incierto y sesión | Capturas bandeja/formulario/hilo; en Samsung no enviar ni responder |
| Ambos · Cuenta | Rol, nombre, correo, cierre y legales; edición del nombre solo apoderado | Identidad autenticada; formularios y vista previa se conservan al consultar Cuenta y volver | Capturas Cuenta; misma composición, sin menú ni regreso duplicado en el cuerpo |
| Ambos · Privacidad / Términos | Lector local con aviso de borrador y regreso | Activos legales existentes intactos; foco, Android Atrás y cierre ante cambio/caducidad de cuenta | Capturas de ambos documentos y pruebas a 320/390 con texto 200 %; revisión legal sigue pendiente |
| Apoderado · Buscar / comuna / resultados | Comuna, cantidad de resultados, identidad/cobertura y «Ver servicio»; datos del recorrido después | Filtro del servidor, actualización, vacío con regreso al catálogo completo, sin convertir error en cero resultados | Capturas buscar/comuna/vacío/error; controles primarios accesibles antes de información extensa |
| Apoderado · Comparación | Dos o tres servicios, mismos datos públicos y fecha/cupos; abrir detalle o quitar | Máximo tres, revalidación del servidor, servicio no disponible retira datos obsoletos | Captura comparación; no hay reservas ni contacto en el comparador |
| Apoderado · Servicio | Identidad/cobertura/cupos y solicitud de contacto; cobertura completa, descripción, validación y reseñas desplegables | Cupos ocupados y disponibles diferenciados por fecha; reseñas demo identificadas; validación no equivale a garantía | Captura servicio y pruebas de elegibilidad |
| Apoderado · Solicitar contacto | Servicio destinatario y correo exacto; mensaje, consentimiento y envío; privacidad ampliable | Revalida servicio antes del formulario, CSRF, consentimiento, duplicados, envío incierto sin repetición automática | Capturas contacto y acción; pruebas con teclado y regresión de escrituras sintéticas; sin envíos reales |
| Apoderado · Solicitudes / detalle | Pendientes y total; estado, servicio y fecha; mensaje bajo demanda | Hasta diez registros sin «Ver anteriores» innecesario; pendiente/aceptada/rechazada/cancelada; correo del servicio solo tras aceptación | Capturas de los cuatro estados, bandeja vacía y pruebas de privacidad; no cancelar solicitudes en Samsung |
| Apoderado · Navegación | Buscar / Solicitudes / Ayuda; Cuenta en cabecera, igual patrón del conductor | Ayuda tiene selección visible; Cuenta conserva el borrador de soporte; Atrás cierra la vista activa y legales vuelve a Cuenta | Pruebas integrales a 320/360/390/412 px y paisaje 844×390; texto hasta 200 % |

La capacidad siempre procede de la respuesta de API y no de la cantidad de filas
filtradas. Ambos roles usan el mismo medidor de ocupación y una única descripción
semántica; el singular «1 disponible» evita el texto defectuoso «1 disponibles».
No se representan asientos físicos.

Las cuentas con correo reservado `.test`, el modo demo existente o una compilación
con `FURGOPLUS_SYNTHETIC_DATA=true` se identifican como ensayo. Se bloquea tanto el
botón como su callback de mapas. No se deduce que una dirección sea real por su
apariencia, ni se consulta geolocalización. El flag identifica datos sintéticos;
no concede permisos ni sustituye la autorización del servidor. Con datos sintéticos
y correos fuera de `.test`, el operador debe activar el flag en la compilación.

## Aceptación Samsung A54 · pendiente, solo lectura

Generar una compilación nueva `.task12` contra el origen **aislado ya acordado**.
El APK histórico no acredita esta entrega. No ejecutar preparación de datos,
servicios de backend, migraciones, cambios de permisos ni comandos del homelab.

```bash
cd mobile
flutter pub get --offline
flutter analyze --no-pub
flutter test --no-pub --concurrency=1
# TASK12_API_BASE_URL debe apuntar al entorno aislado de revisión.
flutter build apk --debug --no-pub \
  --dart-define=API_BASE_URL="$TASK12_API_BASE_URL" \
  --dart-define=FURGOPLUS_SYNTHETIC_DATA=true
```

Si ese origen aislado usa HTTP de desarrollo, conservar su configuración autorizada
`ALLOW_HTTP_API=true`. Nunca cambiar validación de certificados. La instalación y
la aceptación física corresponden a una sesión humana posterior; esta ejecución
no instala ni reemplaza aplicaciones.

1. Registrar fecha, APK/hash, identificador `com.example.furgoplus.task12`, modelo,
   Android/One UI, tamaño y escala de fuente/pantalla. Repetir en retrato, paisaje,
   texto normal y máximo accesible; revisar también un Android pequeño si existe.
2. Conductor: Hoy → información → pasajeros. Leer horario, fecha y cupos. Buscar un
   nombre recibido y otro inexistente; limpiar. Desplegar contacto, cambiar búsqueda
   y volver: contacto cerrado. Desde información, Atrás de pasajeros vuelve al
   detalle, luego Hoy. **No tocar Iniciar, Finalizar ni recuperación de servicios.**
3. Mi plan: leer nombre/estado/vencimiento una sola vez. Abrir Más beneficios y
   Detalles; comprobar estados ya existentes sin editar suscripciones. Abrir Ayuda
   desde la barra y volver conservando la ruta seleccionada.
4. Ayuda de ambos roles: buscar una guía con/sin tilde, filtrar tema, leer artículo
   y volver. Abrir bandeja y formulario vacío; desplegar privacidad y mostrar teclado.
   No enviar, responder ni cambiar solicitudes. Consultar Cuenta y volver con Atrás;
   el borrador queda en la misma sesión. Salir a otro destino limpia su contexto.
5. Apoderado: elegir comuna, ver resultados, comparar dos o tres, abrir servicio,
   revisar fecha/cupos y detalles, abrir contacto. Leer servicio y correo, comprobar
   consentimiento desmarcado inicialmente y botón deshabilitado; mostrar teclado
   sin enviar. Volver. Las ubicaciones de ensayo no deben abrir navegación real.
6. Solicitudes: consultar registros existentes de cada estado, abrir mensaje y
   actualizar. Correo del servicio únicamente si está aceptada. **No cancelar**.
   Si no existen vacíos/errores en ese entorno, registrar «no observado»; no alterar
   datos para fabricar estados. Consultar los ejemplos automatizados de esta entrega.
7. Cuenta: nombre/correo, formulario de nombre sin guardar, Atrás, Privacidad y
   Términos. Los documentos muestran aviso de borrador; Atrás regresa a Cuenta.
   Cerrar sesión y entrar con otra cuenta autorizada; no debe quedar información
   de la cuenta anterior. No guardar nombre durante esta aceptación de solo lectura.
8. TalkBack: orden de lectura, nombre/rol de botones, estado textual, cupos sin
   doble anuncio, controles de al menos 48 dp y foco al volver del lector legal.
   Con teclado, toda acción debe alcanzarse desplazando y la barra seguir visible.
   Capturar cualquier recorte o desbordamiento, incluidos errores y formularios.

Registrar por fila **APROBADA / RECHAZADA / NO OBSERVADA**, PNG del dispositivo,
paso reproducible y observación. Si falla una pantalla, la aceptación global sigue
pendiente. No confundir aprobación automática con la decisión humana.

## Diferencias justificadas y pendientes

- El prototipo es HTML. Se conserva Material 3, las rutas internas actuales, el
  modelo de sesión y las operaciones de la API; no se importan `data.js` ni sus
  fechas, personas o estados a producción.
- El conductor conserva las páginas de diez pasajeros y la recuperación existente
  de recorridos anteriores. No se agregan edición de rutas, asignación de asientos
  físicos, asistencia, pagos, GPS ni reportes móviles.
- Cuenta del apoderado pasa a la cabecera: permite tres destinos inferiores legibles
  con texto ampliado. Abrir Cuenta conserva el contexto de la tarea y el borrador
  de Ayuda; no agrega administración comercial de perfiles.
- Se mantienen límites y paginación reales de soporte. La búsqueda de guías es
  local sobre los artículos ya recibidos y autorizados para el rol.
- El asistente existente permanece detrás de los mismos permisos. No se modifica
  su lógica, integración, contenido o alcance de Task 14.
- Legales conserva los borradores existentes. Esta entrega no concede aprobación
  legal de producción ni modifica documentos.
- APK actualizado, instalación, IME real, barras del sistema Android, TalkBack,
  gestos, plugins y aceptación humana Samsung siguen pendientes. Las capturas de
  widgets no acreditan esos puntos.


## Resultado técnico final

| Verificación | Resultado de esta ejecución |
| --- | --- |
| `flutter analyze --no-pub` | Sin observaciones |
| Formato Dart `lib test tool` | Sin cambios pendientes |
| Regresión con motor Flutter / ejecutor sin sockets | **198/198**, diez archivos; incluye trece casos nuevos y la regresión anterior |
| `flutter test --no-pub --concurrency=1` | Bloqueado al iniciar servidor localhost; `Operation not permitted` |
| Bundle Dart/recursos de `lib/main.dart` | Compila con API de ejemplo y marca sintética; sin conexión a backend |
| Revisión visual de widgets | **55 PNG**, 390×844 al 100 % y 320×844 al 200 %, más estados vacíos/error y de solicitudes |
| Contratos aplicables | `npm run contract:check --prefix web` aprobado; datos de ocupación ya presentes en `DISCOVERY_ROUTE` |
| `git diff --check` | Aprobado |
| APK debug | Bloqueado antes de compilar por servicio de sockets/IP de Gradle |
| ADB / Samsung | Listener no permitido; no se inspeccionó ni instaló un dispositivo |
| Revisor 21st | Cero archivos Dart reconocidos: **no** acredita revisión Flutter |

Logs, reproducción y alcance de cada verificación:
[evidencia nueva](evidence/task12-flutter-integral/README.md).
La revisión visual corrigió cuatro destinos inferiores que partían «Solicitudes»
al ampliar texto, títulos demasiado largos en Ayuda y el aviso de privacidad del
contacto que truncaba su contenido. Los controles vuelven a tener espacio y el
aviso se presenta como texto que puede desplazarse completo.

Los hashes de preservación se comparan con el árbol de trabajo recibido, incluidos
sus cambios previos sin commit. Backend, React, prototipo, `.21st`, infraestructura,
contratos y dependencias permanecen iguales. Los archivos generados por el SDK son
metadatos locales de compilación; se restaura `android/local.properties` y las
referencias locales al SDK/caché originales al cerrar.
No se realizaron conexiones HTTP al entorno académico, cambios de datos, recorridos
reales, operaciones en homelab/r4 ni cambios de Task 13/14. Sin commit, push, merge,
deploy ni instalación. El lote se detiene para aceptación humana.
