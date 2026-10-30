# Task 14 — aceptación factual y del intérprete local

Desde la raíz de `task/14-local-assistant`, en Fedora. Usar solo el túnel y el
Ollama/Qwen3 0.6B existentes en `127.0.0.1:11435`. No instalar, crear túneles,
cambiar red, contenedores, homelab, T12/T13 ni demo r4. Sin commit, push, merge
o deploy. Todos los ejemplos y controles de cuenta son sintéticos.

## 1. Puerta factual sin inferencia

```bash
python3 -B -m local_assistant.evaluate
python3 -B -m local_assistant.quality --repeats 200
python3 -B -m local_assistant.acceptance
FURGOPLUS_REQUIRE_WIRE_TESTS=1 python3 -B -m unittest discover -s local_assistant/tests -v
```

Exigir código 0: calidad 56/56 (incluidos 17 desconocidos con abstención),
23/23 evaluaciones previas; aceptación `status=ok`, 18 casos con
`pass=true`, `answer_correct=true`, `diagnostics_correct=true`. El modo offline
debe indicar `inference_verified=false`. Los 7 tests HTTP usan un servidor
efímero de fixture, no Ollama. En un sandbox con sockets prohibidos, la variable
obliga a fallar; sin ella quedan omitidos y no prueban el contrato HTTP real.

El oráculo de aceptación es independiente de la FAQ. Una respuesta incorrecta
falla aunque tenga ruta y diagnóstico correctos. El informe incluye las respuestas
de estos casos fijos para revisión humana; no usarlo con preguntas/personas reales.

## 2. Las tres consultas reales, con Ollama activado

```bash
python3 -B -m local_assistant --ollama --port 11435 --model qwen3:0.6b --threads 1 --timeout 8 --diagnostics --metrics
```

Introducir exactamente las preguntas siguientes y después sus paráfrasis:

| Consulta | Contenido obligatorio |
| --- | --- |
| ¿Qué diferencia hay entre Básico y Pro? | Básico sin informes mensuales, Pro con mensuales, Elite añade avanzados y XLSX. Capacidades académicas implementadas; sin contratación ni pago comercial dentro de FurgoPlus. |
| ¿Cómo puede un apoderado solicitar transporte? | Buscar → comuna → servicio → solicitud de contacto con permiso para compartir correo. No reserva un asiento. |
| ¿Puedo contratar el plan Elite y pagarlo directamente en FurgoPlus? | No existe contratación ni pago comercial habilitado actualmente. Precios como propuestas futuras. Nunca «Tu plan es Pro». |
| ¿Qué tiene Pro que no tenga Básico? | Misma comparación académica verificada. |
| ¿Dónde pido un furgón para mi hijo? | Mismo flujo de solicitud, sin reserva. |
| ¿Cómo me suscribo a Elite? / ¿Dónde puedo pagar mi plan? | Mismo límite comercial; sin instrucciones inventadas de compra o pago. |

Las seis variantes deben ser FAQ directa: `source=faq`, `model_status=not_needed`,
`model_attempted=false`, `model_invoked=false`, `budget_reason=null`. Esto se
mantiene aunque Ollama no responda, el modelo esté frío o el presupuesto esté
agotado. No llamarlo fallback ni inferencia real. `route` es `plans`,
`parent_request` o `commercial`, respectivamente. «En detalle» conserva la
respuesta principal y añade hasta dos frases revisadas.

Controles: «¿Qué plan tengo?» consulta solo datos sintéticos autorizados y
responde «Tu plan es Pro y está activo»; «¿Cuándo vence mi plan?» consulta
vencimiento; «¿Cuándo vence mi pago?» informa que esa consulta no está soportada.
Ninguno debe invocar al modelo. No introducir texto personal o sensible real.

## 3. Identificar la instalación sin inferencia

```bash
python3 -B -m local_assistant.probe --port 11435 --model qwen3:0.6b --timeout 2
```

Registrar versión y digest, modelo instalado y cargado. La versión aportada por
el operador es **0.40.12**; cotejar el resultado sin sustituirla por una supuesta
versión más reciente. `available` prueba metadatos, no inferencia. Si devuelve
`unavailable`, detener los pasos que necesitan Ollama y registrar la limitación;
no intentar eludir el sandbox ni modificar el túnel.

## 4. Aceptación híbrida estricta

Sin otros CLI/benchmarks concurrentes y tras al menos 60 s sin inferencias:

```bash
python3 -B -m local_assistant.acceptance --ollama --port 11435 --model qwen3:0.6b --threads 1 --timeout 8
```

