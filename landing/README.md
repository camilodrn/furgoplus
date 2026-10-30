# FurgoPlus · Landing / Task 13

**Criterio editorial permanente: menos texto, más claridad.** Antes de editar contenido, seguir [EDITORIAL_GUIDELINES.md](EDITORIAL_GUIDELINES.md): una idea por sección, hasta tres beneficios por bloque, subtítulos breves y detalle bajo demanda. La regla se referencia en `App.tsx` y tiene controles en `npm run verify`.

Landing refinada para revisión humana. Aplicación pública independiente en React + TypeScript + Vite, en el worktree `furgoplus-landing`, rama `task/13-landing`. No necesita la aplicación privada, backend, base de datos, cuentas, Docker ni variables de entorno. La revisión vigente, causas raíz, matriz completa y procedimiento de cierre están en [INTEGRAL_AUDIT_REVIEW.md](INTEGRAL_AUDIT_REVIEW.md). [FINAL_QUALITY_REPORT.md](FINAL_QUALITY_REPORT.md) conserva una revisión anterior. Para presentar, seguir la [guía breve de demostración](DEMO_GUIDE.md). [ACCEPTANCE_FEDORA.md](ACCEPTANCE_FEDORA.md) conserva el lote anterior.

## Ejecutar

Node.js 22.12 o superior y npm.

```bash
cd ~/Proyectos/furgoplus-landing/landing
npm ci
npm run dev
```

Abrir **http://127.0.0.1:4313**. El puerto es exclusivo para esta landing y `--strictPort` evita cambiarlo silenciosamente. El servidor escucha solo en loopback.

```bash
npm run build
npm run preview
```

La construcción produce `dist/`, incluyendo HTML prerenderizado con todo el contenido, CSS, JavaScript, fuentes e imágenes locales. El navegador hidrata el HTML para habilitar interacciones. El prerender usa Vite en modo middleware, sin abrir puertos ni WebSockets.

## Verificar

Lote completo reproducible (construye y ejecuta las ocho suites; acumula casos independientes y continúa aunque una suite falle o Chromium no pueda iniciar):

```bash
npm run audit:fedora
```

Produce `qa-artifacts/final-report.html`, JSON, hashes del build y registros separados por ejecución. Incluye el resultado de cada caso independiente, sus errores, capturas y trazas. Cada directorio fechado conserva `report.json`. No ejecutar otro build durante el lote: un cambio de archivos o hashes de `dist/` invalida el resultado. Devuelve código 1 si alguna prueba falla o queda sin ejecutar. No declara aceptación visual. Para reutilizar Playwright externo ya disponible en Fedora:

```bash
LANDING_PLAYWRIGHT_MODULE="$HOME/.local/share/furgoplus-responsive-audit/node_modules/playwright/index.mjs" npm run audit:fedora
```

Después de construir:

```bash
npm run verify
npm run test:interactions
npm run test:browser
```

- `verify`: HTML generado, semántica básica, anchors, referencias ARIA, nombres de botones, recursos locales, precios, estados de funciones y hitos.
- `test:interactions`: hidratación sin diferencias, selección de recorridos y perfiles, navegación de pestañas con teclado, CTAs por audiencia, menú móvil y restauración de foco con Escape. Usa jsdom; no prueba presentación ni comportamiento nativo del navegador.
- `test:audit`: verifica que dos fallos independientes se acumulen, que un caso posterior se ejecute y que el runner conserve salida 1; un reporte sin cierre queda RUNNING.
- `test:states:browser`: cambios de movimiento, interrupción de transiciones activas, ida/vuelta de preferencias, foco en bloques pendientes, resize sin recarga, texto al 100/200 % con detección de recortes y fallback sin JavaScript/IntersectionObserver. Registra snapshots inmediatos y posteriores sin esperas arbitrarias.
- `test:dialog:browser`: regresión específica de foco inicial, Tab/Shift+Tab, Escape, ambos botones de cierre y retorno al invocador en los tres diálogos a 1440/390/320 px. Guarda trazas `dialog-focus-*.json`. Diagnóstico, límites de evidencia y comandos: [DIALOG_FOCUS_REVIEW.md](DIALOG_FOCUS_REVIEW.md).
- `test:browser`: Chromium con Playwright, doce anchos (1920, 1440, 1280, 1024, 1000, 960, 820, 768, 720, 390, 360 y 320 px), ambas audiencias, overflow, controles de al menos 44 × 44 px, errores, recursos, todos los enlaces/FAQ/diálogos, ciclo de teclado, menú móvil y movimiento reducido. Comprueba además la comparación abierta en los doce anchos y ambas vistas de IVA: foco por Tab, flechas hasta la última columna, `scrollIntoView`, cierre/reapertura y etiquetas absolutas contenidas. Guarda mediciones en `comparison-checks.json` y capturas de inicio/final a 320/360/390 px. Añade reflujo en 640 × 450 y 320 × 225, equivalentes al espacio CSS al usar zoom 200/400 % desde 1280 × 900; el zoom real requiere comprobación humana. Usa interceptación local de `dist/`; no levanta un servidor ni conecta servicios externos. Guarda capturas y árboles accesibles en `qa-artifacts/`, ignorado por Git.

