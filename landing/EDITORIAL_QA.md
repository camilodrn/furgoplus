# Task 13 · Simplificación editorial

> Informe histórico. La clasificación de capacidades de planes fue corregida el 28 de octubre de 2026; consultar [CONTENT_REVIEW.md](CONTENT_REVIEW.md) y [ACCEPTANCE_FEDORA.md](ACCEPTANCE_FEDORA.md) para el estado vigente.


## Ajuste fino: criterio permanente e ilustración

- **Contenido:** se consolidó la regla en [EDITORIAL_GUIDELINES.md](EDITORIAL_GUIDELINES.md), enlazada desde README y referenciada junto a `main` en `App.tsx`. Se ampliaron las verificaciones de encabezados, subtítulos y máximo de tres beneficios/pasos. No se añadió copy a la vista principal; planes conserva exactamente su HTML.
- **Ilustración:** las dos ruedas comparten ahora el lateral longitudinal y la misma perspectiva, con pasos de rueda en la carrocería. Se estrechó el frente, se unificó el parabrisas y se corrigió la sombra bajo ambos apoyos. La posición del grupo, recorrido azul y resto del hero permanecen idénticos.

Se renderizó e inspeccionó el SVG completo y una ampliación del vehículo con ImageMagick. Las vistas locales están en `qa-artifacts/hero/after.png` y `qa-artifacts/hero/van-after.png`; son renders del SVG, no capturas responsive de la página ni de sus etiquetas HTML. La verificación geométrica comprueba ruedas alineadas en el mismo plano y sombra bajo ambos puntos de contacto.

Pasaron `build`, `verify`, `test:pricing` y `test:interactions`. Precios, lógica de IVA y CSS no cambiaron. La comparación del prerender confirma identidad de planes, destinos y hero fuera del grupo del vehículo. Las suites de navegador se intentaron de nuevo con el mismo bloqueo al iniciar Chromium; el renderizado responsive en navegador sigue pendiente. Se detiene para revisión humana, sin commit, push, merge ni deploy.

## Iteración anterior: reducción de densidad

La sección de planes muestra encabezado, selector «IVA incluido / Desglose» y tarjetas sin bloques explicativos intermedios. Cada tarjeta tiene tres beneficios; los futuros conservan una marca visible. La nota académica única se muestra junto a las tarjetas y se asocia al selector y a cada plan mediante `aria-describedby`.

La comparación nativa desplegable reúne las capacidades completas, condiciones de publicación, activación manual, alcance futuro, límites de las exportaciones y revisión documental. El acceso inicial gratuito propuesto para apoderados permanece visible. No se eliminan las advertencias de consentimiento, ausencia de reserva de cupos, GPS, pagos manuales, privacidad ni seguridad.

En las demás secciones se acortaron textos redundantes y se limitaron los beneficios por audiencia a tres. Se retiraron consignas repetidas de los pasos y del cierre. Hero, ilustraciones, animaciones y tamaños de texto se conservan.

## Fuentes y disponibilidad

Se contrastaron en este worktree `docs/PRODUCT_SCOPE.md`, `docs/MVP_DEMO_FREEZE.md`, `docs/DEMO_MODE.md` y ADR 0004. No se encontró documentación identificada como Task 12 ni se accedió a otros worktrees. Se mantiene el estado académico documentado, sin anunciar nuevas disponibilidades ni lanzamiento comercial. La matriz de capacidades y límites está en [CONTENT_REVIEW.md](CONTENT_REVIEW.md).

## Validación ejecutada

Desde `landing/`:

```bash
npm run build
npm run test:pricing
npm run verify
npm run test:interactions
```

Pasaron TypeScript, build y prerender, cálculos y redondeo, selector, totales invariantes, hidratación, navegación de pestañas, menú y controles existentes. Las verificaciones editoriales exigen tres beneficios por tarjeta y audiencia, estados futuros visibles, nota académica accesible y tarjetas como primer contenido visible tras el encabezado.

La comparación del HTML anterior y posterior confirma hero idéntico, mismos destinos de enlaces y mismo orden de secciones. La definición del IVA y la función de cálculo son idénticas en el código fuente. Se conserva su cobertura de casos.

El recuento del DOM estático de planes pasó de **281 a 95 palabras** en la vista inicial, y de **93 a 8** antes de las tarjetas. Excluye contenido de desplegables cerrados, diálogos, SVG y texto exclusivo de lectores; es una medida editorial, no una medición de renderizado. Evidencia local: `qa-artifacts/editorial-review.json`.

## Responsive y revisión humana pendiente

Se revisaron las reglas responsive existentes y se añadió únicamente separación móvil entre el título y el selector. No se redujeron fuentes ni se modificaron breakpoints, ilustraciones o animaciones.

Se intentaron `npm run test:browser` y `npm run test:pricing:browser`: ambos se detuvieron al iniciar Chromium con `sandbox_host_linux.cc:41 ... Operation not permitted`. Tampoco hay navegador conectado disponible. **No se declara aprobado el renderizado responsive, teclado nativo ni lector de pantalla.**

Las suites conservan once anchos de 320 a 1920 px, overflow, legibilidad, teclado y accesibilidad. La de precios añade que encabezado y tres precios quepan en escritorio, sin bloques antes de las tarjetas; genera capturas de ambas vistas cuando pueda ejecutarse.

Para revisión humana, ejecutar `npm run dev` y abrir `http://127.0.0.1:4313/#planes`:

1. En escritorio, comprobar que título, selector y comienzo de las tres tarjetas se perciben de inmediato.
2. A 320, 360, 390 y 820 px, revisar ambas vistas y comparación abierta: sin recortes, desbordes o texto pequeño. Comprobar también zoom al 200 %.
3. Con Tab, Enter/Espacio y lector, comprobar selección, foco, totales y nota académica; los estados futuros deben seguir claros al abrir la comparación.

Se detiene aquí para revisión humana, sin commit, push, merge, deploy ni cambios fuera de `landing/`.
