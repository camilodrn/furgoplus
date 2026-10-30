# T14 — revisión de alcance y rendimiento

Estado: FAQ determinista validada; **modo híbrido sin aprobar**. No se ha
demostrado clasificación real bajo 8 segundos con los cambios de este lote.

## Evidencia y causa

El operador informa Ollama 0.40.12, Qwen3 0.6B, inferencia corta por
`/api/generate` en 4,36 s y timeout de clasificación caliente en 8,011 s.
Son mediciones del homelab, no reproducidas aquí. Un timeout es una observación
censurada: no indica cuánto habría tardado la clasificación en terminar.

La inspección del código y del payload anterior confirma:

| Elemento del benchmark | Antes | Ahora |
| --- | ---: | ---: |
| Petición serializada, UTF-8 | 1.071 bytes | 795 bytes |
| Mensaje system | 360 caracteres | 100 caracteres |
| Mensaje user | 238 caracteres | 227 caracteres |
| Esquema serializado | 172 bytes | 172 bytes |
| Candidatos / valores enum con unknown | 2 / 3 | 2 / 3 |
| Contexto / salida solicitados | 1.024 / 24 tokens | 1.024 / 24 tokens |

No se enviaba el catálogo completo: solo dos preguntas públicas candidatas para
este benchmark. El selector puede construir hasta cuatro candidatos públicos.
Los caracteres y bytes no son tokens del modelo ni incluyen la plantilla de
chat aplicada por Ollama. `prompt_eval_count` proporciona el conteo del servidor
cuando hay respuesta completa.

**Causa de latencia no aislada.** El prompt de clasificación tenía instrucciones
y traducciones redundantes. Reducirlas es una optimización pequeña y comprobable
en tamaño, pero su efecto en segundos sigue sin medir. Son hipótesis pendientes:
costo del prompt y plantilla de chat, preparación de gramática JSON, generación,
cola/carga del servidor, o recarga del runner al solicitar opciones distintas de
las usadas en `/api/generate`. Que `/api/ps` muestre pesos cargados no demuestra
que contexto, caché de prompt y opciones coincidan. No hay evidencia suficiente
para atribuir el problema a `/api/chat`, al esquema o al túnel por separado.

Un ensayo sin red de cinco arranques del worker, con endpoint inválido y salida
inmediata, dio mediana 0,085 s (rango 0,084–0,092 s). Solo mide arranque/imports
en este sandbox; no mide HTTP ni SSH y no se extrapola al homelab.

La sonda de este entorno devolvió `api_available:false`, `status:unavailable`,
en 0,058 s. La conexión directa al puerto 11435 falló con
`PermissionError`, errno 1. Por eso **no se ejecutó benchmark de inferencia**;
no se puede inferir desde aquí el estado del daemon o del túnel en Fedora.

## Cambios mínimos

- `scope.py` valida toda la entrada antes de las reglas de cuenta y antes de
  descartar una anotación personal posterior a una FAQ. Rechaza solicitudes
  explícitas de código, evasión, prompt interno, datos ajenos y hechos inventados.
  Antes, «cuándo vence el plan de otro usuario» consultaba el plan propio, y una
  FAQ seguida de «Mi hijo pide generar HTML» recuperaba la FAQ. No se observó
  divulgación ajena ni ejecución, pero ahora esas solicitudes se rechazan sin leer.
- Se añade un rechazo breve sobre el alcance FurgoPlus. Las preguntas generales
  que no coinciden con reglas siguen recibiendo la abstención determinista.
- Las palabras técnicas solas no activan el rechazo de código. Ocho consultas
  positivas incluyen XLSX, GPS, pasarela de pagos y errores SQL, HTML, API y token.
  Unas pocas formulaciones completas de soporte reciben la guía de ayuda ya
  aprobada; no se inventan soluciones técnicas ni se solicitan secretos.
- Se acorta el mensaje system y compacta el JSON del mensaje user. Se conservan
  etiquetas de conceptos, preguntas candidatas, esquema, número de tokens,
  modelo, un hilo, `think:false`, contexto y residencia de 60 s. No se usan
  heurísticas nuevas para declarar una clasificación correcta.
- El máximo configurable pasa de 15 a **8 s**, tanto en el cliente como en el
  worker. Siguen el límite de una inferencia, seis inicios/minuto, circuito de
  30 s y fallback seguro. No se agregan reintentos ni precalentamiento.
- El decoder también rechaza una respuesta con `message.thinking` no vacío.
  Esto detecta razonamiento inesperado; un timeout no permite verificarlo.
- El benchmark informa tamaño real, opciones solicitadas y desglose de tiempos.
  Una selección correcta después del plazo también falla la validación.

El límite de `subprocess.run` termina y recoge al hijo, pero existe una pequeña
sobrecarga de terminación/medición; no es una garantía de tiempo real duro sobre
el proceso del servidor. No garantiza cancelación instantánea de Ollama.