Los 18 casos anteriores no deben inferir. Luego se prueban dos consultas ambiguas:
«Soy mamá, busco furgón en la demo de FurgoPlus y necesito orientación para
empezar» y «FurgoPlus ofrece funciones para una demo académica». El primero
ofrece varios candidatos, para evitar aprobar una elección trivial de tema único.
Solo pasan con `source=ollama_intent_faq`, `model_status=ok`,
`model_attempted=true`, `model_invoked=true`, la ruta esperada y la respuesta
exacta del oráculo. Los contadores finales deben indicar `public_direct=14`,
`ambiguous=2`, `model_attempts=2`, `model_confirmed=2`, `model_timeouts=0`,
`fallbacks=0`. El modelo recibe únicamente conceptos fijos y temas públicos,
no el texto original ni datos de cuenta. No redacta hechos ni elige frases.
El nuevo prompt solicita contexto 1024/salida 24, `think:false`; registrar
los conteos de tokens reales si están disponibles en el benchmark, sin confundir
los límites solicitados con tokens consumidos. Un corte `done_reason=length`
falla la aceptación y no se interpreta como selección válida.

Exigir código 0, `status=ok`, 20 casos aprobados e `inference_verified=true`.
La aceptación se detiene en el primer fallo del modelo, sin reintentos. Fallback,
`unknown`, error, timeout y rechazo por presupuesto fallan esta puerta. Se puede
aprobar exactitud de FAQ y dejar pendiente el intérprete real; no confundir ambas.

## 5. Frío, caliente, presupuesto y fallback con 8 s

El timeout de 8015 ms reportado antes de la corrección no identifica por sí solo
si el modelo estaba frío. El rechazo siguiente pudo deberse a concurrencia,
frecuencia o circuito abierto: el diagnóstico anterior no registraba cuál.
No deducir que fue una segunda inferencia ni atribuir una fase sin evidencia.

Dejar al menos 60 s entre grupos. Esperar descarga natural de memoria
(`keep_alive=60s`) y observar con la sonda `model_loaded=false`. No forzar carga,
unload ni reinicio. Para medir el clasificador usado por el asistente:

```bash
python3 -B -m local_assistant.benchmark --ollama --port 11435 --model qwen3:0.6b --threads 1 --timeout 8 --samples 3 --mode classify --expect-first cold
```

El primer caso solo se etiqueta frío si `/api/ps` lo confirma; se comprueba de
nuevo antes de cada muestra posterior. Conservar `phase=unconfirmed` si no se
puede observar. Frío/caliente es estado de residencia observado, sujeto a uso
externo del servidor. Registrar pared (incluye hijo y túnel) y contadores
opcionales `load_duration`, `prompt_eval_duration`, `eval_duration`,
`total_duration` en nanosegundos, además de cantidades de tokens.

Si el frío vence, el grupo falla y se detiene. `timeout_censored=true` significa
que no terminó dentro del plazo; no es una latencia exitosa ni entra en mediana.
El cliente recoge su hijo, pero no garantiza cancelar trabajo dentro de Ollama.
Tras terminar la actividad y respetar el intervalo, comprobar con la sonda si
sigue cargado. Solo entonces puede medirse un grupo caliente:

```bash
python3 -B -m local_assistant.benchmark --ollama --port 11435 --model qwen3:0.6b --threads 1 --timeout 8 --samples 3 --mode classify --expect-first warm
```

Si no está cargado se informa `precondition_failed`, sin inferir. No aumentar
8 s para conseguir una aprobación. Para más evidencia repetir grupos pequeños
separados, sin provocar presión sobre otros servicios. No se estima p95 con
estas muestras; `p95=null`. Registrar también recursos con el monitor habitual,
sin instalar ni cambiar límites. Si solo falla frío, documentarlo; si también
falla caliente, documentarlo y mantener la orientación segura. No decidir cambios
de timeout a partir de una muestra o de la vieja selección de frases, eliminada.

| Diagnóstico | Interpretación |
| --- | --- |
| `faq / not_needed / invoked=false` | Hechos públicos recuperados directamente; no se consultó presupuesto. |
| `ollama_intent_faq / ok / invoked=true` | Clasificación estructurada válida, seguida de FAQ revisada. |
| `faq_fallback / timeout / invoked=null` | Interpretación fallida dentro de 8 s; orientación revisada que reconoce incertidumbre. No se adivina entre temas candidatos. |
| `faq_fallback / budget_rejected / invoked=false` | Rechazo local sin petición al servidor. `budget_reason=concurrency`, `rate_limit` o `circuit_open`. |
| `faq_fallback / transport_error o invalid_output / invoked=null` | No se confirma inferencia válida. No se muestran errores ni prosa del servidor. |
| `deterministic / unknown / invoked=true` | El clasificador respondió válidamente `unknown`; no confirmó un tema. |
| `deterministic / disabled / invoked=false` | Consulta ambigua con modelo deshabilitado; sin interpretación confirmada. |

Concurrencia 1, seis inicios/minuto y circuito de 30 s son por proceso, sin cola.
No probar saturación contra Ollama: la suite reproduce esos tres rechazos y la
secuencia timeout → circuito → FAQ directa sin sockets. No reiniciar procesos
para sortear el presupuesto. Las preguntas públicas claras no gastan inicios.

Guardar comandos y códigos de salida, versión/digest, respuestas y diagnósticos,
tabla de fase/estado/tiempo/contadores y recursos observados. Separar datos del
operador, dobles de prueba, HTTP fixture e inferencia real de esta revisión.
Detenerse para revisión humana, sin commit, push, merge ni deploy.
