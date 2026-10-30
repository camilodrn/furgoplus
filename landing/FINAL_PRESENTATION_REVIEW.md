# Task 13 · Ajustes finales para aceptación humana

Cambios locales en `task/13-landing`, limitados a `landing/`. Sin commit, push, merge ni deploy. El diseño general aprobado se conserva.

## Cambios

- `src/styles.css`: `.solution-copy` mantiene su borde vertical y pasa de `padding-left: 0` a `16px` exclusivamente en el media query de hasta 700 px. El padding compartido mantiene alineados ícono, título, párrafo y franja de conexión. Escritorio conserva sus reglas anteriores.
- `src/App.tsx`: se elimina «Dominio previsto: furgoplus.cl» del footer y la frase equivalente obsoleta de «Sobre el proyecto». Se conserva el aviso de proyecto académico demostrativo.
- La columna «Con toda claridad» incorpora «Términos y condiciones», «Privacidad» y «Accesibilidad», con los estilos y objetivos táctiles existentes. No se encontró contenido previo de términos en `src/` ni `public/`.
- Términos utiliza el único diálogo existente. Su texto comienza con «Borrador pendiente de aprobación humana» y declara que no constituye asesoría legal ni condiciones comerciales definitivas. Describe una landing académica sin contratación comercial habilitada, reservas ni procesamiento de pagos. No añade servicios, garantías ni políticas de tratamiento de datos.
- Privacidad y Accesibilidad conservan su contenido y comparten el mismo diálogo. Los manejadores de foco, cierre y teclado existentes no cambian.
- `scripts/verify-interactions.mjs`: comprueba contenido del footer, destinos, diálogo único, borrador de términos, apertura y retorno del foco; actualiza el nombre de Privacidad.
- `scripts/verify-dialog-focus.mjs`: incluye Términos y 360 px junto a los anchos anteriores, conservando las comprobaciones de foco visible, Tab, Shift+Tab, Escape y ambos botones de cierre.
- `scripts/verify-browser.mjs`: actualiza el nombre de Privacidad e incluye Términos en su comprobación móvil existente. Esta suite amplia no se ejecutó.
- `scripts/verify-footer-browser.mjs` y `package.json`: comando focalizado que mide separación, alineación, overflow, destinos y tamaños táctiles; genera capturas de sección, footer y términos a 320, 360, 390 y 1440 px.

## Validación en Codex

| Comprobación | Resultado |
| --- | --- |
| TypeScript (`tsc --noEmit`, incluido en build) | PASS |
| `npm run build` | PASS, con prerender |
| `npm run verify` | PASS: contenido, semántica, anclas, referencias ARIA y recursos |
| `npm run test:interactions` | PASS: hidratación, interacción DOM y manejadores de foco, incluido Términos |
| `npm run test:demo-links` | PASS: destinos y accesibilidad de accesos a demo |
| Sintaxis de los scripts de footer y diálogos | PASS |
| `npm run test:footer:browser` | NO EJECUTADO: Chromium no pudo iniciar |
| `npm run test:dialog:browser` | NO EJECUTADO: Chromium no pudo iniciar |

El bloqueo del navegador es `sandbox_host_linux.cc:41`, `Operation not permitted`. El navegador conectado alternativo también rechazó la llamada por requerir aprobación en una sesión con política `never`. No se solicitaron permisos ni se eludieron restricciones. La CLI `21st` no está instalada; no se obtuvo revisión automática de esa herramienta.

Las pruebas DOM no acreditan geometría, contraste real, teclado nativo ni lectores de pantalla. **No se afirma que los anchos móviles o Tab/Escape hayan pasado en navegador.** No se ejecutó la auditoría integral de 227 pruebas.

## Pendiente de aceptación humana

1. En un entorno que permita iniciar Chromium, ejecutar desde `landing/`:

   ```bash
   npm run build
   npm run test:footer:browser
   npm run test:dialog:browser
   ```

   Revisar las capturas y mediciones en `qa-artifacts/footer-final/` y las trazas en `qa-artifacts/dialog-focus/`. Ambos comandos devuelven error si Chromium no arranca o una aserción falla.
2. Confirmar visualmente la separación y composición del footer a 320, 360 y 390 px, y conservación de escritorio a 1440 px; comprobar apertura con teclado, Tab/Shift+Tab, Escape y retorno de foco. Conservar la revisión humana con lector de pantalla.
3. Aprobar o corregir el borrador de Términos antes de publicar estos cambios. El contenido existente de Privacidad conserva su advertencia sobre revisión del hosting: esta tarea no verifica ni define esa política.

La revisión termina aquí, sin publicación automática ni cambios en infraestructura o en Task 12/14.
