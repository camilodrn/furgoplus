# Task 13 · Revisión integral de navegador

Fecha: 29 de octubre de 2026. Alcance exclusivo: `landing/`, rama `task/13-landing`. Sin commit, push, merge, despliegue ni dependencias nuevas.

## Estado

**PASS automatizado, salida 0.** Ejecución limpia del 29 de octubre, 18:56:32–19:03:00 UTC (15:56:32–16:03:00 en Santiago), sobre Fedora Linux 44, Node 22.23.1, playwright-core 1.64.0 y Chromium 156.0.8078.4. No hubo fallos ni escenarios incompletos.

| Suite de navegador | PASS | FAIL | Incompletos |
| --- | ---: | ---: | ---: |
| General: responsive, comparación, navegación, FAQ, reflujo y regresión original de movimiento | 143 | 0 | 0 |
| Estados: movimiento, foco, resize, texto ampliado y fallbacks | 39 | 0 | 0 |
| Precios: 12 anchos y comprobaciones de integridad | 15 | 0 | 0 |
| Diálogos: 27 combinaciones y comprobaciones de integridad | 30 | 0 | 0 |
| **Total de escenarios registrados** | **227** | **0** | **0** |

También PASS: build/TypeScript, dos pruebas del recolector, contenido, interacciones DOM, precios/IVA y verificación de que `dist/` permaneció idéntico durante todo el lote. Se generaron **72 capturas nuevas**, además de trazas de foco, snapshots de movimiento, árboles accesibles y mediciones de comparación/texto. Se inspeccionaron las capturas de la última columna a 320 px y del menú en reflujo 400 %; esa inspección puntual no constituye aceptación visual global.

[Informe HTML con todos los casos](qa-artifacts/final-report.html) · [reporte JSON fechado del lote final](qa-artifacts/final-2026-10-29T18-56-32-388Z/report.json) · [metadatos actuales](qa-artifacts/final-report.json).

La aceptación visual, zoom real y lectura con Orca siguen pendientes de aceptación humana. No quedan defectos reproducidos sin corregir dentro de las matrices automatizadas descritas aquí.

## Diagnóstico y evidencia anterior a la corrección

Se leyeron completos `verify-browser.mjs`, `verify-pricing-browser.mjs`, `verify-dialog-focus.mjs`, `browser-support.mjs`, `overflow-diagnostics.mjs`, `audit-fedora.mjs` y las verificaciones DOM/contenido/precios. Se revisaron `Reveal`, navegación, diálogos, pestañas, estilos de animación, breakpoints y contenedores de texto.

Chromium estaba instalado. El sandbox impedía arrancarlo; se solicitó permiso para ejecutar la auditoría local fuera del sandbox. No se instaló Playwright ni se accedió a servicios de producto. El CLI de 21st no estaba disponible; no se presenta una revisión de 21st como ejecutada.

La auditoría original reprodujo exactamente `Motion preference changes keep content visible` en Chromium 156.0.8078.4: [registro original](qa-artifacts/final-2026-10-29T18-34-10-140Z/browser.log). El build, contenido, interacciones y precios pasaban.

El primer lote con escenarios independientes completó navegador general, precios y 27 combinaciones de diálogo: [reporte anterior](qa-artifacts/final-2026-10-29T18-43-34-170Z/report.json). Encontró 13 escenarios con defectos de producto y 3 errores de instrumentación: `SVGElement.className` no es un string. El diagnóstico se corrigió para leer `getAttribute("class")`; no se relajó ninguna comprobación de producto. Las mediciones temporales se repitieron con la instrumentación corregida.

