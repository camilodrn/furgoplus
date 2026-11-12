# Task 15 · Informe de usuarios registrados para la feria

**Estado actualizado al 12-11-2026:** hito académico de feria
implementado, desplegado y probado funcionalmente el 03–04/11/2026.
Pendiente de cierre Git y de validaciones integrales adicionales.

**Nota de procedencia:** los bloqueos, advertencias y conclusiones
que siguen corresponden al corte inicial de Codex. Se conservan
como evidencia histórica. El resultado posterior está documentado
en la sección de cierre al final de este archivo.

## Corte inicial de Codex — histórico

Implementado localmente en `task/15-feria-registro`, sobre `bc919c5`.
Feria: 04-11-2026. Corte de verificación: 03-11-2026, 22:31 UTC.
**No listo para desplegar:** PostgreSQL 17 y APK nueva bloqueados por el entorno.
Sin commit, push, despliegue ni cambios en Task 12 o en la demo pública.

## Comportamiento y contrato

El administrador abre **Usuarios registrados** y pulsa **Actualizar usuarios**
después del registro de un apoderado en Flutter o un conductor en la web.
La pantalla consulta `GET /api/v1/admin/registrations/`; no contiene registros
simulados ni depende de un snapshot de la feria.

- Reutiliza `AdminView`: sesión válida, cuenta activa, rol `admin` e `is_staff`.
  Apoderados, conductores (incluso staff), administradores sin staff y anónimos
  reciben 403. Las respuestas llevan `Cache-Control: no-store`.
- Consulta `User` y sus perfiles existentes. No introduce tablas ni migraciones.
- `totals`: cuentas globales por `parent`, `driver`, `admin`, incluidas inactivas.
  `count` y `results`: conjunto filtrado, ordenado por `created_at DESC, id DESC`.
- Campos de cada fila: `id`, `display_name`, `email`, `role`, `created_at`.
  El nombre es el del perfil existente; queda nulo cuando no existe.
  Solo devuelve correos de `@example.test`; otros correos quedan nulos y la UI
  muestra «Correo reservado». Las cuentas siguen incluidas en los totales.
  No devuelve hashes, contraseñas, sesiones, contactos de servicio ni documentos.
- Filtros: `q` (hasta 100 caracteres, nombre o correo ficticio) y `role`.
  Paginación: `offset >= 0`, `1 <= limit <= 50`, por defecto 25.
  Parámetros desconocidos, repetidos o inválidos reciben 400.
- API: instante ISO 8601. UI: fecha y hora en `America/Santiago`, con horario
  estacional, sin depender de la zona del equipo que abre el navegador.
- La UI tiene carga, vacío global, vacío filtrado, error y actualización manual.
  No muestra datos anteriores durante una consulta fallida. Aplica filtros al
  enviarlos, vuelve a la primera página y corrige páginas que dejan de existir.
  Reutiliza tabla adaptable, paginador y errores administrativos del proyecto.
  La lectura tiene el plazo existente de 15 segundos y conserva las protecciones
  de sesión. Al salir de la sección, descarta sus datos y respuestas pendientes.

Fuentes del contrato: `backend/api/contracts.py`, `backend/openapi.json` y
`web/src/api-types.ts`, generado por el script existente.

## Verificación inicial de implementación

Los resultados siguientes corresponden a la etapa anterior. No se repitieron las
suites completas en esta continuación: el código de aplicación no cambió.

Dependencias backend exactas de `backend/requirements.txt`, recuperadas de la
caché local en un entorno temporal de `/tmp`, sin cambiar dependencias del repo.
La red no permitió descargarlas. Se usó la configuración aislada existente
`config.settings_task12_tests`: SQLite en memoria, sin resolver credenciales ni
conectarse a las bases desplegadas. No se modificó esa configuración.

- Backend: 87 pruebas correctas en `api`, `accounts`,
  `drivers.test_controls.AdminControlTests`,
  `drivers.test_publication.PublicationTests`, `drivers.test_reports.ReportTests`
  y `drivers.test_capabilities.CapabilityTests`.
  Incluyen registro HTTP con CSRF de un nuevo apoderado, login administrativo y
  consulta posterior que devuelve su mismo ID, nombre y correo desde la BD.
  Incluyen permisos, filtros combinados, límites, orden estable, fechas,
  correos reservados y ausencia de campos ajenos al informe.
