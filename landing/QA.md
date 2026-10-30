# Task 13 · Segunda iteración: verificación y revisión humana

> Informe histórico. La clasificación de capacidades de planes fue corregida el 28 de octubre de 2026; consultar [CONTENT_REVIEW.md](CONTENT_REVIEW.md) y [ACCEPTANCE_FEDORA.md](ACCEPTANCE_FEDORA.md) para el estado vigente.


## Alcance de la evidencia

El usuario confirmó que abrió y revisó **la primera versión** en Fedora, a resolución de escritorio, y valoró la identidad editorial, los colores, el hero SVG y la demo. Esa observación orienta este refinamiento. **No se atribuye esa aprobación a la segunda iteración ni a móvil/tablet.**

Los cambios de esta entrega se limitan a `landing/`. No se hicieron commits, push, merge, deploy, cambios en otros worktrees, Task 12, aplicación privada, planes efectivos, bases, Docker, homelab, DNS o Cloudflare.

## Cambios para revisar

| Aspecto       | Segunda iteración                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lectura       | Cuerpo 18 px, apoyo 16–17 px y metadatos HTML de al menos 14 px en rem. No se reducen las interfaces mediante escala.                                                                                                       |
| Ancho y ritmo | Contenido máximo 1360 px; demo 1440 px. Secciones de 80 px de padding vertical en escritorio, 68 en tablet y 56 en móvil, frente a 112 px iniciales. Los elementos crecen cuando necesitan envolver texto.                  |
| Demo          | Pasa a continuación de la propuesta. Dashboard y teléfono más grandes; se apilan hasta 1000 px. Teléfono de hasta 340 px sin transformaciones de escala.                                                                    |
| Identidad     | Logo existente de la app, copiado sin alteraciones; azul compartido `#0752AC`. Arte original del hero, superficies y tipografía editorial conservados. Logo del footer sobre una base clara para mantener el arte original. |
| Planes        | Funciones agrupadas por disponibilidad y explicación inmediata de lo que es futuro. Precios y capacidades conservados. No se inventa estado “en prueba”.                                                                    |
| Proyecto      | Noviembre 2026 y Feria 2027 quedan en “Sobre el proyecto”, dentro del footer. No ocupan una sección comercial.                                                                                                              |
| CTA           | Destinos internos revisados. Los logos ilustrativos del producto dejan de navegar al inicio. Matriz en `CONTENT_REVIEW.md`.                                                                                                 |
| Privacidad    | Se distingue el código sin formularios/analítica/persistencia de los datos técnicos que el servidor puede recibir y registrar. Recursos locales, incluido el logo.                                                          |

La tipografía de una imagen de marca y los detalles decorativos dentro del SVG no son texto HTML de interfaz; los metadatos y explicaciones que la acompañan sí se ampliaron. El tamaño efectivo, los saltos de línea y el equilibrio visual requieren evaluación renderizada.

## Resultados ejecutados

| Comprobación                      | Resultado y límite                                                                                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                   | Aprobado: TypeScript estricto, bundle y prerender de todo el contenido.                                                                                                                                                                                         |
| `npm run verify`                  | Aprobado: titular exacto, estructura, anchors, referencias ARIA, nombres de botones, recursos HTML/CSS locales, identidad del logo, precios conservados, estados y proyecto secundario. Revisa también ausencia de código de red/persistencia propio en `src/`. |
| `npm run test:interactions`       | Aprobado en jsdom: hidratación, recorridos, perfiles, CTA por audiencia, flechas/Home/End, menú/Escape, contenido visible con preferencia de movimiento reducido y selección del contenido de privacidad/proyecto.                                              |
| Diálogo en jsdom                  | Se prueba la selección de contenido y callbacks con métodos simulados. **No** demuestra focus trap nativo, navegación real, layout ni experiencia con lector de pantalla.                                                                                       |
| Imagen social PNG                 | Generada con el logo autorizado e inspeccionada. No es una captura de la landing.                                                                                                                                                                               |
| Formato                           | Fuentes de código, scripts y documentos revisados con Prettier.                                                                                                                                                                                                 |
| `npm run dev`                     | Bloqueado: `listen EPERM: operation not permitted 127.0.0.1:4313`.                                                                                                                                                                                              |
| Inventario de navegador conectado | Sin apps ni browsers disponibles.                                                                                                                                                                                                                               |
| `npm run test:browser`            | Intentado y bloqueado al iniciar Chromium: `FATAL:content/browser/sandbox_host_linux.cc:41 ... Operation not permitted`. **Ningún caso de navegador se declara aprobado.**                                                                                      |

