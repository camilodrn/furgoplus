> Revisión histórica. El estado vigente, la evidencia de Chromium real y el procedimiento único están en [INTEGRAL_AUDIT_REVIEW.md](INTEGRAL_AUDIT_REVIEW.md). La aceptación humana sigue pendiente.

# Task 13 · Calidad final · 29 de octubre de 2026

**Actualización posterior:** la auditoría REAL Fedora `final-2026-10-29T15-28-52-868Z`, después de corregir el hero, pasó build, contenido, interacciones, precios y pricing-browser (12 anchos). Browser falló al abrir la comparación a 320 px (documento 621 px, body 320 px). Se añadió `position: relative` al scroller para contener las etiquetas absolutas `.sr-only`, omitidas por el diagnóstico anterior. La causa inferida del código, la evidencia original, los experimentos reversibles y la matriz ampliada están en [OVERFLOW_REVIEW.md](OVERFLOW_REVIEW.md). El lote local posterior `final-2026-10-29T15-44-23-524Z` tiene cuatro pasos PASS y dos NOT_RUN_BROWSER por bloqueo de Chromium; resultado INCOMPLETE. Falta validar la corrección en navegador real y obtener aceptación humana. El resto de este informe conserva el estado del lote previo.

Implementación preparada para aceptación humana en Fedora. **Aceptación visual pendiente:** Chromium continúa bloqueado por el sandbox antes de crear una página. No hay capturas nuevas ni evidencia de renderizado, consola del navegador o teclado nativo en esta ejecución.

Alcance: `landing/`, rama `task/13-landing`. La carpeta ya estaba sin seguimiento al iniciar. Sin commit, push, merge ni deploy. No se modificaron T12, T14, backend, homelab ni demo r4. No se instalaron dependencias ni se añadieron servicios. Se conserva el diseño, sus recursos, estructura, precios y capacidades académicas verificadas por el usuario.

## Hallazgos y correcciones

Severidad: alta impide completar la aceptación; media afecta acceso o comprensión; baja afecta una ayuda o la reproducibilidad. Los hallazgos de CSS se confirman por sus reglas; su resolución visual requiere el navegador pendiente.

| ID | Severidad | Evidencia y efecto | Resolución | Verificación |
| --- | --- | --- | --- | --- |
| Q01 | Alta · entorno | Chromium falla con `sandbox_host_linux.cc:41 … Operation not permitted`, antes de cargar la landing. | Bloqueo registrado; no se elude el sandbox. Las suites quedan `NOT_RUN_BROWSER`. | Reproducido con Playwright local y externo; pendiente Fedora fuera del sandbox. |
| Q02 | Media | El menú suma cinco enlaces de ≥52 px, encabezado ≥76 px y rellenos, sin límite de altura ni scroll propio. Supera una ventana de 320 × 225, equivalente al espacio CSS con zoom 400 % desde 1280 × 900. `src/styles.css:3088`. | Encabezado limitado a `100dvh`; menú con scroll vertical y encabezado de navegación sin encogimiento. | Código corregido; prueba de último enlace enfocable añadida. Renderizado pendiente. |
| Q03 | Media | La nota de planes mostraba “MVP académico T12” sin explicar T12 ni distinguir los informes en su resumen; FAQ usaba “UX”. `src/components/Pricing.tsx:139`, `src/App.tsx:69`. | Resumen visible de informes desde Pro y avanzados/XLSX en Elite; sin servicio comercial. FAQ explica XLSX como archivos para hojas de cálculo y usa “experiencia de uso”. | Build, contenido y precios DOM pasan. Mantiene el detalle completo bajo demanda. |
| Q04 | Baja | La suite buscaba `/Ninguna función/`, texto ausente en la nota comercial actual. Fallaría aun si Chromium iniciara. `scripts/verify-browser.mjs:208`. | Verifica el aviso vigente “Disponibilidad comercial futura … no habilitada”. | Contenido comprobado en HTML; sintaxis de la suite pasa; ejecución nativa pendiente. |
| Q05 | Baja | “Volver arriba” tenía solo la altura de línea del footer, inferior al criterio de 44 px usado en esta auditoría. `src/styles.css:1288`. | Área de al menos 44 px de alto y alineación centrada. | Código corregido; prueba ampliada a todos los enlaces, botones y summaries, en ambas dimensiones. Presentación pendiente. |
| Q06 | Baja | Selector de perfiles: `div` con `aria-label`, sin rol de agrupación. `src/components/ProductDemo.tsx:290`. | `role="group"` para exponer su nombre de grupo. | Build/DOM pasan; árbol accesible y Orca pendientes. |
| Q07 | Baja | Suites sin lote único, sin zoom/reflujo y sin resumen estructurado que distinga bloqueos; capturas compartidas podían pertenecer a otra ejecución. | `audit:fedora`, helper de Playwright externo, logs, hashes y carpetas por ejecución; reflujo y cobertura de controles ampliados. | Auditoría ejecutada: cuatro pasos `PASS`, dos `NOT_RUN_BROWSER`; resultado global `INCOMPLETE`, código 1. |

