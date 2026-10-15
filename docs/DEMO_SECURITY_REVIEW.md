# Revisión de exposición académica — Task 11

Fecha: 14-10-2026. Rama `task/11-homelab-deployment`, base `816dda0`, cambios
sin commit, incluida la integración documental Task 09/10. **Estado actualizado:**
el operador confirma r4 desplegada y probada por HTTPS/Tunnel, React y APK
funcionales con datos sintéticos, escenario preparado y respaldado. El rechazo de
exposición previo correspondía a un candidato anterior. Esta confirmación no
acredita cada prueba de seguridad enumerada abajo ni declara producción lista.
Ver [revisión final](TASK11_FINAL_REVIEW.md). El agente no modifica Debian,
servicios/volúmenes Docker existentes, secretos ni el otro worktree.

**Decisión posterior del producto:** la demo será pública **sin restricciones de
IP para visitantes**, con creación de cuentas controlada. El modo implementado en
[DEMO_MODE](DEMO_MODE.md) cierra el registro público en servidor y deja formularios
ilustrativos sin envío/storage en React/Flutter. Sustituye la recomendación previa
de restringir audiencia por IP. Registrar la evidencia específica de PostgreSQL
y de la matriz HTTPS/dispositivo no adjunta; el servicio r4 ya está expuesto según
el operador. Esta auditoría no cambia Tunnel ni concede permisos anónimos nuevos.

## Resultado de la inspección

| Superficie | Control observado y alcance |
| --- | --- |
| Crear contacto | Sesión activa, rol apoderado y CSRF antes del handler; campos estrictos, consentimiento literal `true`, conductor elegible comprobado dentro de transacción. Parent/driver se determinan en servidor; constraint de un pendiente por pareja. Faltaba protección de frecuencia: corregida aquí. |
| Registro | Demo: 403/registration_disabled antes de leer datos o escribir usuarios/perfiles; CSRF permanece. React/Flutter muestran formulario ilustrativo y bloquean localmente. Normal: parent/driver con validadores/constraints/límites existentes, sin flags admin/staff ni login automático; sin verificación de correo. Cuentas demo por CLI privado, nunca endpoint público. |
| Login/logout/sesión | Error genérico para usuario inexistente, clave incorrecta o cuenta desactivada; rotación de sesión/CSRF, expiración absoluta 12 h, sesión DB, invalidación por cambio de clave/desactivación. Logout exige CSRF y elimina la sesión actual; otras sesiones no se revocan globalmente. Recuperación significa recuperar una sesión válida, no un flujo nuevo de recuperación de contraseña. |
| Objetos privados | Contactos filtrados por participante; rutas, pasajeros, pagos y servicios diarios por conductor antes de recuperar/mutar objetos relacionados. Apoderados no acceden a operaciones; administradores solo a validación/control documentados, no a inbox/pasajeros/pagos ajenos. Tests existentes cubren IDs directos y relaciones; no se rediseña autenticación. |
| Archivos | Solo descarga autenticada del dueño o admin de validación, con adjunto, nombre generado, `nosniff` y `no-store`; admin deja auditoría. Clave de almacenamiento UUID creada en servidor; sin URLs de volumen en JSON. Caddy no monta documentos ni DB y bloquea `/private`, `/media`, `/static`, `/admin` y sus descendientes. React administra por API, no por Django Admin. |
| Datos y errores | Discovery usa campos permitidos; no roster/domicilio privado/pagos/documentos. El correo de servicio se revela al apoderado solo después de aceptación; el conductor recibe solo el correo consentido del participante. DEBUG false, errores de validación/JSON genéricos y API sin caché. Un 500 inesperado puede ser HTML genérico Django o error de proxy, no el sobre JSON: no mostrar trazas ni registrar cuerpos/cookies. |

## Corrección mínima de contact-create

`drivers.contact_throttle.contact_create_rate` reutiliza `accounts.AuthThrottle`;
**no hay cambio de schema/migración**. Dos claves SHA256 separadas por namespace:
10 intentos/cuenta/hora y 20 intentos/IP/hora. Ventanas fijas desde el primer intento;
no son ventanas deslizantes. Cuenta todas las peticiones que superan sesión/rol/
CSRF: éxito, validación, conductor oculto/inexistente, duplicado y rechazo 429.
Ambos buckets consumen el intento y se saturan en límite+1 para evitar crecimiento
del entero; no se divulga cuál bucket falló. La respuesta sigue siendo
`429` con `code=throttled`, `fields={}` y `Cache-Control: no-store`.

