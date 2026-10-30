# Task 14 — prueba aislada propuesta para Debian, 28/10/2026

**Preparado para revisión humana. No se ejecutó SSH, instalación, descarga ni
despliegue en el homelab.** Diagnóstico primero; cualquier instalación o arranque
requiere una sesión futura autorizada. La app T12 y los servicios actuales tienen
prioridad. No cambiar Task 12/13, Cloudflare Tunnel, Caddy, Tailscale, firewall ni
demo r4.

## Diagnóstico de solo lectura

En un checkout aislado ya disponible en Debian, sin sudo:

```bash
python3 -B -m local_assistant.hardware
python3 -B -m local_assistant.hardware --services
```

El segundo añade a CPU/RAM/swap/PSI/disco: unidades conocidas, listeners TCP,
versiones Docker/Compose, ruta del almacén, contenedores y consumo instantáneo.
Cada consulta externa tiene timeout de 5 s. No instala, inicia ni modifica nada;
no lee variables, logs, líneas de comandos, cuentas ni bases de datos.
`command_missing`/`unavailable` significa desconocido, nunca cero consumo.

Docker fija `unix:///var/run/docker.sock`, sin adoptar un contexto remoto. Si es
rootless o falta permiso, registrar la limitación; no añadir grupos, cambiar
permisos ni usar sudo como parte del diagnóstico. La salida contiene nombres de
contenedores/servicios y direcciones de escucha: revisarla antes de compartirla.

Medir el volumen real de Docker, que puede diferir del checkout. Usar la ruta
existente informada en `services.docker_storage`, por ejemplo:

```bash
python3 -B -m local_assistant.hardware --disk-path /var/lib/docker
```

Si no es legible, elegir una ruta legible del mismo filesystem; no se crean
directorios. Repetir en reposo y uso habitual, sin estrés. Las cuotas cgroup de la
raíz visible no resuelven todos los límites heredados de cada servicio. Contrastar
con [la evaluación y propuesta de modelo](HARDWARE.md).

Desde Fedora, con acceso SSH y huella ya autorizados, también puede enviarse solo
el script, sin copiar repositorio ni escribir archivos remotos:

```bash
export FURGO_SSH_TARGET='usuario@alias-homelab'
ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ForwardAgent=no \
  -o ConnectTimeout=10 "${FURGO_SSH_TARGET:?Define el destino autorizado}" \
  'python3 -B - --services' < local_assistant/hardware.py
```

No se recibió un destino SSH en esta sesión y este comando no se ejecutó.

## Configuración para revisar antes de instalar

[ops/compose.yaml](ops/compose.yaml) declara el proyecto independiente
`furgoplus-task14`, perfil optativo `task14`, una CPU, 2 GiB sin swap del
contenedor, 128 PIDs, contexto 2048, una inferencia y un modelo residente.
El cliente usa por defecto 0.6B y un hilo. CPU shares y peso I/O son prioridades
relativas, no reservas ni garantías de aislamiento del HDD compartido.

Solo publica **127.0.0.1:11436** del host. El `0.0.0.0:11434` de Ollama existe
dentro del namespace del contenedor. No usa red host, red externa, nombres globales
de contenedor, secretos, GPU, código, datos de apps ni socket Docker montado. Red
y volumen son exclusivos del proyecto. No combinar con Compose de `infra/`.

