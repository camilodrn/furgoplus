# T12 — Mi servicio: panel operativo con filas y divisores

Fecha: **27 de octubre de 2026**, America/Santiago. Rama: `task/12-plan-capabilities`.

**Implementado para aceptación visual humana en Fedora. Aún no aceptado visualmente.**

El usuario aprobó la dirección A de la [exploración visual](design/task12-mi-servicio/README.md), incorporando las filas y divisores de B. También precisó que la publicación de una cuenta aprobada y visible debe ser compacta: el protagonismo corresponde a las intervenciones, no a un banner permanente de éxito. Esta decisión queda registrada en [el contexto de diseño](../.21st/design.json).

## Alcance y fuentes inspeccionadas

Se revisaron `ServiceOverview.tsx` y sus pruebas, `ValidationScreens.tsx`, `App.tsx`, `style.css`, los componentes de disponibilidad y bloqueos de `DriverExperience.tsx`, los contratos generados existentes y las pruebas de navegación, publicación, guardado y privacidad. Se mantuvieron React 19, TypeScript, CSS propio, los tokens de FurgoPlus y sus controles nativos; no se añadieron dependencias.

Los ocho escenarios de la maqueta no se copiaron a la aplicación. La pantalla consume el perfil, checklist, documentos, historial y publicación que ya cargaba la aplicación. Los nuevos ejemplos de estados existen únicamente en pruebas con API simulada.

## Qué cambió

- **Ancho solo del resumen:** el contenedor principal de Mi servicio admite hasta **1520 px**, incluidos sus márgenes interiores. El menú lateral actual conserva sus 240 px. En una ventana de 1920 px, el contenido útil puede ocupar 1472 px frente a los 1072 previos; a 1440 px, 1152 frente a 1072. Son medidas derivadas del CSS, pendientes de comprobar en el navegador de Fedora. El resto de pantallas y los editores mantienen su ancho anterior.
- **Estados compactos:** revisión y publicación usan una franja con etiquetas separadas y divisores. Una cuenta aprobada, visible y sin pendientes ofrece Consultar publicación con botón secundario. No aparece un banner de éxito ni una tarjeta grande para estos estados.
- **Intervención primero:** el bloque Requiere atención se muestra cuando hay suspensión/desactivación/inactividad, cambios solicitados, requisitos incompletos, bloqueos de publicación o un envío pendiente de realizar. Los mensajes de bloqueo permanecen visibles, con acciones hacia sus destinos existentes.
- **Cambios solicitados:** el resumen muestra las observaciones de la revisión rechazada que coincide con la versión actual del perfil. Destaca Revisar cambios solicitados y permite Corregir información; los documentos siguen siendo accesibles. Las observaciones de versiones anteriores permanecen en el historial y no se sustituyen por las actuales en el resumen.
- **Dos áreas, una superficie:** Documentos tiene mayor ancho que Datos del servicio, separados por un divisor. Cada documento y cada dato son filas, sin tarjetas individuales ni sombras. El resumen muestra los valores reales del servicio y una indicación general de datos completos, en lugar de repetir Completado para cada campo.
- **Fechas a la vista:** los documentos pendientes o sin fecha requerida aparecen primero; después, los que tienen fecha, ordenados por la fecha informada; al final, los demás archivos cargados. Las fechas usan `time` con el valor ISO original y la presentación chilena existente.
- **Gestión secundaria:** revisión/historial y rutas forman dos filas de acceso con separadores. Publicación permanece junto a su estado o a la intervención que la requiere. No cambió ningún destino de navegación.

La selección de acción principal conserva la indisponibilidad como primera prioridad. Para una cuenta rechazada, la revisión de observaciones tiene prioridad visual sobre actualizar documentos; si también hay un vencimiento, su aviso y su acceso a documentos se mantienen. Esto cambia la jerarquía de las acciones, no la elegibilidad, los permisos ni los requisitos del servidor.

### Fechas y significado de los estados

La API actual entrega `expires_on` y bloqueos generales como `required_document_expired`. **No entrega una categoría «por vencer» ni identifica en ese bloqueo qué archivo concreto venció.** Por ello, la interfaz destaca fechas y ordena los documentos sin inventar un plazo de aviso, llamar Vigente a un archivo o asignar un vencimiento a un documento por deducción. No utiliza la fecha del navegador para decidir vigencia o publicación.

Una revisión Aprobado sigue siendo independiente de la publicación y del estado de la cuenta. Sin respuesta de publicación se muestra Sin confirmar. Todos los documentos requeridos, las fechas ausentes y los bloqueos conservan su información visible.

## Responsive y accesibilidad

