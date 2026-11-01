# Task 12 — revisión integral visual Flutter para revisión humana

25-10-2026. Revisión académica: 04-11-2026; entrega: 05-11-2026.
La última aceptación humana sigue **RECHAZADA**. Esta revisión de implementación
queda pendiente de evaluación en Samsung A54 real. Ningún test ni PNG sintético
constituye aprobación UX/UI. Detenerse aquí para revisión humana.

## Resultado de la revisión

Se inspeccionó el tema Flutter y las pantallas existentes antes de definir la
[guía reutilizable](TASK12_FLUTTER_DESIGN_SYSTEM.md). La base anterior empleaba
18 px tanto para párrafos como para muchas etiquetas, con poco contraste entre
niveles de contenido. Mi plan imprimía diez permisos con restricciones técnicas;
Cuenta era un diálogo genérico; el apoderado perdía su navegación al abrir Ayuda.

Esta continuación cambia únicamente presentación y contención de navegación en
Flutter. Se mantienen endpoints, reglas de autorización, cookie segura, CSRF,
validación, limpieza entre sesiones y operaciones existentes.

| Pantalla | Decisión y comportamiento |
| --- | --- |
| Inicio de sesión | Logo con espacio reservado, título, una bienvenida breve y campos. Acción principal inmediata, registro de familias separado, enlaces legales secundarios de 14 px. Sin introducción sobre arquitectura o disponibilidad. Validación, autocompletado, contraseña, modo demo y creación real se conservan. Se oculta el banner de depuración visual. |
| Hoy | Cabecera, fecha del servicio y resumen operativo. Vacío compacto alineado arriba con «Consultar guías» como única acción principal. Indicaciones sobre configuración web bajo demanda. Se conservan iniciar/finalizar, confirmación de cierre, recuperar servicios anteriores, pasajeros, capacidad, selección de ruta y mapas. |
| Mi plan | Nombre y estado, inicio/término de vigencia y beneficios útiles agrupados. Sin plan, Básico, Pro y Elite usan la misma composición. Los beneficios visibles salen de capacidades efectivas e implementadas; no se conceden por el nombre del plan. Hasta cinco grupos en Elite, sin inventario de permisos deshabilitados. Prioridad, fechas con hora exacta, consulta y gestión bajo «Detalles del plan». No hay contratación, cobro ni renovación móvil. |
| Ayuda | Tres accesos con icono, nombre breve y propósito: guías por tema, solicitudes y asistente solo si está autorizado. Temas filtrables existentes, guías por rol y flujo simple de solicitud. Disponibilidad y privacidad se consultan bajo demanda. Al escribir se mantiene una indicación breve, el aviso completo desplegable y la revisión explícita obligatoria antes de enviar. |
| Cuenta | Identidad, correo y rol primero; salida secundaria con icono reconocible. El conductor abre una vista dentro del mismo contenedor, con barra inferior y Android Atrás. Consultarla conserva el borrador de soporte y el estado de Hoy; cerrar sesión o sustituir cuenta los elimina. El apoderado conserva su cuenta, edición de nombre y salida existentes. |

La barra del conductor sigue en Hoy / Mi plan / Ayuda; la del apoderado sigue en
Buscar / Solicitudes / Mi cuenta. Ayuda del apoderado ahora se presenta dentro de
su contenedor y conserva la barra, también sobre el teclado. Cambiar de destino
lo descarta. No se añaden destinos, rutas ni servicios.

Los documentos legales siguen en su lector modal existente. Android Atrás cierra
solo el documento, sin cambiar la pantalla que había debajo. No se modificó el
contenido legal. Los estados de error y éxito tienen mensajes compartidos; la
carga sigue anunciándose. La falta de datos usa información neutral, sin una
advertencia desproporcionada. Los estados restringidos no muestran beneficios
que el servidor haya revocado.

## Archivos de esta continuación

- `mobile/lib/furgo_theme.dart`: roles de color, escala tipográfica, controles,
  superficies y navegación Material 3.
