# T12 — Ayuda por tareas excluyentes

**Pendiente de aceptación visual humana.** Sustituye únicamente la composición de
Ayuda descrita en `TASK12_SCALABLE_LISTS_REVIEW.md`; los demás listados de ese lote
se conservan. No se modifica el prototipo aprobado ni se lo presenta como una
nueva propuesta estética.

## Comprobación académica antes de editar

Se confirmó la rama `task/12-plan-capabilities`. Antes de cambiar código se intentó
leer `http://127.0.0.1:15173/` y consultar el contenedor académico: los sockets y
Docker de esta sesión fueron denegados. No había navegador conectado en CUA. Se
solicitó al usuario una comprobación de solo lectura desde Fedora; su respuesta
confirmó:

- Contenedor: `furgoplus-task12-academic-web-1`, imagen `furgoplus-task12-academic-web`,
  en ejecución (`Up 4 minutes` en el momento de la lectura).
- `web/src/HelpSupport.tsx` del host y `/app/src/HelpSupport.tsx` del contenedor tenían
  la misma huella SHA-256:
  `62a9f9e8c5974692206184ba924f631084dcc23ecb9153c99818dbd4cecf20b2`.
- El módulo HTTP servido incluía `const showCases = section === "tickets" || driver
&& section === "help"`, `driver-help-layout`, `Páginas de guías` y
  `support-local-filters`.

**Conclusión comprobada en Fedora:** el servidor sí servía la implementación
anterior con paginación. Esa misma implementación disponía mostrar solicitudes
cuando estaba activa Guías. El rechazo humano señala un problema real de
composición presente en el código servido, no una ausencia demostrada de aquellos
cambios en el servidor. Esta lectura no acredita por sí sola la caché de una
pestaña concreta.

El Compose académico usa `web/Dockerfile`, que copia `web/` a la imagen y arranca
Vite; no monta el código del host. El recurso relevante es el módulo servido por
Vite, no el hash de `web/dist/assets/`. Un build local no actualiza ese contenedor.
No se ejecutó rebuild, copia al contenedor, reinicio ni deploy académico.

## Composición implementada

| Estado                       | Contenido visible                                                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada / Guías              | Título y navegación compacta, selector de tema, búsqueda y aviso de atención plegado. Sin bandeja, sin catálogo vertical ni resultados hasta elegir un tema o buscar.                                           |
| Tema o búsqueda              | Solo títulos de resultados de ese criterio. Las páginas locales aparecen cuando hacen falta para la colección de resultados; 5 por defecto y selector 5/10/20. No se renderizan los cuerpos de las otras guías. |
| Guía seleccionada            | Un único artículo íntegro, categoría, versión y regreso a sus resultados. Se retiran búsqueda, lista y paginación mientras se lee.                                                                              |
| Mis solicitudes              | Una bandeja con su búsqueda y filtro de estado, rango y páginas de la API existente, más la acción de crear. Sin guías simultáneas.                                                                             |
| Caso seleccionado o cargando | Detalle del caso o indicador de carga. La bandeja y sus filtros desaparecen inmediatamente, también durante la lectura pendiente. Se conserva el regreso a Mis solicitudes.                                     |
| Creación                     | El formulario real de soporte, sin bandeja ni guías debajo. Conserva revisión del texto, consentimiento, gravedad, confirmación y cancelación.                                                                  |
| Asistente                    | Mantiene su consulta y permisos reales. El enlace a una guía abre directamente el artículo íntegro; la derivación conserva el formulario revisado existente.                                                    |

Guías y Mis solicitudes son vistas excluyentes también en escritorio. En móvil se
usa el mismo recorrido progresivo; los controles se apilan y la navegación de las
tres tareas se ajusta al ancho. No se añaden alturas fijas ni scroll anidado.
Se reutilizan superficies, divisores, colores, botones y paginación del sistema
A · Panel operativo + filas de B. El artículo mantiene una medida de lectura.

## Estado, datos y accesibilidad

- Búsqueda, tema, página de resultados y guía seleccionada viven en `HelpSupport`,
  de modo que cambiar de tarea no desmonta su estado. Volver desde una guía conserva
  sus criterios y lleva el foco a su resultado. Cambiar tema, búsqueda o tamaño
  reinicia solo la página de resultados correspondiente.
- Mis solicitudes conserva filtro, búsqueda y offset al volver de un caso, cancelar
  un formulario o cambiar de tarea y de destino del workspace. Guías no precarga la
  bandeja: esta se consulta al entrar en Mis solicitudes. Las lecturas de casos se
  invalidan al salir para que una respuesta tardía no invada otra tarea.
