# FurgoPlus: demo de homelab Debian 13

Configuración preparada el **14-10-2026**, con integración Fedora, backup/restore
real en Fedora y despliegue/reinicio físico Debian 13 confirmados por el operador.
Worktree:
`/home/duran/Proyectos/furgoplus-homelab`, rama `task/11-homelab-deployment`, base
`816dda0`. Task 09/10 está integrada documentalmente aquí, sin commit; el otro
worktree no se modifica. **Estado actual comunicado: r4 está desplegada y probada
en Debian por HTTPS/Tunnel**. React, Django, PostgreSQL y APK funcionan con datos
sintéticos; el escenario automático está preparado y respaldado. Registro público
cerrado. Ver [DEMO_SCENARIO](DEMO_SCENARIO.md) y [revisión final](TASK11_FINAL_REVIEW.md)
para el alcance y evidencia pendiente, sin recrear cuentas ni restaurar sobre Debian.
Las instrucciones iniciales posteriores requieren adaptar el estado existente.
No representa aceptación
de producción. El agente no arranca ni modifica servicios en esta revisión.

Decisión de producto posterior: hostname público **sin restricciones de IP para
visitantes**, con cuentas ficticias controladas. `settings_demo` fuerza registro
cerrado en servidor y el Dockerfile web compila los formularios ilustrativos.
Ver [DEMO_MODE](DEMO_MODE.md) para el CLI privado, builds, superficie anónima y
aceptación React/Flutter. No activar registro para preparar datos ni reutilizar
settings/builds demo en el futuro `app.furgoplus.cl`.

## Código y alcance inspeccionados

Se revisaron `config/settings.py`, WSGI, URLs, API de salud/autenticación,
`accounts.AuthThrottle`, carga/almacenamiento de documentos, solicitudes de
contacto, cliente React, Dockerfiles, Compose, CI y comandos de semillas.
Se contrastaron ARCHITECTURE, PRODUCT_SCOPE, MVP_DEMO_FREEZE, el inventario de
privacidad y ADR 0001–0006. La arquitectura inicial describe funcionalidades
previstas; el código actual ya incluye validación, publicación, solicitudes,
operación diaria, pasajeros y pagos manuales. El despliegue no cambia esas reglas.

La web de gestión de conductor/administrador usa `/api/v1/` con credenciales del
mismo origen. El administrador React funciona mediante esa API; `/admin/` de
Django no se publica. Flutter mantiene las sesiones/CSRF de ADR 0002 y debe usar
`https://demo.furgoplus.cl`, incluyendo Origin en métodos inseguros. No hay JWT,
WebSockets, GPS, Redis ni trabajos de producto añadidos.

**Solo datos sintéticos:** cuentas y correos `*.example.test`, perfiles rotulados
Demo, documentos generados sin identidades reales, pasajeros/tutores ficticios y
destinos de prueba. No importar una base real, documentos personales ni respaldos
de FitFu. `DEMO_SYNTHETIC_ONLY=true` exige reconocimiento explícito; no detecta ni
impide que una persona escriba datos reales. Mantener la demostración supervisada.

## Topología, persistencia y recursos

```text
HTTPS público: https://demo.furgoplus.cl
  Cloudflare -> túnel cifrado -> cloudflared EN EL HOST
    -> http://127.0.0.1:18080 (Host: demo.furgoplus.cl)
       ingress (bridge convencional; solo Caddy)
       Caddy:8080 -> React compilado
                 -> /api y /api/* -> Gunicorn:8000 -> Django/DRF
                                                  -> PostgreSQL:5432
                                                  -> volumen privado de archivos
```

`infra/demo/compose.yaml` es independiente de `infra/compose.yaml`. Nombre de
proyecto `furgoplus-demo`; sin nombres globales de contenedor ni redes externas.
Volúmenes por defecto: `furgoplus-demo_pg_data` y
`furgoplus-demo_private_uploads`. Nunca reutilizar los de desarrollo u otro proyecto.
La red `database` contiene DB/backend; `proxy`, Caddy/backend. Ambas son internas.
La tercera red, `ingress`, es un bridge convencional exclusivo de Caddy, creado
dentro del proyecto. En la integración Fedora fue necesario para publicar
efectivamente el puerto del host; con solo redes internas el puerto no respondía.
Backend y PostgreSQL no se conectan a ingress y no publican puertos.
Solo se publica `127.0.0.1:18080`; ni PostgreSQL, Gunicorn, admin Caddy ni IPv6 del
host tienen un puerto publicado. No abrir puertos en el router.

Ingress añade salida de red a Caddy, pero no una publicación adicional, una red
compartida con FitFu, acceso directo a PostgreSQL ni confianza en nuevas IP de
proxy. No necesita `network_mode: host`, contenedor privilegiado, capabilities,
puertos 80/443/2019 del host ni un montaje del socket Docker. Django/Gunicorn
siguen confiando exclusivamente en la IP fija de Caddy **en proxy**, nunca en la
IP asignada en ingress. Caddy es parte de la frontera de confianza: su compromiso
permitiría alcanzar la API, aunque no la red de DB directamente.

