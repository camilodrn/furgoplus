# Base pública híbrida — lote del 29/10/2026

Lote completo para revisión humana en `task/14-local-assistant`. Se conserva el
contenido de las nueve FAQ y las pruebas anteriores. Se agrega base JSON de 12
conocimientos con identificadores, procedencia, fecha y alcance demo,
experimental o comercial no disponible. Recuperación por equivalencias
completas y reglas acotadas, con abstención ante coincidencias superficiales.
Los estados de cuenta, vencimientos y cupos prevalecen sobre coincidencias
públicas; pagos personales mantienen su negativa por falta de adaptador.

No hay entrenamiento, cambios de pesos, dependencias nuevas, base vectorial,
caché de respuestas ni memoria conversacional. Solo el índice público se carga
una vez. Qwen3 0.6B sigue opcional como clasificador de conceptos fijos, nunca
como fuente de hechos. Se acortó el prompt y la solicitud pasó de 2048/48 a
1024/24 tokens de contexto/salida. Se conservan 8 s, un hilo, concurrencia 1,
seis inicios/minuto, circuito 30 s y ausencia de reintentos. La compatibilidad y
calidad reales del prompt compacto están pendientes de aceptación en Fedora.

## Evidencia local de este lote

| Comprobación | Resultado |
| --- | --- |
| Suite previa, antes de cambios | 71 tests: 64 aprobados, 7 omitidos por sockets. |
| Suite final `python3 -B -m unittest discover -s local_assistant/tests -v` | **84 tests: 77 aprobados, 7 omitidos por sockets**. Se conservan pruebas de aislamiento, permisos, timeout real del hijo, concurrencia, presupuesto, privacidad, FAQ falsas y rechazo de fallback como aceptación. |
| `python3 -B -m local_assistant.evaluate` | **23/23** regresiones originales. |
| `python3 -B -m local_assistant.acceptance` | **18/18**, `status=ok`, `inference_verified=false`. |
| `python3 -B -m local_assistant.quality --repeats 200` | **56/56**, 11200 turnos sintéticos; 28/28 FAQ/paráfrasis y 17/17 desconocidos con abstención. Oráculo separado del catálogo. |
| Recuperación pública, 5600 muestras | Mediana **0,0146 ms**, p95 **0,0201 ms**. |
| Turno completo, 11200 muestras | Mediana **0,0411 ms**, p95 **0,0889 ms**; índice cargado, sin arranque de CLI. |
| Rutas sin necesidad de modelo en el corpus | **53/56 (94,64 %)**; incluye negativas y controles autorizados. Las FAQ directas son 28/56 (50 %); 3 ambiguas elegibles para IA opcional. |
| Inferencias reales confirmadas en este lote | **Cero**. En modo offline, las tres ambiguas se abstienen; no se cuentan como clasificaciones correctas de Qwen. |
| Sonda `--port 11435 --model qwen3:0.6b` | Código 1, `unavailable`, `api_available=false`, `inference_tested=false`, ~116 ms. No se continuó a inferencia tras fallar la precondición. |
| Fuentes T12 | Tres hashes recalculados en lectura, idénticos a SOURCES.md; catálogo 2026-10-19.3. Sin cambios ni tests en T12. |

El [reporte conservado](QUALITY_REPORT.json) incluye hashes del catálogo, corpus
y oráculo, Python/sistema/arquitectura, tiempos por categoría y contadores sin
texto personal. Los 8,12 s y ~809 MiB de inferencia directa, así como 0,6–2,5 ms
de FAQ previa, proceden del operador en otro entorno. No constituyen una
comparación controlada ni una medición de este clasificador. No hay medición
nueva de memoria o inferencia en Debian.

Los contadores distinguen FAQ directa, ambigüedad, intento, clasificación válida
(incluido `unknown`), timeout, abstención y fallback; `--metrics` los publica solo
si se solicita. Las pruebas de modelo emplean dobles y no prueban inferencia
real. La salida `model_invoked=null` ante timeout/error evita afirmar éxito.

