# Task 13 · Corrección de desbordamiento móvil

Rama `task/13-landing`. Cambios limitados a `landing/`. Sin commit, push, merge ni deploy. **Corrección de comparación preparada; validación real posterior y aceptación humana pendientes.**

## Comparación desplegada a 320 px · revisión actual

La auditoría REAL Fedora `final-2026-10-29T15-28-52-868Z` pasó build, contenido, interacciones, precios y pricing-browser (12 anchos). Browser falló en `320px expanded comparison`. Se conserva su [JSON original](qa-artifacts/final-2026-10-29T15-28-52-868Z/overflow-320px-expanded-comparison.json) y su [captura original](qa-artifacts/final-2026-10-29T15-28-52-868Z/overflow-320px-expanded-comparison.png).

| Medición real anterior | Resultado | Interpretación |
| --- | --- | --- |
| Viewport / documento / body | 320 / 621 / 320 px | El documento informa overflow; medir solo body ocultaría el fallo. |
| `.comparison-scroll` | Caja de 16 a 304 px; clientWidth 288, scrollWidth 648; overflow-x auto | Caja dentro del viewport y scroll interno previsto. |
| Tabla | 640 px; de 20 a 660 px | Ancho intencional dentro del scroller; sus celdas no son por sí mismas errores de página. |
| `.comparison-details` | 288 px, scrollWidth 288; min-width 0 | El contenedor no se expande por mínimos de grid/flex. |
| `.benefits` | Caja 320 px, scrollWidth 360, overflow-x hidden | Desbordamiento decorativo local contenido; no explica los 621 px del documento. No se modifica. |

El caso exacto termina el recorrido en 320 px, con apoderado seleccionado, desplaza `#experience-panel`, guarda la captura y abre el `summary`. Falla **antes** del foco explícito y de ArrowRight sobre la tabla. Por tanto, esos pasos posteriores no pueden ser la causa del primer fallo. La prueba original y su aserción se conservan.

La cadena de comparación es `.comparison-scroll → .comparison-details → .reveal → #planes → main → #root → body`. Los contenedores son bloques; `.plans-grid` es un hermano, no un ancestro de la tabla. En el modo `reducedMotion: reduce` de la suite, `.reveal` tiene `transform: none`, por lo que tampoco establece el bloque de referencia de las etiquetas. El desplegable es nativo, sin manejador `onToggle` que fuerce foco o scroll al abrirlo.

### Causa en código y corrección mínima