La publicación en loopback depende también del Engine/firewall del host.
Docker documenta un problema de acceso desde la misma LAN para publicaciones
localhost con versiones anteriores a 28.0.0; usar un Engine corregido y verificar
desde otra máquina que 18080 no es accesible. No habilitar direct routing ni cambiar
el bridge a modo routed para esta demo. Ver
[publicación de puertos de Docker](https://docs.docker.com/engine/network/port-publishing/).

| Servicio | Inicio propuesto | Límite memoria / CPU | Salud |
| --- | --- | --- | --- |
| PostgreSQL 17.6 Alpine | 128 MiB shared_buffers, 30 conexiones | 768 MiB / 1 | `pg_isready` |
| Django 5.2 + Gunicorn 26.2.0 | WSGI, 2 procesos × 2 hilos | 1024 MiB / 1.5 | HTTP JSON + `SELECT 1`, sin escrituras |
| Caddy 2.11.7 Alpine | React construido con Node 22.19.0 | 128 MiB / 0.5 | API a través de Caddy |

Las cuotas suman 1.875 GiB y tres CPU, sin reserva garantizada. PostgreSQL y Python
mantienen las imágenes base del repositorio; Gunicorn/Caddy son pins adicionales.
Las etiquetas no son digests inmutables ni una auditoría de vulnerabilidades.
Antes de exponer, revisar avisos de los pins/base, construir y registrar sus IDs.
Node compila la web y no corre en el contenedor final. No se publican dev servers,
montajes de código o directorios de documentos. Caddy usa gzip y cachea solo assets
compilados con hash; index se revalida y todas las respuestas API son `no-store`.

Backend/Caddy corren con UID/GID 10001, filesystem de imagen de solo lectura,
capabilities eliminadas y `no-new-privileges`. Se elimina la file capability del
binario oficial Caddy para poder ejecutarlo con esa política en el puerto 8080.
El volumen privado nace con dueño 10001 y modo 0700. `/tmp` es tmpfs limitado
(64 MiB backend, 16 MiB Caddy); Gunicorn usa `/dev/shm` para sus heartbeats y evita
escrituras de heartbeat al HDD. El proxy admite 11 MiB de cuerpo para archivos de
10 MiB más multipart; un rechazo del proxy puede no usar el sobre JSON de Django.
Salud no certifica migraciones aplicadas, autorización, restauración ni HTTPS.

La integración corrigió también los tipos aceptados por el archivo de Gunicorn:
`forwarded_allow_ips = os.environ['DEMO_CADDY_IP'] + ',127.0.0.1'` y
`forwarder_headers = ''`. Son cadenas, no listas Python. La primera limita los
peers que pueden aportar esquema HTTPS; la segunda impide habilitar cabeceras
forwarded que reescriban PATH_INFO/SCRIPT_NAME. Las regresiones verifican tipos y
valores; `check_gunicorn.py` ejecuta además el parser real con `--check-config`.

Construcciones no están limitadas por las cuotas de runtime. Preferir construir
imágenes `linux/amd64` fuera del homelab, o secuencialmente en una ventana manual.
Medir RAM, latencia, OOM, espacio y contención del HDD con FitFu antes de aumentar
workers/conexiones. No hay alta disponibilidad: host, disco e Internet son puntos
únicos de fallo.

## Secretos y configuración

`infra/demo/.env.example` contiene únicamente paths y parámetros no secretos.
Crear `infra/demo/.env` manualmente a partir del ejemplo. No usar el `.env` raíz
del desarrollo, ni añadir contraseñas/keys a variables de Compose, Git o comandos.
`FURGOPLUS_RELEASE` identifica imágenes de esta versión; usar un tag nuevo por
cambio y conservar los anteriores para recuperación.

Provisionar manualmente, fuera del repositorio, dos archivos de una línea:

- `/etc/furgoplus/demo/django_secret_key`: valor aleatorio único de al menos
  50 caracteres, sin espacios; por ejemplo 32 bytes expresados en hexadecimal.
- `/etc/furgoplus/demo/db_password`: valor aleatorio único de al menos 20
  caracteres; nunca compartirlo con FitFu u otra instancia.

No se generan valores en esta entrega. El directorio padre debe ser de root y modo
0700. Los archivos pueden tener modo 0444 **dentro de ese directorio inaccesible**:
los consumidores no root de Django y PostgreSQL necesitan leer el archivo montado.
Si se provisionan con 0600 root, el backend no podrá leerlos. Verificar la cadena
completa de directorios y los permisos con `namei -l`, sin mostrar los valores.
Compose standalone monta archivos de solo lectura y no garantiza remapeo UID/GID;
no es un vault ni un almacenamiento cifrado. El Docker daemon/root es parte de
la frontera de confianza. En rootless/user namespaces revisar mapeos antes de usar.

Solo backend recibe ambos secretos; DB recibe únicamente su contraseña. Caddy no
recibe ninguno. Mantener una copia cifrada de los secretos fuera del HDD, separada
del respaldo de datos; guardar credenciales del túnel también fuera de Git.
Los ignores excluyen `.env`, carpetas locales de secretos/respaldos y configuración
real del túnel. No ejecutar `docker inspect`/`printenv`/`diffsettings` para compartir
diagnósticos: la aplicación carga secretos a su entorno durante el arranque.

No rotar la contraseña cambiando solo el archivo: `POSTGRES_PASSWORD_FILE` se
aplica al inicializar un volumen vacío. En uno existente el cambio requiere una
operación interactiva de PostgreSQL (`\password furgoplus_demo`), coordinación del
archivo y reinicio del backend. No se propone SQL con contraseñas en texto.
Cambiar la key Django invalida sesiones; no prometer una rotación transparente.
El usuario de la imagen PostgreSQL es el propietario bootstrap con privilegios
elevados: aceptado solo para esta demo aislada; separar roles antes de producción.

## HTTPS, túnel y confianza de proxies

La configuración espera cloudflared en el **host**, no en un contenedor con su
propio loopback. No se instala ni configura el conector en esta tarea. Después de
activar DNS, el operador debe crear/configurar el túnel y la ruta exacta
`demo.furgoplus.cl -> http://127.0.0.1:18080`, con `httpHostHeader=demo.furgoplus.cl`.
`infra/demo/cloudflared.example.yaml` es una plantilla para túnel administrado
localmente: reemplazar UUID y path de credenciales en un archivo externo, validar
ingress y mantener la regla final `http_status:404`. Si el conector es administrado
remotamente, usar la ruta equivalente en Cloudflare, sin copiar un token al repo.
Modificar también la ruta si se cambia `DEMO_HTTP_PORT`.

El navegador/API comparten HTTPS. El tramo edge–cloudflared va cifrado y el último
salto HTTP queda en loopback/red Docker. No hay certificados ni ACME en Caddy.
Activar redirección HTTP→HTTPS en Cloudflare para ese hostname y bypass de caché
para `/api` y `/api/*`; no aplicar una regla Cache Everything a la API ni cachear
respuestas con cookies. Confirmar certificado público válido y ausencia de bucles.

`settings_demo.py` fuerza DEBUG false, host exacto, redirects HTTPS, HSTS un año
sin subdominios, sesión DB, cookies Secure/HttpOnly/Lax host-only, y
`CSRF_TRUSTED_ORIGINS=['https://demo.furgoplus.cl']`. No confía en forwarded Host,
no añade CORS y no permite cookies para todo `.furgoplus.cl`. Se valida Host incluso
en vistas que no llaman `get_host()`. Las opciones inseguras del entorno de
desarrollo no cambian estos valores. HTTP local sirve para diagnóstico técnico;
no es una prueba válida de login de navegador con cookies Secure.

### Dos avisos HSTS deliberados

Se conservan visibles, sin `SILENCED_SYSTEM_CHECKS`:

- **security.W005**: `SECURE_HSTS_INCLUDE_SUBDOMAINS=False`. La política queda
  en el host demo y no se extiende a posibles subdominios de `demo.furgoplus.cl`.
  Esa opción en el host demo no afectaría a dominios hermanos como FitFu.
- **security.W021**: `SECURE_HSTS_PRELOAD=False`. No se anuncia `preload` ni se
  solicita inscripción en listas de navegador para una demo temporal.

HSTS permanece activo durante un año para el host demo; Caddy tampoco añade
`includeSubDomains` ni `preload`. Los checks operativos usan `--fail-level ERROR`
para no fallar por esos avisos conocidos, que siguen mostrándose. **Cualquier aviso
adicional requiere detener la aceptación y revisarlo**; exit 0 no significa que
todos los avisos sean aceptables. `restore.sh` deja la app detenida para esa revisión.
La regresión de HSTS comprueba ambos códigos; ver los
[checks de seguridad de Django](https://docs.djangoproject.com/en/5.2/ref/checks/#security).

La IP fija de Caddy (`172.30.81.2`) y backend (`172.30.81.3`) están en un `/29`
interno. Revisar colisiones de subred con LAN, VPN, Docker y FitFu. Si hay conflicto,
cambiar conjuntamente `DEMO_PROXY_SUBNET`, `DEMO_CADDY_IP`, `DEMO_BACKEND_IP`.
Nunca sustituir la IP confiable por `*`, todas las redes privadas o una cadena XFF.

### Auditoría de IP y throttling del código actual

| Control | Implementación inspeccionada | Efecto/riesgo |
| --- | --- | --- |
| Login | `api.auth.throttle`: 10 intentos / 15 min por IP | Cuenta también intentos válidos; una NAT comparte límite |
| Registro | Demo: 403/registration_disabled antes de payload/counters/escrituras; normal: 5 / hora por IP | Formulario ilustrativo sin envío/storage; cuentas demo por CLI privado con TTY |
| Cargas | `drivers.services.upload_rate`: 20 / hora por pareja conductor/IP | No es un límite agregado independiente por cuenta y por fuente |
| Persistencia/concurrencia | `accounts.AuthThrottle`, SHA-256 de la clave, transacción y row lock | Compartido entre workers; no depende del LocMemCache de DRF |
| Contact-create | `drivers.contact_throttle.contact_create_rate` antes del payload y la transacción de dominio | 10 intentos/cuenta/hora y 20/IP/hora independientes; ambos se consumen, incluido 400/404/409/429; falla con 429 si cualquiera se agota |

Contact-create usa ventanas fijas desde el primer intento, claves distintas de
login/registro/cargas, adquisición ordenada de filas y commit antes de rechazar.
No hay migración nueva ni caché por proceso. Autenticación, rol y CSRF se comprueban
antes de asignar contadores. La prueba PostgreSQL de carreras entre procesos está
preparada pero **no ejecutada aquí**; no inferir su aprobación de SQLite ni de los
16 tests de infraestructura. No envolver toda la petición en `ATOMIC_REQUESTS`:
un rollback externo podría devolver el presupuesto consumido. Ver
[DEMO_SECURITY_REVIEW](DEMO_SECURITY_REVIEW.md) para evidencias y gates.

Antes del ajuste, `REMOTE_ADDR` sería Caddy y todos los visitantes compartirían
los buckets de login/registro. La demo normaliza `REMOTE_ADDR` antes de las vistas:
Caddy **sobrescribe** `X-FurgoPlus-Client-IP` con `CF-Connecting-IP`, elimina XFF,
forwarded Host, Forwarded y otras cabeceras de esquema, y establece HTTPS. Django
solo acepta esa IP desde el peer Caddy exacto; valida una única IPv4/IPv6,
canonicaliza IPv6 y direcciones IPv4-mapped y rechaza listas, puertos, scope IDs o
valores ausentes. No se utiliza la primera IP de una cadena enviada por el usuario.
Los demás peers conservan su socket IP y su esquema queda HTTP. La única excepción
local para esquema es GET `/api/v1/health/` desde `127.0.0.1` del backend.

Cloudflare debe conservar `CF-Connecting-IP`: desactivar Remove visitor IP headers
y evitar Pseudo IPv4 en Overwrite Headers. No introducir Workers en esta ruta sin
revisar sus cambios de IP. Cloudflare documenta esos casos en sus
[cabeceras HTTP](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
La IP es un control de abuso, no identidad ni autorización. No protege contra DDoS,
muchas cuentas/IPs rotativas ni saturación del HDD. El hash no convierte una IP
en dato anónimo. No hay limpieza de filas antiguas de AuthThrottle en este alcance.
`NUM_PROXIES=0` evita que futuros throttles DRF consulten una cadena XFF; si se
añaden, revisar también su caché/concurrencia.

Un proceso local con acceso a loopback puede forjar cabeceras Cloudflare: el salto
local no autentica al conector. Docker/root y los procesos locales confiables son
parte de la seguridad del homelab. No compartir redes Docker de esta demo ni abrir
18080 en LAN; si hay usuarios/procesos locales no confiables, reforzar esa frontera
antes de exposición. No afirmar que Caddy verifica la procedencia de Cloudflare.

## Comprobaciones realizadas y límites de evidencia

### Integración real Fedora comunicada por el operador

| Comprobación | Resultado comunicado |
| --- | --- |
| PostgreSQL, Gunicorn y Caddy | Healthy |
| React por el puerto loopback | HTTP 200 |
| API health por Caddy | HTTP 200 |
| `/private/` | HTTP 404 |
| API sin IP del proxy | HTTP 400 |
| Pruebas Django con el pin 5.2.18 | 16/16 correctas, incluido HSTS |
| Gunicorn 26.2.0 | Validado por el operador |

Esta evidencia prueba la integración local HTTP en Fedora con las tres
correcciones. Posteriormente el operador confirmó backup/restauración reales en
Fedora, 18/18 tests de recuperación, despliegue saludable en Debian 13 y reinicio
físico. Después confirmó r4 funcionando por HTTPS con React y APK y el escenario
respaldado. Son resultados del operador: no se recibió la matriz detallada de
AUTH_ACCEPTANCE ni el log de carreras PostgreSQL. El agente no repitió esas
operaciones ni inspeccionó secretos del entorno operativo.

### Consolidación estática por el agente

Se ejecutan exclusivamente checks sin servicios ni secretos reales:

- `docker compose --env-file infra/demo/.env.example -f infra/demo/compose.yaml config --quiet`: pasa; Compose local v5.5.1.
- `python3 infra/demo/check_config.py`: pasa; modelo normalizado, tres
  servicios/tres redes, ingress exclusivo, único puerto TCP en IPv4 loopback,
  aislamiento backend/DB, paths de secretos, límites, persistencia y AST.
- `python3 infra/demo/test_config.py`: **9/9**; rechaza publicación LAN/IPv6,
  puerto admin/UDP/rangos, ingress en backend/DB, redes compartidas/routed,
  secretos/archivos/capabilities en Caddy y listas incorrectas de Gunicorn.
- `python infra/demo/check_gunicorn.py`: **pasa** el parser real con
  `--check-config`, usando una aplicación WSGI de la biblioteca estándar y un
  entorno limitado. No importa Django, no lee archivos de secretos, no conecta
  DB ni abre puertos. Versión local disponible: **Gunicorn 23.0.0** en `/tmp`;
  evidencia complementaria, no sustitución del check con 26.2.0 en la imagen.
- `bash -n infra/demo/backup.sh infra/demo/restore.sh`: pasa; wrappers no ejecutados contra servicios.
- `python3 infra/demo/test_recovery.py`: **18/18 simulaciones**; sin Docker Engine, volumen real ni sockets del host.
- Ruff check/format de los once Python de demo: pasa con Ruff 0.13.2 en `/tmp`.
- `infra/demo/test_without_db.py`: **16/16**; IP por visitante, spoofing,
  canonicalización, peer/esquema, Host, CSRF real, cookie CSRF Secure/HttpOnly/Lax,
  mismo origen, fail-closed de configuración y los dos avisos HSTS visibles.
- `git diff --check`: pasa. No se generaron secretos de despliegue.

Las pruebas nuevas del agente usan un entorno aislado en `/tmp` y dependencias de
caché: Python 3.14.8, Django 5.2.12, DRF 3.16.1, asgiref 3.12.1, sqlparse 0.6.0.
Los placeholders de pruebas nunca son credenciales de despliegue. Es evidencia
complementaria; repetir las **16** pruebas con Django 5.2.18/Python 3.13.8 y
`check_gunicorn.py` con Gunicorn 26.2.0 en la imagen que se vaya a aceptar.
El runner configura `DATABASES={}`; no abre sockets ni crea bases/migraciones.
En esta revisión no se ejecutó la suite PostgreSQL de producto, build/imágenes,
`caddy validate`, arranque real de Gunicorn, backups/restauración ni smoke HTTPS.
Se conserva la configuración de desarrollo; la revisión de seguridad posterior
añade el control mínimo de contacto descrito arriba. No se instala software en el homelab.

## Siguientes comandos manuales

Para **crear cuentas/registros en la base nueva Debian** sin contraseñas en Git,
usar la precondición de base sin datos operativos y el procedimiento explícito en
[DEMO_SECURITY_REVIEW](DEMO_SECURITY_REVIEW.md). No reutilizar pasos iniciales de
provisión sobre una instancia que ya contiene datos. Esa revisión también registra
las nuevas pruebas locales de contacto/auth/objetos y las carreras/HTTPS pendientes;
los checks de consolidación anteriores tienen su propio alcance de evidencia.
La creación de usuarios parent/driver se realiza con `create_demo_account`, no
desde los registros públicos: comandos exactos en [DEMO_MODE](DEMO_MODE.md).

La primera sección es estática y no lee secretos. Los pasos operativos posteriores
son para una ventana autorizada y no se ejecutan en esta consolidación. La
integración HTTP Fedora ya fue realizada por el operador; no volver a provisionar
su instancia ni ejecutar semillas/migraciones para repetir checks. Desde la raíz:

```bash
# Solo estático, no requiere secretos reales ni daemon.
python3 infra/demo/check_config.py
python3 infra/demo/test_config.py
python3 infra/demo/test_recovery.py
# Con dependencias ya disponibles en un entorno de validación:
python infra/demo/check_gunicorn.py
python infra/demo/test_without_db.py
bash -n infra/demo/backup.sh infra/demo/restore.sh
git diff --check

```

`check_gunicorn.py` imprime la versión utilizada y se incorpora al próximo build.
La imagen de la integración anterior puede no contenerlo. Para validación manual
con una imagen reconstruida, elegir un **tag candidato nuevo** y reemplazar el
placeholder; no sobrescribir el tag de la versión probada:

```bash
docker run --rm --pull never --network none --read-only --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges:true furgoplus-demo-backend:RELEASE_CANDIDATO python check_gunicorn.py
```

Para el backend Fedora **ya existente**, el operador puede comprobar el parser
con el mismo callable estándar, sin arrancar servicios, cargar Django ni leer
archivos de secretos; no usar `--print-config`:

```bash
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend gunicorn --check-config --config /app/gunicorn.conf.py wsgiref.simple_server:demo_app
```

El helper valida los tipos/configuración de Gunicorn, no la carga de Django.
El siguiente bloque es referencia para **una instancia nueva** o una ventana
operativa separada; los comandos que cargan `settings_demo` leen los archivos
externos internamente y no forman parte de los checks sin secretos de esta revisión.

```bash

# Preparar parámetros no secretos; provisionar archivos externos por separado.
cp -n infra/demo/.env.example infra/demo/.env
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml config --quiet
# Revisar redes/rutas/puerto sin tocar otros proyectos.
docker network ls
ip route
ss -ltn
docker version --format '{{.Server.Version}}'

# Construir secuencialmente; no modifica DB ni ejecuta migraciones.
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml build backend caddy
# Validar Caddy compilado en un contenedor efímero sin red/puertos/secretos.
# Sustituir el tag si cambió FURGOPLUS_RELEASE.
docker run --rm --network none --read-only --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges:true furgoplus-demo-web:demo-816dda0-r1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Crear DB/backend canónicos NUEVOS sin Caddy; no backend one-off con IP fija.
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml up -d --no-recreate --no-build --pull never --wait db backend
# Checks con pins reales. El runner de las 16 pruebas no utiliza DB.
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend python test_without_db.py
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend python manage.py check --deploy --fail-level ERROR
# Revisar que SOLO aparezcan los dos avisos HSTS W005/W021 documentados.
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend gunicorn --check-config --config gunicorn.conf.py config.wsgi:application
# Revisar el plan antes de aplicar, nunca se hace automáticamente al arrancar.
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend python manage.py migrate --plan
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend python manage.py migrate --noinput
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend python manage.py migrate --check
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec -T backend python manage.py seed_demo_communes
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml exec backend python manage.py createsuperuser
# Usar email sintético e introducir contraseña nueva de forma interactiva.
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml up -d --no-recreate --no-build --pull never --wait caddy
docker compose --env-file infra/demo/.env -f infra/demo/compose.yaml ps
curl --fail --silent --show-error -H 'Host: demo.furgoplus.cl' -H 'CF-Connecting-IP: 203.0.113.10' http://127.0.0.1:18080/api/v1/health/
```

El runner independiente viene en la imagen y detecta `/app` como raíz del backend.
Puede ejecutarse también
`python manage.py test config.test_demo_proxy`: SimpleTestCase no crea BD, pero el
runner normal hace checks de Django y necesita las dependencias del proyecto.

No cargar una fixture completa inventada: este baseline tiene semillas de comunas
y reseñas, no un comando único de demo/reset. Crear perfiles/planes/rutas mediante
los flujos existentes y la guía DRIVER_VALIDATION_DEMO. Las reseñas son optativas:
`python manage.py seed_demo_reviews <id-conductor-demo> --demo`, solamente con un
conductor Demo elegible. Ninguna semilla corre al arrancar.

## Aceptación posterior de HTTPS

Después de activar DNS y conectar el túnel:

```bash
curl --fail --silent --show-error https://demo.furgoplus.cl/api/v1/health/
curl --head https://demo.furgoplus.cl/
curl --head http://demo.furgoplus.cl/
```

Verificar redirección a HTTPS, host extraño rechazado, `/api/v1/missing/` JSON 404,
SPA profunda, assets, `/admin/`/`/media/`/`/private/` 404 y ausencia de bucles/caché API.
En navegador y Flutter repetir bootstrap→login→GET privado→escritura CSRF→reinicio
con sesión restaurada→logout→rechazo de cookie anterior; revisar cookie de sesión
y CSRF host-only/Secure/HttpOnly/Lax, Origin foráneo, falta/token CSRF incorrecto,
expiración, usuario deshabilitado y permisos por objeto. Ver AUTH_ACCEPTANCE.
Probar dos fuentes/IP sintéticas para buckets independientes y cabeceras XFF/
X-FurgoPlus-Client-IP forjadas que no cambien la IP efectiva a través de Cloudflare.
No agotar deliberadamente límites sobre participantes reales.

No hay access log Caddy ni Gunicorn. Docker rota los logs por servicio en
3 × 5 MiB. Errores Django/PostgreSQL todavía pueden incluir valores o paths;
inspeccionarlos con datos sintéticos y acceso restringido antes de compartirlos.
No activar debug/logs de bodies, cookies, tokens, query strings o archivos.
El fallo de un healthcheck marca unhealthy; no reinicia por sí mismo un contenedor.

## Backups y ensayo de restauración

**Estado:** procedimiento preparado y probado con simulaciones, todavía sin
backup/restore real. El operador confirmó ahora **16/16 con Django 5.2.18** y
**Gunicorn 26.2.0 validado**. La canary real declarada es
`.restore_canary_task11`, con `FURGOPLUS_TASK11_RESTORE_TEST`; el agente no leyó ese
volumen. Las pruebas usan una copia sintética del marcador en `/tmp`.

Objetivo inicial: backup diario y previo a cambios, siete diarios/cuatro semanales
fuera del HDD y cifrados. RPO 24 h y objetivo RTO 2 h **a confirmar en ensayo**;
sin PITR ni alta disponibilidad. Registrar versión, tamaños, hashes y duración.

### Por qué no usar un backend one-off

El backend tiene IP fija. El contenedor canónico puede conservarla incluso
estando detenido; `docker compose run --rm --no-deps backend` puede fallar con
`Address already in use`. No usar ese patrón en backup, restore, checks ni tareas
manuales. Para Django usar `exec` sobre el backend canónico, con Caddy detenido
hasta completar los gates. No retirar la IP fija para ocultar el problema.

`backup.sh` y `restore.sh` delegan a `recovery.py`, que requiere Python 3.12+ de
host, Compose y un daemon Linux local por socket Unix. No instala dependencias.
Soporta únicamente volúmenes Docker `local` sin opciones especiales y etiquetados
para el proyecto: no NFS/plugins ni contextos remotos. Un recurso sin etiquetas
esperadas se rechaza; no se adopta ni se crea automáticamente.

### Garantías y límites de los scripts

- Antes de detener escritores, el backup exige los tres contenedores originales,
  las dos identidades de volumen y sus montajes correctos; PostgreSQL debe correr.
  Se fija explícitamente el proyecto fuente `furgoplus-demo`.
- El operador debe pausar cron, mantenimiento, imports y cualquier otro escritor,
  confirmándolo con `DEMO_WRITERS_PAUSED=true`. El script detiene Caddy/backend y
  verifica que ambos estén detenidos. PostgreSQL sigue corriendo; el dump lógico
  y los documentos se capturan en esa misma ventana sin escritores.
- Los auxiliares usan el **ID de imagen del backend existente**, `--pull never`,
  `--network none`, UID/GID 10001, filesystem de solo lectura, ninguna capability,
  `no-new-privileges`, sin healthcheck, 128 MiB/0.5 CPU/64 PIDs y ningún secreto.
  La imagen no debe declarar `VOLUME`, para evitar almacenamiento anónimo implícito.
- La carpeta del volumen se obtiene de metadata y se monta con
  `--mount type=bind,...,readonly` para el backup. Se vuelve a verificar el volumen
  tras detener escritores. No se usa `-v`, `type=volume`, `--volumes-from` ni
  `bind-create-src`: una fuente inexistente falla, no crea un volumen/directorio.
  Ver [bind mounts de Docker](https://docs.docker.com/engine/storage/bind-mounts/).
- En Fedora, solo el auxiliar utiliza `label=disable` para no relabelar los archivos
  del volumen con `:z/:Z`. Es una excepción de confinamiento SELinux limitada a
  ese proceso sin red ni capabilities, con montaje fuente RO para exportar. Los
  servicios normales conservan su configuración; validar DAC/SELinux en el ensayo.
- El destino del backup es nuevo, 0700, fuera del repositorio; no se sobrescribe.
  El snapshot incluye `database.dump`, `private_uploads.tar`, `source.tar`,
  `deployment.env` (solo parámetros permitidos y paths, no copia arbitraria del
  `.env`), `images.txt`, `image-identities.txt`, `manifest.json`,
  `private-files.json` y `SHA256SUMS`.
- Se valida el catálogo con `pg_restore --list`, hashes del snapshot y hashes/tamaños
  de cada archivo privado. Se rechazan rutas absolutas/traversal, entradas repetidas,
  enlaces y devices. `COMPLETE` es la última escritura, después de verificar todo.
  Un directorio sin ese marcador o con hashes incorrectos no es restaurable.
- Restore requiere `furgoplus-demo-restore-*`, sin contenedores ni volúmenes/redes
  previos con ese prefijo. Rechaza subred coincidente con la fuente o solapada con
  redes Docker, puerto igual a la fuente/publicado/ocupado e imágenes distintas
  de los IDs respaldados. No descarga ni construye imágenes.
- Solo después del preflight crea la DB nueva y **crea sin arrancar** un backend
  canónico con `--no-recreate`. Así se inicializa el volumen privado nuevo con
  ownership de la imagen sin otro contenedor que reclame su IP. Valida los montajes
  nuevos y el catálogo antes de restaurar DB en una única transacción.
- Los archivos se restauran únicamente sobre el volumen privado **vacío y nuevo**,
  usando otro bind y un auxiliar sin red. Se transmiten TAR e inventario por stdin:
  no se hacen legibles públicamente backups 0600/0700 para el UID del contenedor.
  La extracción usa `tarfile` con filtro `data` y verifica todos los bytes mediante
  hashes. Al terminar, DB corre; backend está creado/detenido y Caddy no se inicia.
- No hay migraciones automáticas, reinicio de la fuente, downgrade, prune, `down`,
  eliminación de volúmenes ni rollback de datos. `--rm` solo limpia el auxiliar
  propio al terminar; ninguna operación de este procedimiento se ejecutó aquí.

Los preflights no reservan atómicamente puertos, subredes ni recursos frente a
otros administradores. La ventana debe ser exclusiva también para operaciones
Docker; revisar LAN/VPN con `ip route`. La integridad SHA no autentica un backup:
usarlo solo con procedencia confiable. Conservar imágenes exactas y secretos
cifrados fuera del HDD; los secretos no se incluyen en el snapshot.

### Ensayo manual: backup y canary

**No ejecutar hasta autorizar la ventana real.** Desde la raíz del worktree,
preparar previamente `/srv/backups/furgoplus-demo` y permisos de escritura del
operador, pausar escritores externos y reservar una carpeta que aún no exista:

```bash
python3 infra/demo/check_config.py
python3 infra/demo/test_recovery.py
bash -n infra/demo/backup.sh infra/demo/restore.sh

demo_snapshot=/srv/backups/furgoplus-demo/task11-canary-01
DEMO_WRITERS_PAUSED=true DEMO_ENV_FILE="$PWD/infra/demo/.env" bash infra/demo/backup.sh "$demo_snapshot"
# El backup deja la fuente detenida incluso si termina correctamente.
# Verificar snapshot y marcador sin mostrar contenido de documentos/secrets.
python3 - "$demo_snapshot" <<'PY'
import sys, tarfile
from pathlib import Path, PurePosixPath
sys.path.insert(0, str(Path('infra/demo').resolve()))
from recovery import verify_snapshot
snapshot = Path(sys.argv[1])
verify_snapshot(snapshot)
with tarfile.open(snapshot / 'private_uploads.tar', 'r:') as archive:
    member = next(m for m in archive if str(PurePosixPath(m.name)) == '.restore_canary_task11')
    assert archive.extractfile(member).read().rstrip(b'\r\n') == b'FURGOPLUS_TASK11_RESTORE_TEST'
print('Snapshot y canary: OK')
PY
(cd "$demo_snapshot" && sha256sum --check SHA256SUMS)
# Copiar/cifrar a OTRO disco/host por un mecanismo existente y verificar allí.
# Cuando se haya comprobado el estado de la fuente: reanudar esos contenedores,
# sin recrearlos ni solicitar de nuevo su IP fija.
docker compose --project-name furgoplus-demo --env-file infra/demo/.env -f infra/demo/compose.yaml start backend caddy
```

No importar datos de FitFu ni una DB real. La prueba del canario compara únicamente
ese marcador sintético. `private-files.json` permite además la verificación de
cada archivo completo. `source.tar` incluye cambios sin commit del checkout,
**no prueba que sean idénticos al código del contenedor activo**; los IDs de imagen
capturados son la referencia binaria del runtime. Guardar también esas imágenes
(registry controlado o `docker image save` manual, sin reconstruir/reemplazar tags).

### Ensayo manual: restauración aislada

Usar ese snapshot verificado, las imágenes exactas y los archivos de secretos
externos correctos. No copiar valores al repo ni mostrarlos. Este ejemplo deja
la fuente en 18080/172.30.81.0/29 y usa 18081/172.30.82.0/29 para el ensayo.
Comprobar también las rutas LAN/VPN y otros proyectos; elegir otro bloque/puerto
si están ocupados. Crear una configuración **externa nueva** sin sobrescribir:

```bash
ip route
ss -ltn
python3 - "$demo_snapshot" <<'PY'
import os, sys
from pathlib import Path
os.umask(0o077)
parameters = dict(line.split('=', 1) for line in (Path(sys.argv[1]) / 'deployment.env').read_text().splitlines())
parameters.update(DEMO_HTTP_PORT='18081', DEMO_PROXY_SUBNET='172.30.82.0/29',
                  DEMO_CADDY_IP='172.30.82.2', DEMO_BACKEND_IP='172.30.82.3')
with Path('/tmp/furgoplus-task11-restore.env').open('x') as stream:
    stream.writelines(f'{key}={value}\n' for key, value in parameters.items())
PY
DEMO_ENV_FILE=/tmp/furgoplus-task11-restore.env bash infra/demo/restore.sh "$demo_snapshot" furgoplus-demo-restore-task11-r1
```

El script valida hashes y recursos antes de crear el proyecto. No modifica ni
pausa la fuente durante restore. Tras éxito, los siguientes pasos manuales inician
solo el backend canónico del ensayo y validan antes de publicar Caddy; no crean
un backend one-off y no aplican migraciones:

```bash
demo_restore=(docker compose --project-name furgoplus-demo-restore-task11-r1 --env-file /tmp/furgoplus-task11-restore.env -f infra/demo/compose.yaml)
"${demo_restore[@]}" ps -a
"${demo_restore[@]}" start backend
"${demo_restore[@]}" exec -T backend python manage.py migrate --check
"${demo_restore[@]}" exec -T backend python manage.py check --deploy --fail-level ERROR
# Revisar: solo W005/W021 HSTS deliberados; detener la aceptación con otros avisos.
"${demo_restore[@]}" exec -T backend python -c "from pathlib import Path; assert Path('/var/lib/furgoplus/private/.restore_canary_task11').read_bytes().rstrip(b'\r\n') == b'FURGOPLUS_TASK11_RESTORE_TEST'; print('Canary restaurada: OK')"
# SOLO si pasan los gates anteriores: crear/iniciar Caddy del ensayo,
# en su puerto separado y sin apuntarle el túnel público.
"${demo_restore[@]}" up -d --no-recreate --no-build --pull never --wait caddy
curl --fail -H 'Host: demo.furgoplus.cl' -H 'CF-Connecting-IP: 203.0.113.10' http://127.0.0.1:18081/api/v1/health/
```

Ejecutar y revisar cada gate antes del siguiente comando. `start backend` es
asíncrono; si aún arranca, revisar `ps`/health y esperar antes de `exec`, sin crear
otro contenedor. Un schema pendiente detiene la aceptación: no ejecutar migraciones
sobre la copia para ocultar el fallo ni iniciar Caddy. Los checks Django operativos
cargan sus secretos internamente, sin imprimirlos; no forman parte del análisis
estático de esta tarea. Verificar conteos sintéticos, historia, permisos de
parent/otro conductor, descargas autorizadas y bytes. El helper ya comparó todos
los hashes privados; el canario es una evidencia adicional, no prueba toda la API.
Para esta restauración aislada, HTTPS/browser/Flutter necesitan su propia
evidencia y una ruta de prueba autorizada; el funcionamiento r4 no prueba esta copia;
no redirigir el hostname público de la demo a este ensayo.

### Fallos parciales y recuperación manual

| Momento del fallo | Estado esperado | Acción manual |
| --- | --- | --- |
| Preflight de backup | Fuente intacta; sin snapshot nuevo | Corregir ruta, imagen, metadata/volúmenes o writers; no crear un volumen para sustituir al ausente |
| Después de detener escritores | Fuente detenida; DB sigue activa; snapshot sin COMPLETE | Preservar archivos para diagnóstico; revisar el estado original, luego `compose start backend caddy` si procede; un nuevo intento exige carpeta nueva |
| Preflight de restore | Fuente intacta; target sin cambios | Corregir hashes/procedencia, imágenes, puerto o subred; no modificar la fuente |
| Después de crear target | DB/volúmenes nuevos presentes; backend sin arrancar; Caddy ausente | Conservar proyecto parcial y revisarlo con `ps -a`; no reejecutar sobre los mismos volúmenes ni borrar recursos automáticamente |
| Restore de DB falla | Transacción DB revertida si el proceso llegó a cerrarla; target retenido | No asumir estado tras un corte/interrupción; inspección manual y nuevo ensayo con otro nombre/subred/puerto |
| Restore/verificación de archivos falla | DB puede estar restaurada y volumen privado parcial | Mantener backend/Caddy detenidos; no sobrescribir ni borrar lo parcial; un ensayo nuevo usa recursos distintos |
| Gate Django falla | Backend del ensayo iniciado, Caddy aún sin publicar | Revisar el fallo; mantener el ensayo aislado y detenerlo manualmente si se acuerda, sin tocar la fuente |

No se intenta una limpieza ni recuperación automática. En interrupciones, revisar
si quedó un auxiliar propio en ejecución antes de reanudar escritores; no se
incluye un comando global de borrado/stop. Si se desconoce el estado, conservar los
recursos y no declarar el snapshot consistente. Una copia en el mismo HDD y un
checksum correcto no sustituyen una restauración comprobada fuera del disco.

### Validaciones de recuperación en esta revisión

`test_recovery.py`: **18/18 simulaciones**, Docker y puerto de host sustituidos por
mocks; la extracción por streaming y la negativa a sobrescribir se prueban contra
un directorio sintético en `/tmp`. Cubre volúmenes ausentes/desaparecidos, permisos
RO de los comandos, imágenes con VOLUME anónimo, escritores que no paran, fallos
en dump/export/catalogo, hash/traversal/enlaces/devices, recursos previos, colisiones,
imágenes equivocadas y targets parciales sin cambios en la fuente. No ejecuta
ninguna operación contra Docker Engine ni lee el volumen canario real.

`bash -n`, AST, Ruff y el validador Compose son no destructivos. **Shellcheck no
está disponible**; no se instala en el homelab. Puede ejecutarse después si existe:
`shellcheck infra/demo/backup.sh infra/demo/restore.sh`. El operador confirmó después
el ensayo real de backup/restauración Fedora y el reinicio físico Debian. Estas
simulaciones siguen siendo evidencia separada: no certifican por sí solas DAC/
SELinux, canary ni recuperación del Engine. Repetir el ensayo para cada snapshot/
imagen candidato que se pretenda aceptar; conservar la fuente intacta.

## Actualizaciones, recuperación y mantenimiento

1. Resolver la versión candidata/Task 09–10 y revisar diff, pins/avisos de seguridad
   y compatibilidad de migraciones. No cambiar de rama ni tocar ese worktree como
   parte de este procedimiento de preparación.
2. Guardar backup consistente y copia fuera del HDD. Registrar configuración e
   imágenes anteriores. No iniciar una actualización si el respaldo no es recuperable.
3. Construir imágenes con un `FURGOPLUS_RELEASE` nuevo, validar Caddy, Gunicorn,
   Django deploy y contratos; usar un proyecto de ensayo para una migración de copia.
4. En ventana manual, detener escritores/Caddy, actualizar el tag y recrear solo
   el backend canónico con la imagen candidata; no arrancar Caddy todavía. Usar
   `compose exec -T backend python manage.py migrate --plan`, aplicar migraciones
   autorizadas y confirmar `migrate --check`. No usar un one-off con IP fija ni
   migrar en el CMD de la imagen.
5. Tras los gates, recrear Caddy con la imagen preparada; validar salud, HTTPS y el
   flujo sintético. Evitar una actualización mayor automática de PostgreSQL.

Reusar los comandos completos de Compose de la sección anterior. Un tag anterior
solo recupera código si el schema sigue compatible. Ante migraciones incompatibles,
recuperar el par DB/archivos en un proyecto nuevo y validar antes de una operación
manual de cambio de origen. No realizar un downgrade de schema improvisado ni
borrar volúmenes para volver atrás. Este trabajo no ejecuta reset, revert ni merge.

Ejecutar `python manage.py clearsessions` mediante backend una vez al día en una
ventana acordada; es limpieza DB con escrituras y debe pausarse durante backups.
No se instala cron ni systemd en esta entrega. `cleanup_private_uploads` tiene su
propio procedimiento de documentos: no automatizarlo sin revisar sus criterios y
retención. Supervisar `docker stats --no-stream`, `df -h`, espacio de backups y logs
sin añadir una plataforma de observabilidad al host.

## Bloqueos y riesgos abiertos

- r4 ya funciona con Tunnel/HTTPS según el operador; registrar IDs de imágenes,
  APK y snapshot fuera de Git. No se inspeccionó su correspondencia con el checkout.
- Task 09/10 integrada documentalmente aquí, sin commit; un futuro SHA/CI/PR no
  certifica por sí solo los artefactos r4 desplegados.
- La integración local Fedora ya es correcta según el operador. Sigue pendiente
  repetir las validaciones sobre cada imagen candidata nueva, registrar IDs/digests
  y medir cuotas/aislamiento; verificar negativa de acceso LAN. El operador ya
  confirmó 16/16 Django 5.2.18 y Gunicorn 26.2.0 para la integración actual.
- React/Android funcionan por HTTPS según el operador. No se adjuntó evidencia
  específica de toda la matriz: cookies, CSRF negativo, expiración, invalidación,
  recuperación secure storage, permisos entre roles y ausencia de caché privada.
- Backup/restore completo Fedora confirmado por el operador; mantener evidencia
  de recuperación correspondiente al siguiente candidato y sus imágenes.
- Debian 13 y reinicio físico confirmados; falta revisar negativa LAN, frontera
  local confiable, cuotas/convivencia y los gates HTTPS del siguiente candidato.
- No se recibió evidencia específica de carreras PostgreSQL entre procesos
  y límites por IP real a través del túnel. Ver procedimiento y decisión en
  [DEMO_SECURITY_REVIEW](DEMO_SECURITY_REVIEW.md).
- Solo demo supervisada sintética; no hay detector de datos reales, protección de
  malware/quarantine suficiente ni decisiones de producción cerradas (Q3–Q9).
- Loopback confía en procesos locales; un host comprometido, una NAT compartida,
  saturación/avería del HDD o una imagen vulnerable siguen siendo riesgos.

En esta consolidación el agente no hace commit, push, merge, cambios de rama,
deploy, up/down, migraciones reales, borrados ni modificaciones al otro worktree.
No lee ni muestra valores de secretos. La integración anterior comunicada por el
operador se registra separadamente de las comprobaciones actuales.

## Archivos de esta entrega sin commit

| Grupo | Archivos nuevos o modificados |
| --- | --- |
| Runtime demo | `infra/demo/compose.yaml`, `Caddyfile`, `backend.Dockerfile`, `web.Dockerfile`, `gunicorn.conf.py`, `healthcheck.py` |
| Configuración | `infra/demo/.env.example`, `cloudflared.example.yaml`, `backend/requirements-demo.txt`, `backend/config/settings_demo.py`, `demo_proxy.py` |
| Validación | `backend/config/test_demo_proxy.py`, `infra/demo/test_without_db.py`, `check_config.py`, `test_config.py`, `check_gunicorn.py` |
| Recuperación | `infra/demo/backup.sh`, `restore.sh`, `recovery.py`, `test_recovery.py` |
| Documentación | `docs/HOMELAB_DEMO.md`, `docs/decisions/0007-homelab-demo-deployment.md`, `README.md` |
| Exclusiones | `.gitignore`, `.dockerignore` |