- La API de soporte mantiene páginas de 25 con `offset`, `limit` y `count` existentes.
  Sus criterios siguen siendo locales a la página recibida y se indica ese alcance.
  No se inventan totales filtrados generales ni se alteran estados o escrituras.
- Los botones son nativos y las tareas tienen `aria-current`. Se comprueba el foco
  al abrir una guía, regresar a sus resultados y cambiar páginas de la bandeja.
  No se agregan índices de tabulación positivos ni controles duplicados ocultos.
- Los permisos, datos y contratos de API no cambian. Los documentos legales íntegros,
  el índice legal, Inicio, Publicación, Pagos y demás listados quedan como estaban.

## Verificación de esta entrega

- Base antes de editar: **75/75** pruebas de Ayuda, sesión y workspace.
- Pruebas pertinentes actualizadas: **76/76**.
- Regresión completa final: **369/369**, 20 archivos, con dos workers.
- Build de TypeScript/Vite, lint, contratos y formato web: correctos.
- `21st review` de los cuatro archivos de implementación/CSS: cero hallazgos.
- La comprobación de preservación y las huellas finales se registran en
  `docs/evidence/task12-help-task-views/`.

Se verifican exclusión de tareas y de lista/detalle incluso durante cargas;
contenido íntegro único; categorías, búsqueda sin acentos y en cuerpos completos;
paginación solo de resultados; estados vacíos; retorno a páginas y filtros;
cancelación sin escrituras; mensajes anteriores; respuesta tardía descartada;
fuente del asistente y foco; conservación al salir a Inicio y limpieza de sesión.
Las pruebas previas de operaciones, permisos y documentos legales siguen pasando.

## Comprobación posterior en Fedora y aceptación pendiente

La segunda comparación **ya fue realizada por el usuario en Fedora** después de
implementar el cambio. Dio como resultado **imagen desactualizada**:

- Host: `HelpSupport.tsx` nuevo `27f1ad31…`; contenedor: anterior `62a9f9e8…`.
- `DriverHelpGuides.tsx` existe en el host y falta en `/app/src/` del contenedor.
- Ambos CSS conservan en el contenedor las huellas anteriores.
- El HTTP aún contiene `showCases` con `driver && section === "help"` y
  `driver-help-layout`; no aparecen las marcas del módulo de guías nuevo.
- El usuario confirma que las capturas siguen siendo las de la interfaz anterior
  y que todavía no ha revisado el flujo nuevo a 390 px ni con teclado.

Por tanto, **la implementación nueva no está servida todavía en el académico y la
aceptación visual continúa sin aprobarse**. La evidencia de ambas comparaciones
está en `fedora-verification.json`; las huellas locales están en `checks.json`.

A petición del usuario se entrega el [procedimiento acotado para reconstruir solo
web y verificar huellas, HTTP y navegación en Fedora](TASK12_ACADEMIC_FRONTEND_REFRESH.md).
Su sintaxis Bash y sus opciones CLI se comprobaron; no se ejecutó contra Docker.
Usa el guard de configuración existente, evita reiniciar dependencias y compara
DB/backend antes y después. No requiere modificar datos existentes.

Después de confirmar las huellas, revisar en Fedora:

1. Entrar en Ayuda a 1440 y 390 px: ninguna bandeja ni lista de guías inicial. Una
   búsqueda o la elección de un tema revela títulos. Abrir uno sustituye la lista
   por un solo contenido completo, sin páginas del artículo. Volver conserva criterio
   y página y devuelve foco al resultado.
2. Entrar en Mis solicitudes: Guías desaparece. Cambiar filtro, buscar y pasar una
   página; abrir un caso y volver. El detalle y la bandeja no deben coexistir.
   Preparar una creación y cancelar sin enviarla.
3. Cambiar entre tareas y salir a Inicio y volver: verificar selección de guía,
   filtros y página. Desde el asistente abrir una guía de origen.
4. Recorrer con Tab/Shift+Tab y activar con Enter/Espacio, a 390 y 320 px. Confirmar
   foco visible, contenido accesible, ausencia de desbordamiento horizontal y scroll
   normal. Revisar también un artículo largo y un resultado vacío.

El motor de layout y el teclado nativo de Fedora requieren navegador o confirmación
humana; las pruebas DOM no los sustituyen. No se declara aceptación visual por
pruebas automatizadas ni por la verificación de huellas del servidor.

Sin cambios en backend, Flutter, Task 13, Task 14, demo r4 o datos académicos. Sin
commit, push, merge ni deploy. Detención para aceptación visual humana.
