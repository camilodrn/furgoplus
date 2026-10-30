> Revisión histórica. El estado vigente, la evidencia de Chromium real y el procedimiento único están en [INTEGRAL_AUDIT_REVIEW.md](INTEGRAL_AUDIT_REVIEW.md). La aceptación humana sigue pendiente.

# Task 13 · Lote del 28 de octubre de 2026

**Histórico:** el lote vigente del 29 de octubre, su matriz, comandos y pendientes están en [FINAL_QUALITY_REPORT.md](FINAL_QUALITY_REPORT.md); la guía de presentación está en [DEMO_GUIDE.md](DEMO_GUIDE.md). Los resultados y alcances de este documento corresponden al lote anterior.

Listo para revisión humana local. Todos los cambios de esta ejecución están dentro de `landing/`, en `task/13-landing`. La carpeta ya estaba sin seguimiento por Git al comenzar; se conserva ese estado. Sin commit, push, merge ni deploy.

## Corrección de exactitud de planes · revisión actual

Se corrigen únicamente `src/content/plans.ts`, los textos/indicadores de `Pricing.tsx` y la respuesta de planes en `App.tsx`; se actualizan sus verificaciones y documentos asociados. El resto de los cambios descritos abajo corresponde al lote anterior. No hay cambios de CSS, recursos, responsive, consentimiento, importes ni cálculo de IVA.

| Comprobación actual | Resultado |
| --- | --- |
| `npm run build` | Pasa: TypeScript, Vite y prerender |
| `npm run verify` | Pasa: matriz por plan, estados visibles/accesibles, exclusión de Básico de informes mensuales, FAQ, nota de oferta comercial no habilitada y controles previos |
| `npm run test:pricing` | Pasa: importes, redondeo, neto + IVA, totales invariantes, foco y estados académicos/experimentales conservados al alternar vistas |
| `npm run test:interactions` | Pasa: hidratación, recorridos, perfiles, pestañas, CTAs, menú y Escape |
| `npm run test:browser` | Intentada; comprobaciones no ejecutadas porque Chromium falla al iniciar: `sandbox_host_linux.cc:41 … Operation not permitted` |
| `npm run test:pricing:browser` | Intentada; mismo bloqueo de Chromium |

Registros actuales: `qa-artifacts/browser-launch-error.log` y `qa-artifacts/pricing/browser-launch-error.log`. No se generaron capturas nuevas ni se validaron renderizado responsive, teclado nativo o lector de pantalla en esta revisión. Las pruebas DOM no sustituyen esa aceptación. Se conserva el diseño en código; falta comprobar visualmente la longitud de los textos corregidos.

La diferenciación académica de informes y XLSX está respaldada por T12 consultado en lectura y por los hechos verificados del usuario. La integración y UX de asistentes y cualquier oferta comercial siguen pendientes; no se declaran cerradas ni disponibles comercialmente.

## Cambios del lote anterior y corrección comercial

- Relato más directo: gestión web y experiencia móvil, beneficios por audiencia, CTAs breves y consistentes. Los tres pasos explican que el contacto requiere consentimiento y no reserva cupos.
- Básico presenta organización diaria; Pro, informes mensuales en el MVP académico; Elite, análisis más detallado. Cada tarjeta muestra su propósito y la madurez de su propuesta. La corrección de exactitud distingue gestión base común, informes mensuales Pro/Elite, informes avanzados y XLSX Elite implementados en T12, y asistentes experimentales con integración/UX pendientes. La disponibilidad comercial futura no está habilitada.
- Se conservan $19.990, $39.990 y $69.990 CLP/mes con IVA incluido, el desglose existente y el acceso inicial gratuito propuesto para apoderados. No hay contratación ni cobros.
- Hasta 1000 px, la pestaña del apoderado presenta directamente su experiencia móvil; el conductor conserva su web y su vista móvil. Se retiraron las alturas mínimas móviles que añadían espacio vacío, sin reducir fuentes ni escalar dispositivos.
- Los destinos de enlaces admiten foco para continuar la navegación con teclado. El perfil ficticio anuncia sus cambios mediante una región cortés. Los botones de IVA pasan de 38 a 44 px de alto. El borde de controles usa `#68788D`: contraste calculado de 4,51:1 sobre blanco y 4,23:1 sobre el fondo cálido. Esto verifica esas parejas, no la conformidad global de la página.
- Logo, azul de marca, tipografías locales, ilustración, animaciones finitas y movimiento reducido se conservan. No se instala ningún componente. Se consultaron metadatos de tarjetas en 21st; se reutilizó la implementación local.

Se revisaron presentación, propuesta, demo, beneficios, explicación, planes, FAQ, cierre y footer. No hay formularios ni campos de captura. Los enlaces apuntan a secciones existentes y los botones abren interacciones locales. Las verificaciones conservan recursos del mismo origen, ausencia de persistencia y ausencia de conexiones a servicios privados.

## Compatibilidad comercial

