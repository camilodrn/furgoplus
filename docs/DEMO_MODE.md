# Demo pública con registro ilustrativo — Task 11

Decisión del producto: `demo.furgoplus.cl` será público, **sin restricciones de IP
para visitantes** y con cuentas preparadas exclusivamente por el equipo. Este
modo forma parte de **r4**, desplegada y probada según el operador en Debian por
HTTPS/Tunnel, con React y APK funcionales y escenario preparado y respaldado.
Esta revisión no modifica ese entorno. Escenario e Inicio compacto se describen
en [DEMO_SCENARIO](DEMO_SCENARIO.md).
Las instrucciones de creación inicial siguientes son para cuentas ausentes: no
recrear el administrador ni Conductor Demo A existentes, ni reinicializar su DB.
La confirmación operativa no aporta el detalle de toda la matriz de seguridad.
Los casos sin evidencia específica de HTTPS/dispositivo y PostgreSQL siguen en
[DEMO_SECURITY_REVIEW](DEMO_SECURITY_REVIEW.md). No es aprobación de producción.

## Comportamiento y configuración

| Componente | Activación | Resultado |
| --- | --- | --- |
| Django normal | `FURGOPLUS_DEMO_MODE` ausente/`false` | Registro parent/driver normal, con CSRF, validadores y límites existentes. Esto incluye el futuro `app.furgoplus.cl`. |
| Django homelab | `DJANGO_SETTINGS_MODULE=config.settings_demo` fuerza `DEMO_MODE=True` | `POST /api/v1/auth/register/` con CSRF válido devuelve **403**, `code=registration_disabled`, `fields={}`, `Cache-Control: no-store`. Rechaza antes de leer el payload, contar intentos o crear usuarios/perfiles; no hay excepción para roles ni admins HTTP. CSRF inválido sigue siendo 403/csrf_failed. |
| React normal | `VITE_FURGOPLUS_DEMO_MODE` ausente/`false`, hostname distinto del demo | Flujo normal. |
| React demo | `infra/demo/web.Dockerfile` compila con `VITE_FURGOPLUS_DEMO_MODE=true`; el hostname exacto `demo.furgoplus.cl` también lo activa | Formulario conductor visible y aviso previo. El botón muestra explicación ilustrativa, limpia nombre/correo/contraseña, conserva la pantalla y no llama API/CSRF ni storage. `AuthApi.register` también rechaza localmente. |
| Flutter demo | `--dart-define=FURGOPLUS_DEMO_MODE=true`; API en `demo.furgoplus.cl` también lo activa | Mismo comportamiento en formulario de familia/apoderado. `NativeSessionApi.registerParent` bloquea antes de CSRF/transporte/storage, incluso si se llama directamente. |

Login/logout, bootstrap CSRF, recuperación de sesión, permisos, documentos privados
y funciones de roles siguen usando los flujos existentes. En demo los campos son
transitorios en DOM/controllers mientras se escriben; al pulsar o cambiar de modo
se limpian. No se envían, serializan, registran ni persisten sus valores. Se desactiva
autofill de ese registro; Flutter cancela el contexto sin guardar. No prometer
control sobre extensiones, capturas o un teclado/gestor externo del visitante.
El aviso pide **no ingresar datos reales**. No se anuncia “Cuenta creada”.

Un cliente antiguo puede intentar el POST: Django lo rechaza sin crear cuentas;
no garantiza evitar el envío de ese cliente antiguo. Por eso se deben distribuir
bundle/APK nuevos. Un cliente normal que recibe `registration_disabled` muestra
la explicación sin success. El servidor es la barrera de seguridad, las flags de
cliente son presentación; no se deduce permiso de registro a partir del cliente.