Los checks DOM y el examen de fuentes apoyan la declaración de privacidad del código; no acreditan la política de un hosting futuro ni sustituyen un registro de tráfico del sitio servido. Vite, durante desarrollo, utiliza además una conexión local para recarga; no es parte del build público.

El JS se mantiene en torno a 237 kB sin comprimir (~74 kB gzip) y el CSS en torno a 50 kB (~11 kB gzip). Las dos fuentes WOFF suman ~666 kB. Se añade el logo original (~345 kB), compartido por todas sus apariciones mediante la misma URL; no se incorporan nuevas bibliotecas, CDN, video ni animaciones continuas. El SVG fuente de la imagen social embebe ese arte para generar el PNG; no se carga como parte de la interfaz normal.

## Suite de navegador preparada

Después de construir:

```bash
cd ~/Proyectos/furgoplus-landing/landing
npm run test:browser
# O indicar un Chromium/Edge compatible ya instalado:
LANDING_BROWSER_PATH=/usr/bin/microsoft-edge npm run test:browser
```

La suite usa Playwright Core e interceptación local de `dist/`. No abre puertos, usa el navegador del usuario ni consulta cuentas, APIs o datos privados. Comprueba once anchos: **1920, 1440, 1280, 1024, 960, 820, 768, 720, 390, 360 y 320 px**.

Está preparada para detectar overflow, texto HTML visible menor a 14 px, imágenes sin cargar, dispositivos reducidos mediante escala, menú en su breakpoint, errores de runtime y solicitudes externas. También prueba selección de audiencias/perfiles/recorridos, disclosures, tabla en móvil, diálogo/foco/Escape, FAQ, cookies/almacenamiento y movimiento reducido, incluido el cambio de preferencia durante la sesión.

Las capturas de once tamaños se guardan en `qa-artifacts/`, ignorado por Git. Si Chromium no inicia, se guarda el diagnóstico y se informa que los casos **no se ejecutaron**. En este entorno no hay capturas de la segunda landing ni puntuaciones Lighthouse/axe.

## Revisión humana pendiente

```bash
npm run dev
```

Abrir **http://127.0.0.1:4313** en Fedora con zoom normal. Luego comprobar zoom al 200%, texto aumentado y un dispositivo táctil.

1. **Escritorio:** lectura cómoda de metadatos, enlaces, explicaciones y planes; ancho y espaciado equilibrados. El titular y la identidad general deben seguir siendo reconocibles.
2. **Demo:** dashboard y teléfono con textos legibles, sin solapamientos. Verificar ambas audiencias, ida/regreso y perfil A/B; los datos son ficticios.
3. **Tablet/móvil:** probar los breakpoints 1000/960/800/700/370 px, apilado, menú, tabla horizontal dentro de su región y footer. Evitar overflow del documento o recortes de texto.
4. **Marca:** logo autorizado visible en header, footer, dashboard y teléfono, sin deformación; consistencia del azul con el producto. La imagen social y favicon se revisaron como archivos, no en todas las superficies del navegador.
5. **Planes:** precios conservados y distinción inmediata entre gestión disponible y funciones futuras. Leer también la comparación y la explicación secundaria de estados.
6. **Teclado:** skip link, orden de foco, botones/enlaces, pestañas con flechas/Home/End, disclosures con Enter/Espacio, navegación dentro del diálogo y devolución del foco al cerrarlo.
7. **Movimiento reducido:** sin entrada, trazo progresivo ni scroll suave. Probar también cambiar la preferencia mientras la página está abierta. No se añadieron animaciones decorativas.
8. **Accesibilidad renderizada:** contraste de texto y foco en superficies claras/oscuras, tamaños efectivos, zoom, lector de pantalla y targets táctiles. No hay auditoría formal WCAG aprobada.
9. **Privacidad:** revisar Network/Application con el build servido: únicamente recursos del mismo origen, sin cookies/almacenamiento creados por la landing ni llamadas de terceros. El eventual hosting puede mantener registros técnicos, como se explica públicamente.
10. **Proyecto:** Feria 2027 accesible en “Sobre el proyecto” y expresada como aspiración, sin sugerir validación comercial ya obtenida.

La entrega se detiene para esta revisión humana, sin publicación. Se mantiene `noindex, nofollow` y el bloqueo de robots de la versión de revisión.
