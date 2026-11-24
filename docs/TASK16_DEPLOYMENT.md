# Task 16 · Operación y reversión del despliegue académico

El [runbook de presentación](TASK16_DEMO_RUNBOOK.md) registra el estado comprobado
por el operador. Este documento codifica las correcciones del despliegue para
una instancia nueva, con las imágenes del release `20261124-9e6ef46-2eff066a-01`.
Las plantillas se verificaron localmente. Su uso como conjunto aún requiere una
prueba en un proyecto nuevo antes de aplicarlas en el HP. Durante el cierre se
conservaron los proyectos y orígenes activos.

- Compose resolvió el bootstrap privado, presentación y ensayo con el override
  de imágenes del paquete. Se comprobaron redes, puertos, montajes y variables.
- Caddy 2.11.7, extraído de la imagen, validó los archivos privado, público y de
  ensayo. El parser del Gunicorn empaquetado dio una lista vacía de proxies para
  bootstrap y la IP de Caddy más loopback para el perfil público.
- El script de bootstrap aceptó archivos sintéticos válidos y rechazó archivos
  ausentes, valores cortos y valores con espacios.

## Verificar la transferencia y las imágenes

En Fedora, cotejar el paquete con la [suma congelada](evidence/task16-20261124-9e6ef46-2eff066a-01/task16-linux-amd64.tar.gz.sha256).
Transferirlo a un directorio privado nuevo mediante el alias `homelab`, sin
sobrescribir el directorio de la presentación. En el HP cotejar la misma suma
antes de extraer como `camilo` en un directorio vacío y comprobar `SHA256SUMS`
interno. El release comprobado está en
`/home/camilo/servicios/furgoplus-task16-20261124-9e6ef46-2eff066a-01/paquete`.
El tar contiene las dos imágenes, documentación de construcción, manifiestos y
el Compose original. Conservarlo íntegro como evidencia. Usar una copia aparte
de `infra/task16` del árbol de cierre para nuevas instancias. Para ensayo HTTPS,
conservar también `infra/demo/Caddyfile` en ese mismo árbol. La combinación
con el `images.override.yaml` original selecciona las etiquetas exactas.