| Causa demostrada | Evidencia | Corrección |
| --- | --- | --- |
| La preferencia reducida conservaba una transición real de `0.01ms` y retardos de `0.09s`, `0.12s` y `0.18s`. El estilo final decía opacidad 1, pero la transición prevalecía durante varios fotogramas. | [Línea temporal 1440 px](qa-artifacts/final-2026-10-29T18-49-48-635Z/motion-1440-change.json): opacidades inmediatas 0.011–0.107; un bloque seguía en 0.107 después de los fotogramas medidos. Finalmente todos llegaban a 1. | `transition: none !important` en los bloques bajo movimiento reducido. Se conserva la aserción inmediata original de opacidad exactamente 1. |
| `Reveal` comprobaba la preferencia solo al montar. Las clases `reveal-pending` sobrevivían al cambio y volvían a ocultar contenido al restaurar movimiento normal. | [Ida y vuelta](qa-artifacts/final-2026-10-29T18-49-48-635Z/motion-1440-roundtrip.json): opacidad 0 incluso después de terminar las transiciones. | Escuchar `matchMedia.change`, retirar permanentemente el estado pendiente y desconectar el observer. El cleanup elimina listeners y estado pendiente. |
| Un enlace podía tener foco dentro de un ancestro transparente antes de que IntersectionObserver y la transición lo revelaran. | [Ancestros del enlace enfocado](qa-artifacts/final-2026-10-29T18-49-48-635Z/motion-390-focus.json). | `:focus-within` hace visible el bloque sin transición en ese mismo estado de foco; `focusin` lo revela permanentemente. El estado inicial pendiente tampoco hace una transición de visible a oculto al hidratar. |
| Cruzar el breakpoint ocultaba el control de navegación activo y Chromium enviaba el foco a `body`. El menú conservaba su estado abierto al regresar a móvil. | [Enlace móvil](qa-artifacts/final-2026-10-29T18-49-48-635Z/resize-mobile-link.json), [CTA de escritorio](qa-artifacts/final-2026-10-29T18-49-48-635Z/resize-desktop-CTA.json); reproducido en cuatro controles. | Gestionar el cambio de media query, cerrar el estado móvil y transferir el foco al enlace equivalente o al botón de menú. Recordar el control evita perderlo cuando el blur nativo precede al evento. No se mueve el foco de contenido/diálogo. |
| Texto al 200 % aumentaba las anchuras mínimas de las pestañas, avisos y palabras. Algunos textos quedaban recortados dentro de contenedores, aunque el documento no siempre desbordaba. | [390 px](qa-artifacts/final-2026-10-29T18-49-48-635Z/overflow-200--text-390px-conductor.json): documento de 517 px. [Recortes](qa-artifacts/final-2026-10-29T18-49-48-635Z/text-200-390-conductor.json): «Cupos por recorrido» y «Más información». | Permitir saltos de línea de controles, retirar la anchura rígida del grupo móvil, permitir contracción del hero y corte de palabras largas en títulos/métricas cuando sea necesario. Sin recortes añadidos, escalado de dispositivos ni overflow global oculto. |

La causa del error original era una transición transitoria real, no contenido perdido permanentemente ni una aserción errónea. El ocultamiento persistente al restaurar movimiento normal era un segundo defecto. No se añadió un `sleep` para obtener PASS.

El lote de las 18:49 se usa **solo para sus diagnósticos de estados ya terminados**. Una reconstrucción posterior de desarrollo cambió `dist/` mientras continuaban otras suites; ese lote no sirve como aceptación global. Está señalado en [EVIDENCE_SCOPE.txt](qa-artifacts/final-2026-10-29T18-49-48-635Z/EVIDENCE_SCOPE.txt). El runner final verifica que los hashes y la lista de archivos de `dist/` no cambien durante el lote.

## Recorrido completo de pruebas

Las matrices usan 1920, 1440, 1280, 1024, 1000, 960, 820, 768, 720, 390, 360 y 320 px.

| Grupo | Estados y comprobaciones |
| --- | --- |
| Renderizado por ancho | Conductor y apoderado en páginas nuevas; un h1, fuentes ≥14 px, imágenes cargadas, almacenamiento vacío, ruta sin animación bajo reducción, dispositivos sin escala, menú según breakpoint, targets ≥44 px, perfiles A/B y ausencia de overflow. Capturas y árbol accesible. |
| Comparación | 12 anchos × 2 audiencias × 2 vistas de IVA. Abrir; foco desde summary con Tab; outline ≥2 px; etiquetas accesibles contenidas; tabla ≥640 px; flechas hasta la última columna y vuelta; scroll nativo y `scrollIntoView`; página sin desplazamiento lateral; Enter para cerrar y Space para reabrir. Caso adicional a 320 px. |
| Experiencias | Perfil B; Home/End/flechas con selección y foco coherentes; ida/regreso, horas y `aria-pressed`. |
| Navegación | Cada anchor visible a 1440/390 px, incluidos skip link, marcas, footer y CTAs de audiencia, con foco en destino. Los cinco enlaces móviles se ejercitan por separado. Escape y cierre de menú; ciclos completos de Tab con outline visible, sin trampa. |
| FAQ | Apertura con puntero y seis escenarios independientes de Enter/Space nativos, incluyendo cierre. |
| Diálogos | Contenido de privacidad/proyecto; foco inicial, modalidad nativa, 6 Tab y 6 Shift+Tab, ambos controles alcanzables, outline y retorno al invocador. Matriz específica: 3 diálogos × 3 anchos × Escape/cerrar/Entendido = 27 escenarios. No se acepta foco en body/chrome dentro del diálogo. |
| Reflujo | 640×450 y 320×225, espacio CSS equivalente a 200/400 % desde 1280×900. Ambas audiencias, desglose y comparación, targets/overflow, último enlace del menú y confirmación del diálogo alcanzables. No se denomina zoom real. |
| Movimiento | 1440×900, 390×844 y 320×225: carga reducida, montaje de otra audiencia, normal→reducido, cambio durante una transición realmente activa, ida/vuelta repetida y foco en bloque pendiente. Snapshots inmediatos, tras render y al terminar; recorrer todas las secciones con movimiento normal; fallback sin IntersectionObserver. |
| Redimensionado durante uso | Cuatro controles cruzando 960/961 px; vuelta a móvil sin menú obsoleto; no robar foco fuera de navegación; preservar Perfil B, desglose y comparación abierta; redimensionar un modal abierto a 320×225 y comprobar su ciclo de foco. |
| Texto ampliado | 100/200 % de tamaño raíz × 1440/390/320 px × ambas audiencias. Medir overflow documental y rectángulos de texto realmente recortados por ancestros no desplazables; capturas. No equivale a emular zoom de navegador. |
| HTML sin JavaScript | Contenido prerenderizado visible, tres precios, comparación nativa abrible y sin overflow a 320 px. |
| Precios | 12 anchos: importes exactos, IVA persistente, 3 destacados por plan, selector compacto, vista inicial, Tab/Shift+Tab/Enter/Space, foco conservado, anuncios de estado, árbol AX con grupo/pressed/live/descripción, legibilidad y overflow. |
| Integridad | Errores de ejecución/consola/HTTP/recursos, peticiones externas y cookies se comprueban aun cuando falle un escenario previo. Build+TypeScript, contenido, hidratación, interacciones DOM, redondeo de IVA y capacidades académicas siguen siendo obligatorios. |