- `ruff check` y `ruff format --check` correctos en los cuatro archivos Python
  añadidos/modificados. `makemigrations --check --dry-run`: sin cambios.
  `generate_openapi --check`: contrato vigente.
- Flutter: `flutter test --no-pub test/session_test.dart`, 21 pruebas correctas,
  incluido registro real demo con CSRF y sin login automático.
- React: **411/411 pruebas**, 24 archivos, con
  `npm test --prefix web -- --maxWorkers=2`. Contrato, formato, lint, TypeScript
  y compilación correctos.
  Las pruebas incluyen navegación administrativa, filtros, páginas, refresco,
  errores de red/permisos/sesión, límite de espera, fechas de verano/invierno y
  descarte de respuestas después de desmontar la sección.

Limitaciones explícitas:

- Una ejecución React con el paralelismo por defecto agotó los 5 segundos de la
  prueba existente `assignment create, edit and end refresh server capacity in
  routes and summary`. La suite completa pasó al limitar a dos workers, sin
  modificar el timeout ni la lógica de esa prueba.
- PostgreSQL **no se ejecutó**: no hay binarios nativos locales disponibles y no
  se utilizaron contenedores. Una ejecución ampliada de 90 pruebas bajo SQLite
  dio 87 correctas, una fallida y dos omitidas. Falló
  `ProfileControlConcurrencyTests.test_competing_profile_controls_one_commit_one_conflict`
  por `database table is locked`; las dos omitidas requieren PostgreSQL.
  No se cambió esa prueba ni se considera validada la concurrencia con SQLite.
- No hubo revisión visual en navegador: Django/Vite no pudieron abrir sus
  puertos de prueba locales por `EPERM`. El intento de preview usó exclusivamente
  una BD nueva en `/tmp`; no se conectó al escenario académico.
- Las pruebas no acreditan aceptación humana ni el circuito físico completo
  Flutter → PostgreSQL → React en el entorno de feria.

Para repetir la selección backend, con las dependencias instaladas:

```bash
python backend/manage.py test \
  api accounts drivers.test_controls.AdminControlTests \
  drivers.test_publication.PublicationTests drivers.test_reports.ReportTests \
  drivers.test_capabilities.CapabilityTests \
  --settings=config.settings_task12_tests --noinput
```

## Cierre de verificaciones pendientes · 03-11-2026

### PostgreSQL 17: bloqueado, no ejecutado

Se preparó un Compose de comprobación en
`/tmp/furgoplus-task15-verification/compose.yaml`, sin puertos publicados,
con `postgres:17.6-alpine3.22`, BD `task15_fair`, usuario de prueba `task15_test`,
red interna y volumen nuevos por proyecto. `docker compose config --quiet`
terminó correctamente. Se intentó crear únicamente este proyecto nuevo:

```bash
docker compose -p furgoplus-task15-check-20261103-1924 \
  -f /tmp/furgoplus-task15-verification/compose.yaml up -d db
```

Resultado: `permission denied while trying to connect to the docker API at
unix:///var/run/docker.sock`. Podman también se bloqueó: primero su runtime fuera
de los directorios escribibles; con runtime y almacenamiento nuevos en `/tmp`,
`newuidmap: write to uid_map failed: Operation not permitted`.

No se pudieron crear los contenedores ni el volumen PostgreSQL. No se usó un
socket alternativo ni una base existente. No se ejecutaron pruebas contra
PostgreSQL, ni se comprobó persistencia tras reiniciar un contenedor. No se dispone
de inventario de las imágenes activas de la demo y no se accedió a su host de
despliegue. Sus IDs y tags vigentes quedan pendientes, sin inferirlos desde los
valores de ejemplo del repositorio.

Para retomar, usar otro nombre de proyecto **nuevo**, otra red y otro volumen;
no reutilizar el puerto, usuario, BD ni configuración PostgreSQL de Task 12.
Ejecutar el runner dentro de la nueva red privada con `DB_HOST=db`,
`DB_NAME=task15_fair`, `DB_USER=task15_test` y credenciales exclusivamente de prueba.
No montar archivos de secretos ni volúmenes de la demo. La selección pertinente es:

```bash
python manage.py test \
  api.test_registrations api.test_demo_registration \
  drivers.test_controls.ProfileControlConcurrencyTests \
  drivers.test_reports.ReportSnapshotTests \
  --keepdb --noinput
```

Antes de ejecutar, verificar servidor PostgreSQL 17 y nombre de BD/volumen. Usar
`--keepdb` para conservar la BD de pruebas, no eliminar recursos al terminar.
Completar después registro y lectura en procesos independientes y persistencia
tras reiniciar **solo el contenedor nuevo**. Ninguno de esos pasos PostgreSQL se
considera ejecutado en este corte.

### Investigación de concurrencia SQLite

Se repitió únicamente la prueba que había fallado, con la configuración aislada
SQLite y `--keepdb`; no se alteró el test:

```bash
python backend/manage.py test drivers.test_controls.ProfileControlConcurrencyTests \
  --settings=config.settings_task12_tests --noinput --keepdb
```

Resultado: **1 prueba fallida**. Esta reproducción muestra
`OperationalError('database table is locked: django_session')` y luego
`BrokenBarrierError()`. El test ejecuta `Client.force_login` en ambos hilos antes
de `barrier.wait`; por tanto, el resultado apunta a una colisión durante la
preparación de sesiones que impide llegar conjuntamente al POST de control.
No demuestra un fallo del nuevo informe.

Hechos adicionales observados en Django: SQLite tiene
`has_select_for_update=False`; PostgreSQL, `True`. El servicio
`change_profile_status` usa `transaction.atomic()` y `select_for_update()` sobre
el conductor antes de comprobar estado/versión y escribir el historial.
La expectativa sigue siendo una respuesta 200, otra 409 y un solo evento.
**Es una expectativa pendiente de ejecución en PostgreSQL**, no una prueba verde
por inspección. La prueba y la lógica de negocio conservan su implementación.

### Registro, permisos y persistencia: comprobación adicional SQLite

Se creó exclusivamente una BD nueva
`/tmp/furgoplus-task15-verification/registration.sqlite3`, con configuración
separada, sin conexiones al escenario académico. Se aplicaron allí las
migraciones existentes; no se generaron migraciones nuevas.

Un primer proceso ejecutó los endpoints reales con el cliente HTTP de Django,
CSRF comprobado, demo y registro real habilitados:

- Registro de apoderado y conductor con correos ficticios `@example.test`: 201.
- Login administrativo y búsqueda por rol/correo: 200. La fila corresponde al
  mismo ID **2**, nombre `Persona Feria parent`, correo
  `task15-parent@example.test`, rol y fecha de la cuenta recién creada.
- Totales obtenidos de la BD: un apoderado, un conductor y un administrador.
- Apoderado y conductor: 403 `permission_denied`; anónimo: 403
  `not_authenticated`, sin filas privadas en la respuesta.
- Tres páginas de una fila sin IDs repetidos. Límite 51, rol repetido y offset
  negativo: 400. Respuesta del informe con `Cache-Control: no-store`.

Un **segundo proceso independiente** abrió la misma BD y una sesión administrativa
nueva: recuperó exactamente el mismo ID, fila, fecha y totales. Esto verifica
persistencia entre procesos en SQLite, **no en PostgreSQL ni entre reinicios de
contenedores**. No es un ensayo físico de Flutter ni una revisión visual React.

Evidencia temporal conservada, sin contraseñas ni cookies:
`/tmp/furgoplus-task15-verification/registration-created.json`,
`registration-persisted.json`, `verify_registration.py` y `task15_http_settings.py`.
La BD nueva se conserva; no se borraron bases ni volúmenes.

### Revisión local del informe web

Se intentaron Django en `127.0.0.1:18015` contra esa BD nueva y Vite en
`127.0.0.1:18115`. Django terminó con `Error: [Errno 1] Operation not permitted`;
Vite con `listen EPERM: operation not permitted 127.0.0.1:18115`.
Un intento mínimo de crear un socket también devuelve `PermissionError` antes de
poder hacer bind. No hubo servidor disponible para una revisión en navegador.