Diagnóstico de ancho (detalles y evidencia en [OVERFLOW_REVIEW.md](OVERFLOW_REVIEW.md)):

```bash
LANDING_OVERFLOW_DIAGNOSTICS=1 LANDING_PLAYWRIGHT_MODULE="$HOME/.local/share/furgoplus-responsive-audit/node_modules/playwright/index.mjs" npm run audit:fedora
```

Antes de las aserciones, recorre 320, 360, 390, 820, 1000 y 1024 px en ambas audiencias, con IVA incluido y con desglose/comparación abiertos. Imprime un resumen breve de cajas que sobresalen del documento, overflow interno contenido y casos sin explicación; conserva dimensiones, estilos, ancestros y bloques de referencia en JSON. Incluye `.sr-only`: ser descendiente del scroller no garantiza que una caja absoluta esté contenida. Ambas suites también guardan el diagnóstico automáticamente al fallar por overflow, sin relajar la aserción.

El preflight añade tres experimentos reversibles a 320 px: scroller original estático, estático sin las cajas de etiquetas accesibles y CSS corregido con todas las etiquetas. Registra si la página realmente puede desplazarse horizontalmente. El primer caso puede generar overflow deliberado; sus estilos temporales se eliminan antes de probar el producto. Los resultados esperados y el límite de evidencia actual están en [OVERFLOW_REVIEW.md](OVERFLOW_REVIEW.md). El diagnóstico requiere Chromium y no sustituye sus aserciones ni la aceptación humana.

Para la prueba de navegador se necesita Chromium de Playwright ya instalado o indicar un ejecutable compatible:

```bash
LANDING_BROWSER_PATH=/usr/bin/microsoft-edge npm run test:browser
```

Si no hay navegador instalado, se puede instalar Chromium desde el CLI oficial de la dependencia en un entorno con red:

```bash
npx playwright-core install chromium
```

**Estado del cierre integral (29 de octubre): PASS automatizado, salida 0, en Fedora 44 con Chromium 156 real.** 227 casos de navegador pasan (143 generales, 39 de estados, 15 de precios y 30 de diálogos), junto con build/TypeScript, contenido, interacciones, precios/IVA e integridad del build. Hay 72 capturas nuevas. La aceptación visual, zoom real y Orca siguen pendientes. Consultar [INTEGRAL_AUDIT_REVIEW.md](INTEGRAL_AUDIT_REVIEW.md) y el [informe ejecutable](qa-artifacts/final-report.html).

## Dirección visual

Concepto: **“El trayecto que nos conecta”**. Fondo cálido luminoso, azul de marca y superficies azul petróleo. Composición editorial con Adwaita Sans variable (derivada de Inter) y Liberation Serif itálica. Ambas fuentes se distribuyen localmente con sus licencias OFL. El SVG original del hero conecta hogar, furgón y colegio; es una ilustración conceptual, sin mapa ni seguimiento GPS.

Tokens principales en `src/styles.css`:

| Uso               | Valor     |
| ----------------- | --------- |
| Azul de marca     | `#0752ac` |
| Texto principal   | `#182c3e` |
| Fondo             | `#f7f8f5` |
| Superficie oscura | `#122c3e` |
| Texto secundario  | `#5e6d75` |

La entrada del hero, el trazo de ruta y las etiquetas tienen secuencias finitas. Las secciones aparecen una sola vez con IntersectionObserver. No se intercepta el scroll ni hay animaciones continuas. `prefers-reduced-motion` elimina las secuencias y el desplazamiento suave. La navegación usa un menú móvil hasta 960 px; las composiciones también se adaptan a 1200, 1000, 800, 700 y 370 px.

La segunda iteración conserva el titular, la ilustración y el tono editorial. La lectura usa cuerpo de 18 px, apoyo de 16–17 px y metadatos de al menos 14 px mediante unidades rem. El contenido alcanza 1360 px y la demo 1440 px; el espaciado de secciones pasa de 112 a 80 px en escritorio. Los dispositivos dejan de usar `transform: scale(...)` y la demo aparece inmediatamente después de la propuesta.

El logo de `public/brand/furgoplus-logo.png` es una copia sin alteraciones del recurso existente en `web/public/brand/`, también utilizado por la app móvil. El azul primario `#0752AC` y sus estados proceden de `web/src/style.css`, `mobile/lib/furgo_theme.dart` y `docs/UX_FOUNDATION.md`, todos consultados en este worktree. El footer conserva el arte original sobre una superficie clara. No se editó el producto privado. La imagen social también incorpora este recurso; el favicon es una adaptación vectorial simple del motivo de transporte.