- Grilla de documentos y datos de aproximadamente 1,4:1, sin anchos mínimos que obliguen a desplazar la página horizontalmente.
- A 1150 px o menos, nombre y estado/fecha de cada documento pasan a dos líneas. A 700 px o menos, documentos y datos se apilan; también los accesos secundarios. A 420 px o menos, las acciones contextuales ocupan el ancho disponible.
- Se conservan el menú móvil existente, el salto al contenido, el foco en el encabezado al navegar y los borradores de los editores montados. No se añadió contenido fijo sobre la pantalla ni animación decorativa.
- Controles de al menos 48 px de alto mediante el patrón existente; foco visible, encabezados jerárquicos, listas y pares etiqueta/valor semánticos. Textos, nombres, observaciones y correos largos pueden partirse sin truncamiento.
- Colores existentes para texto, marca, atención y aprobación; los estados tienen nombres escritos. Los contrastes calculados en la exploración siguen aplicando a esos tokens. La revisión con lector de pantalla, zoom y navegador real sigue pendiente.

## Verificación ejecutada

Comandos desde `web/`, salvo indicación:

| Comprobación                                                                                              | Resultado                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- src/ServiceOverview.test.tsx src/ValidationScreens.test.tsx src/App.test.tsx --maxWorkers=1` | **95/95**, tres archivos.                                                                                                                                                                               |
| `npm test -- --maxWorkers=1`                                                                              | **328/328**, 20 archivos, 82,87 s. Conserva las 318 pruebas previas y añade diez.                                                                                                                       |
| `npm run typecheck`                                                                                       | Código 0.                                                                                                                                                                                               |
| `npm run build`                                                                                           | Código 0; TypeScript y Vite completados. Solo artefactos locales ignorados de compilación.                                                                                                              |
| `npm run lint`                                                                                            | Código 0.                                                                                                                                                                                               |
| `npm run contract:check`                                                                                  | Código 0; sin regenerar contratos.                                                                                                                                                                      |
| Prettier sobre los seis archivos web modificados y el contexto/documentación añadidos                     | Código 0.                                                                                                                                                                                               |
| `git diff --check`, raíz                                                                                  | Código 0.                                                                                                                                                                                               |
| `21st review` sobre los cuatro archivos fuente modificados                                                | **0 errores, 0 advertencias**. Sus 75 sugerencias informativas señalan colores literales del CSS general existente; no se aplicaron cambios ajenos a esta pantalla.                                     |
| Manifiesto SHA-256 al inicio y al cierre                                                                  | De **349 archivos previos**, cambian únicamente los seis archivos web de esta implementación. Los **343 restantes** conservan su contenido, incluidos backend, contratos, Flutter y exploración visual. |

Los ajustes iniciales de pruebas sustituyeron la expectativa de tres etiquetas Completado por los valores reales del servicio y la comprobación de la fecha por un elemento `time`. También se verificó que una consulta sin pendientes sea secundaria únicamente cuando el servicio está aprobado y visible. Los primeros tres fallos fueron consultas que esperaban la fecha como un único nodo de texto; se adaptaron a su marcado semántico y las ejecuciones finales pasan.

### Estados cubiertos

| Tipo de estado                 | Evidencia automatizada                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aprobado y publicado           | Estado compacto, consulta secundaria, valores reales y documentos visibles; navegación al editor y foco al regresar.                                                      |
| Aprobado no publicado          | Se distingue solicitud registrada de ausencia de solicitud; consulta de publicación disponible.                                                                           |
| Publicación desconocida        | Sin confirmar; no se deduce visibilidad de la aprobación.                                                                                                                 |
| Pendiente de revisión          | Acceso al envío existente; no se ofrece un segundo envío.                                                                                                                 |
| Cambios solicitados            | Observaciones de la versión actual, acceso prioritario a revisión y corrección; bloqueos simultáneos visibles; versiones anteriores solo en el historial correspondiente. |
| Datos o documentos incompletos | Siguiente tarea accesible, archivos antiguos excluidos, fecha requerida ausente mostrada explícitamente.                                                                  |
| Documento vencido              | Aviso del servidor y acceso a actualización, manteniendo otros bloqueos. Fechas de prueba pasadas/futuras no generan veredictos locales.                                  |
| Suspensión                     | Estado independiente de aprobación; también cubre desactivación y cuenta inactiva, con y sin bloqueo coincidente.                                                         |

Las pruebas nuevas verifican además errores de lectura 403/503 y reintento; guardado fallido con error asociado al campo y borrador conservado; reintento explícito exitoso y reflejo del estado devuelto por el servidor. Las pruebas existentes ejecutadas cubren descarga privada denegada, roles de la web, aislamiento de sesión, reemplazo de cuenta, caducidad, navegación a publicación/rutas y flujos de revisión, carga y guardado. No se ampliaron permisos ni se sustituyeron validaciones de la API.

Las comprobaciones se ejecutan con API simulada y jsdom. No demuestran aceptación visual en Fedora ni equivalen a escribir o probar datos académicos reales.

Logs y manifiesto de esta fase: `/tmp/furgoplus-service-panel/`, en particular `react-final.log`, `targeted-final.log`, `typecheck.log`, `build.log`, `lint.log`, `contracts.log`, `21st-review-final.json`, `before.json` y `preservation-result.json`.

## Revisión visual en Fedora

Usar el entorno académico ya disponible en `http://127.0.0.1:15173`, con una sesión autorizada. Esta fase no inicia ni reinicia contenedores. Si se muestra una versión anterior, comprobar qué checkout está sirviendo el proceso existente antes de atribuirla a estos cambios. No publicar credenciales ni capturas con información privada.