Se inspeccionó la composición real: controles nativos etiquetados, tabla y celdas
adaptables existentes, fechas `America/Santiago`, estados explícitos y paginador
compartido. El CLI `21st review` no está instalado; no se instaló otra herramienta.
No se obtuvieron capturas ni se declara aceptación visual, responsive o humana.
Logs: `django-preview.log` y `vite-preview.log` en el directorio temporal anterior.

En el diff OpenAPI se comprobó además que el único path añadido es
`/api/v1/admin/registrations/`: ningún endpoint anterior fue eliminado o modificado.
`git diff --check` correcto. Esta continuación no modifica código de aplicación.

## Flags y APK

Revisión de fuentes:

- Django: `DEMO_REGISTRATION_ENABLED` lee
  `FURGOPLUS_DEMO_REGISTRATION_ENABLED`, falso por defecto. Con demo y flag
  habilitados, conserva la restricción de correo ficticio `@example.test`.
- Flutter: `ApiConfig.fromEnvironment` lee el mismo flag con `bool.fromEnvironment`.
  Solo habilita registro real cuando también está en demo; reconoce
  `demo.furgoplus.cl` o `FURGOPLUS_DEMO_MODE=true`.
- React: `VITE_FURGOPLUS_DEMO_REGISTRATION_ENABLED=true` durante la compilación.
  El Compose demo existente pasa el flag a Django y al build web, con valor por
  defecto falso. No se modificaron infraestructura ni flags del despliegue.
- El bloqueo público de `/admin/` en Caddy se conserva. El informe usa la API y
  el panel React; no requiere habilitar Django Admin.

### APK: recompilación intentada, sin artefacto nuevo

No se pudo acreditar el valor de los flags dentro de la APK existente. Se intentó
la recompilación solicitada con estos **cuatro valores exactos**:

```bash
cd mobile
flutter build apk --debug --no-pub \
  --dart-define=API_BASE_URL=https://demo.furgoplus.cl \
  --dart-define=FURGOPLUS_DEMO_MODE=true \
  --dart-define=FURGOPLUS_DEMO_REGISTRATION_ENABLED=true \
  --dart-define=FURGOPLUS_SYNTHETIC_DATA=true
```

El SDK original no puede actualizar su caché por estar fuera de las rutas
escribibles. Para avanzar se usó una copia en `/tmp/furgoplus-task15-sdk`, Flutter
3.47.2 / Dart 3.13.2, Java 21 Temurin y una copia de la caché Gradle en una ruta
escribible propia de esta tarea. No se modificaron el SDK ni la caché originales.

La ejecución llegó a `assembleDebug` y terminó con código 1:
`Could not create service of type FileLockContentionHandler` →
`Could not determine a usable wildcard IP for this machine.`
El entorno también bloquea la creación de sockets con `EPERM`; el fallo ocurre
antes de compilar la aplicación. **No existe una APK nueva ni un SHA256 nuevo.**

Artefacto anterior conservado y comprobado después del intento:

- Ruta: `mobile/build/app/outputs/flutter-apk/app-debug.apk`.
- Tamaño: **159874145 bytes**.
- SHA256: `66abcefbe39201757947a5424c01d1a8bd532b326b2c6b30e735335016d72237`.
- `aapt dump badging`: paquete `com.example.furgoplus.task12`, versión `0.1.0`,
  código 1. La configuración debug conserva ese mismo application ID. Instalarlo
  en el perfil que contiene Task 12 podría actualizar esa aplicación; para
  respetar su protección, usar un dispositivo/perfil separado o definir antes
  un ID distinto. No se cambió el ID ni se hizo ninguna instalación.
- Copia preservada: `mobile/build/task15-verification-20261103/previous-app-debug-66abcef.apk`,
  con el mismo hash. No se instaló ninguna APK ni se operó el dispositivo.
- Log y manifiesto: `mobile/build/task15-verification-20261103/apk-build.log` y
  `apk-attempt.json`, artefactos locales ignorados por Git.
- `mobile/android/local.properties` se restauró y se comparó byte a byte con
  su copia anterior tras la ejecución de Flutter.