- `mobile/lib/furgo_widgets.dart` (nuevo): superficie, mensaje y estado compartidos.
- `mobile/lib/auth_app.dart`: formulario resumido y logo estable.
- `mobile/lib/driver_home.dart`: Hoy, Cuenta integrada y conservación del contexto.
- `mobile/lib/plan_help_screen.dart`: resumen de plan, accesos de ayuda y detalles.
- `mobile/lib/plan_help_service.dart`: solo una frase de restricción más natural;
  no cambian solicitudes, interpretación de permisos ni contratos.
- `mobile/lib/parent_home.dart`: Ayuda integrada y barra accesible con teclado.
- `mobile/lib/parent_presentation.dart`: utiliza el tema común para ambos roles.
- `mobile/lib/legal_access.dart`: enlaces de menor énfasis y propiedad del botón
  Atrás mientras se consulta un documento.
- `mobile/test/visual_experience_test.dart` (nuevo): pruebas focalizadas de esta
  revisión; adaptación de `driver_home_test.dart`, `legal_access_test.dart`,
  `plan_help_test.dart` y `session_test.dart` a los accesos y textos finales.
- `mobile/tool/test_without_sockets.dart`: incluye la nueva suite en el ejecutor
  existente. `mobile/tool/visual_preview.dart` (nuevo): vistas sintéticas con fuentes
  Roboto e iconos del SDK, sin llamadas de red ni datos de personas reales.
- `mobile/README.md`, esta revisión, guía de diseño y evidencias visuales/técnicas.

## Validación

Flutter 3.47.2, Dart 3.13.2, sin paquetes nuevos. Las 166 pruebas incluyen las
152 previas y 14 nuevas; no se suman repeticiones. El ejecutor alternativo usa
interfaces internas de `test_api` y no sustituye el runner convencional.

Los resultados finales y los comandos reproducibles están en
[evidencias de esta revisión](evidence/task12-flutter-visual/README.md).

| Comprobación | Resultado actual |
| --- | --- |
| Formato Dart | 26 archivos; sin cambios pendientes |
| `flutter analyze --no-pub` | Aprobado, sin observaciones |
| Suite con motor Flutter y ejecutor existente sin sockets | **166/166**, ocho archivos de pruebas, cero fallos |
| `flutter test --no-pub --concurrency=1` | Bloqueado al cargar los ocho archivos por socket `127.0.0.1`: `Operation not permitted`. No se declara aprobado. |
| Bundle debug de `lib/main.dart` | Aprobado, compilación Dart y recursos con origen de ejemplo, sin conectar a un servidor |
| APK Android debug | Gradle bloqueado antes de compilar: `FileLockContentionHandler`, `Could not determine a usable wildcard IP for this machine` |
| Vistas con fuentes reales | 16 PNG sintéticos generados e inspeccionados; no equivalen a aceptación en teléfono |
| `git diff --check` y conservación de alcance | Aprobados |

Cobertura focalizada nueva: formulario de acceso y errores antes de red; vacío de
Hoy con una acción real; sin plan; vigencia futura, vencida y suspendida; privacidad
bajo demanda y revisión obligatoria; Cuenta sin diálogo y con retorno a Hoy;
borrador de soporte conservado al consultar Cuenta; sesión restaurada tras recrear
la app sin borradores ni selección anterior; navegación del apoderado con teclado;
y acceso, plan, ayuda y cuenta con texto al 200 % en 320 y 390 px. Se mantienen los
casos anteriores de Básico/Pro/Elite, recorrido preparado/en curso/completado,
fallos, confirmaciones, permisos revocados y aislamiento de cuentas. También se
verifican pares de color con contraste mínimo 4,5:1 y áreas táctiles focalizadas.

Las vistas sintéticas se generaron con el motor Flutter, tamaño lógico 390 × 844,
fuentes reales del SDK y datos de ensayo. Se revisaron las cinco pantallas al
100 % y al 200 %, los tres estados de Hoy y plan sin asignación/Básico/Pro/Elite.
La inspección detectó y corrigió el centrado vertical involuntario de Hoy vacío.
Son revisiones de composición: no verifican TalkBack, teclado Android, fuente
Samsung, gestos, instalación, funcionamiento de plugins ni aceptación táctil.

No se produjo ni instaló un APK nuevo. El APK anterior se conservó sin cambios.
Fuera del entorno restringido, recompilar para la revisión con una URL existente
del entorno aislado, suministrada por el operador:

```bash
cd mobile
flutter analyze --no-pub
flutter test --no-pub --concurrency=1
# TASK12_API_BASE_URL debe contener el origen de pruebas aislado acordado.
flutter build apk --debug --no-pub --dart-define=API_BASE_URL="$TASK12_API_BASE_URL"
```

La configuración Android permanece intacta y mantiene `.task12`. El bundle de
esta sesión usa `https://api.example.test` únicamente para comprobar compilación;
no es un origen operativo ni un APK para el teléfono.

## Guion de aceptación — Samsung A54 real

Preparación: compilar esta revisión con el origen de pruebas aislado acordado,
verificar `com.example.furgoplus.task12` y registrar versión, SHA-256 del APK,
tamaño de fuente/pantalla, fecha y cuenta sintética. No usar el APK antiguo como
evidencia de esta revisión. Repetir con fuente normal, fuente grande del sistema
y TalkBack; combinar también tamaño de pantalla grande. No tocar r4.

1. **Inicio de sesión.** Abrir sin sesión: reconocer marca, campos y acción sin
   leer párrafos. Probar campos vacíos, contraseña visible/oculta, credenciales
   incorrectas, teclado, registro de familia y su retorno. Verificar modo demo
   cuando corresponda. Cerrar/reabrir con sesión válida: volver al rol correcto.
2. **Hoy.** Sin recorridos: entender el estado y abrir Ayuda desde esa acción y elegir Guías por tema.
   Con datos reales del entorno aislado: recorrer preparado → en curso →
   finalizado, confirmar/cancelar cierre y revisar pasajeros/capacidad/destino.
   Probar selección de otro recorrido y recuperación de uno anterior. Cambiar
   entre destinos y regresar: conservar el seleccionado. Probar carga, error y
   recuperación sin repetir operaciones. No registrar servicios inventados.
3. **Mi plan.** Revisar cuatro cuentas: sin plan, Básico, Pro y Elite. Identificar
   nombre, estado y vigencia de inmediato; comprobar que cada beneficio coincide
   con el acceso efectivo. En Elite, reportes/Excel se describen como web y no
   simulan una acción móvil. Abrir/cerrar detalles. Revisar además vigencia
   futura, vencida y suspendida con cuentas ya preparadas del entorno de pruebas.
4. **Ayuda.** Tanto conductor como apoderado: elegir un tema, leer una guía y
   volver; abrir solicitudes, crear un borrador, cancelar y confirmar uno de
   ensayo. Comprobar revisión de privacidad y que cambiar texto la desmarca.
   Verificar que el asistente aparece solo en cuentas autorizadas y que su
   derivación abre un formulario vacío. Consultar condiciones bajo demanda.
   Mantener la barra visible en guías/formularios, con teclado y texto grande.
5. **Cuenta.** Reconocer nombre, correo y rol. En conductor: abrir desde un
   borrador, volver con Android Atrás y conservarlo. Abrir un documento legal y
   cerrarlo sin abandonar Cuenta. Cerrar sesión, entrar con otro conductor y luego
   un apoderado: ausencia total de datos y borradores anteriores. Verificar que
   salida y enlaces se alcanzan con TalkBack y desplazamiento.

Criterio transversal: etiquetas completas y legibles, sin solapamientos ni
recortes, orden de lectura lógico, foco visible/alcanzable, controles de al menos
48 dp, estado comprensible sin depender del color y una acción principal clara.
Registrar por cada pantalla **APROBADA / RECHAZADA**, captura del dispositivo,
observación y paso reproducible. Si falla una pantalla, la aceptación global sigue
rechazada. Esta sesión no modifica la decisión humana.

## Conservación y límites

Se compararon los archivos existentes con SHA-256 al iniciar esta continuación.
Los cambios previos de backend, React, configuración Android, adaptador de sesión,
controlador de autenticación, dependencias y documentación histórica se conservan.
Detalle en `preservation.json` dentro de evidencias. No se modificaron Django,
PostgreSQL, contratos, API, bases, homelab, Cloudflare ni r4. No hubo instalación,
commit, push, merge, deploy, T12.11 ni landing.