Se ajustan dos expectativas anteriores para los criterios conservadores:
consulta comercial mezclada con «qué plan tengo» va a fuente autorizada;
una pregunta conocida con un sufijo desconocido se abstiene, sin filtrar el
sufijo al diagnóstico. Se mantiene la prueba de seguridad respectiva y se
agregan regresiones independientes. El contrato de recursos prueba 1024/24.

## Entrega y aceptación pendiente

- [Base JSON](knowledge.json), [búsqueda](retrieval.py) y [guía de mantenimiento](KNOWLEDGE.md).
- [Procedencia](SOURCES.md), [oráculo ampliado](quality_cases.py), [evaluador](quality.py).
- [Aceptación real](ACCEPTANCE.md): pruebas HTTP obligatorias fuera del sandbox,
  sonda del túnel existente `127.0.0.1:11435`, aceptación estricta de dos
  clasificaciones y benchmark con estado frío/caliente observado. Solo
  `ollama_intent_faq/ok`, tema y texto esperados y confirmación válida aprueban;
  FAQ y fallback jamás aprueban inferencia. No subir timeout para obtener un pase.

Solo se escribieron archivos de `local_assistant/`, que ya estaba sin
seguimiento al inicio. `git status` continúa mostrando únicamente ese directorio
sin seguimiento. Sin cuentas reales, base privada, integración web/Flutter,
instalaciones, SSH, cambios de homelab/T12/T13/demo r4/red ni modelos.
Sin staging, commit, push, merge o deploy. **Detenido para revisión humana.**

---

La evidencia siguiente es histórica. Sus reglas de precedencia comercial,
conteos y límites de contexto describen lotes previos; prevalece este lote.

# Corrección tras aceptación real de Fedora — 28/10/2026

Rama `task/14-local-assistant`, base `c0854de`. `local_assistant/` estaba sin
seguimiento al inicio y continúa así. Solo se editaron archivos de ese directorio;
sin staging, commit, push, merge ni deploy. T12 se inspeccionó exclusivamente en
lectura para verificar hechos; no se ejecutaron sus tests ni se modificó su
worktree. Sin cambios en T13, homelab, demo r4, contenedores, red o modelos.

## Hallazgos y correcciones

1. La FAQ de planes copió Q2 de `PRODUCT_SCOPE.md` de main y lo presentó como
   vigente. Esa base no contiene las capacidades implementadas en T12. Se retiró
   la igualdad de planes y se verificó el catálogo `2026-10-19.3`, guards de
   reportes y especificación. [SOURCES.md](SOURCES.md) identifica fuentes y hashes.
   Básico no incluye mensuales, Pro sí, Elite añade avanzados y XLSX. Los precios
   son propuestas, sin contratación/pago comercial dentro de FurgoPlus.
2. La pregunta sobre contratar/pagar Elite caía en datos personales por contener
   `plan`, mientras `pagarlo` no coincidía con la antigua regla de pagos. La ruta
   pública `commercial` tiene precedencia sobre datos y contempla flexiones de
   comprar/contratar/pagar/suscribirse. Una simple mención de `plan` ya no basta
   para una lectura privada: se exige intención personal o el atajo exacto `plan`.
   Consultas de capacidades del plan siguen siendo conocimiento público.
3. Las FAQ claras gastaban modelo para seleccionar frases ya revisadas, causando
   demora y rechazos sin mejorar la respuesta. Ahora son directas aun con
   `--ollama`. Se eliminó la API de selección de frases; el único uso del modelo
   es clasificar conceptos fijos en preguntas ambiguas. No se envía texto personal
   ni información sensible; los datos privados siguen en funciones autorizadas.
4. Los diagnósticos distinguen FAQ directa (`faq/not_needed`), clasificación
   confirmada (`ollama_intent_faq/ok`), orientación de fallback incierta
   (`faq_fallback`) y presupuesto rechazado sin llamada al servidor. El campo
   `budget_reason` separa concurrencia, frecuencia y circuito abierto.