La revisión de código confirma la ruta habilitada de registro, no los valores
compilados del binario: `ApiConfig.fromEnvironment` consume URL y flags; con demo
más registro habilitado, `AuthApp.submit` permite el formulario, conserva la
restricción `@example.test` y llama a `registerParent`. `NativeSessionApi` envía
CSRF y `role=parent` a `https://demo.furgoplus.cl/api/v1/auth/register/` con esa
configuración. `AuthController.usesSyntheticData` reconoce el cuarto flag y demo.
La URL no se sustituye por localhost y el registro no abre una sesión automática.
La prueba Flutter específica de este flujo pasó en la etapa anterior; no se
repitió su suite completa. **Los cuatro valores siguen sin acreditarse en una
APK nueva**, y tampoco se verificó el binario instalado en el teléfono.

## Propuesta de despliegue y reversión · no ejecutada

Usar el Compose existente `infra/demo/compose.yaml`, con el mismo proyecto y
configuración **que el operador confirme para la demo**. El ejemplo `.env` y sus
tags no acreditan lo que está desplegado. Ninguna orden de esta sección se ejecutó
sobre la demo. No modificar ni reiniciar servicios o worktrees de Task 12.

1. **Cerrar gates fuera de las restricciones actuales:** PostgreSQL 17 aislado,
   concurrencia 200/409 y un evento, registro/permisos/paginación/persistencia en
   esa BD; APK recompilada con los cuatro valores, hash nuevo y prueba de registro;
   revisión real de la sección a anchos de escritorio y móvil. No repetir las
   suites React/Flutter completas si no cambian fuentes ni aparecen otros fallos.
2. **Fijar la candidata y la reversión:** revisar y congelar el HEAD más el diff
   y los archivos nuevos sin seguimiento. `bc919c5` por sí solo no contiene este
   informe. No hacer un commit sin autorización. Registrar el proyecto/Compose
   real, configuración previa, IDs de los contenedores e IDs/digests de las
   imágenes activas de backend, web y PostgreSQL. Conservar las imágenes anteriores
   con tags de reversión nuevos; no reconstruirlas ni sobrescribir sus tags.
   No se han obtenido estos IDs por el bloqueo de Docker y no se inventan aquí.
