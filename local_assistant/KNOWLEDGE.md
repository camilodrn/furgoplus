# Base pública híbrida — Task 14, 29/10/2026

`knowledge.json`, versión `2026-10-29.1`, es la fuente de respuestas públicas.
Contiene 12 conocimientos en diez áreas: funcionamiento general, conductor,
apoderado, planes, solicitudes de contacto, pagos manuales, publicación, rutas,
ayuda y límites de la demo. Conserva literalmente las nueve FAQ anteriores y
agrega orientación del conductor, ayuda del asistente y límites de demostración.
No entrena modelos ni modifica pesos; usa solo la biblioteca estándar de Python.

## Contrato de un conocimiento

| Campo | Significado |
| --- | --- |
| `id` | Identificador estable, también `Reply.route`; no renombrar para cambiar el texto. |
| `area` | Tema organizativo; no controla permisos. |
| `question`, `aliases` | Pregunta canónica y equivalentes completos revisados. |
| `patterns` | Reglas compositivas acotadas, evaluadas con `fullmatch`. |
| `sentences` | Resumen primero, hasta tres frases al pedir detalle. |
| `source` | Archivo/sección o símbolo documental que respalda la afirmación; T12 tiene hashes y versión en SOURCES.md. |
| `reviewed_on` | Fecha de revisión factual; no certifica despliegue ni vigencia de una cuenta. |
| `status` | `implemented_demo` para funciones académicas documentadas; `experimental` para el asistente; `commercial_unavailable` para contratación no habilitada. |
| `commercial_available` | Siempre `false` en este lote. No se publican precios como oferta. |
| `scope` | Delimitación explícita de demostración, sin disponibilidad comercial ni estados particulares de cuentas. |

La presencia de una función en una propuesta no prueba su implementación.
`availability` describe funciones demo y delimita en sus frases al asistente
experimental. `commercial` explica la contratación comercial no habilitada y tiene estado
`commercial_unavailable`. La asignación manual y los pagos manuales de transporte
tampoco son contratación ni pago de una suscripción.

`guides.py` valida el archivo al importar, construye registros inmutables y
conserva `GUIDES`/`faq_answer` para las FAQ y pruebas existentes. Un catálogo
inválido falla al cargar; no hay recuperación desde memoria de un LLM. La
conversación nunca vuelve a leer archivos de fuentes ni de T12.

## Recuperación y confianza

1. `understanding.py` revisa privacidad y acciones sobre **todo** el texto. Las
   consultas explícitas de plan asignado, vencimiento, estado y cupos tienen
   prioridad sobre preguntas públicas, también en preguntas mixtas. Pagos
   particulares continúan en la negativa existente: no hay adaptador autorizado
   de pagos en este prototipo. Las otras consultas particulares siguen el
   contrato `AuthorizedQueries` sintético, sin caché entre turnos.
2. `retrieval.py` normaliza mayúsculas, tildes, puntuación y cortesías acotadas
   («porfa», «por favor»), además de la petición de detalle. Busca la pregunta
   completa en un índice de equivalencias; luego aplica reglas completas con
   vocabulario delimitado. «Chofer», «cabro», «plata», «lucas», «altiro» se aceptan
   en expresiones específicas documentadas; no son sustituciones globales.
3. Una equivalencia o regla completa única tiene confianza categórica `high`
   (`alias`/`reviewed_rule`). No es una probabilidad calibrada. Si se contradicen
   dos temas, se abstiene con `conflicting_evidence`. Compartir palabras, un
   sufijo desconocido, un error ortográfico o una similitud parcial no basta.
   Se prefiere pedir reformular antes que cubrir lenguaje abierto sin evidencia.
4. Se mantiene una excepción acotada para una anotación personal declarativa
   «Mi hijo/a…» posterior a una pregunta completa o a un punto. Los guardas
   anteriores revisan todo el texto; una nueva pregunta en esa anotación impide
   la excepción. Ningún fragmento de la anotación entra al modelo. Esta regla
   conserva los casos canario de privacidad previos, no interpreta esos datos.