5. La aceptación anterior comparaba contra la misma FAQ que podía estar equivocada.
   Ahora hay un oráculo literal independiente con las tres consultas exactas,
   paráfrasis y controles personales/privacidad. Verifica texto y diagnóstico.
   Pruebas con respuestas falsas demuestran que falla ante igualdad de planes,
   reserva automática o plan personal en una consulta comercial.

## Timeout y presupuesto

El resultado aportado de 8015 ms prueba que venció el plazo, pero no distingue
frío de caliente. El `budget_rejected` posterior no demuestra inferencia y podía
ser circuito abierto de 30 s, concurrencia o frecuencia; faltaba registrar la
causa. No se asigna retrospectivamente una causa no observada. Se conserva **8 s**,
un hilo, concurrencia uno, seis inicios/minuto y circuito de 30 s. No se amplió el
plazo ni se añadieron modelos. El techo configurable previo de 15 s no cambió;
el procedimiento actual exige medir y aceptar a 8 s.

El benchmark mide únicamente clasificación. Observa `/api/ps`, distingue frío,
caliente y fase no confirmada; marca timeout censurado, separa rechazos de
presupuesto y no incluye fallos en medianas. Ante error detiene el grupo sin
reintentar. El procedimiento permite observar caliente tras un frío fallido solo
si la sonda confirma residencia y se respeta el intervalo, sin cargar/descargar
ni reiniciar. No se simula que exista una medición de Qwen en este sandbox.

## Evidencia de esta revisión

- `python3 -B -m local_assistant.evaluate`: **23/23**, texto y origen exactos.
- `python3 -B -m local_assistant.acceptance`: **18/18**, `status=ok`,
  `inference_verified=false`; respuestas públicas y controles sintéticos.
- Suite: **71 tests, 64 aprobados y 7 omitidos por sockets prohibidos**.
  Incluye secuencia timeout → circuito, rechazo concurrente y de frecuencia,
  FAQ directa con presupuesto ocupado y pruebas de aceptación con respuestas
  falsas. Las 14 preguntas públicas también pasan por subprocesos CLI con
  `--ollama`, respuesta exacta y cero intentos de modelo. Las simulaciones no
  acreditan inferencia real.
- Sonda real al puerto local 11435 con plazo 2 s: `status=unavailable`,
  `api_available=false`, `inference_tested=false` (aprox. 0,05 s).
- Aceptación `--ollama --port 11435 --model qwen3:0.6b --timeout 8`: código **1**,
  18 casos directos/controles aprobados; primer caso ambiguo falla con
  `faq_fallback/transport_error`, `model_invoked=null`, aprox. 53 ms.
  `inference_verified=false`; no se intentó la segunda clasificación.
- Benchmark de clasificación a 8 s: código **1**, `precondition_failed`,
  sonda `unavailable`, cero muestras y ninguna inferencia intentada.
- No hay medidas nuevas de frío/caliente, recursos o inferencia real. Ollama
  **0.40.12**, Qwen3 0.6B y túnel existente son datos del operador, no verificados
  aquí. Los tests HTTP fixture requieren ejecución obligatoria fuera del sandbox.

Procedimiento entregado: [ACCEPTANCE.md](ACCEPTANCE.md). Tras las puertas factual,
HTTP y sonda, la aceptación híbrida exige 20/20, dos clasificaciones válidas y
respuestas exactas; fallback no aprueba inferencia. No se requiere aprobación
para las correcciones locales ya solicitadas. Se detiene tras entregar pruebas
y procedimiento; la aceptación real en Fedora queda pendiente.

---

Lo siguiente conserva evidencia histórica. Sus afirmaciones de igualdad de
planes, modelo para seleccionar frases y guiones de aceptación previos están
**sustituidos por esta revisión** y no describen el comportamiento actual.

# Task 14 — evidencia para revisión humana

## Histórico: lote de utilidad anterior a la aceptación real de Fedora

