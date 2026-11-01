# T12 — Actualizar y verificar solo el frontend académico en Fedora

Procedimiento preparado para el operador; **no ejecutado por el agente**. La
comparación posterior a los cambios confirmó que el contenedor académico conserva
el código anterior. No se puede aceptar visualmente la nueva composición a partir
de esas capturas.

El destino es exclusivamente `furgoplus-task12-academic`, web en
`http://127.0.0.1:15173`. Ejecutar desde una terminal Bash normal de Fedora con el
repositorio actual y los secretos académicos ya existentes. No se generan secretos
ni se cambia su contenido o permisos. No es una publicación de demo r4.

## Reconstrucción acotada

El guard existente `control.py config` solo valida la configuración. Para este
refresco se usan `build web` y `up ... web` explícitos, porque `control.py build`
abarca todas las imágenes y `control.py start` incluye backend. No usar esos dos
comandos generales para este procedimiento.

El bloque termina ante un error. Antes y después compara la identidad, fecha de
inicio y montajes de DB y backend. Solo el contenedor web debe recrearse. No ejecuta
migraciones, cargas, auditorías de base de datos, provisión ni borrados.

```bash
(
  set -euo pipefail
  cd ~/Proyectos/furgoplus-planes
  test "$(git branch --show-current)" = "task/12-plan-capabilities"

  export ACADEMIC_SECRETS_DIR="$HOME/.local/share/furgoplus/task12-academic"
  t12_compose=(
    docker compose
    --project-directory "$PWD/infra/academic"
    --env-file /dev/null
    -p furgoplus-task12-academic
    -f "$PWD/infra/academic/compose.json"
  )

  python3 infra/academic/control.py config

  t12_snapshot() {
    local t12_service t12_id
    for t12_service in db backend; do
      t12_id="$("${t12_compose[@]}" ps --quiet "$t12_service")" || return 1
      test -n "$t12_id" || return 1
      docker inspect --format '{{.Id}}|{{.State.Running}}|{{.State.StartedAt}}|{{range .Mounts}}{{.Type}}:{{.Name}}:{{.Destination}};{{end}}' "$t12_id" || return 1
    done
  }

  t12_before="$(t12_snapshot)"

  "${t12_compose[@]}" build web
  "${t12_compose[@]}" up -d --no-deps --no-build --pull never --force-recreate web

  t12_after="$(t12_snapshot)"
  if test "$t12_before" != "$t12_after"; then
    printf '%s\n' 'DETENER: cambió la identidad, el inicio o un montaje de DB/backend.' >&2
    exit 1
  fi

  "${t12_compose[@]}" ps web
  printf '%s\n' 'Frontend recreado; DB y backend conservan identidad, inicio y montajes.'
)
```

No usar `down`, `down -v`, `rm`, `prune`, `create`, `migrate`, `load` ni `provision.py`.
La configuración existente no monta el código del host en web: refrescar el navegador
sin reconstruir/recrear **web** seguirá mostrando la imagen anterior.

## Comprobar archivos y módulos servidos

Este segundo bloque es de solo lectura sobre el entorno académico. Los únicos
archivos que escribe son las respuestas HTTP en un directorio temporal de Fedora.
Detiene la comprobación si un archivo falta, una huella difiere o el servidor
conserva las marcas de la composición anterior.