3. **Respaldo recuperable antes del cambio:** seguir
   [HOMELAB_DEMO](HOMELAB_DEMO.md#backups-y-ensayo-de-restauración) y
   [BACKUP_RESTORE](BACKUP_RESTORE.md), en la futura ventana autorizada.
   El procedimiento detiene escritores y conserva detenida la fuente: coordinar
   esa consecuencia, no ejecutarlo como una lectura inocua. Mantener BD,
   documentos privados, sesiones, configuración y APK anterior. No borrar nada
   ni usar `down -v`, `prune`, resets o restauraciones sobre volúmenes existentes.
4. **Preparar imágenes candidatas con tag nuevo:** conservar el PostgreSQL 17
   actual. Construir solo `backend` y `caddy`, desde la misma candidata, con
   `FURGOPLUS_RELEASE=<tag-candidato-nuevo>` y
   `FURGOPLUS_DEMO_REGISTRATION_ENABLED=true`. El Compose actual pasa este flag
   al backend en ejecución y a React durante el build; cambiar solo el entorno
   de Caddy después del build no modifica los flags del JavaScript.
   `config.settings_demo` mantiene `DEMO_MODE=true` y registro ficticio limitado.
   Validar Gunicorn, Caddy, Django y `/admin/` bloqueado según el runbook.
5. **Comprobar compatibilidad de schema en un ensayo separado:** Task 15 no añade
   migraciones, pero no se conoce el schema ni la revisión de las imágenes
   desplegadas. No concluir que no habrá migraciones acumuladas. Comparar planes
   de migración en una copia aislada antes de decidir. Si aparecen cambios de
   schema, detener esa propuesta y revisar su autorización y reversión; no aplicar
   migraciones ni hacer downgrade automáticamente.
6. **Solo con autorización de despliegue:** en la ventana acordada, detener Caddy
   y escritores según el runbook; recrear únicamente el backend canónico con la
   candidata y `up -d --no-deps backend`, usando la misma configuración candidata
   de release y flag que en el build. Comprobar salud y `migrate --check`
   mediante `compose exec -T backend`, sin lanzar un one-off con su IP estática.
   Luego recrear únicamente Caddy con `up -d --no-deps caddy`. No recrear DB ni
   cambiar sus volúmenes, redes o versión. Registrar los IDs efectivamente usados.
7. **Smoke después de ese despliegue autorizado:** comprobar HTTPS, login y
   bloqueo de `/admin/`. Registrar un apoderado ficticio único desde Flutter,
   entrar como administrador React y verificar la misma cuenta, incremento del
   total y hora de Chile. Comprobar 403 para los otros roles con cuentas sintéticas.
   El throttle de registro sigue en cinco intentos por origen/hora: no agotarlo
   con ensayos repetidos. Conservar la cuenta; no borrar datos para repetirlos.
8. **Reversión si falla el smoke:** detener Caddy, restaurar la configuración y
   referencias de backend/web anteriores y recrear solo esos dos servicios con
   las imágenes preservadas. Comprobar que sus IDs coinciden con el inventario.
   Con schema compatible, las cuentas recién creadas permanecen en la misma BD;
   no restaurar datos ni eliminar volúmenes como parte de un rollback de código.
   Si el schema fuese incompatible, no improvisar: validar la restauración en
   otro proyecto nuevo y solicitar una decisión de cambio de origen. Conservar
   también la APK anterior; no reinstalar ni alterar el dispositivo automáticamente.

**Dictamen de este corte: no listo para desplegar.** La implementación y sus
resultados anteriores se conservan; faltan comprobaciones ejecutadas en PostgreSQL,
una APK nueva verificable, revisión visual real e inventario de reversión. Los
bloqueos proceden de permisos/capacidades del entorno. Las pruebas ya están
autorizadas por el usuario; requieren un entorno capaz de ejecutarlas.

## Cierre posterior verificado — 03 y 04-11-2026

### Pruebas e implementación

- PostgreSQL 17.6 aislado en Fedora: 20 de 20 pruebas Django correctas,
  incluyendo registros, permisos, concurrencia y reportes.
- APK Flutter compilada con la API pública, registro demo habilitado
  y datos sintéticos.
- Identidad Android actualizada: nombre FurgoPlus, logo original
  y recursos de ícono adaptativo.
- APK final de feria: `FurgoPlus-Feria-2026.apk`.
  SHA256 registrado:
  `52f41ecad91df6f0c2cb5dc0f9e8ec8668bd9285bdf312a7fcc33de8ba36aebe`.
- Samsung A54: instalación y apariencia del ícono verificadas.
- Registro ficticio desde Flutter y aparición en el informe React:
  recorrido funcional confirmado por el operador.

### Despliegue de demostración

- Backend desplegado: `furgoplus-feria-backend:task15-reg-report-v1`.
- Web desplegada: `furgoplus-feria-web:task15-reg-report-v1-favicon`.
- PostgreSQL conservó el mismo contenedor durante la actualización.
- Backend, Caddy y PostgreSQL alcanzaron estado saludable.
- La API respondió `{"status":"ok"}` después del despliegue.
- Imágenes Task 15 RC2 conservadas para reversión.

### Protección y continuidad

- Respaldo previo al informe generado el 03-11-2026.
- Copia externa en Fedora verificada mediante SHA256 coincidente.
- Homelab reiniciado el 03-11-2026 a las 22:23.
- Docker, Tailscale, Cloudflare Tunnel y contenedores recuperados.
- API pública correcta y landing con HTTP 200 tras el reinicio.
- La profesora confirmó posteriormente que el producto estaba
  bien para la presentación final.

### Pendientes posteriores

- Crear y revisar el commit final de Task 15.
- Publicar la rama y decidir su integración después del cierre
  de las dependencias con Task 12.
- Reconciliar estado local, GitHub y versión desplegada.
- Mantener el registro público restringido al escenario académico
  con identidades ficticias; no equivale a una habilitación comercial.
- Conservar como riesgo independiente los problemas históricos
  de almacenamiento I/O/ext4 del homelab.
- No considerar cerrada la aceptación integral UX/UI y accesibilidad
  solo por las pruebas de feria.

**Alcance de esta actualización:** reconstrucción documental basada en
evidencias de ejecución y comprobaciones anteriores. No constituye una
nueva prueba del entorno realizada el 12-11-2026.