Las celdas contienen etiquetas `.sr-only` con `position: absolute`, ancho de 1 px y `clip-path`. Antes del cambio, ni `.comparison-scroll` ni sus ancestros de comparación establecían un bloque de referencia para esas cajas. Un descendiente absoluto cuyo bloque de referencia está fuera del scroller puede escapar de su overflow; es el comportamiento descrito por [CSS 2.2, overflow y clipping](https://www.w3.org/TR/CSS22/visufx.html#overflow-clipping). El `clip-path` visual no elimina la geometría de la caja según [CSS Masking](https://www.w3.org/TR/css-masking-1/#clipping-paths).

El diagnóstico anterior omitía todos los `.sr-only` y asignaba contención a cualquier descendiente de `.comparison-scroll`, sin comprobar su bloque de referencia. Por eso no podía identificar esas cajas.

Se añade únicamente `position: relative` a `.comparison-scroll`, para establecer el bloque de referencia de las etiquetas dentro de la región desplazable. Se conservan `overflow-x: auto`, tabla mínima de 640 px, padding, tipografía, contenido accesible, tabindex, role y outline. No se añade ocultación global, recorte ni escalado. No se modifican precios, IVA, textos comerciales ni capacidades académicas.

**Límite de evidencia:** el JSON anterior no midió las etiquetas; por tanto, la identificación se basa en código, geometría registrada y reglas CSS, y aún requiere corroboración geométrica del navegador. No se afirma haber medido aquí qué etiqueta llega a 621 px, ni haber demostrado un falso positivo. La aserción de `documentElement.scrollWidth > innerWidth` sigue intacta.

### Diagnóstico y regresión preparados

`scripts/overflow-diagnostics.mjs` ahora incluye `.sr-only`, bloque de referencia (`offsetParent` de cajas absolutas), ancestros, dimensiones, mínimos de grid/flex, scroll y límites efectivos tras contención. Distingue cajas que sobresalen a nivel de página, overflow interno contenido y casos sin explicación. Si el documento sigue ancho pero no identifica una caja, lo anuncia y **mantiene el fallo**. Consola: resumen y hasta cinco selectores; información extensa en JSON.

Con `LANDING_OVERFLOW_DIAGNOSTICS=1`, antes de la matriz se ejecuta un experimento controlado a 320 px:

1. `overflow-320-comparison-original-static.json`: restaura temporalmente `position: static` en el scroller.
2. `overflow-320-comparison-static-without-label-boxes.json`: mantiene static y retira temporalmente solo las cajas `.sr-only` de la tabla.
3. `overflow-320-comparison-current-css.json`: mide el CSS corregido con todas las etiquetas presentes.

Cada caso guarda anchos, cajas y un intento real de desplazamiento horizontal de página (`horizontalScrollProbe.maxScrollX`). Las hojas temporales se eliminan en `finally`. La retirada de etiquetas ocurre solo en la página de diagnóstico, nunca en el producto ni en la suite normal. Para confirmar la causa, el primer caso debe reproducir el overflow y el desplazamiento de página; los otros dos deben conservar un documento de 320 px sin desplazamiento lateral. El caso corregido debe contener las etiquetas y mantener el scrollWidth interno de la tabla mayor que su clientWidth.

`verify-browser.mjs` conserva la secuencia original y añade comparación abierta en 1920, 1440, 1280, 1024, 1000, 960, 820, 768, 720, **390, 360 y 320 px**, con ambas audiencias y ambas vistas de IVA. Comprueba entrada por Tab con foco visible, etiquetas contenidas, tabla completa, flechas hasta la última columna y de regreso, `scrollIntoView`, cierre por Enter y reapertura por Espacio, y ausencia de overflow de página en cada estado. Guarda `comparison-checks.json` progresivamente y capturas de inicio/final de tabla en los tres anchos móviles. Conserva las comprobaciones de reflujo equivalente a zoom 200 %/400 %.

## Verificación actual

Lote local `final-2026-10-29T15-44-23-524Z`, ejecutado con `LANDING_OVERFLOW_DIAGNOSTICS=1 npm run audit:fedora`:

| Comprobación | Resultado |
| --- | --- |
| Build / TypeScript / prerender | PASS |
| Content | PASS |
| Interactions DOM | PASS |
| Pricing DOM/cálculos | PASS |
| Browser | NOT_RUN_BROWSER |
| Pricing-browser | NOT_RUN_BROWSER |
| Sintaxis de scripts modificados y pricing-browser (`node --check`) | PASS |
| Lógica del diagnóstico con geometría sintética en jsdom | PASS; incluye etiquetas absolutas escapadas, tabla/decoración contenidas, JSON completo, resumen breve y aserción estricta aun sin culpable identificado. No demuestra layout. |

Resultado del lote: **INCOMPLETE**, código 1. Chromium no crea una página: `sandbox_host_linux.cc:41 … Operation not permitted`. Los registros están en el directorio del lote. No hay nuevas capturas reales ni PASS de navegador. La alternativa Playwright conectada fue rechazada por el control automático de permisos (`requires approval`, política `never`); el navegador integrado no ofrece superficies disponibles. Firefox headless tampoco arrancó. La CLI `21st` no está instalada; la revisión se hizo sobre código y evidencia existente.

## Comprobación final en Fedora

Desde una terminal normal, con las dependencias y Chromium existentes:

```bash
cd ~/Proyectos/furgoplus-landing/landing
LANDING_OVERFLOW_DIAGNOSTICS=1 npm run audit:fedora
```

Si se reutiliza la instalación externa ya disponible:

```bash
LANDING_OVERFLOW_DIAGNOSTICS=1 LANDING_PLAYWRIGHT_MODULE="$HOME/.local/share/furgoplus-responsive-audit/node_modules/playwright/index.mjs" npm run audit:fedora
```

Revisar `qa-artifacts/final-report.html`, los seis pasos PASS y los archivos **del lote nuevo**. Los tres experimentos son deliberados: el JSON/captura de `original-static` puede mostrar overflow; no describe el CSS corregido ni altera las aserciones de la landing. Revisar los selectores `.sr-only`, su bloque de referencia, `horizontalScrollProbe`, los JSON de preflight a 320/360/390/820/1000/1024 y `comparison-checks.json` de los doce anchos.

Para aceptación humana a **320, 360 y 390 px**: abrir/cerrar comparación por ratón y teclado; alternar IVA y audiencia; desplazar la tabla con tacto/trackpad y flechas hasta Elite y volver a Capacidad; comprobar foco visible y etiquetas con Orca. La página debe conservar su ancho, la tabla debe permitir consultar todas sus columnas. Revisar además los demás anchos de la matriz y zoom real 200 %/400 %.

**No cerrar la auditoría hasta tener evidencia real posterior, todas las suites PASS y aceptación humana.**

## Histórico · hero móvil

La ejecución Fedora anterior `final-2026-10-29T14-45-55-494Z` fallaba a 390 px: hero en fila en lugar de columna, captura de 463 px para viewport 390. Se añadió `flex-direction: column` al hero a ≤700 px y se apilaron los controles de demo a ≤370 px. La nueva auditoría REAL `final-2026-10-29T15-28-52-868Z` avanzó hasta la comparación de 320 px y pricing-browser pasó los doce anchos. Esas correcciones se conservan sin nuevos cambios.