```bash
(
  set -euo pipefail
  cd ~/Proyectos/furgoplus-planes

  t12_web_id="$(docker ps --quiet \
    --filter label=com.docker.compose.project=furgoplus-task12-academic \
    --filter label=com.docker.compose.service=web)"
  test -n "$t12_web_id"

  for t12_file in HelpSupport.tsx DriverHelpGuides.tsx help-support.css driver-coherence.css; do
    t12_local="$(sha256sum "web/src/$t12_file")"
    t12_local="${t12_local%% *}"
    t12_remote="$(docker exec "$t12_web_id" sha256sum "/app/src/$t12_file")"
    t12_remote="${t12_remote%% *}"
    test "$t12_local" = "$t12_remote"
    printf '%s %s\n' "$t12_local" "$t12_file"
  done

  t12_http_dir="$(mktemp -d /tmp/furgoplus-t12-help-http.XXXXXX)"
  curl --noproxy '*' --max-time 15 -fsS -H 'Cache-Control: no-cache' \
    http://127.0.0.1:15173/src/HelpSupport.tsx \
    -o "$t12_http_dir/HelpSupport.js"
  curl --noproxy '*' --max-time 15 -fsS -H 'Cache-Control: no-cache' \
    http://127.0.0.1:15173/src/DriverHelpGuides.tsx \
    -o "$t12_http_dir/DriverHelpGuides.js"

  rg -F 'const showCases = section === "tickets";' "$t12_http_dir/HelpSupport.js"
  rg -F 'DriverHelpGuides' "$t12_http_dir/HelpSupport.js"
  if rg -q 'driver-help-layout' "$t12_http_dir/HelpSupport.js"; then
    printf '%s\n' 'DETENER: todavía se sirve la composición anterior.' >&2
    exit 1
  fi
  rg -F 'Encuentra una respuesta' "$t12_http_dir/DriverHelpGuides.js"
  rg -F 'Volver a las guías' "$t12_http_dir/DriverHelpGuides.js"
  rg -F 'Selecciona un tema' "$t12_http_dir/DriverHelpGuides.js"
  printf '%s\n' 'Cuatro huellas iguales y módulos nuevos confirmados por HTTP.'
)
```

Huellas de esta entrega (también en `evidence/task12-help-task-views/checks.json`):

| Archivo                | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `HelpSupport.tsx`      | `27f1ad31d8363cafed3e668ad49f9ae9bf1acbbb09dcd5cd7e6ba5109ac56b0c` |
| `DriverHelpGuides.tsx` | `10f09ff8498d0d2997eadc5191d376daef1ffb6e3d5c1d05341da94822bbf7ca` |
| `help-support.css`     | `fe0bf7a893a03fe4a4d358c7211f5598fc96f8ed2a9a4e7ca0f6993ea618d963` |
| `driver-coherence.css` | `7415d3d3d28e3f64d37e8abe58fa579cbd964e50741ed70bdbb595a039219528` |

Si las huellas coinciden pero los módulos HTTP no, detener la revisión y revisar
el origen/puerto que se está consultando. No compensarlo con cambios de datos o
permisos.

## Comprobación visual sin escribir datos

Abrir `http://127.0.0.1:15173/` y recargar con `Ctrl+Shift+R`. Usar la cuenta
académica existente; no crear otra cuenta, cargar datos ni enviar solicitudes.

1. **Entrada:** Guías activa, búsqueda y selector de tema. Ninguna bandeja ni lista
   inicial. “Sobre la atención y sus límites” aparece como un control plegado, no
   como un bloque de texto abierto. Su presencia plegada es deliberada; no debe
   confundirse con la versión anterior.
2. **Guías:** elegir un tema, abrir un título y comprobar que solo se muestra ese
   artículo completo. No debe quedar la lista de títulos ni un paginador del
   contenido. Volver debe conservar criterio/página y devolver foco al título.
3. **Mis solicitudes:** sustituye Guías. Buscar, filtrar y cambiar página cuando
   haya datos. Abrir un caso sustituye la bandeja; volver conserva sus criterios.
   El formulario puede abrirse y cancelarse **sin confirmar envío**.
4. **Móvil y teclado:** a 390 y 320 px recorrer con Tab/Shift+Tab y activar con
   Enter/Espacio. Comprobar foco visible, flujo progresivo de una tarea, texto
   íntegro, ausencia de desbordamiento horizontal y scroll normal.
5. Cambiar de tareas y salir a Inicio y volver. Confirmar conservación de la guía
   seleccionada y de la bandeja sin que ambas aparezcan simultáneamente.

Las huellas y el HTTP acreditan qué código se sirve. La aceptación visual solo se
completa cuando la persona revisora confirme esa interfaz y su comportamiento.