1. **Cuenta aprobada y publicada:** abrir Mi servicio desde el menú actual. Deben verse encabezado, franja compacta de revisión/publicación, documentos y datos en dos áreas. Consultar publicación es secundaria cuando no hay pendientes. No debe aparecer un banner permanente de éxito, formulario de alta o una tarjeta por documento.
2. **Escritorio:** revisar 1920×1080, 1440×900 y 1280×800. El área crece con equilibrio, el menú permanece igual y fechas, texto y acciones no se pisan. Documentos debe tener más peso visual que datos; los accesos a revisión e historial y rutas siguen siendo fáciles de encontrar.
3. **Tablet y móvil:** comprobar 768×1024, 390×844 y 320 px. En móvil aparecen primero los estados y pendientes, después documentos, datos y accesos. No debe haber desplazamiento horizontal de la página, contenido cortado ni botones superpuestos.
4. **Rechazo y suspensión:** con cuentas ya disponibles para estos estados, verificar el bloque Requiere atención y las observaciones de la revisión actual. Revisar cambios solicitados debe abrir revisión/historial; Corregir información, el editor existente. Una suspensión no debe confundirse con el resultado de la revisión. No preparar, alterar ni suspender cuentas para generar estos casos.
5. **Vencimientos y requisitos:** en estados ya existentes, comparar las fechas con las de Documentos y verificar los mensajes de bloqueos y fechas ausentes. No debe aparecer una etiqueta de vigencia calculada por el navegador. Si no existen estos estados en las cuentas autorizadas, su cobertura queda en las pruebas simuladas hasta disponer de un escenario autorizado.
6. **Navegación y borradores:** abrir Editar datos y Revisar documentos; comprobar avisos existentes de nueva revisión y regreso al resumen. Se puede revisar la conservación de un borrador sin guardarlo. Las pruebas automáticas ya verificaron guardado y errores; esta aceptación visual no requiere guardar, subir archivos o enviar revisiones sobre datos académicos.
7. **Accesibilidad:** recorrer acciones con Tab/Shift+Tab y Enter/Espacio, abrir/cerrar el menú móvil con Escape, comprobar foco al regresar al resumen y zoom 200–400 %. Con lector de pantalla, verificar nombres de regiones, encabezados, campos, estados y fechas. Probar textos largos en un escenario autorizado o revisar esa condición sin modificar datos existentes.
8. **Al salir:** abrir Inicio, Solicitudes, Pagos y Plan y reportes. Deben conservar su disposición anterior; los editores también recuperan su ancho previo. Administración mantiene sus pantallas y navegación por rol.

Playwright MCP anunció disponibilidad, pero el intento de abrir la URL local fue rechazado por la revisión automática: **«MCP tool call requires approval, but approval policy is never»**. No se obtuvo una sesión académica ni se intentó eludir ese rechazo. No hay capturas nuevas de la aplicación real ni una afirmación de validación de geometría en navegador.

## Archivos y punto de detención

Modificados en esta fase:

- `web/src/ServiceOverview.tsx`: composición y jerarquía visual del resumen, datos y observaciones.
- `web/src/style.css`: sustitución de estilos del resumen por reglas acotadas a Mi servicio.
- `web/src/App.tsx`: clase de ancho ampliado únicamente cuando está activo el resumen del conductor, fuera de Ayuda.
- `web/src/ValidationScreens.tsx`: entrega de observaciones de la revisión actual al resumen.
- `web/src/ServiceOverview.test.tsx` y `web/src/App.test.tsx`: estados, errores, guardado y alcance de la presentación.

Añadidos: este informe y `.21st/design.json` / `.21st/DESIGN.md` para registrar la dirección aprobada. La exploración anterior se conserva como antecedente; sus imágenes no representan la implementación final ni su aceptación.

**Detenido para aceptación visual humana.** Sin cambios a backend, contratos, datos académicos, Flutter, Task 13, Task 14 o demo r4. Sin reinicios, commit, push, merge, publicación o deploy. Las otras pantallas operativas no se rediseñaron.