Sin otros defectos confirmados en contenido, hidratación, precios o estados DOM revisados. Esto no acredita ausencia de defectos visuales. No se propone otro rediseño.

## Matriz de secciones

“Revisado” significa lectura de implementación y contenido, con comprobaciones DOM cuando aplica. La evaluación visual de **todas** las filas sigue pendiente.

| Sección | Propósito y audiencia | Resumen → acción → detalle | Revisión y decisión |
| --- | --- | --- | --- |
| Presentación | Explicar la organización del transporte escolar; ambas audiencias. | Titular y frase breve → Explorar la demo → Así funciona. | Un H1, etapa académica visible, ilustración conceptual. Se conserva. |
| Propuesta | Mostrar el problema de información dispersa. | Problema → búsqueda/contacto/gestión como punto de encuentro. | Explica el motivo del producto; no añade otra lista de funciones. Se conserva. |
| Demo | Mostrar experiencias diferentes. | Dos pestañas → seleccionar recorrido o perfil → cambio ilustrativo. | Conductor: gestión web y jornada móvil. Apoderado: perfiles/horarios/cupos en móvil; a >1000 px también se ilustra cómo se organiza el conductor. Identificación ficticia visible. |
| Beneficios | Explicar el valor concreto por audiencia. | Tres beneficios por bloque → CTA a su pestaña. | Transportista: rutas, solicitudes, pagos manuales. Familias: comparar y solicitar contacto con consentimiento. La repetición con la demo refuerza el valor y permite volver a explorar; no se amplía. |
| Funcionamiento | Explicar la secuencia del contacto, centrada en familias. | Buscar → autorizar correo → coordinar fuera de FurgoPlus. | Complementa beneficios con pasos; solicitar contacto no reserva cupos. Se conserva. |
| Planes | Comparar propuestas académicas para conductores. | Propósito/precio/tres destacados → desglose o comparación → condiciones. | Nota breve corregida; condiciones y experimentos siguen desplegables. Apoderados tienen bloque de acceso inicial $0, sin inscripciones. |
| FAQ | Resolver dudas específicas. | Pregunta → respuesta al abrir. | GPS, validación, contacto, precios y privacidad bajo demanda. Repetición justificada como consulta autónoma. Se simplifica solo la respuesta de planes. |
| Cierre | Retomar la acción principal. | Datos de ejemplo → Explorar la demo. | Un destino, sin registro ni contratación. Se conserva. |
| Footer/diálogos | Navegación secundaria y límites del proyecto. | Enlaces breves → información al abrir. | Privacidad, accesibilidad e hitos fuera del relato principal. “Volver arriba” amplía su área. |

## Matriz de interacciones

