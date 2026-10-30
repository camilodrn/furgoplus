# T13: overflow del encabezado durante resize a 320 px

Evidencia original: `qa-artifacts/final-2026-10-29T20-47-40-845Z/overflow-live-resize-320.json` y `states-cases.json` del mismo directorio.

El fallo ocurre en el primer resize, **antes de abrir el diálogo**. El foco está en el resumen de comparación y `dialogOpen` es `false`; las acciones posteriores al fallo no se ejecutaron.

En el JSON, el botón ya tiene layout móvil, pero `.nav-shell` conserva medidas de escritorio: x=40, ancho=240, alto=88 y `flex-shrink: 1`. Su geometría coincide con marca de 232 px y gap de 28 px: 40 + 232 + 28 = 300; el botón de 48 px termina en 348. El estado capturado posteriormente por el runner vuelve a `documentWidth: 320`. Esto evidencia un desbordamiento transitorio de layout durante resize, con una caja realmente expuesta; no justifica relajar la aserción. Sin ejecución del navegador no se puede atribuir la actualización parcial a un mecanismo interno concreto de Chromium.

La marca tenía `flex-shrink: 0`. La corrección permite reducir **solo la marca dentro de `.nav-shell`**, con `min-width: 0` y `flex-shrink: 1`. Su imagen ya tiene `max-width: 100%`. Incluso con la geometría transitoria registrada, quedan 240 - 28 - 48 = 164 px para la marca y el botón cabe dentro del contenedor. En el layout móvil estable, los 192 px de marca, 24 px de gap y 48 px de botón caben en los 288 px del contenedor sin reducir la marca.

Se mantienen las aserciones inmediatas de overflow y se añade otra justo después del resize con el diálogo abierto, antes de comprobar Tab, Shift+Tab, Escape y restitución del foco. No se añaden esperas ni ocultamiento horizontal. No se modifica lógica de interacción ni otras áreas.

## Validación local

- `npm run build`: PASS, incluye TypeScript y prerender.
- Comprobaciones de navegador: NOT RUN. Chromium no puede arrancar en el sandbox (`sandbox_host_linux.cc:41`, `Operation not permitted`). No se declara resuelto el resultado de Fedora ni se actualiza el total 226/227.

## Fedora: ejecutar solo los seis casos existentes de resize

Desde `landing/`, reconstruir y ejecutar el siguiente comando. Se reutilizan los casos originales y sus aserciones; no se ejecutan auditoría general, movimiento, pricing ni la matriz de texto ampliado. Se respetan `LANDING_BROWSER_PATH` y `LANDING_PLAYWRIGHT_MODULE` si ya están configuradas.

```bash
npm run build
LANDING_QA_DIR="qa-artifacts/header-resize-$(date +%Y%m%dT%H%M%S)" node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from './scripts/browser-support.mjs';
import { createCaseRunner, serveDist, freshPage, loadPage } from './scripts/browser-cases.mjs';
import { runResizeCases } from './scripts/verify-browser-states.mjs';

const artifacts = path.resolve(process.env.LANDING_QA_DIR);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.LANDING_BROWSER_PATH ? { executablePath: process.env.LANDING_BROWSER_PATH } : {}) });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const errors = [], external = [];
  await serveDist(context, errors, external);
  const cases = createCaseRunner({ artifacts, suite: 'header-resize', browser });
  let selected = 0;
  await runResizeCases(async (name, width, height, action, motion = 'reduce') => {
    if (!name.startsWith('resize ')) return;
    selected++;
    const page = await freshPage(context, errors);
    try {
      return await cases.run(name, async () => {
        await loadPage(page, width, height, motion);
        await action(page);
      }, page);
    } finally { await page.close(); }
  }, artifacts);
  await cases.finish();
  assert.equal(selected, 6);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
} finally { await browser.close(); }
JS
```

Esperado: `header-resize: 6 PASS, 0 FAIL, 0 incomplete`, con ciclo de foco del diálogo registrado en el directorio indicado. El caso expandido conserva contenido al pasar por 320, 1000, 390 y 1920 px, y vuelve a 320×225 con el diálogo abierto. Cualquier overflow sigue fallando y guarda su diagnóstico original.