Los selectores, acciones y aserciones concretos están en los scripts; cada nombre de caso y su resultado se conserva en los JSON `*-cases.json` y en el informe HTML. La tabla describe cobertura automatizada, no una certificación completa de accesibilidad.

## Acumulación de fallos sin falsos PASS

`browser-cases.mjs` captura excepciones en el límite de **cada escenario independiente**. Conserva el stack, estado de foco, viewport y captura de fallo. No continúa las acciones dependientes posteriores a una aserción fallida: el caso entero queda FAIL. El caso siguiente usa una página nueva; desaparecen dependencias accidentales de scroll, foco, disclosure, audiencia o preferencia heredados.

El reporte se escribe antes y después de cada caso. Una interrupción queda RUNNING/incompleta. Cualquier FAIL produce salida 1. El lote agrega las cuatro suites y exige sus reportes completos; el fallo de build impide auditar un `dist/` antiguo. Un navegador que no arranca queda NOT_RUN_BROWSER, nunca PASS.

`browser-cases.test.mjs` inyecta dos errores independientes y un tercer caso correcto: verifica los tres resultados y código de salida 1. También verifica que omitir el cierre del runner deje el informe RUNNING. Son pruebas del mecanismo, no errores de producto ocultados.

No se eliminaron las aserciones originales de opacidad, foco, ancho, importes, IVA ni capacidades. La única corrección de instrumentación fue leer la clase SVG mediante el atributo; las comprobaciones nuevas de movimiento añaden evidencia a la regresión original.

## Procedimiento único para Fedora

Con Node ≥22.12, dependencias y Chromium ya disponibles:

```bash
cd ~/Proyectos/furgoplus-landing/landing
npm run audit:fedora
```

No ejecutar otro build/dev que reemplace `dist/` durante el lote. No requiere backend, puerto de servidor, cuentas ni datos privados. Sirve el build por interceptación del origen de prueba y bloquea peticiones externas.

El comando construye, ejecuta las suites y deja `qa-artifacts/final-report.html`, `final-report.json` y un directorio fechado con registros, capturas, trazas, casos y `report.json` inmutable. Un FAIL o una etapa no ejecutada conserva salida no cero. Las capturas no se reutilizan de ejecuciones anteriores.

Si Fedora utiliza una instalación existente diferente, se mantienen `LANDING_PLAYWRIGHT_MODULE` (ruta absoluta del módulo) y `LANDING_BROWSER_PATH` (ejecutable). El comando de auditoría sigue siendo el mismo; no es necesario instalar otra dependencia. `LANDING_OVERFLOW_DIAGNOSTICS=1` añade experimentos temporales de contención, sin sustituir las aserciones estrictas.

## Aceptación humana pendiente

Después de un PASS automatizado, revisar el build con zoom real al 200/400 %, teclado y Orca en Fedora, además de apariencia y lectura de las capturas. Verificar también el navegador de presentación previsto. Las pruebas actuales usan Chromium headless; no prueban la voz de un lector de pantalla ni equivalencia visual entre navegadores.

No se modificaron contenidos, importes, porcentajes, capacidades, assets de marca ni lógica de contratación. Las adaptaciones de controles/títulos pueden cambiar los saltos de línea cuando falta espacio; requieren aceptación humana de su presentación. No se declara aceptación visual ni autorización para publicar.