5. Solo una ambigüedad dentro de un vocabulario público revisado puede ofrecer
   candidatos a Qwen3 0.6B. Se transmite una lista de **etiquetas fijas** y las
   preguntas canónicas candidatas, sin texto original, datos personales, DTO,
   respuestas FAQ, fechas, cupos o historial. Una materia desconocida no se
   convierte en candidata por mencionar «FurgoPlus» o «demo».
6. El modelo opcional devuelve únicamente `topic` o `unknown`, con JSON/enum
   validados. Un tema válido se renderiza desde la base. Una clasificación
   válida puede equivocarse de tema; su utilidad semántica real requiere la
   aceptación en Fedora. `unknown`, timeout o fallo mantienen la abstención.

No se añaden embeddings, base vectorial, entrenamiento ni dependencias. La
normalización deliberadamente no intenta comprender español general. Repetir
el tema si faltan referencias; no hay memoria conversacional.

## Caché y recursos

La medición reproducible en [QUALITY_REPORT.json](QUALITY_REPORT.json) muestra
recuperación pública mediana de aproximadamente **0,015 ms**, p95 **0,020 ms**,
con el índice cargado. Guardar respuestas por pregunta añade claves que podrían
contener texto personal, invalidación y complejidad sin una mejora relevante.
**No se incorpora caché de respuestas**, tampoco para consultas autorizadas o
clasificaciones. El único índice compartido contiene alias y patrones públicos
versionados, cargados una vez. Una edición entra en vigor al reiniciar el CLI;
la nueva versión identifica el catálogo. No se guardan preguntas ni resultados.

El payload se reduce a un prompt de clasificación corto, preguntas candidatas
y conceptos; contexto máximo solicitado **1024 tokens**, salida **24 tokens**
(antes 2048/48), `think:false`, sin streaming. El tamaño en bytes del prompt se
comprueba en tests; no se presenta como conteo exacto de tokens. El procedimiento
real registra `prompt_eval_count`/`eval_count`. Una respuesta truncada no pasa
la validación; se ajustará solo con evidencia, sin elevar el plazo para aprobar.
Se conservan timeout **8 s**, un hilo, concurrencia **1**, seis inicios/minuto,
circuito de 30 s, sin cola ni reintentos. No hay cambios de infraestructura.

## Diagnóstico sin información personal

Cada `Assistant` mantiene contadores en memoria con bloqueo y sin persistencia.
`--metrics` imprime una copia de los agregados en stderr al salir; puede usarse
junto con `--diagnostics`, que mantiene los indicadores por respuesta.

```bash
python3 -B -m local_assistant --once --diagnostics --metrics
```

`queries_total`, `public_direct`, `ambiguous`, `model_attempts`, `model_confirmed`,
`model_timeouts`, `fallbacks`, `abstentions`, `authorized_answers` y
`data_unavailable` solo contienen enteros. `model_confirmed` requiere una
respuesta estructurada válida, incluido `unknown`; no significa que se haya
resuelto una pregunta ni que la clasificación sea correcta. `fallbacks` cuenta
ambiguas sin respuesta seleccionada, incluido modelo deshabilitado. Un rechazo
de presupuesto no cuenta como intento ni confirmación. Un timeout cuenta como
intento pero no como confirmación: se desconoce si el servidor llegó a inferir.
Los totales son por instancia/sesión y no identifican personas ni cuentas.

## Evaluación y comparación

```bash
python3 -B -m local_assistant.quality --repeats 200
python3 -B -m local_assistant.evaluate
python3 -B -m local_assistant.acceptance
python3 -B -m unittest discover -s local_assistant/tests -v
```