| Interacción | Comprobación | Evidencia actual / pendiente |
| --- | --- | --- |
| Todos los enlaces, logo, salto al contenido y CTA final | Destinos existentes; Enter transfiere foco al destino. | Anchors/tabindex pasan en HTML. Suite nativa ampliada a todos los enlaces de escritorio y móvil; pendiente. |
| CTA de cada audiencia | Selecciona su pestaña y va a demo. | Pasa en DOM; navegación y foco nativos pendientes. |
| Pestañas conductor/apoderado | Clic, flechas, Home/End, selección y tabulación exclusiva. | Pasa en DOM. Suite nativa cubre las cuatro teclas; pendiente. |
| Ida/regreso | Horas, cupos y detalle cambian; botón seleccionado. | Pasa en DOM; nativo y distribución en móvil pendientes. |
| Perfiles A/B | Horarios/cupos y `aria-pressed`; aviso cortés. | Pasa en DOM; nativo y anuncio de Orca pendientes. |
| Elementos de la interfaz ilustrativa | Sidebar, comuna y métricas son contenido, no controles simulados. | Revisado en código: no se les atribuyen acciones reales. |
| Menú móvil | Abrir/cerrar, Escape, enlaces y último enlace con altura reducida. | Estado/Escape/foco pasan en DOM. CSS de altura corregido; comportamiento nativo pendiente. |
| IVA/Desglose | Totales constantes, tres desgloses, estados y foco. | Pasa en DOM y cálculos. Enter/Espacio, árbol accesible y layout nativos pendientes. |
| Comparación | Abrir/cerrar; tabla desplazable por teclado sin ensanchar página. | Semántica y capacidades pasan en HTML. Scroll/foco nativos pendientes. |
| Seis FAQ | Abrir/cerrar con Enter y Espacio. | Contenido y `details/summary` revisados. Suite ampliada a las seis; pendiente navegador. |
| Tres diálogos | Contenido, cierre, Escape, foco contenido y restaurado. | Selección de contenido pasa en DOM; comportamiento modal nativo y cierre en ventanas bajas pendientes. |
| Teclado y movimiento | Ciclo Tab sin trampa, foco visible, reducción de animaciones. | Estado DOM de movimiento reducido pasa. Suite nativa cubre ciclo completo, cambios de preferencia y animación finita; pendiente. |

## Invariantes académicas

| Plan | Total CLP/mes, IVA incluido | Informes mensuales | Avanzados y XLSX |
| --- | ---: | --- | --- |
| Básico | $19.990 | No | No |
| Pro | $39.990 | Sí | No |
| Elite | $69.990 | Sí | Sí, tres tipos de exportación |

Se conserva gestión base común. Asistente FAQ en Pro/Elite y contextual en Elite: experimentales, con integración y experiencia de uso pendientes. No se confunden con servicio comercial. No hay contratación, cobros, seguimiento GPS ni integraciones nuevas en esta landing. El registro de pagos es manual. No se ofrece descargar ni instalar una app.

## Pruebas ejecutadas

Node `v22.23.1`, npm `10.9.8`, Linux x64. Playwright externo existente `1.64.1`; instalación local `playwright-core 1.64.0` también intentada. No se instalaron paquetes.

| Comando / paso | Resultado |
| --- | --- |
| `npm run build` | PASS: TypeScript, Vite y HTML prerenderizado. |
| `npm run verify` | PASS: semántica básica, destinos ARIA/enlaces, contenido, recursos locales, capacidades y precios. |
| `npm run test:interactions` | PASS: hidratación, experiencias, selecciones, CTA, menú y foco DOM. |
| `npm run test:pricing` | PASS: importes, neto/IVA, suma, totales constantes, estados y foco DOM. |
| `node --check` de los cuatro scripts de navegador/auditoría | PASS: sintaxis; no ejecución de layout. |
| `npm run test:browser` / `npm run test:pricing:browser` | NOT RUN: bloqueo de Chromium al iniciar. |
| `npm run audit:fedora` con Playwright externo | INCOMPLETE; código 1. Cuatro pasos PASS y dos NOT_RUN_BROWSER. |
| `npm run preview` | No inicia: `listen EPERM 127.0.0.1:4313`. Petición curl también bloqueada al abrir socket. |
| `21st review landing/src --json` | No disponible: CLI `21st` ausente. Revisión directa de código/DOM realizada; no se instaló la CLI ni se generó UI. Tampoco existe `.21st/design.json` en este proyecto. |

