# T12.10 — Integración Flutter de planes, ayuda y soporte

> Informe histórico del 20-10. El usuario confirmó posteriormente el funcionamiento
> en Samsung A54 y rechazó la UX. La navegación de cabecera descrita aquí se
> reemplazó el 25-10 por Hoy / Mi plan / Ayuda persistentes. Estado, validación
> actual y guion breve: [revisión de navegación](TASK12_FLUTTER_NAVIGATION_REVIEW.md).
> Las limitaciones y resultados de este informe corresponden a su ejecución original.

Fecha: 20-10-2026. Rama: `task/12-plan-capabilities`.
Autorización expresa del usuario para T12.10. Pendiente de revisión humana.
No se continúa a T12.11. Sin commit, push, merge, despliegue ni instalación.

## Resultado y alcance

- Conductor: menú de cabecera **Plan y ayuda** → **Mi plan** o **Ayuda y soporte**.
  El plan se consulta en `GET /api/v1/driver/capabilities/`, sin propietario ni filtros.
  Se muestran etiqueta comercial, vigencia efectiva, motivos comprensibles y prioridad
  de atención. Vigencia, fechas y beneficios están bajo desplegables. Nunca se usa
  `included_in_plan` como autorización; se exigen `implemented` y `enabled`.
- Apoderado: icono **Ayuda y soporte** en la cabecera, conservando Buscar,
  Solicitudes y Mi cuenta. No consulta el endpoint exclusivo de conductores.
- Centro de Ayuda: contenido versionado de `GET /api/v1/help/`, filtrado también
  defensivamente por rol; temas seleccionables y lectura de una guía a la vez.
  Se indica que configuración, validación y reportes se gestionan en la web.
- Soporte: listado propio paginado en grupos de diez, estados en español,
  gravedad, prioridad efectiva, fechas, autoría e historial desplegable.
  Formulario solo después de consultar exitosamente el endpoint autorizado.
  Crear requiere revisión explícita; editar asunto/cuerpo reinicia la confirmación.
  Responder utiliza la versión del servidor, reinicia confirmación y permite
  reabrir resueltas según la respuesta de Django. Cerradas son solo lectura.
- Asistente: se ofrece únicamente a conductores cuando coinciden los modos efectivos
  de Ayuda y las capacidades efectivas. Pro permite FAQ; Elite permite además activar
  contexto. El contexto solo se renderiza con ese modo autorizado. La respuesta enlaza
  su guía y versión; no se presenta como atención humana ni ejecuta cambios.
  **Preparar solicitud de soporte** comprueba acceso y abre un formulario vacío:
  nunca copia preguntas/respuestas ni crea tickets automáticamente.
- Las pantallas operativas conservan su estado al entrar/salir de ayuda. No se
  agregan contratación, cobros, renovación, exportaciones ni reportes móviles.
  Los beneficios de reportes/Excel se identifican expresamente como disponibles
  **en la web**, según sus capacidades. No se prometen funciones pendientes.

## Permisos de apoderados

No hay brecha de autorización para las solicitudes propias en el backend revisado:
`drivers/support.py:authorize` admite apoderados y `support_api.py:SupportView.scope`
filtra por usuario autenticado. `HelpView` entrega guías de su rol y ningún modo
comercial de asistente. Flutter utiliza esos contratos existentes, sin cambios de
permisos. Una denegación real 403 impide ofrecer el formulario y borra los datos
retenidos; no se sustituye por un flujo local ni por un endpoint administrativo.

## Sesión, conectividad y privacidad

Se reutilizan `NativeSessionApi`, cookies de sesión y almacenamiento seguro existentes,
CSRF, origen autorizado y rechazo de redirecciones. No se incorporan paquetes ni
almacenamiento de planes, tickets, preguntas, respuestas o borradores.

La versión de sesión y el rol se comprueban antes de aplicar cada respuesta. Cambiar
cuenta/rol, restaurar o cerrar sesión desmonta la pantalla y borra el estado privado.
Las respuestas obsoletas no pueden repoblar la UI ni caducar una cuenta nueva.
Un `not_authenticated` vuelve al ingreso existente mediante `AuthController.expire`.

