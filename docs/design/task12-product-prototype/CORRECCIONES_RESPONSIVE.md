# Corrección de los 66 fallos responsive de T12

Correcciones acotadas aplicadas el 28 de octubre de 2026. **Reejecución en Fedora pendiente:** el único intento de esta sesión quedó bloqueado al iniciar Chromium por `sandbox_host_linux.cc: Operation not permitted`. No se cambiaron permisos ni se volvió a intentar. No se adjudican aprobaciones nuevas.

El informe real de Fedora sigue intacto en [results.json](evidence/responsive/results.json): 443 casos, 377 con comprobaciones automáticas satisfactorias y revisión humana pendiente, 66 fallidos y 24 capturas. Se conserva una copia exacta [anterior a las correcciones](evidence/responsive/results-fedora-before-fixes.json), con SHA-256 `5e46bae402c2f11f6bf197eea0f13a03f8cc6a5d559df76058b287bac80dcbd8`.

Se leyeron los 66 registros completos, incluidos los errores de interacción, y se clasificaron todos sus campos. [Diagnóstico JSON](evidence/responsive/failure-diagnosis.json) conserva los registros fallidos completos, sus medidas o errores y su posición original. No se encontraron fallos adicionales de desborde de página/contenido Android, campos, medidores, encabezados o etiquetas de tablas en los 57 registros fallidos que sí llegaron a medir la interfaz. Los otros 9 son casos de diálogo: uno llegó a medir y ocho terminaron antes por timeout; estos ocho no certifican la geometría del diálogo.

## Causas y correcciones

| Causa | Casos | Evidencia y causa en el código | Corrección aplicada |
| --- | ---: | --- | --- |
| `inline-target` | 53 | Los enlaces `.text-button` conservaban `display: inline`. Su `min-height: 44px` no generaba una caja con esa altura; el área medida seguía dependiendo de la línea. Afecta «Información del recorrido», «Consultar pasajeros», «Editar datos», «Ver revisión» y «Gestionar rutas». | `inline-flex`, centrado vertical, separación de icono y ancho máximo del contenedor. El mínimo existente de 44 × 44 px pasa a aplicarse a la caja interactiva real. |
| `filter-shrink` | 4 | Los cuatro botones de filtros de Solicitudes estaban en una tira flex desplazable con `white-space: nowrap`, pero podían encogerse. Sus etiquetas y contadores excedían la caja. | Impedir que esos botones se contraigan. Se conserva la tira con scroll propia existente: cada etiqueta y contador mantiene su ancho completo y se alcanza con teclado o desplazamiento. |
| `privacy-target` | 1 | En Nueva solicitud de soporte, el input `privacy` medía 20 × 20 px aunque la etiqueta tuviera un mínimo mayor. El auditor mide el input del diálogo. | Input real de 44 × 44 px con marca visual centrada de 20 px. Conserva el checkbox semántico, etiqueta, `required`, foco, activación con Espacio y estados marcado/desmarcado; estilos específicos para colores forzados. |
| `dialog-navigation` | 8 | Los errores completos muestran que el diálogo del caso anterior intercepta el puntero al pulsar el disparador de fondo. Se repite en el segundo y tercer tamaño de cada diálogo. La limpieza dependía solo de `hashchange`; una navegación al mismo fragmento no lo dispara. | Cerrar el diálogo transitorio también en `popstate`, conservando el manejador de `hashchange`. No se cierra al redimensionar ni al abrir el teclado. El modal sigue bloqueando el fondo mientras está abierto; no se debilita su comportamiento accesible para permitir clics detrás. |

