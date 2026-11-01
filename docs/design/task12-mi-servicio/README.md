# FurgoPlus: tres direcciones para Mi servicio

Exploración del 27 de octubre de 2026, rama `task/12-plan-capabilities`. **Pendiente de elección humana. No implementado en la aplicación.**

Recomendación: **A · Panel operativo**. Da prioridad a entender el estado y encontrar la siguiente acción; mantiene los documentos y sus fechas a la vista. B es preferible si se busca una experiencia de ficha continua. C sirve mejor para una gestión frecuente y especializada, con mayor coste de navegación.

## Abrir y comparar

- [Maqueta HTML independiente](index.html): abrir en un navegador y elegir A, B o C en la barra superior. El selector permite explorar ocho estados ficticios. Menú móvil, accesos y navegación interna funcionan como simulación; no hay guardado ni conexión a la API.
- [Comparativa visual](comparativa.png).

| Dirección                 | Escritorio, 1440 × 1040                  | Móvil, 390 × 1840            |
| ------------------------- | ---------------------------------------- | ---------------------------- |
| A · Panel operativo       | [Ver propuesta](a-panel-operativo.png)   | [Ver propuesta](a-movil.png) |
| B · Ficha clara           | [Ver propuesta](b-ficha-clara.png)       | [Ver propuesta](b-movil.png) |
| C · Gestión por secciones | [Ver propuesta](c-gestion-secciones.png) | [Ver propuesta](c-movil.png) |

Los PNG son composiciones estáticas dibujadas para evaluar la dirección, **no capturas del HTML ni de la interfaz local real**. El HTML expresa el comportamiento responsive propuesto; no se ha comprobado su geometría con un navegador. Las vistas de móvil son páginas largas, no un único viewport. El detalle de algunas filas difiere entre la composición estática y el HTML; no constituyen una especificación de medidas finales.

## Qué se inspeccionó

- `web/package.json`: React y React DOM 19.2.8; Vite 7.3.6, TypeScript 6.0.2. Sin Tailwind, shadcn, biblioteca de iconos o biblioteca de componentes. No existe `components.json` ni contexto `.21st` previo en el checkout.
- `web/src/style.css`: fuente de sistema, texto base de 18 px, tokens semánticos ya disponibles y azul `#0752ac`. Menú lateral de 240 px; `.workspace-shell .workspace` limitada a 1120 px, incluidos sus 48 px de padding horizontal. En un escritorio de 1920 px deja sin usar buena parte del área disponible. Cambiar solo colores o radios conservaría ese problema.
- `ServiceOverview.tsx`: dos estados en un panel, acción principal separada, dos paneles equivalentes de información y acciones al final. El componente distingue correctamente aprobación y publicación; la exploración conserva esa distinción.
- `App.tsx`: navegación global más accesos a Publicación y Rutas anidados permanentemente en Mi servicio. Ambos destinos aparecen también en el contenido; esa repetición debilita la ubicación de las tareas.
- `DriverExperience.tsx`, `ValidationScreens.tsx`, `DriverHomeStatus.tsx`, `task12.css`, pruebas de Mi servicio e informe de la corrección anterior. Ya existen foco al navegar, avisos de disponibilidad y bloqueos, borradores preservados y formularios separados del resumen. Son comportamientos que debe conservar una futura implementación.
- Logo existente de `web/public/brand/furgoplus-logo.png`; no se redibujó la marca.

Estos hallazgos proceden del código y de la aceptación humana comunicada por el usuario. No se atribuyen a una sesión visual real nueva.

## Investigación con 21st

Se aplicó la habilidad `21st-ui-explore`. La CLI instalada es `@21st-dev/cli` 1.18.0. Se creó contexto de diseño en una copia temporal de los archivos relevantes, fuera de la aplicación. Los intentos de `usage --json` y de búsqueda con `--context auto` devolvieron «Not signed in». No se inició un login ni se obtuvo autorización de generación IA; no se ejecutaron `generate`, `get`, instalaciones o publicaciones.