Las capacidades se revisan al entrar, al volver desde segundo plano, cada treinta
segundos visibles, al alcanzar el fin informado por el servidor y al actualizar
manualmente. Salir de primer plano elimina capacidades/contexto visibles e invalida
resultados pendientes; no se refresca en segundo plano. Cada acción conserva la
validación definitiva de Django. No existe garantía de revocación instantánea entre
consultas; un POST rechazado retira los datos y modos que estaban habilitados.

Las solicitudes de esta integración usan un límite de veinte segundos **por petición
HTTP**, incluyendo el bootstrap CSRF. Es opcional en el adaptador: las llamadas
anteriores conservan su comportamiento. El límite se aplica antes de procesar una
respuesta, para impedir cookies tardías y evitar que un bootstrap vencido continúe
hacia un POST. No se reintentan escrituras automáticamente.

Un envío sin confirmación queda bloqueado hasta consultar solicitudes/historial.
Esto incluye tiempo agotado, pérdida de conexión, fallo de servidor o interrupción
por segundo plano. Un 409 exige refrescar la versión. El cliente no puede cancelar
una escritura que ya haya llegado a Django ni garantizar idempotencia frente a un
reenvío manual posterior: se debe comprobar el historial antes de volver a escribir.

Fechas en formato día/mes/año y hora, con la etiqueta **hora del dispositivo**.
El sistema operativo resuelve zona y horario de verano; no se fija un desfase UTC
chileno ni se utiliza el reloj del teléfono para conceder permisos.

## Archivos de T12.10

| Archivo | Cambio |
| --- | --- |
| `mobile/lib/plan_help_service.dart` | Cliente de los contratos existentes y traducciones de estados/restricciones. |
| `mobile/lib/plan_help_screen.dart` | Plan, ayuda por temas, soporte propio y asistente efectivo; navegación local vinculada a sesión. |
| `mobile/lib/driver_home.dart` | Acceso desde cabecera; conserva Hoy y operaciones. |
| `mobile/lib/parent_home.dart` | Acceso desde cabecera; conserva navegación del apoderado. |
| `mobile/lib/session_api.dart` | Timeout opcional de transporte propagado a CSRF; mantiene aislamiento por generación. |
| `mobile/test/plan_help_test.dart` | Casos nuevos con identidades, textos, transportes y fechas sintéticos. |
| `mobile/tool/test_without_sockets.dart` | Ejecutor alternativo reproducible de los siete archivos de pruebas, sin canal de red. |
| `mobile/README.md` | Accesos nuevos, alcance y referencia a este informe. |
| `docs/PLAN_CAPABILITIES_SPEC.md` | Estado actual y autorización de T12.10; conserva evidencia anterior. |
| `docs/TASK12_FLUTTER_VALIDATION.md` | Esta entrega, pruebas, límites y aceptación móvil. |

El árbol ya contenía modificaciones sin commit de Django y React. No se editaron esos
archivos, sus pruebas ni sus informes previos. Las 285/285 pruebas React corresponden
a la evidencia previa comunicada por el usuario; no se atribuyen a esta ejecución.
No se modificaron infraestructura, r4, bases existentes ni dispositivos.

## Validación ejecutada

Flutter 3.47.2, Dart 3.13.2. SDK y caché Pub copiados a `/tmp` para respetar el sistema
de archivos restringido. Dependencias resueltas con `flutter pub get --offline`, sin
cambios de `pubspec.yaml` ni lockfile. Se desactivó telemetría mediante
`FLUTTER_SUPPRESS_ANALYTICS=true` y `DASH__SUPPRESS_ANALYTICS=true`.
Los primeros intentos encontraron escritura prohibida de telemetría/caché; se
corrigió el entorno de ejecución sin modificar la instalación original ni Debian.

Resultados finales:

- `flutter analyze --no-pub`: aprobado, sin observaciones (7,1 s).
- Regresión con motor Flutter y ejecutor sin sockets: **143/143 aprobadas**;
  **115 previas + 28 nuevas**. No se suman repeticiones como casos distintos.
- Formato Dart de `lib`, `test` y `tool`: aprobado tras aplicar el formato del
  nuevo archivo de pruebas; sin cambios semánticos posteriores a la regresión.
- `git diff --check`: aprobado.
- `flutter build bundle --debug --no-pub --target=lib/main.dart
  --dart-define=API_BASE_URL=https://api.example.test`: aprobado. Es compilación
  Dart/recursos de la aplicación, no un APK ni validación de plugins Android.
- `flutter test` estándar y APK: bloqueados por el entorno, detalles más abajo.