Rama comprobada: `task/14-local-assistant`. Al empezar, `local_assistant/` ya
estaba sin seguimiento; continúa así, sin staging ni commit. Solo se editaron
archivos de ese directorio. No se modificó infraestructura, contenedores, red,
demo r4 ni Tasks 12/13; tampoco se instaló o descargó nada.

### Diagnóstico reproducido antes del cambio

| Pregunta exacta | `understand` anterior | Motivo | Modelo |
| --- | --- | --- | --- |
| ¿Qué diferencia hay entre Básico y Pro? | `intents=('unknown',), topic=None` | No reconoce comparación ni nombres de planes; no contiene la palabra literal `plan`. Falta también la guía de comparación. | No se llega a invocar |
| ¿Cómo puede un apoderado solicitar transporte? | `intents=('unknown',), topic=None` | La guía de solicitudes exige `solicitud` más reserva/asignación/aceptación/cupo; no reconoce `solicitar transporte`. Falta la guía del flujo del apoderado. | No se llega a invocar |

Ambas devolvían el texto estático de desconocido antes de leer cuentas o entrar
al adaptador. **No eran rechazos de seguridad, timeouts ni errores de Ollama.**
La inferencia directa previa de 8,12 s sí supera el timeout actual de 8 s, pero
es un problema distinto: con un tema reconocido debe conducir a FAQ, nunca a
inventar una respuesta. Ese tiempo no mide los prompts nuevos.

### Cambios y sustento

- Reglas para preguntas originales y paráfrasis habituales; tres guías nuevas
  con resumen primero y hasta tres frases al pedir «en detalle».
- Planes: [PRODUCT_SCOPE, Q2](../docs/PRODUCT_SCOPE.md) y
  [ADR 0004](../docs/decisions/0004-publication-eligibility.md): Basic/Pro/Elite
  tienen las mismas funciones en el MVP académico; sin precios, cuotas,
  prioridad ni beneficios comerciales confirmados. No se importan contratos de T12.
- Solicitud: [recorrido del apoderado](../docs/PRODUCT_SCOPE.md),
  [términos, secciones 1/4](../web/src/legal/terms.md) y
  [modo demo](../docs/DEMO_MODE.md): Buscar/comuna/servicio, consentimiento de
  correo, Solicitudes, contacto tras aceptación y coordinación externa. No reserva
  ni contrato automático; registro público cerrado y solo datos ficticios.
- Alcance: funciones de demo académica; asistente local experimental; operación
  comercial condicionada a revisiones pendientes. No se afirma disponibilidad
  de un servicio real, habilitación legal ni lanzamiento comercial.
- El modelo puede clasificar conceptos de una lista cerrada para variantes
  públicas ambiguas; devuelve un tema permitido o `unknown`. El tema debe tener
  evidencia local. No recibe texto original, secuencias de palabras del usuario,
  nombres, contactos, fechas, cifras ni DTO de cuenta. El texto mostrado sigue
  siendo FAQ, sin una segunda llamada al modelo. La calidad semántica real queda
  pendiente: los conceptos pierden orden/matices y no garantizan relevancia.
- `--diagnostics` muestra origen, etiqueta de ruta, intento, confirmación,
  resultado y tiempo del turno, sin datos sensibles. `model_invoked=null` ante
  fallos evita afirmar que el servidor ejecutó una inferencia; `true` requiere
  salida válida. Se distingue timeout, transporte, JSON inválido y presupuesto.
- Fallback conserva el resumen y detalles pedidos, sin anteponer avisos técnicos.
  Si no hay sustento se reconoce y se ofrecen ejemplos concretos para continuar.
- Timeout default **8 s**, techo **15 s**, concurrencia **1**, seis inicios/minuto
  por proceso y circuito de 30 s se conservan. Worker y padre distinguen timeout.
  Benchmark separa frío/caliente según `/api/ps`, incluye versión/digest y
  contadores numéricos del servidor; detiene fallas, sin retries ni p95 ficticio.