Raíz de imagen de solo lectura, sin capabilities ni privilegios nuevos; `/tmp`
es tmpfs de 128 MiB y el volumen dedicado es escribible por Ollama. Sin reinicio
automático; logs rotados (2 × 5 MB). Requiere verificar compatibilidad de la imagen
elegida. Ver [Docker de Ollama](https://docs.ollama.com/docker).
`OLLAMA_NO_CLOUD=1` desactiva funciones cloud según la
[FAQ oficial](https://docs.ollama.com/faq); el bridge conserva salida para la
descarga explícita del modelo, no constituye un firewall de salida.

Requisitos previos a cualquier arranque futuro:

1. Diagnóstico con margen de RAM/disco/CPU, sin presión sobre servicios actuales.
2. Docker local ya instalado, Engine ≥28.0.0 y publicación loopback segura.
   Docker documenta acceso desde la misma LAN en versiones anteriores:
   [publicación de puertos](https://docs.docker.com/engine/network/port-publishing/).
   Si requiere actualizar Engine o red, detener este procedimiento; no hacerlo
   como parte de Task 14.
3. Proyecto `furgoplus-task14`, volumen y puerto 11436 libres. Si existen,
   identificarlos antes de continuar; no adoptar/borrar recursos ni detener otro
   servicio para liberar el puerto. El diagnóstico no prueba ausencia de recursos
   detenidos: revisar también `docker compose ls -a` y `docker volume ls`.
4. Imagen oficial CPU y arquitectura compatible, versión/digest revisados. No usar
   `latest`. Copiar `ops/.env.example` a `ops/.env` y completar
   `TASK14_OLLAMA_IMAGE=ollama/ollama:<version>@sha256:<digest completo>`.
   Conservar referencia y licencia. Compose no certifica la seguridad del digest.

Validar solo configuración, sin contactar el daemon ni descargar imágenes:

```bash
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 config --quiet
```

Variable vacía bloquea Compose. El cliente Python sigue en el host, con biblioteca
estándar, sin pip. Si no hay Docker adecuado, preparar su instalación por separado.
Si existe otro Ollama, no modificarlo ni usar su almacén. El
[ejemplo systemd anterior](ops/ollama-override.conf.example) se conserva como
alternativa de diseño 1.7B; no aplicar ambos perfiles.

## Arranque futuro, solo con autorización

Estos comandos descargan y crean recursos; **no fueron ejecutados**. Usar el
contexto Docker local confirmado en Debian. El perfil tiene `pull_policy: never`:
la descarga inicial es explícita, sin instaladores automáticos.

```bash
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 pull --policy always ollama
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 up -d --pull never ollama
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 ps
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 port ollama 11434
ss -ltn 'sport = :11436'
python3 -B -m local_assistant.probe --port 11436 --model qwen3:0.6b
```

Inicialmente esperar `model_missing`, salida 1. La sonda hace hasta tres GET
secuenciales (versión, pesos instalados, modelos cargados), plazo de 2 s por GET,
sin inferir, calentar ni descargar. Distingue API ausente, pesos ausentes y
metadatos no disponibles; salida 0 significa API/pesos presentes, no inferencia
validada. Solo muestra digest y metadatos del candidato seleccionado.

Confirmar binding host exclusivamente `127.0.0.1:11436`, sin LAN/IPv6 ni rutas
públicas, antes de descargar el modelo. `ss` puede no mostrar socket por el NAT
de Docker: verificar también `compose ps` y `port`. Si el bind no es seguro,
detener solo este proyecto, sin reconfigurar redes existentes.

Desde otra máquina de la LAN, una petición al puerto 11436 de la IP LAN de
Debian debe fallar (rechazo/timeout), sin devolver `/api/version`. Hacer esa
comprobación solo después del arranque autorizado y no añadir reglas para
permitirla. No probar por el dominio público ni publicar un endpoint de salud.

Con descarga del modelo expresamente autorizada:

```bash
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 exec -T ollama ollama pull qwen3:0.6b
python3 -B -m local_assistant.probe --port 11436 --model qwen3:0.6b
```

Registrar imagen/digest, versión Ollama y digest completo del modelo. El cliente
jamás llama `pull`, instaladores, mutadores o endpoints cloud.

## Disponibilidad, latencia, consumo y fallback

En un entorno autorizado con sockets, exigir las cinco pruebas HTTP reales contra
un servidor efímero simulado (sin Ollama), además de evaluación determinista:

```bash
FURGOPLUS_REQUIRE_WIRE_TESTS=1 python3 -B -m unittest discover -s local_assistant/tests -v
python3 -B -m local_assistant.evaluate
```

Esa variable impide omitir pruebas por bloqueo de sockets. En el sandbox actual
están omitidas; no confundir contrato HTTP simulado con aceptación de Qwen real.

Con modelo ya instalado, ejecutar una serie secuencial, solo preguntas sintéticas:

```bash
python3 -B -m local_assistant --ollama --port 11436 --model qwen3:0.6b --threads 1
python3 -B -m local_assistant.benchmark --ollama --port 11436 \
  --model qwen3:0.6b --threads 1 --samples 3
```

El benchmark hace 2–5 solicitudes de FAQ fijas, mide cada tiempo total y mediana
posterior a la primera; se detiene ante la primera falla. No estima p95 ni tokens/s.
Primera muestra puede incluir carga; comprobar `ollama ps` usando `compose exec`.
Para frío esperar descarga natural después de 60 s sin uso. Espaciar ejecuciones
al menos un minuto, sin benchmarks paralelos. Timeout 8 s, máximo configurable
15 s: una carga fría lenta vuelve a FAQ. Límites del cliente son por proceso;
múltiples CLI multiplican carga. El timeout recoge el worker HTTP pero no garantiza
que Ollama cancele inmediatamente la inferencia; mantener cuotas del servidor.

Observar en otra terminal, con herramientas ya presentes:

```bash
free -h
vmstat 1 10
python3 -B -m local_assistant.hardware --services
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 stats --no-stream
```

Para observación continua breve usar `compose ... stats` y terminar con Ctrl+C.
Registrar CPU, RAM y PSI antes/durante/después, disco libre, Block I/O, errores y
latencias. `/api/ps` informa estimación del modelo cargado, no RSS/peak; una
instantánea de `stats` tampoco captura picos. Si es accesible el cgroup dedicado,
leer `memory.peak`, `memory.events`, `cpu.stat` y `memory.swap.current` para peak,
OOM, throttling y swap. No instalar monitor ni consultar datos privados de T12.

Criterios de aceptación propuestos, todavía sin mediciones Debian:

- Cero hechos inventados y texto presentado solo del catálogo. Planes, pagos,
  fechas, cupos y estados nunca pasan por el modelo; cuentas reales desconectadas.
- Fallback correcto ante API/modelo ausente, timeout, error HTTP, salida inválida
  y saturación. Nunca descargar para resolver una falla.
- Mediana caliente objetivo ≤3 s, sin OOM, swapping inducido ni presión sostenida.
  Comparar uso habitual de servicios prioritarios antes/durante; sin pruebas de
  carga sobre T12/r4. Ante deterioro, detener Ollama dedicado y mantener FAQ.
- Comparar con FAQ sola. Solo si aporta utilidad y queda margen ≥6 GiB considerar
  1.7B en otra prueba aprobada, revisando techo a 4 GiB sin swap. No ampliar recursos
  automáticamente ni descargar múltiples modelos juntos.

Sin modelo funcionan FAQ y consultas deterministas:

```bash
python3 -B -m local_assistant
python3 -B -m local_assistant.evaluate
```

En una prueba futura autorizada, detener solo Ollama dedicado y repetir CLI con
`--ollama` para comprobar fallback real, conservando respuestas exactas de cuenta:

```bash
docker compose --env-file local_assistant/ops/.env \
  -f local_assistant/ops/compose.yaml --profile task14 stop ollama
```

El volumen se conserva para revisión. No usar `down -v`, `prune` ni borrar modelos
como limpieza; no detener otros contenedores.

## Túnel opcional desde Fedora, con SSH existente autorizado

```bash
ssh -N -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ForwardAgent=no \
  -o ExitOnForwardFailure=yes -o GatewayPorts=no \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=2 \
  -L 127.0.0.1:11435:127.0.0.1:11436 \
  "${FURGO_SSH_TARGET:?Define el destino autorizado}"
```

Confirmar puerto libre y bind loopback en Fedora; allí usar `--port 11435` en sonda,
CLI y benchmark. Cerrar con Ctrl+C. La latencia incluye SSH; medir los recursos
en **Debian**. No instalar ni reconfigurar SSH/Tailscale. La API local carece de
autenticación propia: usuarios/procesos locales forman parte de la confianza.
Ver [manual OpenSSH](https://man.openbsd.org/ssh).

Detenerse para revisión humana. Sin cuentas reales, commit, push, merge ni deploy.
