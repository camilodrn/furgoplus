# T12 — Navegación escalable de listados del conductor web

> **Revisión posterior de Ayuda:** la composición simultánea de Guías y solicitudes no fue aprobada. Sus filas y navegación de Ayuda descritas aquí quedan sustituidas por [vistas excluyentes centradas en tareas](TASK12_HELP_TASK_VIEWS_REVIEW.md). El resto de la matriz y la evidencia de esta entrega se conservan como registro histórico.

Entrega del 28-10-2026, **pendiente de aceptación humana en Fedora**. Se conserva
la aprobación visual provisional de Publicación, Solicitudes y Pagos. Este lote
agrega navegación de colecciones; no propone una nueva dirección visual.

## Matriz de listados revisados

| Vista / colección                                      | Resultado                                                                           | Alcance y motivo                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ayuda: guías                                           | **Paginación local nueva**, 5 por defecto; selector 5/10/20                         | Categorías en selector nativo, búsqueda por título, categoría y cuerpo, sin distinguir mayúsculas ni acentos. Se pagina la colección recibida para el acceso actual; no se divide el contenido de una guía. La agrupación por categoría comprende solo los resultados de la página visible.                                                                                                      |
| Ayuda: solicitudes propias de soporte                  | **Paginación de API conservada**, 25 por página, controles compartidos              | Usa exactamente `offset`, `limit=25` y `count` existentes. Muestra rango realmente recibido, página y total API sin filtrar. Búsqueda por asunto, número o estado y filtro de estado **solo sobre la página recibida**: ambos controles lo indican, al igual que los conteos. No hay total general de coincidencias porque la API no lo entrega. No descarga páginas adicionales para simularlo. |
| Ayuda: conversación de una solicitud                   | **Paginación local nueva de mensajes anteriores**, 10 por defecto; selector 5/10/20 | Conserva los tres mensajes recientes junto a la respuesta y el desplegable de mensajes anteriores. Al abrirlo, limita sus resultados. Todos los eventos recibidos siguen accesibles, en el orden entregado. Las operaciones de respuesta, versión y confirmación conservan su contrato.                                                                                                          |
| Rutas: listado de gestión                              | **Paginación local nueva**, 10 por defecto; selector 5/10/20 cuando hay más de 10   | El endpoint entrega una colección sin metadatos de paginación. Se mantienen orden, edición, activación y creación. El cambio está en el listado de Rutas de `PublicationScreens.tsx`; no modifica el diseño ni las acciones de Publicación.                                                                                                                                                      |
| Pasajeros: cupos por ruta                              | **Paginación local nueva**, 5 por defecto; selector 5/10/20 cuando hay más de 5     | Sustituye el crecimiento del panel y su altura máxima con scroll interno. El filtro nativo conserva todas las rutas; seleccionar una revela también su página de cupos. Esta página es independiente de la de pasajeros.                                                                                                                                                                         |
| Pasajeros: asignaciones                                | **Ya paginado**, 10 por defecto; selector 5/10/20                                   | Se conserva búsqueda, filtros y paginación. Se añade una explicación expresa de su alcance local sobre las asignaciones recibidas. No se modifican operaciones.                                                                                                                                                                                                                                  |
| Solicitudes de contacto                                | **Ya paginado**, 10 por defecto; selector 5/10/20                                   | Mantiene sus filtros y conteos sobre la bandeja recibida completa. Se añade el alcance local y se retira la altura máxima con scroll interno que quedaba en escritorio. No se modifica lectura, aceptación ni rechazo.                                                                                                                                                                           |
| Pagos manuales                                         | **Ya paginado**, 10 por defecto; selector 5/10/20                                   | Ya explica que búsqueda, páginas y resumen corresponden a los registros recibidos. Se reutiliza su patrón; no se modifica su vista, filtros, registro, importes ni transiciones.                                                                                                                                                                                                                 |
| Validación: historial de revisiones                    | **Paginación local nueva**, 10 por defecto; selector 5/10/20 cuando hay más de 10   | El servidor devuelve **hasta las 100 revisiones más recientes**, sin total ni continuación. Se informa esa limitación junto al listado. El conteo representa solo las revisiones recibidas, nunca el total histórico. Se mantienen los documentos y descargas de cada revisión.                                                                                                                  |
| Reportes: pagos del mes                                | **Paginación local nueva independiente**, 10 por defecto; selector 5/10/20          | Puede contener miles de registros aun estando limitado al mes. Usa únicamente la colección del reporte recibido, sin cambiar el reporte, sus totales de API ni sus exportaciones.                                                                                                                                                                                                                |
| Reportes: recorridos del mes                           | **Paginación local nueva independiente**, 10 por defecto; selector 5/10/20          | Mismo alcance mensual recibido. Cambiar su página no altera pagos ni solicitudes del reporte.                                                                                                                                                                                                                                                                                                    |
| Reportes: solicitudes de contacto del mes              | **Paginación local nueva independiente**, 10 por defecto; selector 5/10/20          | Mismo alcance mensual recibido. Los detalles de reportes tienen una salvaguarda existente de API de 10.000 registros por colección; no se cambia ni se interpreta como total.                                                                                                                                                                                                                    |
| Reportes: cupos actuales por ruta                      | **Paginación local nueva independiente**, 10 por defecto; selector 5/10/20          | El número de rutas puede crecer. Respeta la fecha `as_of` y el orden de API; no se confunde con ocupación histórica del mes.                                                                                                                                                                                                                                                                     |
| Inicio: resumen de rutas y actividad                   | **Sin nueva paginación**                                                            | El resumen ya muestra como máximo tres rutas y permite ir a todas. Los indicadores son un conjunto fijo. Inicio permanece sin rediseño.                                                                                                                                                                                                                                                          |
| Mi servicio / Documentos requeridos                    | **Sin paginación**                                                                  | Presentan requisitos y el documento actual por tipo del checklist, no cada versión acumulada. El acceso a versiones anteriores sigue en el historial de revisiones paginado. No es necesario dividir una ficha documental.                                                                                                                                                                       |
| Publicación: requisitos, estados y cobertura           | **Sin paginación**                                                                  | Son datos y requisitos de una ficha y un catálogo de selección, no una bandeja creciente. Sin rediseño de Publicación.                                                                                                                                                                                                                                                                           |
| Plan y reportes: beneficios, indicadores y comparación | **Sin paginación**                                                                  | Cantidad finita de capacidades y estados; solo las colecciones de registros y rutas necesitaban navegación adicional.                                                                                                                                                                                                                                                                            |
| Selectores de ruta, pasajero, comuna y categoría       | **Sin páginas artificiales**                                                        | Controles nativos de selección, sin desplegar todas sus opciones verticalmente como contenido de la página. Conservan las opciones entregadas y la selección por teclado.                                                                                                                                                                                                                        |
| Privacidad y Términos                                  | **Sin paginación; contenido e índice íntegros**                                     | Documentos completos con su índice navegable existente, foco a la sección y retorno al cerrar. Ningún cambio en fuentes legales, componente ni estilos legales. Se verifican con las pruebas que comparan todos los bloques con los Markdown originales.                                                                                                                                         |