Para el último ajuste se contrastó el ciclo de navegación con el [estándar HTML: actualización del documento](https://html.spec.whatwg.org/multipage/browsing-the-web.html#update-document-for-history-step-application): la navegación de fragmento emite `popstate`, mientras `hashchange` depende de que cambie el fragmento. La eficacia del ajuste en la secuencia exacta del auditor queda pendiente de Chromium en Fedora.

Las únicas fuentes funcionales modificadas son `responsive.css` y `prototype.js` (clase del checkbox y manejador de navegación). No se ocultaron controles, eliminaron textos, redujeron fuentes ni cambiaron rutas, datos, criterios, umbrales o casos del auditor. Se conservan colores, tipografía y composición del prototipo aprobado provisionalmente.

## Agrupación por pantalla, tamaño y tipo

Dimensiones en píxeles CSS. **V**: 320/360/390/430 × 844 y 768/1024/1280/1440/1920 × 1000. **I**: anchos 450, 451, 600, 759, 760, 761, 767, 769, 959, 960, 961, 999, 1000, 1001, 1023, 1025, 1250, 1251, 1599 y 1600, con altura 900.

| Pantalla | Casos | Tamaños y tipos fallidos | Causa |
| --- | ---: | --- | --- |
| `android/conductor/hoy` | 35 | V (9); I (20); `landscape`: 568 × 320, 844 × 390, 932 × 430 (3); `state`, `estado=muchos`: 320 × 844, 768/1440 × 1000 (3) | `inline-target` |
| `web/conductor/servicio` | 9 | V, `viewport` | `inline-target` |
| `android/conductor/recorrido/1` | 9 | V, `viewport` | `inline-target` |
| `web/conductor/solicitudes` | 4 | `viewport`: 320/360/390/430 × 844 | `filter-shrink` |
| `web/conductor/ayuda` | 3 | `dialog`, `support-new`: 320 × 480 (1); 844 × 320, 1440 × 900 (2) | `privacy-target` (1), `dialog-navigation` (2) |
| `web/conductor/pasajeros` | 2 | `dialog`, `passenger-new`: 844 × 320, 1440 × 900 | `dialog-navigation` |
| `web/administrador/conductor/1` | 2 | `dialog`, `admin-plan`: 844 × 320, 1440 × 900 | `dialog-navigation` |
| `android/conductor/cuenta` | 2 | `dialog`, `logout`: 844 × 320, 1440 × 900 | `dialog-navigation` |

Totales por tipo: 31 `viewport`, 20 `intermediate`, 3 `landscape`, 3 `state` y 9 `dialog` = 66. No hubo fallos registrados en `text-200`, `zoom-reflow-approximation` ni `navigation` en la ejecución de Fedora; deben mantenerse en la siguiente ejecución para detectar regresiones.

## Validación y entrega

- Sintaxis de `prototype.js` comprobada con `node --check`.
- `responsive.css` analizado con PostCSS ya disponible en el proyecto, sin modificar dependencias: 119 reglas, 0 errores de análisis.
- Revisión estática 21st: 0 errores, 0 advertencias, 42 sugerencias preexistentes. No se aplicaron recomendaciones visuales ajenas al diagnóstico. [Salida](evidence/responsive/21st-review-corrections.json).
- El auditor original permanece sin modificaciones. El intento bloqueado conserva los 443 casos planificados, sin casos ejecutados ni capturas nuevas: [informe separado](evidence/responsive/results-correction-attempt.json) y [salida](evidence/responsive/audit-correction-run.log). Se restauró `results.json` desde la copia exacta de Fedora para no reemplazar evidencia real por un bloqueo local.
- [Preservación y verificaciones estáticas de esta corrección](evidence/responsive/correction-checks.json). No se alteraron archivos ajenos a este directorio ni HEAD/rama. Sin commit, push, merge ni deploy.

Ejecutar desde una terminal normal en Fedora, con los mismos 443 casos y criterios:

```bash
NODE_PATH="$HOME/.local/share/furgoplus-responsive-audit/node_modules" node docs/design/task12-product-prototype/evidence/responsive/audit.cjs
```

El auditor actualizará `results.json` y las 24 capturas/galería; el informe anterior permanece en `results-fedora-before-fixes.json`. Revisar que no queden fallos ni errores y comparar cada identidad de caso con esa copia. La inspección humana sigue pendiente; no se certifica aquí que los 66 ya pasen.

En las comprobaciones manuales focalizadas, revisar los cinco enlaces afectados a 320 px y con texto ampliado; recorrer los cuatro filtros completos con teclado y tacto; marcar/desmarcar privacidad y comprobar validación/foco; volver a la misma URL con el diálogo abierto y abrirlo otra vez. Redimensionar un formulario con texto escrito debe mantenerlo abierto y conservar el borrador. Comprobar Cancelar y Escape con retorno de foco. Estas comprobaciones no añaden funcionalidades ni otro ciclo de exploración visual.

## Inventario de los 66 registros

Número = posición desde 1 en `cases` del informe original. Los errores íntegros están en el JSON del diagnóstico.

| Caso | Pantalla / estado | Tamaño | Tipo | Causa | Hallazgo |
| ---: | --- | --- | --- | --- | --- |
| 2 | `web/conductor/servicio` | 320 × 844 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 8 | `web/conductor/solicitudes` | 320 × 844 | viewport | filter-shrink | Todas 4; Por responder 2; Aceptadas 1; Cerradas 1 |
| 16 | `android/conductor/hoy` | 320 × 844 | viewport | inline-target | Información del recorrido |
| 17 | `android/conductor/recorrido/1` | 320 × 844 | viewport | inline-target | Consultar pasajeros |
| 30 | `web/conductor/servicio` | 360 × 844 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 36 | `web/conductor/solicitudes` | 360 × 844 | viewport | filter-shrink | Todas 4; Por responder 2; Aceptadas 1; Cerradas 1 |
| 44 | `android/conductor/hoy` | 360 × 844 | viewport | inline-target | Información del recorrido |
| 45 | `android/conductor/recorrido/1` | 360 × 844 | viewport | inline-target | Consultar pasajeros |
| 58 | `web/conductor/servicio` | 390 × 844 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 64 | `web/conductor/solicitudes` | 390 × 844 | viewport | filter-shrink | Todas 4; Por responder 2; Aceptadas 1; Cerradas 1 |
| 72 | `android/conductor/hoy` | 390 × 844 | viewport | inline-target | Información del recorrido |
| 73 | `android/conductor/recorrido/1` | 390 × 844 | viewport | inline-target | Consultar pasajeros |
| 86 | `web/conductor/servicio` | 430 × 844 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 92 | `web/conductor/solicitudes` | 430 × 844 | viewport | filter-shrink | Todas 4; Por responder 2; Aceptadas 1; Cerradas 1 |
| 100 | `android/conductor/hoy` | 430 × 844 | viewport | inline-target | Información del recorrido |
| 101 | `android/conductor/recorrido/1` | 430 × 844 | viewport | inline-target | Consultar pasajeros |
| 114 | `web/conductor/servicio` | 768 × 1000 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 128 | `android/conductor/hoy` | 768 × 1000 | viewport | inline-target | Información del recorrido |
| 129 | `android/conductor/recorrido/1` | 768 × 1000 | viewport | inline-target | Consultar pasajeros |
| 142 | `web/conductor/servicio` | 1024 × 1000 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 156 | `android/conductor/hoy` | 1024 × 1000 | viewport | inline-target | Información del recorrido |
| 157 | `android/conductor/recorrido/1` | 1024 × 1000 | viewport | inline-target | Consultar pasajeros |
| 170 | `web/conductor/servicio` | 1280 × 1000 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 184 | `android/conductor/hoy` | 1280 × 1000 | viewport | inline-target | Información del recorrido |
| 185 | `android/conductor/recorrido/1` | 1280 × 1000 | viewport | inline-target | Consultar pasajeros |
| 198 | `web/conductor/servicio` | 1440 × 1000 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 212 | `android/conductor/hoy` | 1440 × 1000 | viewport | inline-target | Información del recorrido |
| 213 | `android/conductor/recorrido/1` | 1440 × 1000 | viewport | inline-target | Consultar pasajeros |
| 226 | `web/conductor/servicio` | 1920 × 1000 | viewport | inline-target | Editar datos; Ver revisión; Gestionar rutas |
| 240 | `android/conductor/hoy` | 1920 × 1000 | viewport | inline-target | Información del recorrido |
| 241 | `android/conductor/recorrido/1` | 1920 × 1000 | viewport | inline-target | Consultar pasajeros |
| 255 | `android/conductor/hoy` | 450 × 900 | intermediate | inline-target | Información del recorrido |
| 259 | `android/conductor/hoy` | 451 × 900 | intermediate | inline-target | Información del recorrido |
| 263 | `android/conductor/hoy` | 600 × 900 | intermediate | inline-target | Información del recorrido |
| 267 | `android/conductor/hoy` | 759 × 900 | intermediate | inline-target | Información del recorrido |
| 271 | `android/conductor/hoy` | 760 × 900 | intermediate | inline-target | Información del recorrido |
| 275 | `android/conductor/hoy` | 761 × 900 | intermediate | inline-target | Información del recorrido |
| 279 | `android/conductor/hoy` | 767 × 900 | intermediate | inline-target | Información del recorrido |
| 283 | `android/conductor/hoy` | 769 × 900 | intermediate | inline-target | Información del recorrido |
| 287 | `android/conductor/hoy` | 959 × 900 | intermediate | inline-target | Información del recorrido |
| 291 | `android/conductor/hoy` | 960 × 900 | intermediate | inline-target | Información del recorrido |
| 295 | `android/conductor/hoy` | 961 × 900 | intermediate | inline-target | Información del recorrido |
| 299 | `android/conductor/hoy` | 999 × 900 | intermediate | inline-target | Información del recorrido |
| 303 | `android/conductor/hoy` | 1000 × 900 | intermediate | inline-target | Información del recorrido |
| 307 | `android/conductor/hoy` | 1001 × 900 | intermediate | inline-target | Información del recorrido |
| 311 | `android/conductor/hoy` | 1023 × 900 | intermediate | inline-target | Información del recorrido |
| 315 | `android/conductor/hoy` | 1025 × 900 | intermediate | inline-target | Información del recorrido |
| 319 | `android/conductor/hoy` | 1250 × 900 | intermediate | inline-target | Información del recorrido |
| 323 | `android/conductor/hoy` | 1251 × 900 | intermediate | inline-target | Información del recorrido |
| 327 | `android/conductor/hoy` | 1599 × 900 | intermediate | inline-target | Información del recorrido |
| 331 | `android/conductor/hoy` | 1600 × 900 | intermediate | inline-target | Información del recorrido |
| 335 | `android/conductor/hoy` | 568 × 320 | landscape | inline-target | Información del recorrido |
| 340 | `android/conductor/hoy` | 844 × 390 | landscape | inline-target | Información del recorrido |
| 345 | `android/conductor/hoy` | 932 × 430 | landscape | inline-target | Información del recorrido |
| 390 | `android/conductor/hoy?estado=muchos` | 320 × 844 | state | inline-target | Información del recorrido |
| 391 | `android/conductor/hoy?estado=muchos` | 768 × 1000 | state | inline-target | Información del recorrido |
| 392 | `android/conductor/hoy?estado=muchos` | 1440 × 1000 | state | inline-target | Información del recorrido |
| 427 | `web/conductor/pasajeros` | 844 × 320 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 428 | `web/conductor/pasajeros` | 1440 × 900 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 429 | `web/conductor/ayuda` | 320 × 480 | dialog | privacy-target | privacy |
| 430 | `web/conductor/ayuda` | 844 × 320 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 431 | `web/conductor/ayuda` | 1440 × 900 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 433 | `web/administrador/conductor/1` | 844 × 320 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 434 | `web/administrador/conductor/1` | 1440 × 900 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 436 | `android/conductor/cuenta` | 844 × 320 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
| 437 | `android/conductor/cuenta` | 1440 × 900 | dialog | dialog-navigation | Timeout: diálogo anterior intercepta el puntero |