## Seguridad y validación local

Resultados tras los cambios, sin modificar los tests ni oráculos existentes:

| Comprobación | Resultado |
| --- | --- |
| Suite unittest | 92 descubiertas: 85 pasaron, 7 omitidas por sockets prohibidos |
| Evaluación determinista | 23/23 |
| Aceptación pública y controles | 18/18; `inference_verified:false` |
| Calidad, 200 repeticiones | 56/56; 100 % en este corpus sintético |
| Nuevas negativas de alcance | 31 entradas, con modelo habilitado y deshabilitado |
| Soporte técnico positivo | 8 entradas, respuesta desde FAQ aprobada |

Las negativas cubren Python, HTML, SQL, Mercado Libre, preguntas generales,
prompt interno, ignorar reglas/cambio de rol, mezcla FurgoPlus+código, otros
usuarios, fabricación de planes/pagos y acciones. Ninguna consulta el proveedor
ni llama al modelo. Las pruebas nuevas también impiden ampliar el timeout,
aceptar razonamiento inesperado o aprobar latencia posterior al plazo.

En la última evaluación local, el turno determinista tuvo mediana 0,0554 ms,
p95 0,1394 ms y máximo 4,3751 ms. Son repeticiones dentro del proceso con índice
cargado; no incluyen arranque CLI ni constituyen latencia de Qwen o del homelab.

La garantía estructural sigue siendo: al modelo solo llegan conceptos fijos y
candidatos públicos; su salida debe ser un único tema permitido o `unknown`;
nunca se imprime prosa del modelo. La FAQ procede del catálogo aprobado y los
datos particulares del proveedor autorizado, con aislamiento por actor/recorrido.
El modelo no selecciona usuarios, no recibe datos de cuenta y no ejecuta tools.
El proveedor actual es sintético; no se ha conectado autenticación ni datos reales.
Las reglas de detección son conservadoras y finitas, no una comprensión semántica
de cualquier ataque; los controles de salida y autorización no dependen de ellas.

## Repetición en Fedora

Desde la raíz del checkout y con el túnel existente, sin instalar ni precalentar:

```bash
FURGOPLUS_REQUIRE_WIRE_TESTS=1 python3 -B -m unittest discover -s local_assistant/tests -q
python3 -B -m local_assistant.probe --port 11435 --model qwen3:0.6b
python3 -B -m local_assistant.benchmark --ollama --port 11435 --model qwen3:0.6b --timeout 8 --threads 1 --samples 3 --expect-first either
python3 -B -m local_assistant.acceptance --ollama --port 11435 --model qwen3:0.6b --timeout 8 --threads 1
```

`either` no precalienta: registra frío/caliente antes de cada muestra. Si la
primera muestra ya estaba caliente, ese resultado no verifica el arranque frío.
Para exigir frío, repetir cuando el modelo haya dejado de estar residente usando
`--expect-first cold`; si aún está cargado, falla la precondición sin inferencia.
El benchmark se detiene ante la primera selección inválida, timeout o rechazo.
No ejecutar las pruebas de inferencia en paralelo con otras cargas de Ollama.

Para inspeccionar metadatos del modelo instalado, sin inferencia ni cambios:

```bash
curl --noproxy '*' -fsS --connect-timeout 2 --max-time 8 http://127.0.0.1:11435/api/show -H 'Content-Type: application/json' -d '{"model":"qwen3:0.6b"}' > /tmp/furgoplus-qwen3-show.json
```

Revisar `parameters`, `template`, capacidades y metadatos de thinking si existen
en esa versión. Son configuración del modelo; las opciones por petición se
registran aparte en `request_profile`. Aquí no se verificó que el servidor aplique
efectivamente cada opción ni su plantilla/version/digest actual.

Con una respuesta completa, comparar `server_metrics` y `timing_seconds`:
`load` identifica carga; `prompt_eval` mide procesamiento del prompt; `eval` mide
generación. `client_worker_transport` es tiempo de pared menos `total_duration`,
una estimación conjunta de cliente, arranque y transporte, no una medición aislada
de SSH. El total del servidor puede incluir trabajo adicional, cola o gramática
sin desglose. Un timeout no devuelve estos contadores; no inventar tiempos de
fases ni subir el plazo para obtenerlos. Semántica de campos según la
[API oficial de Ollama](https://docs.ollama.com/api/chat); comportamiento de
`think` según la [documentación oficial](https://docs.ollama.com/capabilities/thinking),
sin asumir que la versión instalada coincide con la documentación actual.

Pendiente: inferencia real correcta bajo 8 s en frío y caliente, ambos casos
ambiguos de aceptación y siete pruebas HTTP en el host. Si vuelven a fallar,
mantener la FAQ y declarar bloqueado el modo híbrido. No se modificó infraestructura,
no se instalaron dependencias/modelos, no se integró React/Flutter y no se hizo
commit, push, merge ni deploy.