### Verificación de este lote

| Comprobación | Resultado de este entorno |
| --- | --- |
| Baseline antes de editar | 48 pruebas: 43 pasaron, 5 omitidas por sockets |
| `python3 -B -m local_assistant.evaluate` | 11/11, texto/origen exactos |
| `python3 -B -m unittest discover -s local_assistant/tests -v` | 65 pruebas: 58 pasaron, 7 omitidas por bloqueo de sockets |
| Preguntas originales y 19 paráfrasis/consultas públicas adicionales | FAQ correcta sin lecturas de cuenta ni modelo; incluye acentos/mayúsculas, precios no confirmados y planes recomendables |
| Nuevo clasificador | Payload canario sin nombres/direcciones/correo; enum/JSON estrictos; rechazo de texto libre, temas sin evidencia y herramientas, probado con dobles |
| Fallas y diagnósticos | Timeout del padre/worker, error de transporte, salida inválida y presupuesto; FAQ íntegra y ausencia de datos de cuenta en diagnósticos |
| Benchmark/aceptación | Frío/caliente, precondiciones, métricas numéricas permitidas, parada al fallar y rechazo de fallback como aceptación real, probados con dobles |
| HTTP real de fixture | 7 pruebas preparadas; no ejecutadas aquí por bloqueo de sockets |
| Ollama real por túnel | No ejecutado en este lote; sin nuevas medidas calientes/frías ni validación semántica de Qwen |

Las 48 pruebas y 9 evaluaciones previas aprobadas en Fedora, el túnel operativo,
Ollama 0.40.12/Qwen3 0.6B, los 8,12 s / 19 tokens / 808,8 MiB y r4 saludable
son **evidencia aportada por el operador**. No se atribuyen a estas modificaciones.

Procedimiento exacto: [ACCEPTANCE.md](ACCEPTANCE.md). Ejecuta tests HTTP obligatorios,
sonda, medición de ambos modos y aceptación real con diez casos (cuatro controles
sin IA y seis inferencias como máximo). No permite declarar éxito por fallback.
La ventana diagnóstica de 15 s, si 8 s censura la medición, no cambia el timeout
normal. Cualquier propuesta de cambio depende de resultados reales y revisión.

Pendiente: ejecutar ese procedimiento en Fedora, registrar resultados/recursos
y revisar la utilidad real. **Sin commit, push, merge o deploy. Detenido para
revisión humana.** Lo siguiente se conserva como evidencia histórica.

## Lote anterior de transporte/infraestructura propuesta: 28/10/2026

Se conserva el prototipo previo sin cambios de reglas, FAQ ni fixtures. Se
comparte el transporte HTTP acotado entre el adaptador de inferencia y una sonda
de disponibilidad; se mantiene el deadline con subproceso recogido, loopback
numérico, sin proxies, redirects ni reintentos. La sonda solo permite GET de
versión/tags/ps, sin cargar ni descargar modelos, y distingue API ausente de
pesos ausentes. Hay pruebas nuevas de ese contrato y de fallback de punta a
punta con errores simulados del adaptador real.

Se amplía el inventario con volumen seleccionable, PSI CPU/I/O y consultas de
solo lectura a metadatos de servicios/listeners/contenedores, optativas con
`--services`. Docker fija un socket Unix local para no usar contextos remotos.
No se leen env/logs/DB/datos de T12. En este lote solo se ejecutó el inventario
básico en Fedora con `/tmp`; no se consultaron servicios de Debian.

El ADR 0007 registra A10-5750M, 10 GiB RAM y HDD de 1 TB compartido. La decisión
provisional es **0.6B**, un hilo y una CPU, con techo de 2 GiB sin swap en el
Compose dedicado. Se conserva 1.7B como candidato si quedan ≥6 GiB disponibles
durante carga habitual y aporta utilidad. Son presupuestos, no consumos medidos.
Ver [HARDWARE.md](HARDWARE.md) y [HOMELAB_COMPOSE.md](HOMELAB_COMPOSE.md).

