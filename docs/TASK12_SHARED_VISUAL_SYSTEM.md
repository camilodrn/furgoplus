# T12 — Sistema visual compartido A + B

Registro histórico de los lotes del 27–28 de octubre. Sus alcances temporales y diferencias cromáticas de plataforma quedan sustituidos por la [referencia conceptual unificada](TASK12_DESIGN_SYSTEM_PROPOSAL.md) y el [primer incremento](TASK12_VISUAL_IMPLEMENTATION_REVIEW.md). Se conserva el texto para trazabilidad; no es el contrato activo.

Decisión de producto comunicada el 27-10-2026: extender **A · Panel operativo**, con filas y divisores de B, a toda la experiencia existente web y móvil. La revisión humana de Fedora confirma la dirección de Mi servicio; **no acepta automáticamente este lote ni Flutter**. Este documento define el lenguaje compartido. El lote inicial implementó únicamente Inicio web y Hoy del conductor Android.

La continuación humana del 28-10-2026 autoriza también el [lote de recuperación Android y Pasajeros/Pagos](TASK12_RECOVERY_PASSENGERS_PAYMENTS.md). Se reutiliza este sistema; la aceptación del lote 1 y del nuevo lote sigue pendiente.

## Fuentes y dependencias inspeccionadas

- [Exploración A/B/C](design/task12-mi-servicio/README.md), composiciones A y B, [panel implementado](TASK12_WEB_MI_SERVICIO_PANEL.md) y `ServiceOverview.tsx`: estados compactos, intervención contextual, filas y ancho útil.
- [Auditoría UX web](TASK12_WEB_UX_AUDIT.md), [fase previa](TASK12_WEB_UX_PHASE1.md), [revisión Flutter](TASK12_FLUTTER_VISUAL_REVIEW.md) y [guía Flutter existente](TASK12_FLUTTER_DESIGN_SYSTEM.md). Son registros históricos; su alcance y aceptación no se reescriben.
- Web: React/DOM 19.2.8, TypeScript 6.0.2, Vite 7.3.6, CSS propio. Sin Tailwind, shadcn, biblioteca de iconos ni `components.json`. Primitivas reales: `ProductIcon`, botones nativos, `DriverReadNotice`, `ServiceAvailabilityNotice`, `FocusPanel`, `HomeRequirements`, `CapacityText`, formularios y fechas chilenas existentes.
- Android: Flutter, Dart, Material 3, `flutter_secure_storage` 11.2.0 y `url_launcher` 6.3.2. `furgoTheme`, `FurgoColors`, `FurgoSurface`, `FurgoMessage`, `FurgoStatus`, `ParentPanel`, `ParentDisclosure` y navegación nativa existentes. Sin paquetes añadidos ni cambios a `pubspec`, configuración Android o adaptadores de sesión.
- 21st conectado: búsqueda de metadatos `task list summary action rows divider`. Referencias [Task List](https://21st.dev/@ravikatiyar162/components/task-list), [Task List Card](https://21st.dev/@tailwind-admin/components/task-list) y [Reshaped Divider](https://21st.dev/@reshaped/components/reshaped-divider). Se toma la organización por filas y grupos; no sus animaciones, checkboxes, datos o dependencias. No se recuperó código ni se generaron diseños alojados. Revisión determinista mediante CLI local 1.18.0; no equivale a revisión visual de 21st.

## Composición por tarea

**Resumen primero → acción principal → detalles bajo demanda.** Un grupo de información comparte una superficie; cada registro usa una fila y un divisor. Blanco y fondo suave, sin sombras decorativas, gradientes ni animaciones nuevas. Reservar color intenso para acciones y señales concretas. No convertir cada cifra, campo o fecha en una tarjeta.

| Tarea                     | Composición                                                                                  | Qué permanece visible                                                               | Qué puede desplegarse                               |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| Entrada de gestión web    | Estado compacto → pendientes y operación en dos áreas → preparación y cupos                  | Cantidades reales, acción contextual, errores y bloqueos                            | Requisitos, motivos y cupos por ruta                |
| Jornada Android           | Fecha del servidor → recorrido seleccionado y acción → destino y pasajeros en una superficie | Estado, nombre, horario, capacidad, indicación de recogida, recuperación tras error | Contacto privado, otras rutas, servicios anteriores |
| Ficha de servicio         | Estados independientes → intervención → documentos y datos                                   | Requisitos pendientes, observaciones actuales, fechas requeridas                    | Historial y edición en sus destinos actuales        |
| Listado de trabajo futuro | Filtros → filas de registros → acción contextual                                             | Identidad autorizada, estado, fecha y consecuencia relevante                        | Mensajes y detalles secundarios                     |
| Reportes futuros          | Plan/permiso → período/filtros → resultados reales                                           | Alcance del reporte, período, totales y descargas autorizadas                       | Detalle y metodología                               |

El sistema no crea actividad, nombres, tendencias, vigencias, estados ni permisos. La ausencia de respuesta no es cero ni un éxito. En web Inicio no se copian documentos ni los datos de Mi servicio. En Android no se traslada el sidebar ni se incrusta HTML.

## Tokens y equivalencia de plataformas

Los roles son comunes. Las pequeñas diferencias ya existentes en fondos, divisores y verde se conservan como adaptación de plataforma; no se modifica globalmente el tema de pantallas fuera del lote.

| Rol                             | React / CSS existente                                      | Flutter existente                                        | Aplicación                                                                               |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Marca / acción                  | `--brand` `#0752AC`; hover `#06458F`                       | `FurgoColors.blue` `#0752AC`, `ColorScheme.primary`      | Acción rellena, enlaces y selección                                                      |
| Énfasis suave                   | `--brand-soft` `#EAF3FF`                                   | `blueSoft` `#EDF4FF`                                     | Selección o información; no banner permanente de éxito                                   |
| Texto / apoyo                   | `--ink` `#202B3A`; `--muted` `#526176`                     | `ink` / `muted`, mismos colores                          | Títulos/contenido; etiquetas/horarios                                                    |
| Fondo / superficie              | `#F5F7FB` / `--surface` blanco                             | `canvas` / `ColorScheme.surface`, mismos colores         | Página / un grupo de tareas                                                              |
| Divisor / borde de control      | `--border` `#D8E0EB` / `--interactive-border` `#68788D`    | `divider` `#DCE3ED` / `border` `#68788D`                 | Dividir contenido / identificar control                                                  |
| Éxito                           | `--positive` `#16643F`, fondo `#E9F6ED`                    | `success` `#246342`, `successSoft` `#E9F6ED`             | Confirmación explícita del servidor; etiqueta compacta                                   |
| Atención / pendiente accionable | `--warning` `#835313`, fondo `#FFF5DF`                     | `warning` / `warningSoft`, mismos colores                | Requisito o recuperación que requiere atención                                           |
| Error                           | `--danger` `#A32735`, fondo `#FFF0F1`                      | `error` / `errorSoft`, mismos colores                    | Fallo de acción o validación; texto y recuperación                                       |
| Pendiente de revisión           | Azul o texto secundario + «En revisión»                    | Azul o texto secundario + etiqueta                       | Espera neutral; no representar como fallo                                                |
| Suspensión                      | Aviso de atención + nombre «Suspendido» y motivo existente | Mismos roles cuando el payload de esa pantalla lo aporte | Separar de revisión, plan y publicación; no añadirlo a Hoy si su respuesta no lo informa |

Una aprobación no equivale a publicación. Un estado administrativo de plan no acredita vigencia efectiva. «Completada» en Hoy significa recorrido confirmado, no aprobación del conductor. La información de carga/error tiene texto y semántica accesible; el color nunca es la única señal.

| Escala                       | Web                                                                                          | Android                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Fuente                       | Sistema; 16 px en el nuevo contenido operativo; resto pendiente de migración                 | Sistema; `TextTheme` existente; sin limitar escalado                                                |
| Página / recorrido destacado | `--operational-title`: 28–36 px adaptativos                                                  | `headlineMedium` 28 sp para Hoy; `headlineSmall` 24 sp para nombre del recorrido                    |
| Sección / fila / apoyo       | 20,8 / 16 / 16 o apoyo existente                                                             | `titleLarge` 22 / `titleSmall` 16 / `bodySmall` 14 sp                                               |
| Espaciado                    | `--space-1/2/3/4/6/8/12`: 4/8/12/16/24/32/48 px                                              | `FurgoLayout`: 8/12/16/24 dp; margen 16, padding de superficie 20 dp                                |
| Superficie operativa         | `--operational-radius`: 12 px; borde 1 px; sin sombra                                        | `FurgoLayout.panelRadius`: 12 dp; borde 1 dp; sin elevación                                         |
| Ancho                        | `--operational-width`: 1520 px incluyendo padding; lectura de párrafos ≤65 caracteres aprox. | `FurgoLayout.contentWidth`: 720 dp; flujo vertical en teléfono                                      |
| Controles                    | Botones/inputs y foco visibles existentes; mínimo 48 px; se expanden con texto               | Tema Material 3 existente: botones principales ≥52 dp, acción de recorrido ≥56 dp, objetivos ≥48 dp |

Los botones de Inicio usan el radio operativo de 12 px, equivalente a los controles Android de 12 dp. Los controles web heredados de otros destinos mantienen 9 px hasta su lote. Inicio aprovecha el mismo máximo de ancho de Mi servicio sin cambiar el shell de los demás destinos. La superficie de pendientes/operación se apila a ≤1150 px; acciones de filas a ancho completo a ≤420 px. El menú web conserva su transición a ≤900 px. Flutter usa `SafeArea`, desplazamiento único, texto sin alturas fijas ni truncado esencial y barra inferior Hoy / Mi plan / Ayuda. Cuenta y Android Atrás conservan su comportamiento previo.

## Primitivas reutilizables y migración

| Patrón                | React                                                                        | Flutter                                                                               | Alcance de este lote                                       |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Grupo continuo        | Nuevo `OperationalPanel` + `.home-activity`                                  | Nuevo `FurgoOperationalPanel`                                                         | Se aplican solo a Inicio/Hoy; no reemplazo global          |
| Fila con acción       | Nuevo `OperationalRow`, título, icono existente, contenido y botón           | `Row`/`Column`, `ListTile`, `ExpansionTile` y `Divider` nativos                       | Filas web y destino/pasajeros móviles                      |
| Estado / recuperación | `DriverReadNotice`, `ServiceAvailabilityNotice` y región existente           | Región viva, progreso y acciones existentes; `FurgoMessage`/`FurgoStatus` disponibles | Conservar mensajes, reintentos y bloqueos                  |
| Detalles              | `details`/`summary`, `ServicePreparation` y `CapacityText`                   | `ExpansionTile`; contacto reiniciado por ruta/sesión                                  | Sin nuevos permisos ni contactos expuestos permanentemente |
| Formulario            | Controles nativos, etiquetas, `FieldError`, `ChileanDateField`, `FocusPanel` | `InputDecorationTheme`, `TextField`, confirmación Material                            | Se documenta; no rediseño de formularios en este lote      |
| Navegación            | Sidebar actual y menú móvil web, salto al contenido/foco                     | `NavigationBar`, AppBar, PopScope y diálogos Material                                 | Sin destinos adicionales                                   |

No generar una clase genérica que mezcle pagos, publicación y recorridos. Reutilizar estructura y tokens, conservando estado, datos y comportamiento en cada componente de dominio. Los controles secundarios usan contorno o texto; una acción rellena prioritaria por tarea, salvo confirmaciones separadas. En Inicio publicado: solicitudes pendientes → pagos pendientes → pasajeros asignados → rutas. Si solicitudes está cargando, se espera su respuesta para destacar la acción operativa; ante error se ofrece recuperación sin inventar una cantidad. Si el servicio no está visible, se conserva la prioridad existente de requisitos de publicación.

## Accesibilidad y límites de validación

Contraste objetivo de texto ≥4,5:1; controles/foco ≥3:1 cuando corresponda. Se mantienen las comprobaciones de colores móviles existentes y se añaden comprobaciones web de pares de texto. Divisores tenues solo separan; no identifican por sí solos un control. Estados e iconos se acompañan de texto. Botones con nombre accesible, encabezados ordenados, zoom/escalado sin recortes, contenido largo que pueda partirse y teclado/foco visibles. Con fuente grande se usa el acceso Cuenta de icono ya existente con tooltip.

Las pruebas DOM no miden geometría CSS. Las pruebas de widgets no acreditan TalkBack, fuente Samsung, mapas reales o aceptación táctil. [Guion humano del lote](TASK12_INICIO_HOY_BATCH1.md) y [matriz futura](TASK12_VISUAL_ROLLOUT_MATRIX.md). No ampliar el alcance sin revisión humana de este primer lote.