Se priorizó CSS y APIs nativas porque Motion y las fuentes inicialmente previstas no estaban en caché y el registro de npm no era accesible (`EAI_AGAIN`). No hay una dependencia Motion incompleta ni una implementación GSAP adicional.

## Contenido y precios

Los precios y capacidades propuestos se configuran en **`src/content/plans.ts`**. Cambiar `monthlyCLP` actualiza las tarjetas sin rediseñarlas; la entrada de apoderados está en `parentAccess.initialCLP`. Revisar también el copy de gratuidad si cambia esa política. No hay checkout ni inscripciones.

- Básico: **$19.990 CLP/mes**.
- Pro: **$39.990 CLP/mes**.
- Elite: **$69.990 CLP/mes**.
- Acceso inicial de apoderados: **$0 CLP**, propuesta académica.

Los valores son hipótesis de negocio aportadas para Task 13, **no tarifas comercialmente validadas**. La gestión base es común. T12 implementa informes mensuales para Pro/Elite e informes avanzados y tres tipos de XLSX para Elite; Básico no incluye informes mensuales. Los asistentes FAQ (Pro/Elite) y contextual (Elite) se presentan como experimentales: hay permisos y lógica implementados, con integración y UX pendientes de cierre. La disponibilidad comercial futura no está habilitada.

La matriz de fuentes, capacidades y pendientes está en [CONTENT_REVIEW.md](CONTENT_REVIEW.md). No se modifican planes, precios ni capacidades del producto privado o Task 12.

Las tarjetas conservan su propósito y tres beneficios. Sus indicadores, nota visible, comparación y FAQ distinguen implementación académica, asistentes experimentales y disponibilidad comercial futura no habilitada. La evidencia T12 se consultó en modo lectura; sus pruebas no se reejecutaron. No se anuncia contratación ni fecha de lanzamiento.

## Interacciones implementadas

Todos los CTAs llevan a secciones existentes o abren información local. Los enlaces de las dos audiencias seleccionan su pestaña correspondiente. La demo permite elegir recorridos de ida/regreso y perfiles ficticios A/B. Las pestañas admiten flechas, Home y End. Las preguntas y la comparación de planes usan `details/summary`. Privacidad, proyecto y accesibilidad usan un diálogo nativo con cierre y Escape. La evaluación de noviembre de 2026 y la aspiración de Feria de Software 2027 se conservan en “Sobre el proyecto”, como información secundaria del footer.

Hasta 1000 px, la experiencia del apoderado muestra directamente su vista móvil; la web del conductor sigue en su propia pestaña. Las alturas móviles se ajustan al contenido. Los destinos de navegación tienen foco programático para que el teclado continúe desde la sección elegida. El selector de IVA tiene botones de al menos 44 px de alto y los bordes de controles usan el token del producto `#68788D`.

No se añaden enlaces de registro, tienda, contacto comercial ni descarga de aplicaciones sin un destino real. Todos los datos de la demo son ficticios, se mantienen en memoria y desaparecen al recargar. No hay formularios, trackers ni llamadas a servicios privados. El código de la landing no instala cookies ni guarda selecciones en almacenamiento persistente. Fuentes, logo y demás recursos se sirven desde el mismo origen. Esto no impide que el servidor reciba IP/datos del navegador y pueda registrar accesos; la declaración de privacidad ahora lo distingue expresamente. Vite usa además una conexión local de desarrollo para recargar cambios, que no forma parte de `dist/`.

## Antes de una eventual publicación

Esta entrega **no publica nada**. Se conserva `noindex, nofollow` y `robots.txt` bloqueado para la revisión. Los metadatos de título, descripción, idioma, Open Graph, imagen PNG 1200 × 630 y favicon ya están preparados. No hay canonical ni `og:url` apuntando a un dominio aún no operativo.

Tras revisar el contenido, la presentación y las condiciones del lanzamiento, configurar canonical/URLs absolutas para el dominio confirmado, revisar indexación y robots y confirmar el alcance legal/comercial. El dominio futuro es `furgoplus.cl`; esta entrega no modifica DNS, Cloudflare ni hosting.

## Archivos principales

- `src/App.tsx`: navegación, relato, beneficios, hitos, FAQ, footer y diálogos.
- `src/components/RouteIllustration.tsx`: ilustración original.
- `src/components/ProductDemo.tsx`: experiencias interactivas.
- `src/components/Pricing.tsx`: precios, comparación y estados.
- `src/content/plans.ts`: configuración editorial de planes.
- `src/styles.css`: sistema visual, responsive y movimiento reducido.
- `scripts/prerender.mjs`: HTML estático para lectura y SEO.
- `public/fonts/`: WOFF y licencias. `scripts/compress-fonts.py` documenta la conversión sin pérdida desde las fuentes OFL del sistema de desarrollo; no se ejecuta en el build.

Los recursos generados (`node_modules`, `dist`, capturas) están ignorados dentro de `landing/`. No se han hecho commits, push, merge ni deploy.