Vite reemplaza estas variables durante el build, no al arrancar Caddy; nunca usar
`VITE_*` para secretos ([Vite](https://vite.dev/guide/env-and-mode)). Flutter usa
defines de compilación ([Dart](https://api.dart.dev/dart-core/bool/bool.fromEnvironment.html));
la cancelación de autofill usa
[finishAutofillContext](https://api.flutter.dev/flutter/services/TextInput/finishAutofillContext.html).
No añadir flags demo a los builds futuros de app normal ni usar settings_demo allí.

## Preparación administrativa privada (solo cuentas ausentes)

El operador confirma que r4 ya tiene su escenario. Estos comandos son una
referencia para instancias nuevas o cuentas ausentes; el agente no los ejecutó.
No ejecutar el bloque completo sobre la DB r4 ni recrear cuentas existentes.

No usar registro público ni `compose run backend` (IP fija). Crear cuentas por
`exec` en el backend canónico, con terminal, desde un operador confiable. El comando
`create_demo_account` existe solo en modo demo, acepta únicamente parent/driver,
correo `@example.test` y nombre con Demo; valida la contraseña Django solicitada
dos veces **sin eco**, y crea usuario+perfil atómicamente. No acepta contraseñas
por argv/env/file/pipe, no reemplaza duplicados, no concede staff/superuser,
aprobación, plan o publicación. No es un seeder/reset general.

El operador proporciona ruta del env externo ya validado, candidato/IDs de imágenes,
correos y nombres ficticios, claves aleatorias únicas de su gestor privado y
fecha/vigencias de ensayo. Nunca claves de fixtures ni datos personales. Si hay
datos previos, revisar cuentas/IDs sin borrarlos; no repetir la precondición de
base vacía para forzar un reset. Para la primera preparación de la base nueva,
seguir el preflight no destructivo en DEMO_SECURITY_REVIEW antes de sembrar comunas.

Tras aprobar manualmente el entorno y actualizar el candidato en una operación
posterior autorizada (no realizada aquí), desde la raíz del checkout candidato:

```bash
export DEMO_ENV_FILE=/ruta/externa/validada/demo.env
demo=(docker compose -p furgoplus-demo --env-file "$DEMO_ENV_FILE" -f infra/demo/compose.yaml)
"${demo[@]}" config --quiet
"${demo[@]}" ps
"${demo[@]}" exec -T backend python manage.py migrate --check
"${demo[@]}" exec -T backend python manage.py shell -c \
  'from django.conf import settings; assert settings.DEMO_MODE; print("Registro público cerrado en servidor")'

# Sin -T: el terminal es obligatorio. Cada comando pide una clave privada única.
"${demo[@]}" exec backend python manage.py createsuperuser --email admin-demo@example.test
"${demo[@]}" exec backend python manage.py create_demo_account --role parent --email parent-demo@example.test --display-name 'Familia Demo A'
"${demo[@]}" exec backend python manage.py create_demo_account --role parent --email parent-backup@example.test --display-name 'Familia Demo B'
"${demo[@]}" exec backend python manage.py create_demo_account --role driver --email driver-demo-a@example.test --display-name 'Conductor Demo A'
"${demo[@]}" exec backend python manage.py create_demo_account --role driver --email driver-demo-b@example.test --display-name 'Conductor Demo B'
"${demo[@]}" exec backend python manage.py create_demo_account --role driver --email driver-control@example.test --display-name 'Conductor Demo Control'
# Solo si se ensayará el bucket compartido entre tres apoderados:
"${demo[@]}" exec backend python manage.py create_demo_account --role parent --email parent-throttle@example.test --display-name 'Familia Demo Throttle'
```

No pasar contraseñas de admin por entorno ni reutilizarlas en cuentas de rol. No
publicar credenciales compartidas (especialmente admin) en Git, web, APK o capturas.
El equipo distribuye accesos ficticios de ensayo por su canal privado; un visitante
anónimo no recibe una sesión automáticamente. Concluir la preparación mediante las
pantallas de perfil/documentos/revisión/plan/rutas de [DEMO_RUNBOOK](DEMO_RUNBOOK.md),
solo PNG y registros ficticios. El CLI deja conductor draft y sin publicación;
no omitir validación ni escribir SQL para habilitarlo. Anotar IDs, no hashes/claves,
y realizar snapshot recuperable como indica HOMELAB_DEMO en una ventana posterior.

## Activación posterior y aceptación de clientes

1. Ejecutar suites aisladas con pins exactos y carreras PostgreSQL pendientes.
   Elegir tags nuevos de candidato y construir backend/web siguiendo HOMELAB_DEMO;
   el Dockerfile demo ya incorpora la flag React. Registrar IDs, no sobrescribir
   tags de imágenes aceptadas. No basta cambiar `.env` de un Caddy con bundle viejo.
2. En ventana autorizada, usar el procedimiento de backup/actualización existente
   para cambiar únicamente imágenes candidatas; preservar DB/privados. No hay
   migración nueva en este cambio. Verificar `DEMO_MODE` y los dos avisos HSTS
   deliberados W005/W021, salud y negativa LAN antes de habilitar exposición.
3. Preparar/revisar las cuentas ficticias mediante el CLI privado anterior. Para
   reconstruir Flutter en un HOST con SDK/Android configurados:

```bash
cd mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug \
  --dart-define=API_BASE_URL=https://demo.furgoplus.cl \
  --dart-define=FURGOPLUS_DEMO_MODE=true
```

4. DNS/Tunnel ya sirven r4 según el operador; esta revisión no los modifica.
   En una instancia futura, su activación requiere una operación autorizada.
   Mantener host exacto, HTTPS obligatorio y bypass cache API; **sin
   allowlist de IP ni challenge/login HTML que Flutter no soporte**. Tras habilitar
   el ensayo HTTPS, ejecutar el gate real antes de declarar aceptada la demo.
5. En React y Android real, abrir registro, escribir solo valores ficticios,
   pulsar dos veces y Enter/acción del teclado: mismo formulario, explicación,
   campos limpios, ninguna llamada de registro ni cuerpos con datos introducidos,
   sin success ni nuevas cuentas. Network puede mostrar el bootstrap normal
   csrf/me del arranque; no son registros. No capturar cookies/tokens/contraseñas.
6. Con un cliente de prueba directo y CSRF válido, intentar ambos roles: 403/
   registration_disabled, sin 201, sesión ni filas. Repetir sin token: csrf_failed.
   Revisar solo conteos antes/después. Después probar login de cuentas preparadas,
   logout, restauración/expiry/secure storage y permisos con AUTH_ACCEPTANCE.
   El registro real de ese gate corresponde al entorno normal; en demo se sustituye
   por estos rechazos y el CLI. No desactivar CSRF/TLS para hacer el ensayo.

## Qué puede mostrar un visitante sin sesión

| Disponible anónimamente | Permanece privado / resultado |
| --- | --- |
| React: identidad visual, login y formulario ilustrativo de conductor; Flutter: login/formulario ilustrativo de familia | No dashboards, validaciones, pasajeros, pagos, servicios diarios ni inbox/contactos. |
| Privacidad y términos existentes, rotulados como drafts | Sin datos de usuarios ni nueva aceptación legal obligatoria. |
| Assets compilados y salud JSON genérica; bootstrap CSRF | No estado de DB, rutas de archivos, secretos, identidad o listas de cuentas. |
| Intento de login (errores genéricos y límite por IP) | No bypass de sesión ni creación de cuenta. Credenciales controladas, nunca auto-login. |
| Formulario de registro y explicación local | Endpoint cerrado; discovery/comparación/comunas sigue requiriendo rol apoderado, no se convierte en catálogo público. Documentos/operación siguen filtrados por dueño/rol. `/admin`, `/private`, `/media`, `/static` no se publican en Caddy. |

No añadir galerías con datos ficticios ni nuevos endpoints anónimos para completar
la visita: excedería este cambio. El acceso público sin cuentas nuevas reduce el
abuso anónimo de cargas/contactos, pero no elimina DDoS, guessing distribuido de
login ni abuso de una credencial entregada/filtrada. Conservar límites, claves
fuertes, cuota de disco y supervisión; no afirmar que los datos son sintéticos por
haber validado solamente el correo/nombre. Registrar los casos de aceptación HTTPS
que no cuentan con evidencia específica; r4 ya funciona según el operador.

## Evidencia local y archivos

Resultados de la implementación local anteriores al cierre r4; no reemplazan la
confirmación posterior del operador ni demuestran la matriz completa en Debian.
La suite React final con Inicio alcanza 244/244 en DEMO_SCENARIO.

| Validación ejecutada | Resultado / límite |
| --- | --- |
| Django local ampliado | **100 aprobadas de 102**, dos carreras PostgreSQL omitidas explícitamente. Incluye ambos roles cerrados antes de consultas/escrituras, CSRF/login/logout/me intactos, registro normal, negativas anónimas y provisión atómica/no sobrescritura/roles/TTY/claves. SQLite en memoria; terminal/getpass simulados, ORM/validadores reales. |
| React | **240/240**, 14 archivos; cuatro tests demo nuevos. Transport mock, DOM/formularios reales. Typecheck/lint/contrato y build con flag demo aprobados; comprobación de formato de archivos modificados aprobada. |
| Flutter | **20/20** tests de `session_test.dart` mediante harness temporal directo sin sockets, incluidos dos nuevos. Suites reales importadas, asserts activados y assets reales con `flutter_tester`; transporte/storage de prueba. **No es un pase del runner normal.** `flutter analyze` y formato de archivos modificados aprobados. |
| Runner normal Flutter | Intentado; **0 tests ejecutados**, loader bloqueado por bind `127.0.0.1:0`/EPERM del sandbox. Repetir `flutter test` en HOST; no parchear SDK ni omitir tests para ocultarlo. No se construyó APK nuevo. |
| Infraestructura | **16/16** proxy/settings/CSRF (incluida flag demo forzada ante override false); **9/9** topología, modelo Compose aprobado. Sin daemon. |
| Estáticas | Ruff backend/infra, `makemigrations --check --dry-run` (sin schema nuevo), OpenAPI `--check`, `git diff --check`: aprobadas. |

Entorno local complementario: Python 3.14.8/Django **5.2.12**/DRF 3.16.1,
dependencias Node de lockfile desde caché offline y SDK Flutter copiado a `/tmp`
sin parches. No se instala nada en Debian ni se toca el SDK/caché original para
validar. Repetir backend con Django **5.2.18**, carreras PostgreSQL, runner normal
Flutter, APK y la aceptación HTTPS en el candidato real. Ningún resultado anterior
certifica HTTPS de red, Android real ni despliegue Debian.

Comandos locales del backend sin servicios ni secretos (usar venv con dependencias):

```bash
PYTHONPATH="$PWD/infra/demo" python backend/manage.py test \
  --settings=security_test_settings --noinput \
  api.test_demo_registration accounts.test_demo_account api.test_auth \
  drivers.test_contact_throttle api.tests api.test_contracts accounts.tests \
  drivers.test_contact.ContactTests drivers.tests \
  drivers.test_controls.AdminControlTests drivers.test_operations.OperationsTests \
  drivers.test_daily_operation.DailyOperationTests \
  drivers.test_daily_operation.ChileDateTests drivers.test_publication.PublicationTests
cd web
npm test
npm run typecheck
npm run lint
npm run contract:check
VITE_FURGOPLUS_DEMO_MODE=true npm run build
```

El harness Flutter se conserva fuera de Git en `/tmp/furgoplus-demo-flutter-direct.dart`,
con su kernel/log, como evidencia complementaria revisable; no se incluye en SDK,
producto o CI. Los comandos de HOST arriba usan el runner normal.

| Archivos de esta continuación | Propósito |
| --- | --- |
| `backend/api/auth.py`, `backend/config/settings.py`, `backend/config/settings_demo.py`, `backend/config/test_demo_proxy.py`, nuevo `backend/api/test_demo_registration.py` | Flag, rechazo temprano y pruebas de endpoint/config. |
| Nuevos `backend/accounts/management/__init__.py`, `backend/accounts/management/commands/__init__.py`, `backend/accounts/management/commands/create_demo_account.py`, `backend/accounts/test_demo_account.py` | Provisión privada y pruebas. |
| `web/src/App.tsx`, `web/src/api.ts`, nuevos `web/src/demo.ts`, `web/src/DemoRegistration.test.tsx` | Formulario conductor y guard local. |
| `mobile/lib/api_config.dart`, `mobile/lib/auth_app.dart`, `mobile/lib/auth_controller.dart`, `mobile/lib/session_api.dart`, `mobile/test/session_test.dart` | Formulario apoderado, guard y pruebas. |
| `infra/demo/web.Dockerfile`, `infra/demo/.env.example`, `infra/demo/security_test_settings.py` | Build demo y entorno local de pruebas. |
| Nuevo `docs/DEMO_MODE.md`; `docs/DEMO_SECURITY_REVIEW.md`, `docs/DEMO_RUNBOOK.md`, `docs/HOMELAB_DEMO.md`, `docs/AUTH_ACCEPTANCE.md`, `docs/MVP_DEMO_FREEZE.md`, `docs/decisions/0007-homelab-demo-deployment.md` | Decisión pública, evidencia y procedimientos. |

Todos sin commit; cambios previos preservados. No nuevo staging, rama modificada,
deployment, Tunnel, contenedor/volumen existente ni datos reales.