La paginación local limita lo que se presenta; **no reduce la descarga ni constituye
paginación de servidor**. No se extrapolan totales de subconjuntos. Los resúmenes
operativos existentes conservan los valores que entrega la API.

## Estado y navegación

- Guías y soporte mantienen páginas independientes. Cambiar búsqueda, categoría o
  cantidad de guías reinicia esa colección en la primera página. El ajuste es
  inmediato y cubre toda la colección de guías recibida.
- Los criterios de soporte pertenecen expresamente a la página de API: modificarlos
  conserva esa página, y pasar a otra mantiene los criterios. Sus conteos de estado
  corresponden a los registros recibidos en la página antes de buscar. Un resultado
  local vacío no oculta el acceso a las demás páginas del servidor.
- Ir al asistente, volver a Guías/Mis solicitudes, abrir y cerrar un caso o cancelar
  una creación conserva búsquedas, filtros y páginas de ambas colecciones. La guía
  enlazada desde el asistente abre su categoría, su página y su contenido completo.
- Salir de Ayuda hacia otra sección del conductor y regresar conserva el estado en
  memoria del workspace. Se pausa la actualización de ayuda mientras está oculta;
  las respuestas tardías no deben mover el foco a esa vista. No se usan URL,
  `localStorage` ni `sessionStorage` para persistir búsquedas o datos de soporte.
  La frontera de sesión existente desmonta el workspace al salir, expirar o cambiar
  de cuenta. No se cambian permisos ni se crean nuevos mecanismos de sesión.
- Si una colección local se reduce, se ajusta la página al último resultado válido;
  al volver a crecer no reaparece una página descartada. Si una página de soporte
  queda fuera del nuevo `count`, se consulta la última válida de API (o la primera
  cuando queda vacía). No se modifican los datos para rellenarla.
- `CollectionPages` comparte el marcado y comportamiento anterior de `LocalPages`
  usado por Pagos. `LocalPages` sigue siendo su alias compatible. Cada navegación
  tiene nombre accesible propio; Anterior/Siguiente usan botones nativos y límites
  deshabilitados. El foco vuelve a los resultados de la colección correspondiente.
- Los listados nuevos usan el scroll normal. Se retiran alturas máximas de la banda
  de cupos y de la bandeja de Solicitudes; no se agregan contenedores de altura fija.
  Los controles se envuelven, las columnas existentes se apilan y los textos largos
  de Ayuda pueden partirse. Los diálogos existentes no se rediseñan.