| Comprobación actual | Resultado |
| --- | --- |
| `python3 -B -m local_assistant.evaluate` | 9/9, texto y origen exactos |
| Suite `unittest` | 48 tests: 43 aprobados, 5 omitidos por bloqueo de sockets |
| GET/POST local, paths permitidos y cuerpos acotados | Probados con dobles, sin red |
| API/pesos ausentes, modelo descargado sin cargar, digest y metadatos inválidos | Simulados; la sonda no infiere ni descarga |
| Deadline y exclusión concurrente | Pruebas previas conservadas; hijo real dormido termina al vencer plazo |
| Fallback con timeout, OSError, error HTTP y salida inválida | Probado usando adaptador real con transporte simulado; plan sigue exacto |
| Inventario de servicios | Comandos fijos, socket Docker local, ausencia/permisos simulados |
| Compose | Validación de configuración local; no se descargó imagen ni se inició contenedor |

El Compose declara proyecto/red/volumen exclusivos y loopback 11436, sin restart
automático, con imagen revisable obligatoria y `pull_policy: never`. La validación
usa un digest ficticio **solo para parsear configuración**, no una imagen
existente ni recomendada. Esto no certifica arranque, publicación real, cgroups,
compatibilidad CPU ni seguridad de una futura imagen. La guía exige Engine
corregido y comprobación negativa LAN antes de aceptar el aislamiento.

Pendiente del operador: diagnóstico Debian, destino SSH autorizado si se desea,
selección de imagen/digest, autorización de instalación/prueba, cinco tests HTTP
con `FURGOPLUS_REQUIRE_WIRE_TESTS=1`, inferencia real y medidas de latencia/RAM/CPU/I/O.
No hay resultados de homelab, Qwen real, consumo peak ni beneficio de calidad.
La IA continúa seleccionando frases de FAQ; no redacta libremente ni comprende
preguntas abiertas. El texto original y los hechos de cuenta no llegan al modelo.

Todos los cambios del lote están bajo `local_assistant/`, que ya estaba sin
seguimiento al comenzar. No se editó Task 12/13 ni ningún archivo de la app.
Sin SSH, instalaciones, descargas, arranques, cambios de redes o servicios del
homelab. Sin commit, push, merge ni deploy. Detenido para revisión humana.

## Evidencia histórica del prototipo: 26/10/2026

Fecha: 26/10/2026. Rama: `task/14-local-assistant`. Base comprobada:
`HEAD == origin/main == c0854de9e571686aabe10fb8dd57496e2f8d88dd` antes de cambios.
Todo el trabajo se agrega bajo `local_assistant/` en este worktree. No se leen
ni modifican archivos de Task 12 o Task 13; se usan contratos ya incluidos en main.
No se modifica ninguna aplicación o configuración existente.

## Entregado

- Diseño y contrato futuro Django: [README](README.md).
- Conversación CLI sin dependencias nuevas, comprensión local, datos sintéticos
  por cuenta, respuestas deterministas y alternativa FAQ.
- Adaptador Ollama con JSON validado, modelo local permitido, límites de recursos,
  frecuencia, concurrencia y plazo total; selección de frases verificadas.
- Nueve casos de evaluación y suite de pruebas de exactitud, brevedad, autorización,
  privacidad, selección del modelo, concurrencia y fallas.
- Inventario de hardware de solo lectura y benchmark sintético explícitamente
  optativo. [Guía Debian 13/Fedora SSH](OPERATIONS.md) y ejemplo de límites systemd.

## Verificado en este entorno