Los primeros ensayos del ejecutor alternativo localizaron fallos de búsqueda de
controles fuera de pantalla y mejoras de visibilidad de errores en formularios.
Una regresión intermedia tuvo 139 aprobadas / 141 casos; tras añadir el timeout
seguro, 141 aprobadas / 142 casos. Se corrigieron las búsquedas y se ejecutó la
regresión completa de 142/142. La revisión final añadió un guard y un caso de
sesión vencida con el menú abierto: **143/143** en la última ejecución completa,
sin alterar pruebas operativas anteriores.

El comando estándar `flutter test --no-pub test/plan_help_test.dart` se intentó,
pero no pudo iniciar el dispositivo de pruebas: `Failed to create server socket`,
`Operation not permitted`, `127.0.0.1`. No se declara aprobada una ejecución estándar.

Para ejecutar realmente los casos se usó el mismo motor `flutter_tester`, el binding
`AutomatedTestWidgetsFlutterBinding` y los invocadores de `test_api`, dentro de un
proceso y sin WebSocket. El archivo de herramienta declara todos los tests de los
siete archivos y conserva sus setups, teardowns y aserciones. Esta ruta alternativa
usa interfaces internas de la versión fijada por el lockfile; no sustituye la
necesidad de ejecutar `flutter test` convencional en un entorno que permita sockets.

Comandos reproducibles desde `mobile`, con variables de tarea propias:

```bash
export FLUTTER_SUPPRESS_ANALYTICS=true
export DASH__SUPPRESS_ANALYTICS=true
export PUB_CACHE=/tmp/furgoplus-pub-t12
TASK12_FLUTTER=/tmp/furgoplus-flutter-t12/bin/flutter
TASK12_DART=/tmp/furgoplus-flutter-t12/bin/cache/dart-sdk/bin/dart
TASK12_ENGINE=/tmp/furgoplus-flutter-t12/bin/cache/artifacts/engine/linux-x64/flutter_tester

"$TASK12_FLUTTER" pub get --offline
"$TASK12_FLUTTER" analyze --no-pub
"$TASK12_DART" --suppress-analytics format --output=none --set-exit-if-changed lib test tool
"$TASK12_FLUTTER" build bundle --debug --no-pub --target=tool/test_without_sockets.dart
FLUTTER_TEST=true APP_NAME=furgoplus UNIT_TEST_ASSETS="$PWD/build/flutter_assets" \
  "$TASK12_ENGINE" --disable-vm-service --enable-checked-mode --verify-entry-points \
  --enable-software-rendering --skia-deterministic-rendering --non-interactive \
  --use-test-fonts --disable-asset-fonts \
  --flutter-assets-dir="$PWD/build/flutter_assets" \
  --packages="$PWD/.dart_tool/package_config.json" \
  "$PWD/build/flutter_assets/kernel_blob.bin"
```

También se intentó `flutter build apk --debug --no-pub
--dart-define=API_BASE_URL=https://api.example.test`, con copia aislada de cachés
Gradle. **No produjo APK**: Gradle no pudo crear `FileLockContentionHandler`
(`Could not determine a usable wildcard IP for this machine`). No se instalaron
componentes del sistema ni se intentó resolverlo modificando la red del equipo.

Cobertura nueva: Básico/Pro/Elite, plan suspendido, beneficios no implementados,
rol apoderado, 403, guías por tema, confirmación reiniciada, cancelación sin escritura,
CSRF y origen, historial y cierre, respuesta con versión/reapertura, 409, paginación,
FAQ/contexto y derivación vacía, baja de plan, vencimiento de permiso, revocación,
pérdida de conectividad, reintento de lectura, sesión vencida, reemplazo de identidad,
resultado tardío al pausar, formulario a 360 px con texto al doble/teclado, doble toque,
timeout de escritura, bootstrap CSRF tardío sin POST ni cookies persistidas y
menú de cabecera obsoleto después de caducar la sesión.

## Límites y pendientes

- Pendientes `flutter test` convencional, APK Android y aceptación visual/táctil real.
  Compilar un bundle Dart no valida Gradle, manifiestos combinados, plugins nativos,
  instalación, TalkBack ni el comportamiento real de teclado/red/segundo plano.
- No se ejecutó integración HTTP contra Django ni flujos con un administrador real:
  se verificaron contratos existentes y transportes sintéticos, sin usar bases.
