# Operación futura en Debian 13 y acceso desde Fedora

**Actualización 28/10/2026:** el procedimiento preferido para este lote está en
[HOMELAB_COMPOSE.md](HOMELAB_COMPOSE.md), con Qwen3 0.6B, una CPU y 2 GiB sin
swap. El [hardware documentado y la evaluación actual](HARDWARE.md) reemplazan la
elección inicial de 1.7B de esta guía. Las secciones siguientes conservan la
alternativa systemd de la revisión anterior; no aplicarlas sobre un Ollama
existente ni ejecutar ambas alternativas. El túnel para Compose apunta al puerto
remoto **11436**, según la guía nueva; 11434 aquí corresponde solo a systemd.

**Procedimiento preparado para revisión humana; no ejecutado en el homelab.**
No instalar, descargar modelos, habilitar servicios ni modificar redes durante
Task 14. Ningún comando de este documento se ejecuta automáticamente.

## 1. Medir antes de elegir modelo

Debian 13 incluye Python 3.13, suficiente para el prototipo según el
[anuncio oficial de Debian 13](https://www.debian.org/News/2025/20250809).
El diagnóstico solo lee CPU, memoria, presión, espacio del directorio actual y
límites cgroup v2, sin nombres de host, IP, seriales, procesos ni credenciales:

```bash
python3 -B -m local_assistant.hardware
```

Ejecutarlo **en Debian**, en reposo y durante una carga normal de la demo, sin
pruebas de estrés. La salida de Fedora no describe el homelab. Si el servicio
usará un cgroup diferente, medir sus límites también: el script solo informa el
cgroup raíz visible, que puede ser el de un contenedor; no resuelve el cgroup
anidado de cada proceso. Verificar límites efectivos con `systemctl show ollama`
después de una instalación futura aprobada.

Registrar: modelo/arquitectura de CPU, núcleos e hilos, AVX/AVX2, RAM disponible
mínima durante uso normal, swap/PSI, disco libre, CPU/memoria ya reservadas a la
demo y procesos existentes. El script no certifica compatibilidad de GPU; iniciar
por CPU, sin instalar drivers. Comprobar el espacio en el volumen donde realmente
se guardarán los modelos, no solo en el checkout.

Recomendaciones iniciales **estimadas por este proyecto**, no requisitos
garantizados ni resultados medidos:

| Candidato | CPU inicial | RAM disponible antes de cargar | RAM total orientativa en host compartido | Reserva de disco | Uso |
| --- | --- | --- | --- | --- | --- |
| Qwen3 0.6B | 2 hilos modernos; x86_64 con AVX2 preferible | 3 GiB o más | 6–8 GiB | 5 GiB libres | Equipo muy limitado; contrastar calidad |
| Qwen3 1.7B | 2 hilos asignados; CPU de 4 núcleos preferible para compartir | 6 GiB o más | 8–12 GiB | 6 GiB libres | Segundo candidato, condicionado a medición |
| Qwen3 4B | 2–4 hilos según reserva | 9 GiB o más | 16 GiB o más | 8 GiB libres | Solo si mejora las respuestas sin afectar la demo |

Estas reservas incluyen margen operativo, no solo pesos. SSD preferible; no
planificar usando swap como RAM. Si no queda margen para Django, DB y sistema,
mantener únicamente la FAQ. Una GPU no es necesaria para esta primera medición.
Para ARM64 comprobar el paquete y rendimiento específicos antes de elegir.

Los catálogos oficiales consultados el 26/10/2026 informan pesos aproximados
de [0.6B: 523 MB](https://ollama.com/library/qwen3:0.6b),
[1.7B: 1,4 GB](https://ollama.com/library/qwen3:1.7b) y
[4B: 2,5 GB](https://ollama.com/library/qwen3:4b), con cuantización Q4_K_M.
Eso **no equivale a RAM de inferencia**. Los tags pueden cambiar: registrar la
versión de Ollama y el digest del modelo que finalmente se pruebe. Los modelos
figuran con licencia Apache 2.0; conservar su licencia en una distribución futura.
No hay costo de API; energía, máquina y almacenamiento siguen teniendo costo.

## 2. Instalación futura tras revisión

Seguir la [instalación Linux oficial](https://docs.ollama.com/linux) para la
arquitectura medida. Elegir y registrar una versión concreta de la distribución
oficial y verificar su artefacto contra el checksum publicado si está disponible.
Si no hay mecanismo verificable, documentar esa limitación antes de instalar.
No usar un instalador que arranque automáticamente un servicio antes de aplicar
los límites: para este homelab se propone instalación manual.

Secuencia para el operador, únicamente después de aprobar recursos:

1. Confirmar `python3`, `tzdata`, cliente SSH y herramientas de descompresión
   existentes. El prototipo no necesita paquetes de pip. Si falta algo, preparar
   una instalación de paquetes separada y revisable.
2. Descargar manualmente el paquete oficial versionado `amd64` o `arm64`, revisar
   el contenido del archivo y extraerlo en `/usr` según la guía oficial. No usar
   URLs de terceros. Documentar versión y huella del archivo descargado.
3. Crear un usuario de servicio exclusivo `ollama`, sin inicio de sesión, y un
   directorio de modelos privado con dueño correcto. No usar el usuario de Django
   ni montar su DB, documentos, secretos o directorios privados.
4. Preparar la unidad **antes de iniciarla**. Base CPU para instalación manual en
   `/usr/bin/ollama` (confirmar esa ruta según el artefacto):

```ini
[Unit]
Description=Ollama local para prototipo FurgoPlus
After=network.target

[Service]
Type=simple
User=ollama
Group=ollama
ExecStart=/usr/bin/ollama serve
Environment="OLLAMA_MODELS=/usr/share/ollama/.ollama/models"
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

5. Aplicar como drop-in el ejemplo
   [ollama-override.conf.example](ops/ollama-override.conf.example), ajustado a la
   medición. El perfil de 1.7B limita a dos CPU, presión desde 3 GiB y máximo
   4 GiB sin swap; no es un tamaño garantizado. Para 0.6B considerar 1,5/2 GiB;
   para 4B considerar 5/6 GiB solo si existe reserva suficiente. Un límite de
   memoria demasiado bajo puede terminar Ollama: la FAQ debe seguir disponible.
6. Recién entonces recargar systemd e iniciar manualmente Ollama. No habilitar
   inicio al arrancar hasta completar la medición y revisión. Confirmar:

```bash
systemctl status ollama --no-pager
systemctl show ollama -p CPUQuotaPerSecUSec -p MemoryHigh -p MemoryMax -p MemorySwapMax
ss -ltn 'sport = :11434'
curl --noproxy '*' --max-time 2 http://127.0.0.1:11434/api/version
```

El único listener esperado es `127.0.0.1:11434`. Si aparece `0.0.0.0`, una IP
LAN/Tailscale, `[::]` o un proxy público, detener el servicio y corregir antes de
continuar. La [FAQ oficial](https://docs.ollama.com/faq) documenta loopback,
`OLLAMA_NO_CLOUD` y límites de carga/cola. El ejemplo los fija explícitamente:
solo local, un modelo, una inferencia y cola de uno. No publicar este puerto por
Cloudflare, router, Serve/Funnel o Internet, ni añadir orígenes de navegador.

7. Con autorización para la descarga, elegir **un** candidato. El comando futuro
   para la primera opción es:

```bash
sudo -H -u ollama env OLLAMA_HOST=127.0.0.1:11434 ollama pull qwen3:1.7b
sudo -H -u ollama env OLLAMA_HOST=127.0.0.1:11434 ollama list
```

No ejecutar aquí. No descargar los tres candidatos por defecto. Verificar digest
y espacio. Un modelo ausente debe producir alternativa FAQ; el cliente nunca
invoca `pull`, `run`, `create`, un instalador ni un servicio cloud.

## 3. Ejecutar y medir el prototipo, después de instalar

Desde un checkout aislado del prototipo en Debian, o desde Fedora con el túnel de
la sección siguiente, manteniendo datos sintéticos:

```bash
python3 -B -m local_assistant --ollama --model qwen3:1.7b
python3 -B -m local_assistant.benchmark --ollama --model qwen3:1.7b --samples 3
```

`benchmark` realiza 2–5 solicitudes secuenciales de guías fijas, no descarga nada
y se detiene ante la primera falla. Informa tiempo total de cada solicitud,
mediana posterior a la primera y validez del resultado. No presenta p95 con una
muestra insuficiente. El límite de seis inicios/minuto aplica dentro del proceso;
espaciar nuevas ejecuciones manuales al menos un minuto. No ejecutar benchmarks
de distintos candidatos simultáneamente.

La primera muestra puede incluir carga; para distinguir frío/caliente confirmar
antes con `ollama ps` y esperar descarga natural de memoria (60 s sin uso).
La carga fría puede exceder 8 s: falla de forma segura. Revisar si vale la pena
ampliar hasta 15 s; si no, usar un modelo menor o solo FAQ.

Observar con herramientas ya presentes `free -h`, `vmstat 1 10`, `ollama ps` y
`systemctl show ollama -p MemoryCurrent -p MemoryPeak -p CPUUsageNSec`.
Registrar versión/digest, contexto, hilos, latencia, pico de RAM, swap/PSI,
selecciones válidas y efecto en la demo. El benchmark no mide tokens/s ni incluye
un monitor continuo de recursos; no confundir su tiempo de pared con velocidad
de decodificación del servidor. La API ofrece métricas adicionales documentadas
en [chat](https://docs.ollama.com/api/chat) para una medición posterior.

Criterios propuestos para revisión: cero cifras/fechas inventadas; respuestas de
1–3 frases; 100 % de salidas presentadas pertenecientes al catálogo; alternativa
inmediata ante saturación; mediana caliente objetivo ≤3 s; sin swapping inducido
ni deterioro observable de la demo. Ese objetivo de latencia no está medido.
La medición de p95 y carga sostenida requiere otra sesión aprobada; no lanzar
pruebas de saturación sobre el homelab activo. Mantener concurrencia 1 aunque
exista más RAM hasta justificar un aumento.

## 4. Conexión segura desde Fedora

Usar un acceso SSH ya autorizado por LAN o Tailscale existente; no instalar ni
reconfigurar Tailscale, sshd, router o firewall. Verificar previamente la huella
del host por un canal confiable y tenerla en `known_hosts`. Usar clave local
protegida; no incluir secretos en comandos, preguntas ni este repositorio.

Ejemplo de destino: `usuario@alias-homelab` (sustituir por el conocido). Preparar
la variable en Fedora; no modificar `HOME` ni variables del sistema:

```bash
export FURGO_SSH_TARGET='usuario@alias-homelab'
```

Para inventario de solo lectura, sin copiar el repositorio ni escribir archivos
remotos, desde la raíz del worktree en Fedora:

```bash
ssh -T -o StrictHostKeyChecking=yes -o ForwardAgent=no -o ConnectTimeout=10 \
  "${FURGO_SSH_TARGET:?Define el destino SSH autorizado}" 'python3 -B -' \
  < local_assistant/hardware.py
```

Este comando aún no se ha ejecutado: falta un destino autorizado y no se necesita
para las pruebas sintéticas. Para la prueba posterior con Ollama ya instalado,
abrir en una terminal dedicada el siguiente túnel:

```bash
ssh -N -T -o StrictHostKeyChecking=yes -o ForwardAgent=no \
  -o ExitOnForwardFailure=yes -o GatewayPorts=no \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=2 \
  -L 127.0.0.1:11435:127.0.0.1:11434 \
  "${FURGO_SSH_TARGET:?Define el destino SSH autorizado}"
```

La opción `-L` y el bind explícito se describen en el
[manual SSH de OpenBSD/OpenSSH](https://man.openbsd.org/ssh).
En otra terminal de Fedora comprobar `ss -ltn 'sport = :11435'` y luego:

```bash
python3 -B -m local_assistant --ollama --port 11435 --model qwen3:1.7b
```

El listener de Fedora también debe estar solo en `127.0.0.1`. No usar `-g`, `-R`,
bind global ni un proxy de navegador. El túnel no configura Ollama y no certifica
que esté sano; `ExitOnForwardFailure` confirma la apertura del forward, no la
disponibilidad del destino. Si ya existe un servicio en 11435, usar otro puerto
local libre, sin detenerlo. Cerrar con Ctrl+C al terminar. La API no añade
autenticación propia: otros procesos/usuarios locales capaces de alcanzar ese
puerto son parte de la frontera de confianza de la máquina de desarrollo.

## 5. Detención y revisión

El CLI termina con `/salir` o Ctrl+C; no deja un servidor ni un historial.
El túnel termina con Ctrl+C en su terminal. Tras una futura prueba autorizada,
el operador puede detener la unidad Ollama dedicada para liberar RAM; no tocar
contenedores, DB, Docker, Cloudflare, Tailscale o demo r4. No borrar datos ni
modelos de servicios existentes como «limpieza».

Antes de integrar: completar HTTP real y Qwen real, medir hardware Debian,
contrastar calidad con FAQ sola y revisar el adaptador de sesión/propiedad Django.
La implementación actual se detiene para revisión humana; ninguna de estas
operaciones de instalación, red o despliegue fue autorizada para ejecutarse ahora.