`quality_cases.py` es un oráculo literal independiente del catálogo: 56 casos,
28 públicos/variantes (incluidas variantes compositivas ausentes de los alias),
3 ambiguos, 17 desconocidos y 8 controles de seguridad/cuenta. Exige texto,
ruta, origen y ausencia de invocación. Los ambiguos exigen abstención con modelo
deshabilitado. Mide con `perf_counter_ns`, 200 repeticiones por pregunta, sin
arranque CLI y con índice cargado; incluye el primer turno sin calentamiento
explícito. p95 usa rango más próximo; muestra máximos y métricas por categoría.
No se aplican umbrales de tiempo dependientes de CPU en la suite.

| Evidencia | Latencia | Alcance |
| --- | --- | --- |
| Inferencia directa histórica, operador | 8120 ms; ~809 MiB | Otra ejecución/host; no mide este clasificador. |
| FAQ previa, operador | 0,6–2,5 ms | Observaciones históricas; condiciones distintas. |
| Recuperación pública actual, local | mediana 0,0146 ms; p95 0,0201 ms | Solo recuperación, 5600 muestras. |
| Turno actual completo, local | mediana 0,0411 ms; p95 0,0889 ms | 11200 turnos offline sintéticos; incluye métricas. |
| Clasificador Qwen actual por túnel | Pendiente | No se confirma inferencia por una FAQ o fallback. |

Las cifras anteriores corresponden al reporte conservado; una nueva ejecución
puede variar. **56/56 correctos**, 28/28 públicos directos y 17/17 desconocidos
con abstención en este corpus. **53/56 (94,64 %) no requieren modelo** por su
ruta; los otros tres son elegibles para clasificación opcional. Las FAQ directas
son 28/56 (50 %); no se cuentan negativas ni datos autorizados como FAQ. El
100 % observado sin intentos corresponde al modo offline, con el modelo apagado.
Estos porcentajes describen el corpus, no una estimación del tráfico real ni
exactitud de Qwen. No hay comparación controlada entre hosts ni aceleración
medida contra las referencias históricas.

## Mantener o ampliar

1. Revisar la implementación y la documentación pública, fecha, versión y
   alcance. Registrar archivo/sección, y hash si se trata de una fuente externa
   al checkout, en [SOURCES.md](SOURCES.md). Resolver contradicciones primero.
   Nunca copiar un dato de cuenta, fixture operativa o respuesta del modelo.
2. Agregar/corregir el registro JSON. Mantener el `id`, resumen breve y límites
   demo/experimental/comercial; subir `version` y `reviewed_on`. Si cambia un
   identificador, revisar rutas, conceptos y compatibilidad expresamente.
3. Añadir equivalentes completos verificados, incluidas expresiones chilenas.
   Para una regla, acotar vocabulario y exigir toda la pregunta; evitar comodines
   abiertos, búsqueda parcial, regex con retroceso explosivo o listas de una
   sola palabra como criterio de hechos. Medir colisiones entre temas.
4. Añadir al oráculo una paráfrasis ausente de los alias, un desconocido cercano,
   una consulta personal mezclada y el esperado literal respaldado por fuentes.
   No generar el esperado leyendo `GUIDES`, el JSON ni el modelo. Revisar los
   cambios factuales del esperado por separado.
5. Ejecutar los cuatro comandos anteriores. Solo si se cambian conceptos,
   candidatos o prompt, repetir además la aceptación real de
   [ACCEPTANCE.md](ACCEPTANCE.md). Conservar el reporte y sus hashes después de
   revisar resultados. No ajustar expectativas para ocultar abstenciones o
   errores reales. Si una fuente pierde vigencia, retirar sus equivalencias
   hasta verificar una sustitución.

Las 71 pruebas originales siguen presentes. Se ajustaron expectativas de dos
comportamientos: pregunta comercial mezclada con plan asignado pasa a lectura
autorizada; pregunta FAQ con sufijo desconocido se abstiene y mantiene el control
de privacidad del diagnóstico. Las pruebas de contrato reflejan 1024/24. Los
nuevos casos comprueban conservación de hechos, negativas, conflicto, privacidad,
contadores y uso exclusivo de fuentes autorizadas. Sin integración web/Flutter,
cuentas reales, cambios de pesos o servicios, ni commit/push/merge/deploy.