Se consultaron referencias públicas de 21st con búsqueda web como alternativa:

| Referencia                                                                                 | Qué informa                                                                                              | Aplicación y límite                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dashboard Sidebar, Arun Dass](https://21st.dev/@arunjdass/components/dashboard-sidebar)   | Separación de navegación, contenido y cuenta. Se revisaron descripción y código público de demostración. | A y C: menú estable, selección visible y área de trabajo amplia. Se descartan navegación profunda, tipografía diminuta y efectos. No se copia el componente.          |
| [Item Action List, Sean Hello](https://mcp.21st.dev/@sean0205/components/item-action-list) | Referencia pública de listas con acciones contextuales.                                                  | B: filas y divisores para organizar información; A: documentos con jerarquía interna. No se recuperó código privado ni se afirma compatibilidad de su implementación. |
| [Catálogo de Settings de 21st](https://mcp.21st.dev/community/components/s/settings)       | Patrones de ajustes e índice de secciones; incluye Settings Sidebar Layout de felipemenezes098.          | C: navegación local para una tarea por sección. La ficha individual de ese componente no pudo recuperarse; la referencia queda limitada al catálogo.                  |

Son referencias de organización, no diseños generados ni aprobados por 21st. Las maquetas se elaboraron localmente con HTML/CSS/JavaScript y composiciones PNG originales. No necesitan trasladar Tailwind, Radix, Motion o Lucide al proyecto.

## Contrato común de las propuestas

La ficha inicial es la misma en A, B y C: **Servicio académico**, descripción **Traslados escolares**, correo **servicio@example.test**, revisión **Aprobado**, publicación **Visible para apoderados**, tres documentos cargados —Identidad, Vehículo, Credencial— y credencial con vencimiento **31/12/2026**. Son valores ficticios existentes en `ServiceOverview.test.tsx`, no datos extraídos de la cuenta académica.

Las tres incluyen Editar datos, Revisar documentos, revisión e historial, Consultar publicación y Ver rutas. Cambian la composición y el lugar de los accesos. Los formularios y los destinos reales quedan representados por vistas informativas; la maqueta no reproduce sus operaciones.

El selector mantiene los escenarios idénticos entre alternativas: aprobado visible, aprobado no visible sin solicitud, publicación desconocida, pendiente, rechazado, datos incompletos, documento vencido y suspensión. Una selección solo cambia memoria de la maqueta.

Reglas que deben mantenerse al implementar:

- Aprobación y publicación tienen etiquetas independientes. Una aprobación nunca implica visibilidad.
- No sustituir un dato de publicación desconocido por «Visible» o «No visible».
- La acción principal sigue la prioridad de `ServiceOverview`: indisponibilidad, vencimiento, revisión pendiente/rechazada, datos faltantes, documentos faltantes, consulta de publicación o envío a revisión. Los ocho ejemplos no agotan todas las combinaciones del componente existente.
- Las fechas y los bloqueos proceden de los datos existentes; no recalcular vigencia con el reloj del navegador. La maqueta utiliza estados explícitos y fechas ficticias.
- Avisos de suspensión, observaciones y bloqueos mantienen explicación y acceso a su solución. No esconder fechas documentales ni problemas dentro de un desplegable.
- Conservar foco, regreso al resumen, borradores y avisos sobre cambios que requieren nueva revisión. La exploración no valida ni sustituye esas garantías de la aplicación.
- Mantener las restricciones por rol, plan y capacidades; no crear permisos o destinos nuevos para uniformar el diseño.

## A · Panel operativo

**Idea:** responder primero «¿mi servicio está visible?» y «¿qué necesito hacer?». Pensado para conductores no técnicos que entran para resolver una tarea y continuar.

La navegación global usa una columna estable de 224 px, sin submenú permanente de configuración. El contenido ocupa el área disponible, hasta 1680 px de contenedor principal en pantallas grandes. En 1920 px quedan unos 1568 px útiles de contenido, frente a los 1072 actuales. Los párrafos conservan límites de lectura, aunque la estructura sea amplia.

Una franja de estado domina la parte superior, con la acción contextual junto a ella. Debajo, documentos ocupa aproximadamente tres quintos del ancho y datos dos quintos. Solo estos grupos necesitan superficie propia. Revisión y rutas forman una franja de accesos secundaria, separada por líneas. Los documentos se presentan como filas con nombre, estado y fecha; no como tres tarjetas.

**Ventajas:** lectura rápida; acción fácil de encontrar; las fechas ganan presencia; aprovecha escritorio sin convertirlo en una pared de indicadores. Es la dirección más cercana a la navegación ya existente.

**Limitaciones:** el bloque principal es prominente incluso cuando todo está aprobado. La publicación podría percibirse como el único estado relevante si se reduce demasiado la etiqueta de revisión. Los bloqueos múltiples necesitan una lista breve y ordenada, sin repetir el mismo botón en cada sitio.

**Responsive y accesibilidad:** a 1150 px los grupos se apilan; a 900 px el menú se abre mediante un botón; a 600 px las filas y acciones se ordenan verticalmente. El orden de lectura es estado → pendientes → documentos → datos → accesos. Ningún botón fijo cubre contenido al hacer zoom.

**Efecto en la aplicación:** Inicio puede adoptar «situación + acción + actividad»; Solicitudes y Pagos, listas con acciones por fila; Reportes, una barra de filtros y un área amplia para resultados. Administración conserva su navegación por rol y gana espacio para tablas. Requiere reorganizar el shell y aplicar patrones comunes gradualmente, sin reemplazar flujos ni contratos.

## B · Ficha clara

**Idea:** presentar Mi servicio como una ficha de trabajo legible y continua. La identidad del servicio es el encabezado principal; la página se lee de arriba abajo, con referencias por sección.

El menú global pasa a la cabecera; se recupera todo el ancho que usaba el lateral. El contenedor mide hasta 1400 px, o 1520 px en pantallas grandes. Una banda azul concentra publicación, revisión y consulta. Debajo hay una superficie continua con secciones horizontales: etiqueta a la izquierda, contenido a la derecha. Los datos usan pares etiqueta/valor; los documentos, filas. Editar datos queda en la cabecera de la ficha y la revisión documental junto a su sección.

**Ventajas:** composición sobria y claramente diferente al panel; elimina la repetición de tarjetas; permite revisar la información como un conjunto. Es adecuada si la mayoría de las visitas son de consulta y mantenimiento ocasional.

**Limitaciones:** el menú superior tolera menos destinos largos; no conviene añadir Administración al menú del conductor. Los accesos de revisión y rutas quedan más abajo. En móvil es una lectura más larga que A, con documentos después de los datos.

**Responsive y accesibilidad:** el menú superior cambia a Menú a 900 px; las secciones pasan a una sola columna a 600 px. Los enlaces internos ayudan a llegar a Documentos y Gestión. La banda azul necesita contraste comprobado tanto en textos como en sus estados y foco.

**Efecto en la aplicación:** Inicio mantiene la cabecera y una composición más libre; Solicitudes y Pagos se convierten en registros continuos con cabeceras y divisores; Reportes puede aprovechar todo el ancho. Administración necesita una navegación secundaria de su propio rol para que el menú global no crezca demasiado. Tiene más impacto transversal que A por el cambio de navegación.

## C · Gestión por secciones

**Idea:** ofrecer un espacio de gestión donde cada tarea tenga un lugar reconocible. La navegación global y la configuración del servicio son niveles explícitos.

Menú global de 208 px y contenido amplio. El estado se reduce a una barra compacta, con aprobación y publicación al mismo nivel. Un índice local de 188 px reúne Resumen, Datos del servicio, Documentos, Revisión e historial, Publicación y Rutas. El área principal es una hoja de trabajo; el resumen inicial muestra datos, los tres documentos y la fecha antes de entrar al detalle.

**Ventajas:** ubicación predecible para volver a una tarea; más espacio para documentos o historial cuando se abre esa sección; diferencia fuerte entre navegación y trabajo. Adecuada para conductores con mantenimiento frecuente y para tareas administrativas con varias subsecciones.

**Limitaciones:** dos niveles de navegación exigen más comprensión; el resumen repite accesos que el índice ya ofrece. En pantallas medianas debe pasar pronto a una sola columna. Es la opción menos recomendable como punto de partida para conductores no técnicos.

**Responsive y accesibilidad:** a 900 px el índice local pasa a filas de botones; a 600 px usa dos columnas. No depender de desplazamiento horizontal para descubrir secciones. Cada cambio enfoca el encabezado del contenido, conserva el contexto y ofrece regreso al resumen. La barra de estados no se fija al viewport.

**Efecto en la aplicación:** reutilizar el shell global en Inicio, Solicitudes y Pagos, pero reservar el índice local para áreas que realmente tengan varias tareas. Reportes podría usarlo para tipos de reporte existentes; Administración, para sus subáreas autorizadas. No convertir todas las pantallas simples en espacios con doble menú.

## Sistema visual pequeño y reutilizable

Se propone evolucionar los tokens existentes y CSS propio. El sistema es común a las tres alternativas; la elección define el shell y la composición. No incluye una biblioteca nueva ni una implementación en Flutter.

| Elemento            | Propuesta                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marca e interacción | Azul `#0752ac`, hover `#06458f`, selección suave `#eaf3ff`. Conservar logo y nombre.                                                                                                                                                                       |
| Texto y superficies | Texto `#202b3a`, secundario `#526176`, fondo `#f5f7fb`, superficie blanca, divisor `#d8e0eb`. Los divisores estructurales no sustituyen el borde visible de un control.                                                                                    |
| Estados             | Positivo `#16643f` sobre `#e9f6ed`; atención `#835313` sobre `#fff5df`; error `#a32735` sobre `#fff0f1`. Etiqueta escrita junto al color. Separar «revisión», «publicación», «pago» y «plan» semánticamente.                                               |
| Tipografía          | Fuente de sistema actual. Base de 16–18 px; metadatos 14 px; subtítulos 17–18 px; secciones 21–22 px; título 30–40 px, adaptable. Peso 400 para lectura, 550–650 para datos y controles, 700 para títulos. Fechas e importes pueden usar cifras tabulares. |
| Espaciado           | Escala existente 4, 8, 12, 16, 24, 32, 48 px. Dentro de grupos, 12–16; entre secciones, 24–32. Padding de escritorio 32–56 y móvil 16–24. Ancho de párrafos explicativos hasta 65–70 caracteres.                                                           |
| Formas              | Controles de 8 px de radio; superficies de 10–12 px; bordes finos. Sombra solo para elementos superpuestos. Una tarjeta debe agrupar un propósito, no cada dato o destino.                                                                                 |
| Acciones            | Una principal por contexto; secundarias con borde visible `#68788d`; enlaces para desplazarse o consultar. Ubicar las acciones junto al objeto que modifican. Evitar botoneras desconectadas al final.                                                     |
| Navegación          | Destino activo escrito y marcado visualmente; iconos acompañan texto. Menú móvil con estado expandido, Escape y devolución del foco. Cuenta y ayuda tienen una ubicación estable. Mantener Pasajeros y Plan y reportes, que ya existen.                    |
| Accesibilidad       | Objetivos táctiles de al menos 44 × 44 px; foco visible de 3 px; orden DOM coherente; títulos semánticos y salto al contenido; textos que se parten sin truncar datos necesarios. Animaciones decorativas innecesarias.                                    |

Primitivas propuestas para una fase posterior: `AppShell`, `PageHeader`, `StateBadge`, `StatusBanner`, `ActionGroup`, `Section`, `KeyValueList`, `DocumentList`, `ActionRow` y patrones de tabla/lista responsive. Son nombres de trabajo, no componentes añadidos. Preferir composición sobre una tarjeta universal con decenas de variantes.

| Área            | Patrón reutilizable y jerarquía                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio          | Estado y tarea pendiente, después actividad existente. Ayuda explicativa bajo demanda. No duplicar la ficha completa de Mi servicio.                                                           |
| Mi servicio     | Estado independiente de revisión/publicación, tarea contextual, documentos y datos; editores existentes al elegir una acción.                                                                  |
| Solicitudes     | Lista con estado, persona/contexto y acciones existentes por solicitud. Detalle bajo demanda; conservar confirmaciones y restricciones de aceptación/rechazo.                                  |
| Pagos           | Período y filtros arriba; listado con importes y estados legibles; detalle y acción juntos. No inventar indicadores ni nuevas operaciones.                                                     |
| Plan y reportes | Plan como información contextual; filtros y resultados con mayor área útil. Conservar capacidades, bloqueos y exportaciones actuales. No separar destinos por razones estéticas sin acordarlo. |
| Administración  | Misma escala y controles; densidad mayor para tablas y filtros. Shell y destinos propios por rol; acciones de cada entidad en su contexto, con las confirmaciones ya existentes.               |

## Evidencia y límites de validación

- Playwright MCP está anunciado, pero `browser_navigate` a `http://127.0.0.1:15173` fue rechazado por la revisión automática: «MCP tool call requires approval, but approval policy is never». No se obtuvo sesión académica ni se imprimieron credenciales. No se intentó acceder a la aplicación por otra vía para eludir ese rechazo.
- Se intentó iniciar Chromium local solo para renderizar las maquetas; falló al arrancar con `setsockopt: Operation not permitted`. No se presentan los PNG como evidencia de renderizado web.
- Verificación DOM mediante jsdom: **24 combinaciones**, tres propuestas por ocho estados; encabezado, accesos conservados, fecha visible e IDs únicos. También se comprobó el cambio de sección de C, aperturas conceptuales de A/B y apertura/cierre del menú por Escape. Resultado final: sin fallos. Esto no mide layout, reflujo, lector de pantalla ni usabilidad.
- Contraste calculado según luminancia relativa: azul/blanco **7,47:1**; texto principal/blanco **14,30:1**; secundario/blanco **6,31:1**; azul/azul suave **6,67:1**; estados positivo, atención y error sobre sus fondos **6,44:1**, **6,03:1** y **6,55:1**. Borde interactivo/blanco **4,51:1**; foco/blanco **4,97:1**. Son pares de tokens; no una certificación WCAG de la interfaz.
- Las tres composiciones de escritorio y móvil se inspeccionaron visualmente como imágenes. El HTML contiene CSS para 320 px, móvil, tablet y escritorio, pero no se declara validado en esos tamaños.
- Formato del HTML y del informe comprobado. No se repitieron las 318 pruebas React: no cambió la aplicación; el resultado anterior sigue siendo evidencia de la fase previa, no una ejecución nueva.
- Los artefactos no tienen dependencias externas ni fuentes remotas. La maqueta bloquea conexiones y envío de formularios mediante CSP, no contiene llamadas API, almacenamiento de sesión ni credenciales.

Antes de implementar la dirección elegida, la aceptación debe comprobar: comprensión de aprobación/publicación y siguiente tarea; hallazgo de documentos, historial y rutas sin guía; casos con bloqueos; 1440/1920, 768, 390 y 320 px; zoom 200–400 %; teclado, foco y lector de pantalla; nombres/correos largos y estados desconocidos. Esa revisión decidirá ajustes de densidad y navegación, sin cambiar la lógica.

## Punto de detención

Elegir **A, B o C** antes de modificar pantallas. Mi recomendación es **A**, con su navegación simple, mayor peso de documentos y acciones contextuales. Evitar combinar los tres modelos de navegación antes de probar uno.

Solo se añadieron estos artefactos de exploración bajo `docs/design/task12-mi-servicio/`. Los 340 archivos presentes al inicio conservaron su hash SHA-256. No se cambiaron pantallas operativas, dependencias, backend, contratos, datos académicos, Task 13, Task 14 ni demo r4. No hubo commit, push, merge, publicación o deploy.
