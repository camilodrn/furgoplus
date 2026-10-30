# Task 13 · Ubicación y jerarquía de accesos a la demo

Rama `task/13-landing`. Pendiente de revisión visual humana.

- Hero: un único botón azul «Ver cómo funciona» hacia `#producto`. Se retira el enlace externo y el override móvil añadido para apilar los dos accesos; se conserva el resto de la composición, tipografía, ilustración y estilos originales.
- Navbar: el botón azul existente pasa a «Abrir demo ↗», hacia `https://demo.furgoplus.cl`, sin añadir botones. El acceso equivalente del menú móvil conserva su cierre al activarse. La navegación interna permanece intacta.
- Producto: debajo de la simulación se reutiliza `text-link` para «Abrir demo de la aplicación ↗», en azul de marca. Una frase asociada mediante `aria-describedby` indica: «Abre la versión demostrativa alojada en demo.furgoplus.cl». No se atribuyen funcionalidades de T12 a esa versión.
- Cierre: se conserva el botón blanco original hacia `#producto` y el aviso académico. Se retiran el enlace externo redundante y la nota de T12, sin crear otro diseño de sección.
- Los tres enlaces externos del HTML (navbar de escritorio, menú móvil y producto) usan URL exacta, `target="_blank"`, `rel="noopener noreferrer"`, icono discreto oculto a tecnologías de asistencia y anuncio de nueva pestaña para lectores de pantalla.

Validación focalizada:

- `npm run build`: PASS (TypeScript, Vite y prerender).
- `npm run test:demo-links`: PASS. Verifica CTA único en hero y cierre, accesos externos en navbar y producto, seguridad y anuncio accesible, aclaración asociada y destinos internos conservados.
- `npm run test:demo-links:browser`: NOT RUN para las interacciones de navegador a 1440/390/320 px. Chromium no pudo iniciar por una restricción del entorno (`sandbox_host_linux.cc: Operation not permitted`). Las aserciones sobre HTML generado sí pasaron. Quedan pendientes la composición renderizada, foco, comportamiento móvil y apertura real de pestañas; no se declara aprobación visual.

Cambios limitados a `src/App.tsx`, estilos locales de los accesos en `src/styles.css`, prueba focalizada `scripts/verify-demo-links.mjs` y este registro. Sin cambios en precios, IVA, simulación, componentes, animaciones, homelab, T12, T14, DNS o Cloudflare. Sin auditoría integral, commit, push, merge ni deploy.