Transacción independiente antes de leer el payload/escribir el contacto, orden
global de adquisición de claves, creación única y `select_for_update` de ambas
filas. Se toma la hora después del lock; se confirma la transacción antes de lanzar
429. PostgreSQL permite compartir esos locks entre los dos procesos y cuatro hilos
Gunicorn; no depende de memoria/caché de cada worker. **Esto es una conclusión de
diseño, pendiente de ejecutar las carreras PostgreSQL añadidas.** SQLite no aplica
estos locks. No activar `ATOMIC_REQUESTS` ni envolver toda la vista en una
transacción que pueda deshacer los contadores al rechazar el dominio.

Fuentes técnicas: [locks y TransactionTestCase de Django](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update)
y [limitaciones de concurrencia/antiabuso de DRF](https://www.django-rest-framework.org/api-guide/throttling/).
El límite no reemplaza protección de tráfico en el edge ni resuelve ataques con
muchas cuentas y fuentes. Una NAT académica comparte presupuesto; preparar cuentas
y ensayar antes, sin desactivar controles ni borrar contadores para la demostración.

## Frontera Cloudflare → Caddy → Django

Solo Caddy publica `127.0.0.1:18080`; ingress no conecta backend ni PostgreSQL.
Proxy y database permanecen internas. Caddy sobrescribe `X-FurgoPlus-Client-IP`
desde `CF-Connecting-IP`, elimina las cadenas XFF/Forwarded/X-Real-IP y fija HTTPS.
Django acepta una única IP válida solo del peer exacto de Caddy en **proxy**,
canonicaliza IPv6/IPv4-mapped y elimina las cabeceras restantes. Otros peers no
pueden imponer IP/esquema; ausencia/lista/puerto/scope inválido desde Caddy da 400.
Gunicorn tampoco confía en ingress ni habilita headers PATH_INFO/SCRIPT_NAME.

Esto **no autentica Cloudflare en el puerto local**: procesos con acceso al
loopback/host Docker pueden falsificar CF-Connecting-IP. Host, root, socket Docker
y usuarios/procesos locales deben ser confiables; no compartir redes con FitFu,
publicar en LAN ni ampliar peers confiables. Una cabecera cliente enviada al edge
debe ser reemplazada por Cloudflare; todavía falta comprobarlo por el túnel real.
No usar Workers, Remove Visitor IP Headers ni Pseudo IPv4 en Overwrite Headers
sin reevaluar la frontera ([documentación Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/)).

HSTS conserva exactamente los avisos deliberados `security.W005` y `security.W021`
(sin includeSubDomains ni preload), visibles y no silenciados. Otros avisos detienen
la aceptación. HTTP de loopback y los checks de salud no prueban cookies HTTPS.

## Evidencia y comandos locales

Comprobaciones realmente ejecutadas por el agente:

| Validación | Resultado y límite |
| --- | --- |
| Suite HTTP/auth/CSRF/objetos/archivos/contratos | **92 aprobadas de 94 descubiertas; 2 omitidas** (las carreras PostgreSQL). SQLite en memoria, Client real con CSRF, sesiones/ORM y archivos sintéticos; sin mocks de permisos o throttle. No prueba PostgreSQL ni HTTPS de red. |
| Repetición tras hacer independiente el catálogo del fixture | **24 aprobadas de 26; las mismas 2 omitidas**. Contactos y controles usan ahora un fixture que repone Basic tras el flush de TransactionTestCase; no cambia la semilla operativa. |
| Proxy/settings/CSRF de infraestructura | **16/16**; requests Django reales, sin DB/red/túnel. |
| Topología Compose y Gunicorn | **9/9**, modelo normalizado sin daemon; `check_config.py` y parser real `Gunicorn --check-config` aprobados. |
| Recuperación | **18/18 simulaciones** Docker/puerto; extracción real solo a directorios temporales sintéticos. No nuevo backup/restore operativo. |
| Estáticas | Ruff check backend + infra/demo, format de archivos Python cambiados, `bash -n`, `git diff --check`, `makemigrations --check --dry-run` con settings de test: aprobadas, sin schema nuevo. Shellcheck no disponible. |

Entorno complementario: Python 3.14.8, Django **5.2.12**, DRF 3.16.1,
Pillow 12.3.0, pypdf 6.10.0 y Gunicorn **23.0.0**, disponibles en caché/runtime
local y copiados a un venv en `/tmp`; no instalación en Debian. No hay binarios
PostgreSQL locales, acceso permitido al daemon Docker ni DNS de PyPI en el sandbox.
Por eso no se ejecutan las carreras ni se sustituye el gate con los pins exactos
Django 5.2.18/Gunicorn 26.2.0.

El operador ya confirmó por separado Debian saludable/reinicio físico, backup y
restauración reales Fedora, recuperación 18/18 e infraestructura Django 5.2.18
16/16 y Gunicorn 26.2.0. No se repiten ni se atribuyen al agente.

Archivos de **esta revisión** (los cambios anteriores se conservan):

| Cambio | Archivos |
| --- | --- |
| Control mínimo | `backend/drivers/contact_api.py`, nuevo `backend/drivers/contact_throttle.py` |
| Tests | `backend/drivers/test_contact.py`, nuevo `backend/drivers/test_contact_throttle.py`, nuevo `infra/demo/security_test_settings.py` |
| Evidencia/procedimientos | Nuevo `docs/DEMO_SECURITY_REVIEW.md`; actualizados `docs/AUTH_ACCEPTANCE.md`, `docs/DEMO_RUNBOOK.md`, `docs/MVP_DEMO_FREEZE.md`, `docs/HOMELAB_DEMO.md`, `docs/decisions/0007-homelab-demo-deployment.md` |

Git conserva rama `task/11-homelab-deployment` y todo sin commit/staging nuevo.
No se modifican los otros archivos ya pendientes ni el otro worktree.

Para repetir las pruebas HTTP complementarias sin servicios, secretos ni DB
persistente, usar un venv local con las dependencias de backend instaladas:

```bash
PYTHONPATH="$PWD/infra/demo" python backend/manage.py test \
  --settings=security_test_settings --noinput \
  drivers.test_contact_throttle api.test_auth api.tests api.test_contracts \
  accounts.tests drivers.test_contact.ContactTests drivers.tests \
  drivers.test_controls.AdminControlTests drivers.test_operations.OperationsTests \
  drivers.test_daily_operation.DailyOperationTests \
  drivers.test_daily_operation.ChileDateTests drivers.test_publication.PublicationTests
python infra/demo/test_without_db.py
python infra/demo/test_config.py
python infra/demo/test_recovery.py
python infra/demo/check_config.py
python infra/demo/check_gunicorn.py
bash -n infra/demo/backup.sh infra/demo/restore.sh
git diff --check
```

`security_test_settings` usa configuración base normal de auth y una SQLite en
memoria con placeholders públicos solo de pruebas; jamás usarla para despliegue.
Los dos tests multiproceso se omiten explícitamente allí. Los tests de recuperación
usan mocks de Docker/puerto y directorios sintéticos temporales: son simulaciones.

**Gate PostgreSQL pendiente, fuera de Debian/DB operativa:** en un entorno Linux
de pruebas independiente, con PostgreSQL exclusivo y rol de test con CREATEDB,
preparar un venv con los pins del candidato. El operador debe comprobar primero
que el puerto 15432 pertenece a ese PostgreSQL de test, no a una DB de proyecto.
No apuntar al contenedor Debian ni ejecutar este comando vía su backend operativo.
Las suites crean/escriben/vacían exclusivamente su base `test_furgoplus_security_tests`;
`--keepdb` la conserva al terminar. No reutilizar ese nombre para datos útiles.

```bash
export DB_HOST=127.0.0.1 DB_PORT=15432 DB_NAME=furgoplus_security_tests
export DB_USER=furgoplus_security_test_runner
read -rs -p 'Clave del PostgreSQL exclusivo de test: ' DB_PASSWORD
printf '\n'
export DB_PASSWORD
export DJANGO_DEBUG=false DJANGO_ALLOWED_HOSTS=testserver
export API_PUBLIC_ORIGIN=https://testserver WEB_PUBLIC_ORIGIN=https://testserver
export DJANGO_TRUST_PROXY_SSL_HEADER=false
export DJANGO_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(64))')
export PRIVATE_UPLOAD_ROOT=/tmp/furgoplus-pg-security-tests-private
python backend/manage.py test --settings=config.settings --noinput --keepdb \
  drivers.test_contact_throttle drivers.test_contact api.test_auth \
  drivers.tests drivers.test_controls drivers.test_operations drivers.test_daily_operation
unset DB_PASSWORD DJANGO_SECRET_KEY
```

No almacenar ni imprimir las claves introducidas. Exigir ambas carreras
`ContactThrottleProcessTests` ejecutadas, sin skips, y todas las negativas de roles/
IDs y unicidad pendientes aprobadas. Las carreras parten de contadores vacíos,
usan procesos independientes y prueban cuenta compartida con IP distintas e IP
compartida entre cuentas. Registrar versiones, resultado, candidato y fecha.

## Preparación ficticia inicial — referencia, no repetir sobre r4

El agente no ejecutó este procedimiento. El operador confirma que r4 ya tiene su
escenario preparado y respaldado; no ejecutar el preflight de DB vacía, recrear
cuentas ni reemplazar datos en esa instancia. Preferir DEMO_SCENARIO para una
instancia nueva y compatible; los comandos manuales son alternativas, no pasos
adicionales que deban repetirse.

El operador aporta: ruta absoluta del env **externo** ya validado, proyecto real,
IDs de imágenes candidatas, fecha/hora America/Santiago del ensayo y vigencia de
documentos/plan/asignaciones; seis correos `@example.test` de la tabla de
[DEMO_RUNBOOK](DEMO_RUNBOOK.md), nombres claramente Demo, contraseña aleatoria
única por cuenta desde su gestor privado, IDs de perfil/ruta resultantes y un
navegador/dispositivo autorizados. No usar contraseñas del código de tests ni
credenciales reales/reutilizadas; no pasarlas en URLs, argv, Git o capturas.

Para distinguir el límite IP del límite de cuenta en el gate real, preparar además
`parent-throttle@example.test` (Familia Demo Throttle) como tercer apoderado ficticio,
con clave única del operador y el CLI privado de DEMO_MODE. El registro público
está cerrado; login/contactos conservan límites. Es una cuenta de ensayo, sin pasajeros/documentos.

Elegir **la base nueva prevista para esta demo**, ya migrada y con backend canónico
saludable; el procedimiento no la crea, migra, vacía ni reemplaza. Antes de escribir:

```bash
export DEMO_ENV_FILE=/ruta/externa/validada/demo.env
demo=(docker compose -p furgoplus-demo --env-file "$DEMO_ENV_FILE" -f infra/demo/compose.yaml)
"${demo[@]}" config --quiet
"${demo[@]}" ps
"${demo[@]}" exec -T backend python manage.py migrate --check
"${demo[@]}" exec -T backend python manage.py shell -c '
from django.apps import apps
models = [m for app in ("accounts", "drivers") for m in apps.get_app_config(app).get_models() if m.__name__ != "Plan"]
assert not any(m.objects.exists() for m in models), "STOP: hay registros; revisar manualmente, no reinicializar"
print("Base de demo sin cuentas/registros operativos; planes de migración permitidos")'
```

Si la negativa falla, **detener preparación**: no ejecutar limpieza ni volver a
sembrar por ensayo/error. Identificar el entorno y revisar la preparación existente
por UI. Una ejecución parcial se reanuda manualmente con las cuentas/IDs anotados,
sin intentar dejar la base vacía. Nunca importar un dump de FitFu o datos reales.

Después de la aprobación del operador de ese destino:

```bash
"${demo[@]}" exec -T backend python manage.py seed_demo_communes
"${demo[@]}" exec backend python manage.py createsuperuser --email admin-demo@example.test
umask 077
demo_file=$(mktemp /tmp/furgoplus-documento-sintetico.XXXXXXXX.png)
"${demo[@]}" exec -T backend python - <<'PY' > "$demo_file"
import sys
from PIL import Image, ImageDraw
image = Image.new("RGB", (640, 160), "white")
ImageDraw.Draw(image).text((20, 60), "DEMO SINTETICO - SIN DATOS REALES", fill="black")
image.save(sys.stdout.buffer, "PNG")
PY
```

`createsuperuser` solicita la contraseña sin eco; nunca `--noinput` con contraseña
de entorno. Crear los otros cinco usuarios con los comandos interactivos de
[DEMO_MODE](DEMO_MODE.md), sin endpoint público; las UIs originales sirven para
completar sus perfiles después del login. Login conserva 10/IP/15min. En una instancia nueva sin Tunnel
no hay aceptación HTTPS posible:
no iniciar sesión del navegador en el HTTP de loopback ni desactivar Secure/TLS.

Seguir las pantallas y tablas de DEMO_RUNBOOK: completar perfiles, cargar **solo el
PNG generado** en las tres categorías demo, fechas futuras; presentar/validar la
revisión exacta; asignar plan con inicio pasado y fin exclusivo posterior al ensayo;
crear rutas/asignaciones/pagos ficticios y solicitar publicación. Usar destino
`Escuela Demo / Calle Ficticia 123, Comuna Demo`, sin domicilio/landmark real; Maps
puede no resolverlo y no demuestra GPS. Nombres `Pasajero Demo A/B`, tutores Demo,
correos `.test`, teléfono de formato demo (no contactar: ningún número se presume
inexistente), sin RUT, DOB o datos médicos. No usar seed de tests/SQL para saltar
validación ni editar estados de operación diaria. Reseñas opcionales solo tras
verificar los IDs y la ausencia de colisiones en esta base sintética; no son necesarias.

Comprobar por cada actor que no ve datos del otro, publicación solo de A/B,
ausencia de contacto pendiente para el par principal y rutas no iniciadas ese día.
Anotar IDs/estados y fecha en registro restringido; mantener contraseñas solo en
gestor separado. Realizar después un snapshot DB+privados con el procedimiento
[HOMELAB_DEMO](HOMELAB_DEMO.md), con escritores detenidos y recuperación aislada
comprobada. Ese paso es manual posterior, no ejecutado ni autorizado por esta revisión.

## Condiciones para autorizar acceso temporal

1. Aprobar pruebas PostgreSQL con los pins exactos y revisar imágenes/dependencias;
   registrar su evidencia e identidad sin confundir este checkout con imágenes r4.
2. Mediante una operación posterior autorizada, actualizar Debian y repetir salud,
   deploy checks (solo W005/W021 deliberados), persistencia y negativa de acceso LAN.
3. Preparar datos totalmente ficticios por CLI privado y confirmar registro cerrado
   en ambos roles, formularios sin POST/storage y ausencia de accesos privados
   anónimos. La decisión de producto es URL pública sin filtro de IP; no añadir
   allowlists ni challenges/login HTML incompatibles con Flutter. Login carece de
   bucket por cuenta y cargas solo limitan parejas cuenta/IP: conservar claves
   fuertes, credenciales controladas y supervisión. Cerrar registro elimina la
   creación anónima masiva de cuentas que habilitaba esas cargas, no todo abuso.
4. En r4 conservar la ruta activa; para una instancia futura activar solo en un
   ensayo autorizado la ruta exacta de Tunnel, certificado,
   HTTPS obligatorio y bypass cache API, y ejecutar [AUTH_ACCEPTANCE](AUTH_ACCEPTANCE.md):
   browser y Android real, registro ilustrativo/rechazo, login/rotación/logout/reload, almacenamiento
   seguro tras force-stop, expiry/cambio de contraseña/desactivación, roles/IDs,
   CSRF ausente/ajeno y cookies host-only Secure/HttpOnly/Lax. Build/tests Flutter
   previos y APK con `api.example.test` no certifican este origen.
5. Por dos fuentes reales, comprobar buckets independientes y que variar XFF,
   Forwarded, X-Real-IP, X-FurgoPlus-Client-IP y CF-Connecting-IP desde el cliente
   no cambia su bucket. Confirmar IP al entrar mediante pruebas/buckets, sin loguear
   cookies ni datos personales; falta/malformación del proxy debe fallar cerrado.
   Verificar `/private/`, `/admin/`, `/media/`, `/static/` 404, API desconocida JSON404,
   errores sin traza, API no cacheada y ausencia de exposición de documentos ajenos.
   Con ventanas inicialmente disponibles, consumir 10 intentos de payload inválido
   de A desde fuente 1: deben dar 400; el siguiente desde fuente 2 debe dar
   `429/throttled` por cuenta. Consumir después 5 de B y 5 de C desde fuente 1
   (también 400); el siguiente de C desde esa fuente debe dar 429 y desde fuente 2
   debe volver a 400. Así se prueba IP compartida sin agotar la cuenta C. Hacer la
   prueba de headers falsos con presupuesto de cuenta disponible y registrar
   solamente códigos/contadores sintéticos, no credenciales. Una comprobación que
   agotó ambos buckets no demuestra por sí sola cuál IP se usó. Esperar expiración
   de ventanas antes de la demo; no borrar contadores ni datos para repetirla.
6. Registrar evidencia fechada de ese candidato, navegador/APK/dispositivo, fuentes
   y snapshot recuperable. El operador decide ventana limitada y supervisada,
   cuentas preparadas, responsables y cierre posterior del túnel. Sin filtro de IP
   para visitantes. Hasta entonces
   los gates pendientes bloquean la autorización; no se declara producción lista.