Reporte local: [HTML](qa-artifacts/final-report.html) y [JSON](qa-artifacts/final-report.json). Incluyen registros por suite, runtime elegido, SHA-256 de cada archivo del build y solo capturas de la ejecución actual. Los artefactos están ignorados por Git; se regeneran con el comando siguiente. Los resultados DOM no acreditan contraste global, presentación, lector de pantalla ni ausencia de errores de consola del navegador.

## Reproducir en Fedora

Desde una terminal normal de Fedora, con Node ≥22.12 y las dependencias ya presentes:

```bash
cd ~/Proyectos/furgoplus-landing/landing
LANDING_PLAYWRIGHT_MODULE="$HOME/.local/share/furgoplus-responsive-audit/node_modules/playwright/index.mjs" npm run audit:fedora
```

Si esa instalación externa no existe, usar la dependencia local ya declarada:

```bash
npm run audit:fedora
```

Ambas variantes necesitan Chromium ya instalado. Se puede seleccionar un ejecutable existente, sin instalar dependencias:

```bash
LANDING_BROWSER_PATH=/usr/bin/microsoft-edge npm run audit:fedora
```

No usar el perfil personal: Playwright crea uno temporal. No se requiere servidor, backend ni credenciales. Las suites sirven `dist/` por interceptación de un origen de prueba, bloquean recursos externos y comprueban ausencia de cookies/almacenamiento añadido. Esto prueba el artefacto, no el futuro hosting. Si faltan las dependencias locales, `npm ci` restaura únicamente las declaradas en el lockfile.

Cobertura preparada: 1920, 1440, 1280, 1024, 960, 820, 768, 720, 390, 360 y 320 px; ambas audiencias. Añade 640 × 450 y 320 × 225 como reflujo equivalente al espacio CSS con zoom 200/400 % desde 1280 × 900. **No simula el zoom real mediante `deviceScaleFactor`.** La ampliación real con Ctrl+ y las preferencias de fuente siguen siendo comprobaciones humanas. Si hay fallos, las suites se detienen en la primera aserción; los logs y capturas anteriores a ella no constituyen un pase de toda la cobertura.

## Comprobaciones humanas pendientes

- [ ] Ejecutar la auditoría en Fedora fuera del sandbox y revisar su HTML: ninguna suite fallida o sin ejecutar; inspeccionar sus capturas.
- [ ] Recorrer escritorio 1440 × 900 y tableta 820 px. Verificar jerarquía, contraste, textos completos, ritmo y logo en el monitor/proyector de la presentación.
- [ ] Revisar 320/360/390 px con ambas audiencias, comparación y desglose abiertos. La página no debe desplazarse lateralmente; la tabla sí puede hacerlo dentro de su región.
- [ ] Probar zoom **real** 200 % y 400 %, ventana baja y tamaño de texto ampliado. Comprobar menú, diálogos, última opción y foco accesibles; distinguirlo de la prueba de reflujo.
- [ ] Recorrer con Tab/Shift+Tab, Enter/Espacio, flechas, Home/End y Escape. Revisar contraste del foco y que el encabezado no lo tape; sin trampas fuera de los diálogos.
- [ ] Probar Orca: nombres/selección de pestañas e IVA, cambio de perfiles, encabezados de tabla, condiciones académicas, diálogos y regreso del foco.
- [ ] Activar movimiento reducido en Fedora y cambiar la preferencia con la página abierta; todo el contenido debe seguir visible.
- [ ] Abrir consola/red en Chromium o Edge y Firefox durante el recorrido servido por `preview`: sin errores de aplicación, recursos fallidos ni conexiones inesperadas. Firefox y controles táctiles no están cubiertos por estas suites Chromium.
- [ ] Pedir a una persona sin conocimientos técnicos que explique qué hace FurgoPlus, qué cambia entre conductor/apoderado y cuáles son los límites de la demo. Debe distinguir precios académicos, informes de cada plan, asistentes experimentales y ausencia de contratación/GPS/cobros.
- [ ] Ensayar la [guía de demostración](DEMO_GUIDE.md) y registrar decisión humana: pendiente / aceptado / cambios requeridos.

El lote termina aquí para aceptación humana; ningún resultado de este documento concede aceptación visual.