La [matriz editorial](CONTENT_REVIEW.md) recoge la consulta de T12 en modo lectura: `PLAN_CAPABILITIES_SPEC.md`, catálogo `2026-10-19.3`, permisos, pruebas e informes de reportes y soporte, y límites de aceptación UX. Se confirma diferenciación implementada de informes y XLSX; los asistentes conservan estado experimental pese a tener permisos y lógica. Los documentos históricos locales de gestión común no describen las ampliaciones posteriores de T12.

La corrección solo cambia textos e indicadores de planes, FAQ, verificaciones de contenido y documentación asociada. Se mantienen activación manual, precios, IVA, diseño, CSS, responsive, consentimiento, GPS y pagos manuales. No se ejecutaron ni modificaron T12, T14, backend ni homelab; tampoco se accedió a cuentas o servicios privados.

La comprobación de esta revisión es documental y de código: no reejecuta la suite T12 ni valida producción. Integración/UX final de asistentes y condiciones de oferta comercial siguen pendientes; ninguna capacidad se ofrece comercialmente.

## Pruebas del lote anterior (histórico)

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Pasa: TypeScript, Vite y prerender |
| `npm run verify` | Pasa: contenido, anchors, ARIA, recursos, precios, madurez y límites de privacidad |
| `npm run test:interactions` | Pasa: hidratación, recorridos, perfiles, pestañas, CTAs, menú y selección de diálogos |
| `npm run test:pricing` | Pasa: importes exactos, redondeo, suma neto/IVA, selector y conservación de foco/totales |
| `node --check` de ambas suites de navegador | Pasa: sintaxis |
| `npm run dev` | Vite inicia en `127.0.0.1:4313`; se detiene al terminar la comprobación |
| Petición HTTP local | Bloqueada por el entorno: `connect EPERM 127.0.0.1:4313` |
| `npm run test:browser` | No ejecutada: Chromium no puede iniciar por `sandbox_host_linux.cc:41 … Operation not permitted` |
| `npm run test:pricing:browser` | Mismo bloqueo de Chromium |

Las suites de navegador se ampliaron para comprobar ambas audiencias en once anchos, controles de al menos 44 px de alto y foco al navegar desde el menú móvil. Generan capturas en `qa-artifacts/` cuando pueden ejecutarse. No hay capturas nuevas de navegador ni validación de lector de pantalla en esta ejecución. Los registros del bloqueo quedan en `qa-artifacts/browser-launch-error.log` y `qa-artifacts/pricing/browser-launch-error.log`.

## Aceptación visual en Fedora

Con Node.js 22.12 o superior, desde una terminal:

```bash
cd ~/Proyectos/furgoplus-landing/landing
npm ci
npm run dev
```

Abrir `http://127.0.0.1:4313` en Firefox o Chromium. El servidor escucha solo en loopback; no requiere backend, Docker, variables ni credenciales. Detener con Ctrl+C.

1. **Escritorio, 1440 × 900:** recorrer toda la landing. Comprobar jerarquía, logo, ritmo entre secciones y legibilidad. El CTA principal invita a explorar la demo. En planes, identificar propósito y precio sin abrir detalles; Pro y Elite deben distinguir sus capacidades académicas de una oferta comercial todavía no habilitada; el asistente FAQ de Pro debe indicar «Experimental».
2. **Móvil, 390/360/320 px, y tableta, 820 px:** comprobar ausencia de recortes y scroll horizontal de página en ambas audiencias. Elegir apoderado: debe aparecer su celular inmediatamente después del selector. Cambiar Perfil A/B; volver a conductor y seleccionar ida/regreso. Revisar también 1000/1024 px, donde cambia la composición.
3. **Planes:** alternar IVA incluido/Desglose; verificar totales invariantes y suma neto + IVA. Abrir la comparación: solo la tabla puede desplazarse horizontalmente. Leer la nota académica y los estados: mensuales solo Pro/Elite, avanzados/XLSX solo Elite, asistentes experimentales. Confirmar que la oferta comercial futura no está habilitada.
4. **Teclado y zoom al 200 %:** Tab, Shift+Tab, Enter y Espacio; foco visible y sin controles ocultos en el recorrido. En las pestañas usar flechas, Home/End. Desde el menú móvil ir a Planes y continuar con Tab desde esa sección. Abrir/cerrar FAQ y diálogos, probar Escape y el regreso de foco al botón de origen.
5. **Movimiento y lectura:** activar movimiento reducido y recorrer de nuevo. Con Orca, comprobar etiquetas, selección de pestañas/IVA, actualización del perfil y lectura de las condiciones de cada plan. No debe aparecer registro, solicitud de datos, pago o conexión a una cuenta real.

Para repetir comprobaciones sobre la versión de producción:

```bash
npm run build
npm run verify
npm run test:interactions
npm run test:pricing
npm run preview
```

`preview` utiliza también 4313: detener antes `dev`. En otra terminal se pueden ejecutar `npm run test:browser` y `npm run test:pricing:browser`. Requieren Chromium de Playwright ya instalado; si se usa un Chromium del sistema, indicar su ruta real con `LANDING_BROWSER_PATH=/ruta/al/ejecutable`. Las suites interceptan los recursos de `dist/` sin abrir un servidor ni contactar servicios externos.

Aceptar el lote solo tras esa revisión visual y de teclado. El trabajo se detiene para revisión humana.
