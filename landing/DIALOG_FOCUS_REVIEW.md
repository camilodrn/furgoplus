# Task 13 · Foco del diálogo nativo

Alcance exclusivo: apertura, recorrido de foco y cierre de `.info-dialog`, y sus pruebas. Rama `task/13-landing`. Sin cambios de CSS, responsive, comparación, precios, IVA, contenido o navegación; sin commit, push, merge ni deploy.

## Diagnóstico

La ejecución real Fedora `final-2026-10-29T15-53-36-231Z`, Chromium 156.0.8078.4, llega a la comparación y sus nuevas pruebas y después falla en `verify-browser.mjs:315`, `Native dialog must contain focus`. El [registro original](qa-artifacts/final-2026-10-29T15-53-36-231Z/browser.log) se conserva. Build, contenido, interacciones, precios y pricing-browser (12 anchos) pasaron en ese lote.

El diálogo afectado es «Privacidad de esta landing». La secuencia anterior:

1. `openModal("privacy")` llama a `setModal` y después a `showModal()` sobre el mismo `<dialog>`.
2. El foco inicial queda a cargo del navegador; el primer control es «Cerrar información». El cambio de contenido de React conserva ambos nodos de botón.
3. Hay dos controles tabulables: «Cerrar información» y «Entendido». La aplicación no interceptaba los extremos del recorrido; después de cada Tab la prueba exigía que `dialog.contains(document.activeElement)` fuera verdadero.
4. Escape y ambos botones usan el cierre nativo. La devolución del foco dependía del elemento que el navegador hubiera registrado como previamente enfocado.

El fallo registrado es de **contención después de Tab**: apertura y contenido ya habían pasado. El log anterior no guarda la iteración, `activeElement` ni `document.hasFocus()`, por lo que no demuestra si el foco pasó a `body` al salir a la interfaz del navegador o a un control externo. No se presenta como un falso positivo ni se atribuye con certeza a un fallo interno de Chromium. Tampoco hay evidencia de una carrera de React: los controles permanecen montados y la nueva regresión DOM comprueba el foco después del commit del contenido.

La aplicación carecía de gestión explícita de los límites. Se corrige ese comportamiento para cumplir el contrato solicitado: Tab/Shift+Tab recorren el diálogo, Escape cierra y el foco vuelve al invocador, conforme al [patrón de diálogo modal de WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). La validación geométrica y del teclado nativo sigue pendiente en este entorno. **La aserción de contención se mantiene estricta y ahora se amplía; no se permiten excepciones para body, ni reintentos que oculten un escape tras Tab.**

## Corrección

En `src/App.tsx`:

- Se guarda el botón invocador por identidad, mediante `event.currentTarget`.
- Justo después de `showModal()` se enfoca «Cerrar información». Ambos botones permanecen montados al cambiar el texto.
- Únicamente se interceptan Tab en el último botón y Shift+Tab en el primero para envolver el recorrido. El movimiento interior y los atajos Ctrl/Alt/Meta+Tab siguen a cargo del navegador.
- Escape conserva su acción nativa. El evento `close`, común a Escape, ambos botones y el fondo, devuelve el foco al invocador si sigue conectado. Un evento close encolado no roba foco si el diálogo ya se abrió de nuevo.

No se reemplaza el diálogo nativo ni se añade un capturador global de foco.

## Regresión y evidencia

`verify-interactions.mjs` comprueba los manejadores de la aplicación: foco inicial tras actualizar contenido, tres ciclos de envoltura en ambos sentidos, conservación del Tab interior y Ctrl+Tab nativos, selección de los tres contenidos y devolución exacta al invocador al cerrar con ambos botones o fondo. jsdom solo simula `showModal`/`close` y el evento de cierre; **no prueba el Tab ni Escape del navegador**.

`verify-dialog-focus.mjs`, comando `test:dialog:browser`, comprueba los tres diálogos a 1440, 390 y 320 px. Para cada uno prueba cierre por Escape, «Cerrar información» y «Entendido», con reaperturas desde su invocador real. Exige foco inicial en el primer botón, seis Tab y seis Shift+Tab, acceso alternado a ambos controles, foco visible, modalidad nativa y devolución al mismo invocador.

La suite general reutiliza esa misma regresión en el punto que falló y en los tres diálogos a 390 px. Guarda progresivamente `dialog-focus-*.json`: pasos, `activeElement`, pertenencia al diálogo, estado modal, `document.hasFocus()`, outline y eventos `focusin`/`focusout`/`keydown` con destino, origen relacionado, instante y `defaultPrevented`. Si vuelve a fallar, la excepción enlaza la traza concreta. No se requieren temporizadores ni esperas arbitrarias para pasar la contención.

## Verificación local de esta corrección

| Comprobación ejecutada | Resultado |
| --- | --- |
| `npm run build` | PASS: TypeScript, Vite y prerender |
| `npm run verify` | PASS |
| `npm run test:interactions` | PASS, incluyendo regresión de manejadores de foco |
| `npm run test:pricing` | PASS |
| `node --check` de los tres scripts modificados/añadidos | PASS |
| `npm run test:dialog:browser` | NOT_RUN_BROWSER |
| `npm run test:browser` | NOT_RUN_BROWSER |
| `npm run test:pricing:browser` | NOT_RUN_BROWSER |

Los tres intentos de Chromium fallan antes de crear una página: `sandbox_host_linux.cc:41 … Operation not permitted`. Registros nuevos en `qa-artifacts/dialog-focus-review/`. No hay nuevas trazas reales de foco ni se afirma un PASS de teclado nativo. El CSS construido conserva el mismo recurso `index-C_vbI6vI.css` del lote Fedora anterior. La auditoría general real anterior no se sobrescribió con los intentos locales.

## Validación Fedora

Desde `~/Proyectos/furgoplus-landing/landing`, con las dependencias y Chromium existentes:

```bash
npm run build
npm run test:dialog:browser
npm run audit:fedora
```

La prueba específica deja trazas en `qa-artifacts/dialog-focus/`. El lote completo genera su directorio nuevo y ejecuta también la regresión compartida. Si se usa el Playwright externo ya instalado, anteponer a cada comando de prueba:

```bash
LANDING_PLAYWRIGHT_MODULE="$HOME/.local/share/furgoplus-responsive-audit/node_modules/playwright/index.mjs" npm run test:dialog:browser
LANDING_PLAYWRIGHT_MODULE="$HOME/.local/share/furgoplus-responsive-audit/node_modules/playwright/index.mjs" npm run audit:fedora
```

Revisión humana limitada al defecto: abrir los tres diálogos, recorrer varios ciclos de Tab/Shift+Tab, comprobar foco visible, cerrar con Escape y ambos botones, y verificar el regreso al invocador, en escritorio y móvil. Aceptar esta corrección tras PASS real y esa revisión. No se amplía la auditoría de diseño.