| Comprobación | Resultado |
| --- | --- |
| `python3 -B -m local_assistant.evaluate` | 9/9 casos, texto y origen exactos |
| `python3 -B -m unittest discover -s local_assistant/tests -v` | 36 tests: 32 aprobados, 4 omitidos por bloqueo de sockets |
| Deadline con subproceso real bloqueado artificialmente | Termina y recoge el hijo al vencer 0,2 s; sin sockets |
| Contrato HTTP con dobles de prueba | POST local, tamaño máximo, cierre, rechazo de redirecciones, errores y cuerpos inválidos |
| Rol, cuenta activa y propiedad de recorrido | Dos cuentas aisladas; parent/admin/inactiva/desconocida y acceso cruzado rechazados |
| Información exacta | Plan/fecha/cupos/estados no pasan por el modelo; falla de datos no se transforma en ausencia de plan |
| Privacidad del payload | Texto original con datos sintéticos de prueba se reduce a clave fija de FAQ; no llega al cliente del modelo |
| Selección del modelo | Solo índices válidos de frases verificadas, sin prosa libre ni llamadas a herramientas |
| Presupuesto | Un cliente activo compartido por proceso, rechazo paralelo inmediato, seis inicios/minuto y circuito de 30 s |
| Inventario | Ejecutado en Fedora del entorno actual; no en el homelab |
| CLI real, mediante subproceso | Entrada estándar, anuncio sintético, respuesta exacta y descarte de líneas extensas verificados |

Inventario local orientativo: Fedora 44, Python 3.14.8, x86_64, Intel i5-1135G7,
8 hilos lógicos visibles, AVX2 disponible, aproximadamente 15,35 GiB de RAM total
y 4,89 GiB disponibles durante una lectura, 391,73 GiB libres en el volumen del
checkout; ejecutable Ollama ausente. Memoria disponible y carga son valores
transitorios. Los límites cgroup v2 raíz no estaban visibles. **Estos datos no
describen ni dimensionan el homelab Debian.**

## Limitaciones y aceptación pendiente

1. El sandbox niega creación de sockets con `PermissionError: Operation not
   permitted`, incluso en loopback. Las cuatro pruebas HTTP real quedan
   explícitamente omitidas; ejecutar fuera de ese sandbox con
   `FURGOPLUS_REQUIRE_WIRE_TESTS=1` para que no puedan omitirse. No se solicitó
   elevar permisos ni se intentó eludir esta restricción.
2. No hay Ollama ni modelos instalados en este entorno. No se han medido carga,
   RAM de inferencia, calidad de Qwen, latencia, tokens/s ni compatibilidad real
   de su versión de API. Se verificaron el contrato y los fallos de forma simulada.
3. Debian 13/Python 3.13 no se ejecutó aquí; no se instaló otro intérprete ni se
   inició un contenedor. La documentación usa bibliotecas estándar compatibles,
   pero la aceptación debe repetirse en el entorno de destino.
4. Las reglas locales no cubren lenguaje general, referencias entre turnos ni
   todas las ambigüedades. Para cupos usar una fecha ISO y recorrido seleccionado.
   No soporta cuotas de planes de Task 12, pagos personales, pasajeros ni datos
   privados. Las fixtures de capacidad solo existen para el 26/10/2026.
5. La IA solo selecciona frases preaprobadas de FAQ; no redacta respuestas libres
   ni mejora la comprensión de preguntas. Es una decisión explícita de aislamiento
   para esta primera revisión. Aún debe justificarse su utilidad frente a FAQ sola.
6. No existe autenticación de producción ni adaptador Django real. `Principal` y
   `--actor` son simuladores; no exponer el CLI como una API confiando en esos IDs.
7. La alternativa FAQ de este prototipo funciona sin IA. No se integró ni verificó
   un asistente FAQ de otros worktrees: preservarlo en una futura integración.
8. Límites del cliente son por proceso. La configuración systemd global es solo
   un ejemplo sin aplicar; la cancelación del cliente no garantiza cancelar de
   inmediato el trabajo de Ollama.

No se instalaron programas, descargaron modelos, iniciaron contenedores ni se
accedió por SSH al homelab. Sin cambios en Docker, Cloudflare, Tailscale o demo r4.
Sin commit, push, merge ni despliegue. Detenido para revisión humana.