## Verificación automatizada

Resultados finales: ver `docs/evidence/task12-scalable-lists/checks.json`.

Comandos ejecutados desde la raíz:

```bash
npm run test --prefix web -- --maxWorkers=2
npm run build --prefix web
npm run lint --prefix web
npm run contract:check --prefix web
npm run format:check --prefix web
git diff --check
```

También se ejecutó `21st review` sobre los 11 archivos de implementación y CSS
modificados: cero errores, cero advertencias; tres sugerencias informativas de
colores preexistentes en `operational.css`, que no se cambian en este lote. Se
consultó el catálogo 21st de paginación; el componente propio ya resolvía la
necesidad y no se instaló ninguna dependencia ni se generó una nueva propuesta.

Cobertura añadida: límites de guías de varias categorías; búsqueda en cuerpos y sin
acentos; cambios de tamaño y criterios; estados vacíos; independencia de páginas;
regreso desde detalle y cancelación sin escrituras; enlace de origen a una guía fuera
de la primera página; reducción del total de API hasta cero; conversación larga;
actualización de una colección que se reduce y vuelve a crecer; semántica nativa,
controles de límites y foco DOM; salida de Ayuda y retorno desde Inicio; limpieza
al cerrar sesión; páginas independientes en reportes; historial parcial con
descargas; gestión de rutas; cupos por ruta y acceso directo desde su selector.

Las pruebas DOM **no simulan el motor de layout ni la activación nativa con Tab,
Enter o Espacio de un navegador**. No se presenta esta evidencia como aceptación
visual, ni se afirman capturas o mediciones de overflow que no pudieron ejecutarse.

## Limitación de esta sesión y aceptación humana

El intento de iniciar Vite fue denegado por el sandbox (`listen EPERM`). Chromium
local también fue denegado (`sandbox_host_linux.cc`, `Operation not permitted`).
Las llamadas de Playwright MCP, incluida la navegación básica, fueron rechazadas
por el control de aprobación: `MCP tool call requires approval, but approval policy
is never`. No se solicitaron excepciones ni se alteró la política. Por ello, la
comprobación real de teclado y desbordamiento responsive queda pendiente en Fedora.

Guion de aceptación, con datos sintéticos en un entorno autorizado:

1. Abrir la aplicación a 1440, 768, 390 y 320 px; entrar a Ayuda desde el menú. Con
   más de 20 guías y más de 25 solicitudes, comprobar los dos paginadores, categorías,
   rangos y avisos de alcance. En móvil no debe haber desplazamiento horizontal.
2. Usar solo Tab/Shift+Tab, Enter y Espacio para categorías, búsqueda, apertura de
   guías y paginadores. Comprobar foco visible, orden natural, límites deshabilitados
   y retorno a los resultados de la colección correcta, también al volver de un caso.
3. Buscar una palabra con acento escrita sin él y una frase del cuerpo de una guía.
   Cambiar categoría y tamaño desde una página posterior: guías vuelve a la primera;
   soporte conserva su página. Comprobar búsqueda sin resultados y recuperación.
4. Filtrar soporte por estado y asunto, incluyendo cero coincidencias en una página
   con resultados en otra. Verificar que Siguiente sigue disponible y que no aparece
   un supuesto total general filtrado. Volver de un caso, cancelar un borrador, pasar
   al asistente, ir a Inicio y volver: criterios y páginas deben conservarse.
5. Abrir desde el asistente una guía que esté después de la primera página; comprobar
   su categoría, contenido completo y foco. Abrir una conversación larga y recorrer
   todos los mensajes anteriores sin perder los tres recientes ni el formulario.
6. Revisar Rutas, cupos por ruta de Pasajeros, historial de revisiones y las cuatro
   colecciones de reportes con varias páginas. Confirmar límites y orden, acceso a
   edición/descarga, selectores que siguen accesibles tras elegir un tamaño mayor
   que la colección y ausencia de contenedores de scroll anidados nuevos.
7. Abrir Privacidad y Términos, recorrer el índice, ir a la última sección y cerrar
   por teclado. Comprobar documento íntegro y retorno de foco. Cerrar sesión y
   verificar que no queda el estado de Ayuda al entrar con otra cuenta.

## Alcance y cierre

Solo web y documentación de esta entrega. Los cambios de `PublicationScreens.tsx`
se limitan al listado de Rutas. Los cambios de `DriverOperations.tsx` se limitan a
Pasajeros; Pagos e Inicio no cambian. No se modifican backend, API, tipos generados,
contratos, datos, permisos, Flutter, Task 13, Task 14 ni demo r4. Se preserva el trabajo
previo sin commit presente al comenzar esta sesión; no debe atribuirse a este lote.
No se ejecutan commit, push, merge ni deploy. Se detiene T12 para aceptación humana.