Docker 29 con containerd puede mostrar un ID local distinto al ID de
configuración emitido por Podman. El criterio es exportar las etiquetas con
`docker save` y cotejar los bytes JSON de configuración, plataforma y
`diff_ids` ordenados de todas las capas. El verificador recalcula el hash
descomprimido de cada capa en formato tar o gzip. El tamaño y el ID de
`docker image inspect` sirven como inventario operativo.
[Almacenamiento containerd de Docker](https://docs.docker.com/engine/storage/containerd/).

En el HP, con `pkg` apuntando al paquete verificado y `cfg` al directorio
absoluto de las plantillas:

```bash
(
  set -euo pipefail
  cd "$pkg"
  sha256sum -c SHA256SUMS
  python3 "$cfg/verify_image_archive.py" IMAGES.tsv images.docker.tar
  sudo -v
  d=(sudo -n docker --host unix:///var/run/docker.sock)
  "${d[@]}" info --format '{{.ServerVersion}}'
  [[ $("${d[@]}" image inspect postgres:17.6-alpine3.22 \
    --format '{{.Os}}/{{.Architecture}}') == linux/amd64 ]]
  mapfile -t tags < <(tail -n +2 IMAGES.tsv | cut -f1)
  tmp=$(mktemp)
  trap 'unlink "$tmp"' EXIT
  existing=0
  for tag in "${tags[@]}"; do
    if "${d[@]}" image inspect "$tag" >/dev/null 2>&1; then
      existing=$((existing + 1))
    fi
  done
  if (( existing == 0 )); then
    "${d[@]}" load -i images.docker.tar
  elif (( existing != ${#tags[@]} )); then
    printf 'Importación parcial. Verificar el inventario antes de continuar.\n' >&2
    exit 1
  fi
  "${d[@]}" save --platform=linux/amd64 -o "$tmp" "${tags[@]}"
  python3 "$cfg/verify_image_archive.py" IMAGES.tsv "$tmp"
)
```

Si ya existen ambas etiquetas, el bloque solo las exporta y verifica. Ejecutar
sin importaciones concurrentes para esas etiquetas. Ante una diferencia,
detenerse e investigar el tag. Reservar espacio para el paquete
y el tar temporal. El operador verificó en el HP la importación de las
imágenes del release mediante `docker save`. El verificador de este documento
se probó localmente sobre el paquete de Podman y un tar de prueba con variantes
de rutas y compresión. La ejecución del nuevo verificador contra un export real
del HP queda pendiente.

## Instancia nueva y carga privada

Requiere Docker Compose **2.24.4 o posterior**, Docker con soporte para
`docker save --platform` y sudo interactivo. Las reservas originales
son `rehearsal / 01 / 18083` y `presentation / 01 / 18084`. Para repetir el
ensayo a partir de la semilla usa `rehearsal / 02` y otro puerto libre. Cada
instancia tiene red, volúmenes, configuración y secretos propios.
[Reglas de combinación de Compose](https://docs.docker.com/reference/compose-file/merge/).

Ejecutar solo para un proyecto **nuevo**, con autorización de despliegue.
Comprueba `df -h`, `free -h`, el journal reciente de I/O/ext4, los puertos
y las redes existentes. El HP tuvo errores de almacenamiento y su salud SMART
sigue sin confirmar. En la misma sesión usa un archivo de parámetros privado
nuevo, sin valores de secretos. Ejemplo de contenido para reproducir el perfil
de presentación en un destino libre. Adapta las rutas absolutas verificadas y
elige otro puerto e instancia para un ejercicio en el HP actual.

```dotenv
TASK16_SLOT=presentation
TASK16_INSTANCE=01
TASK16_PORT=18084
TASK16_CONFIG_DIR=/ruta/absoluta/infra/task16
TASK16_SECRETS_DIR=/etc/furgoplus/task16/furgoplus-task16-presentation-01
TASK16_PROXY_SUBNET=172.30.82.0/29
TASK16_BACKEND_IP=172.30.82.2
TASK16_CADDY_IP=172.30.82.3
```

Para ensayo, fija `TASK16_SLOT=rehearsal`, proyecto y ruta de secretos
correspondientes, un puerto libre y otra subred comprobada contra las rutas
del host y el IPAM de Docker. `172.30.82.0/29` es la subred de presentación
confirmada. En el archivo de ensayo HTTPS añade
`TASK16_REHEARSAL_CADDYFILE` apuntando al archivo absoluto que se generará
en la fase siguiente.

Para los bloques siguientes, `params` es la ruta absoluta de ese archivo,
`pkg` es el directorio del paquete verificado y `cfg` es la ruta desde
`TASK16_CONFIG_DIR`. Ejecutar los bloques en la misma sesión Bash y avanzar
solo si el anterior termina bien. El archivo es propio y contiene únicamente
las asignaciones de parámetros mostradas.

```bash
set -euo pipefail
source "$params"
unset COMPOSE_PROJECT_NAME
project="furgoplus-task16-$TASK16_SLOT-$TASK16_INSTANCE"
cfg=$TASK16_CONFIG_DIR
case "$TASK16_SLOT" in rehearsal|presentation) ;; *) exit 1 ;; esac
[[ "$TASK16_INSTANCE" =~ ^[0-9]{2}$ && "$TASK16_PORT" =~ ^[0-9]{4,5}$ ]]
[[ "$cfg" = /* && "$pkg" = /* && "$params" = /* ]]
[[ "$TASK16_SECRETS_DIR" = "/etc/furgoplus/task16/$project" ]]
for file in compose.yaml Caddyfile bootstrap.sh mark-database.sh; do
  [[ -f "$cfg/$file" ]]
done
sudo -v
d=(sudo -n docker --host unix:///var/run/docker.sock)
[[ -z $("${d[@]}" ps -aq --filter "label=com.docker.compose.project=$project") ]]
[[ -z $("${d[@]}" volume ls -q --filter "label=com.docker.compose.project=$project") ]]
[[ -z $("${d[@]}" network ls -q --filter "label=com.docker.compose.project=$project") ]]
for volume in pg_data private_uploads; do
  ! "${d[@]}" volume inspect "${project}_$volume" >/dev/null 2>&1 || exit 1
done
for network in database application public_proxy; do
  ! "${d[@]}" network inspect "${project}_$network" >/dev/null 2>&1 || exit 1
done
[[ -z $(ss -H -lnt "sport = :$TASK16_PORT") ]]
sudo install -d -m 0700 /etc/furgoplus/task16
sudo sh -eu -c '
  umask 077
  mkdir "$1"
  for name in db_password django_secret_key; do
    openssl rand -hex 32 > "$1/$name"
    chown root:10001 "$1/$name"
    chmod 0440 "$1/$name"
  done
' sh "$TASK16_SECRETS_DIR"
private=("${d[@]}" compose --project-name "$project" --env-file "$params"
  -f "$cfg/compose.yaml" -f "$pkg/infra/task16/images.override.yaml")
"${private[@]}" config --quiet
"${private[@]}" up -d --no-build --pull never --wait task16-db
```

Los bind mounts son de solo lectura y fallan si falta su origen.
`db_password` se monta en PostgreSQL y Django. `django_secret_key` se monta
solo en Django. Los archivos tienen modo 0440, dueño `root:10001` y un
directorio de root con modo 0700. Este procedimiento supone Docker de sistema
sin remapeo de usuarios. Un Compose con secretos externos cambiados no rota
la contraseña de un volumen PostgreSQL ya inicializado. El script de bootstrap
traduce los archivos a las variables que espera `config.settings` dentro del
proceso. No usar `set -x`, `printenv` ni publicar volcados de configuración.

El Gunicorn de la imagen lee su archivo de configuración al arrancar.
Durante bootstrap recibe `DEMO_CADDY_IP=127.0.0.1` para que el archivo se
pueda evaluar y la opción explícita `--forwarded-allow-ips ""` deja vacía
la lista de proxies confiables. Los servicios de este paso se mantienen
fuera del túnel.

```bash
mark=$("${private[@]}" exec -T task16-db psql -XAt -v ON_ERROR_STOP=1 \
  -U furgoplus_task16 -d furgoplus_task16 \
  -c "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = current_database()")
[[ "$mark" == "task16-2026-11-v1:$TASK16_SLOT" ]]
"${private[@]}" run --rm --no-deps --pull never backend python manage.py shell -c \
  'import os; from drivers.november_scenario import verify_destination; verify_destination(os.environ["FURGOPLUS_TASK16_SLOT"])'
"${private[@]}" run --rm --no-deps --pull never backend python manage.py migrate --noinput
"${private[@]}" run --rm --no-deps --pull never backend python manage.py migrate --check
"${private[@]}" run --rm --no-deps --pull never backend \
  python manage.py prepare_november_scenario --expect-slot "$TASK16_SLOT" --dry-run
"${private[@]}" run --rm --no-deps --pull never backend \
  python manage.py prepare_november_scenario --expect-slot "$TASK16_SLOT" --apply
```

El puerto de PostgreSQL queda interno. La comprobación de destino valida la
marca con versión y slot, nombre, usuario, propietario y host de PostgreSQL.
El comando `--apply`
pide credenciales de cuentas ficticias en una terminal privada sin eco.
`--dry-run` sobre un escenario existente informa su estado. Un ensayo nuevo
usa su propia base y su propia cuenta reservada. Si se prueba React por HTTP
local, arrancar el mismo proyecto con el arreglo `private`, comprobar
`http://127.0.0.1:$TASK16_PORT/api/v1/health/` y mantenerlo fuera de Cloudflare.

## Perfil HTTPS reforzado

En este perfil el Caddy de la imagen sirve React y envía `/api` al backend
por una red interna. Solo Caddy tiene la publicación loopback del host.
`settings_demo` fija el hostname, desactiva DEBUG, activa cookies seguras y
valida IP de origen en `DemoProxyMiddleware`. Gunicorn y Django confían en
la IP exacta de Caddy en `public_proxy`. Caddy recibe la IP de Cloudflare,
sanitiza las cabeceras reenviadas y entrega HTTPS como esquema. El host local
y su conector son parte de esta frontera. `check --deploy` del despliegue
confirmado conservó W005 y W021 por la exclusión deliberada de subdominios y
preload de HSTS.

Presentación usa el Caddyfile reforzado que ya contiene la imagen web. Si se
autoriza ensayo HTTPS, generar una copia de ese mismo archivo con una cabecera
diagnóstica. Ejecutar solo para ensayo; `TASK16_REHEARSAL_CADDYFILE` se
define fuera del repositorio con un path absoluto. `$cfg/../demo/Caddyfile`
debe corresponder al Caddyfile de la imagen.

```bash
public=("${private[@]}" -f "$cfg/compose.public.yaml")
if [[ $TASK16_SLOT == rehearsal ]]; then
  [[ $TASK16_REHEARSAL_CADDYFILE = /* ]]
  (
    umask 022
    set -o noclobber
    awk '
      { print }
      $0 == "http://demo.furgoplus.cl:8080 {" {
        print "\theader X-FurgoPlus-Task16-Slot rehearsal"
        found++
      }
      END { if (found != 1) exit 1 }
    ' "$cfg/../demo/Caddyfile" > "$TASK16_REHEARSAL_CADDYFILE"
  )
  public+=(-f "$cfg/compose.rehearsal.yaml")
fi
"${public[@]}" config --quiet
"${public[@]}" up -d --no-build --pull never --wait --wait-timeout 120 backend web
"${public[@]}" ps
"${public[@]}" exec -T backend python manage.py showmigrations drivers
"${public[@]}" exec -T backend python manage.py check --deploy
```

Validar por separado HTML, API y rechazo de IP inválida en el origen.
Confirmar el puerto final de Caddy, la ausencia de puertos publicados de
PostgreSQL y backend, y los volúmenes propios mediante los metadatos de
Compose. Revisar que Task 15 y landing sigan saludables. Estas sondas de
origen son para el operador en el HP, con el Host correcto.

```bash
origin="http://127.0.0.1:$TASK16_PORT"
curl -fsS -H 'Host: demo.furgoplus.cl' "$origin/" | grep -F index-B0qRJdIM.js
curl -fsS -H 'Host: demo.furgoplus.cl' -H 'CF-Connecting-IP: 127.0.0.1' \
  "$origin/api/v1/health/"
test "$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: demo.furgoplus.cl' \
  "$origin/api/v1/health/")" = 400
```

## Ventana de publicación y reversión

La APK comparte el hostname fijo con React. Antes de abrir una ventana de
ensayo HTTPS, conseguir autorización específica y registrar el origen vigente,
hora de inicio, hora límite y operador de reversión. Confirmar la salud de
ambos slots y que la base de presentación sigue preparada. En el túnel
efectivo, editar solo la URL de servicio de la ruta exacta
`demo.furgoplus.cl`. Mantener `HTTP Host Header=demo.furgoplus.cl`, la regla
308 para ese hostname y el bypass de caché de la API. Para túnel administrado
remotamente, usar la ruta existente en el dashboard. Para administración local,
conservar una copia protegida del YAML efectivo y comprobar
`cloudflared tunnel ingress validate` antes de aplicar el cambio según el
método vigente del servicio. Mantener las demás rutas, DNS y credenciales.
[Configuración del túnel local](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/) ·
[Parámetros de origen](https://developers.cloudflare.com/tunnel/reference/origin-parameters/).

- **Ensayo autorizado:** `18084 → 18083`. Verificar desde otra red el health,
  la cabecera de ensayo y HTTP 308. Cerrar las sesiones de presentación en ambos
  clientes antes del cambio y usar solo las cuentas de ensayo. Volver a
  `18084` al terminar, al primer fallo o al vencer la ventana. Confirmar API
  200, bundle esperado, HTTP 308 y ausencia de la cabecera de ensayo, y
  comprobar de nuevo el marcador y el cupo inicial Básico de presentación.
- **Reversión de Task 16:** si se autoriza, `18084 → 18080`, con comprobación
  de health, web y autenticación de Task 15. Las sesiones de cada base son
  independientes. Los datos de Task 16 permanecen en sus volúmenes.

Sondas externas para comprobar el retorno a presentación desde Fedora o una
red distinta del HP. El código HTTP directo debe ser 308. Para un ensayo
anterior a estas plantillas, comprobar el nombre de cabecera que se configuró.

```bash
base=https://demo.furgoplus.cl
curl -fsS "$base/api/v1/health/"
curl -fsS "$base/" | grep -F index-B0qRJdIM.js
headers=$(curl -fsS -D - -o /dev/null "$base/api/v1/health/")
if grep -qi '^X-FurgoPlus-Task16-Slot:' <<< "$headers"; then
  printf 'Sigue visible la cabecera de ensayo.\n' >&2
  exit 1
fi
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://demo.furgoplus.cl/
```

### Respaldo para la reversión

Task 15 conserva el respaldo actualizado
`furgoplus-task15-actual-20261124T153153Z.5MlcTukZ`, con copias verificadas
en HP y Fedora. Su formato es `furgoplus-task15-topology-v1`, con dump,
archivos privados y configuración de los dos árboles Compose y overrides
en orden. El operador verificó hashes, tar y marcador `COMPLETE`. Queda
pendiente una restauración de punta a punta. Mantener esta copia externa y
conservar la instancia Task 15 para volver a su origen en el túnel.