- La aceptación debe usar un entorno aislado con T12.1–T12.9 revisadas y disponibles.
  Esta entrega no habilita los endpoints en r4 ni modifica su demo.
- No hay contratación/pagos automáticos, Excel/reportes móviles, adjuntos, push,
  cola administrativa móvil, operador humano permanente ni funciones comerciales
  pendientes de definición. Reportes y Excel continúan en React.
- La operación y retención de soporte mantienen los pendientes de sus etapas
  anteriores. El asistente sigue siendo de reglas/contenido y no un agente con
  acciones ni un servicio de atención humana.

## Guion de aceptación móvil para revisión humana

Solo datos sintéticos, cuentas de ensayo y una base aislada. No aplicar migraciones
ni cambiar planes en bases existentes. Este guion no autoriza instalar APK, ejecutar
`flutter run` o reemplazar la demo r4 del Samsung: esas acciones requieren autorización
posterior y un dispositivo/emulador de revisión acordado.

1. Conductor Básico: abrir menú → Mi plan. Comprobar nombre, estado, vigencia,
   idioma, prioridad estándar y beneficios desplegables. No debe aparecer asistente,
   contratación ni descarga. Volver a Hoy y verificar recorridos, nómina y acciones.
2. Repetir con Pro y Elite. Pro ofrece FAQ sin selector de contexto; Elite permite
   activarlo. Reportes, detalle, comparación y Excel se señalan como web según plan.
   No deben aparecer promesas de notificaciones, posicionamiento o capacitación.
3. Suspender/vencer la suscripción en el entorno aislado. Volver al primer plano,
   esperar actualización o pulsar Actualizar permisos: retirar asistente y contexto,
   explicar restricción y conservar acceso autorizado a ayuda/soporte y operación.
4. Ayuda: elegir un tema, abrir una guía y volver; revisar contenido correcto por rol,
   lectura sin desbordes, foco, botones, Back de Android y navegación a Hoy/Buscar.
5. Soporte: consultar vacío y crear texto sintético. Enviar debe estar bloqueado sin
   revisión; editar asunto/cuerpo desmarca la revisión. Cancelar no crea solicitud.
   Enviar una vez muestra confirmación, gravedad, estado y prioridad del servidor.
6. En un cliente administrativo de ensayo, responder y dejar esperando usuario.
   Actualizar historial móvil, desplegar eventos y responder. Verificar En revisión,
   autoría y fecha. Resolver y responder para reabrir; cerrar y comprobar solo lectura.
   Provocar versión antigua: mostrar conflicto y exigir actualización antes de enviar.
7. Con más de diez tickets sintéticos, recorrer páginas sin mezclar propietarios.
   Probar permisos denegados y recurso inexistente: explicar restricción y retirar
   formulario/datos retenidos, sin revelar identidad de otra cuenta.
8. Asistente: consultar una pregunta de plan/rutas, abrir guía de origen y revisar
   versión. Elite: solo los cinco estados permitidos. Pedir cambios/datos ajenos debe
   devolver fuera de alcance. Preparar soporte abre un texto vacío; revisar y confirmar
   explícitamente antes de crear. Aclarar que disponibilidad automática no implica
   atención humana permanente ni canal de emergencias.
9. Apoderado: conservar Buscar/Solicitudes/Mi cuenta y entrar a ayuda desde cabecera.
   Ver sus guías y soporte propio; sin plan comercial ni asistente. Si el entorno
   desplegado devuelve 403 a soporte, registrar la brecha del entorno; no dar permisos.
10. Perder conectividad al leer: error y recuperación con lectura manual. Perderla
    durante envío o agotar espera: sin reenvío automático ni doble toque; consultar
    historial antes de volver a escribir. Repetir al pausar/reanudar la aplicación.
11. Vencer sesión y cambiar entre dos conductores, luego conductor/apoderado, con
    historial/formulario/contexto abierto y una respuesta pendiente. No deben quedar
    textos, respuestas, tickets o datos de la cuenta anterior. Restaurar sesión válida
    y volver a consultar únicamente los recursos de la identidad nueva.
12. Revisar 320/360/390 px y tablet, texto al doble, orientación, teclado, contraste,
    TalkBack y áreas táctiles. Comprobar fechas con la zona real del teléfono y el
    estado de carga, vacío, error y permisos restringidos sin depender del color.

Al terminar esta entrega, detenerse para revisión humana de T12.10.
