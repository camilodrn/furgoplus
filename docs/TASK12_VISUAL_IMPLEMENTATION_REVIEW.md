> **Actualización integral 31-10-2026:** el encargo vigente incluye F01–F13 completos. Las restricciones y bloqueos de incrementos anteriores de este documento son históricos. Estado actual, evidencia real y pendientes: [implementación integral](TASK12_INTEGRAL_IMPLEMENTATION.md) y [cobertura de 99 filas](TASK12_INTEGRAL_COVERAGE.md). No hay aceptación global ni accesibilidad completa declaradas.

# FurgoPlus T12 — Revisión del primer incremento visual

31-10-2026. Primer incremento implementado; validación técnica y revisión de renders documentadas. Dirección conceptual autorizada por el encargo actual; aceptación visual y humana pendientes.

## Preservación y delimitación antes de editar

Rama inicial: `task/12-plan-capabilities`. Se registraron 463 entradas modificadas/sin seguimiento (incluidos archivos internos de directorios sin seguimiento) y 653 hashes del árbol rastreado/no ignorado. Este trabajo NO parte de una rama limpia. Copia de los archivos frontend/documentos de T12, diff previo y hashes en `/tmp/furgoplus-t12-visual-baseline/`. El estado completo y la comprobación final se incorporarán a evidencias. Los cambios preexistentes de backend, contratos, Android, sesión e infraestructura quedan fuera del incremento.

Leídos completos antes de editar: auditoría unificada, propuesta y matriz. Consultados contexto `.21st`, sistema compartido, guía Flutter, revisión visual Flutter, composiciones y pruebas existentes. Habilidad aplicada: `21st:21st-ui-build`. Consulta de metadatos 21st de badges/chips; se reutilizan primitivas propias, sin recuperar código ni instalar dependencias. CLI no disponible.

Inventario inicial de archivos candidatos (no implica que todos terminen modificados):

| Archivo | Consumidores reales / alcance previsto |
| --- | --- |
| `mobile/lib/furgo_theme.dart` | `AuthApp` y ambos roles, legales, plan/Ayuda; colores comunes. Sin cambiar métricas globales de texto/campos/acciones. |
| `mobile/lib/furgo_widgets.dart` | Panel de Hoy/detalle, superficies de plan/Ayuda/cuenta; capacidad en conductor y familia. Un dueño de superficie, conservar adaptadores actuales. |
| `mobile/lib/parent_presentation.dart` | Paneles familiares de resultados, detalle, contacto, solicitudes y cuenta; disclosures de cobertura, acerca, confianza, reseñas, privacidad y solicitud. |
| `mobile/lib/parent_service.dart` | Fichas de resultados y detalle; comparación por atributos públicos con ruta/fecha explícitas. |
| `mobile/lib/parent_home.dart` | Integración de comparación; conservar selección, consulta/revalidación y regreso existentes. |
| `mobile/lib/driver_home.dart` | Hoy/detalle/pasajeros, títulos y texto operativo del tema, sin modificar controladores. |
| `web/src/ValidationScreens.tsx`, `style.css` | Badge de revisión de conductor, historial, cola y expediente; desconocido neutral, revisión en espera. |
| `web/src/DriverExperience.tsx`, `App.tsx`, `HelpSupport.tsx` | Catálogo SVG existente y consumidores de navegación/guías/soporte; significados distintos para plan/reportes, pagos y guías. |
| `web/src/operational.css` | `CapacityText` en Inicio, rutas y pasajeros; legibilidad de cupos/fecha. |
| Pruebas de componentes/frontend y herramienta de previews | Regresión existente más comparación 2/3, reflujo y guidelines acotadas. |
| `.21st/DESIGN.md`, `.21st/design.json`, documentos activos | Contrato vigente y excepciones explícitas, sin borrar decisiones históricas. |

Corte: C02/C04 comunes en Android, C04 y legibilidad/iconografía en React, C11/C12 especializados conservados. C06/C07 nativos existentes mantienen controles de 48/52 dp. No se amplían métricas globales React: navegador MCP exige aprobación no disponible y Chromium local aborta con `sandbox_host_linux: Operation not permitted`. C01/C03/C05 se conservan salvo consumidores de las primitivas anteriores. H07/H10 requieren evaluación de navegación/foco; quedan pendientes, sin tocar controladores complejos. No se inicia un segundo lote dependiente de aceptación visual.

## Pruebas previas a la implementación

- `flutter analyze --no-pub`: sin observaciones.
- Vitest completo: 389/391; timeout preexistente en App (asignación), y fallo de paginación de DriverRequests bajo ejecución paralela. Los dos archivos pasan aislados: 52/52. No se modifican tiempos ni pruebas para ocultarlos.
- `flutter test --no-pub --concurrency=1` antes de editar: 198/198, runner convencional. Los intentos posteriores en el entorno restringido encuentran caché de SDK no escribible y sockets localhost prohibidos; no se extrapola ese aprobado inicial al código final.

## Archivos efectivamente modificados

Comparación contra los hashes iniciales, no contra HEAD. Los 24 archivos siguientes ya existían al iniciar (algunos sin seguimiento); se conservan sus cambios previos. [Manifiesto de preservación](evidence/task12-visual-implementation/preservation.json) y [estado inicial completo](evidence/task12-visual-implementation/preexisting-status.txt).

| Archivos | Responsabilidad / consumidores |
| --- | --- |
| `.21st/DESIGN.md`, `.21st/design.json` | Contrato activo, tokens y decisiones históricas. |
| `docs/TASK12_DESIGN_SYSTEM_PROPOSAL.md`, `TASK12_UX_MIGRATION_MATRIX.md`, `TASK12_SHARED_VISUAL_SYSTEM.md`, `TASK12_FLUTTER_DESIGN_SYSTEM.md` | Estado vigente, seguimiento de 99 filas y equivalencias; historia conservada. |
| `mobile/lib/furgo_theme.dart`, `furgo_widgets.dart` | Colores de AuthApp/ambos roles; superficies operativas, plan, Ayuda y cuenta; sin métricas globales nuevas. |
| `mobile/lib/parent_presentation.dart`, `parent_service.dart`, `parent_home.dart` | Adaptadores familiares, todos sus paneles/disclosures; resultados/detalle/comparación, alcance de validación y control nativo de envío. |
| `mobile/lib/driver_home.dart` | Hoy y entrada a pasajeros, otras rutas/anteriores, roster y títulos del tema. |
| `mobile/test/driver_home_test.dart`, `parent_home_test.dart` | Conteo asignado; acción delineada, comparación, quitar/retorno y límites de navegación. |
| `mobile/tool/test_without_sockets.dart`, `integral_experience_preview.dart` | Suite nueva en ejecutor existente y capturas 2/3 al 100/200 %. |
| `web/src/App.tsx`, `DriverExperience.tsx`, `HelpSupport.tsx` | Un catálogo SVG para shell, inicio/servicio/listas/reportes y centro de Ayuda de todos los roles. |
| `web/src/ValidationScreens.tsx`, `ValidationScreens.test.tsx` | Estado desconocido de información, historial, cola y expediente. |
| `web/src/style.css`, `admin-coherence.css`, `operational.css` | Roles neutral/revisión; capacidad compacta de Inicio/rutas/pasajeros en su definición original. |

Nuevos: este informe, `mobile/test/unified_visual_system_test.dart` (8 casos de widgets) y la carpeta de evidencia de esta ejecución. También se agrega un caso de retorno a las pruebas familiares existentes. Ningún archivo preexistente fue eliminado. Backend/infraestructura/contratos/autenticación/sesiones y configuración Android permanecen idénticos al inicio.

## Componentes y tokens consolidados

| Patrón | Implementación de este incremento | Límites |
| --- | --- | --- |
| C01 iconografía | `ProductIcon` incorpora Inicio, revisión, reportes, libro y soporte. Se elimina la copia `NavIcon`; shell conductor/admin y centro de Ayuda usan el mismo catálogo. Pagos conserva tarjeta, reportes usa documento/gráfico, guías libro y soporte salvavidas. | Títulos, anchos y tipografía global React no se rediseñan sin navegador. |
| C02 superficies Android | `FurgoSurface` es el único dueño de color, radio 12, borde, clipping y padding 20. `FurgoOperationalPanel`, `ParentPanel` y `ParentDisclosure` existentes lo componen. Se retira `parentTheme`, que cambiaba los márgenes de todas las tarjetas por rol; la separación de 12 dp queda explícita en los adaptadores familiares. | No se crean wrappers nuevos; se conservan diferencias de composición por tarea y controles Material. |
| C03 filas | Comparación por grupos y divisores; títulos operativos de otras rutas/pasajeros usan TextTheme. | No se convierte todavía cada solicitud familiar en fila ni se reescriben listas admin. |
| C04 estados | Azul suave `#EAF3FF`, divisor `#D8E0EB` y positivo `#16643F` comunes en React/Flutter. Neutral `#526176` sobre `#EEF1F5`; espera de revisión neutral, desconocido «Estado por confirmar» con clase controlada, sin heredar un color positivo de un estado desconocido. Validado familiar usa revisión interna, sin escudo de garantía. | El contrato de estado de negocio se conserva. Pendiente de pago/contacto sigue pudiendo requerir atención: no se cambia el significado por compartir una palabra. |
| C05 feedback | Conserva canales, mensajes, carga, errores y recuperaciones existentes; hereda los colores del tema Android. | Sin un nuevo canal de anuncios. TalkBack pendiente. |
| C06 / C07 acciones y campos | Se reutilizan botones, campos, foco y errores Material 3 existentes (objetivos 48, principales 52/56 dp). Fichas de alternativas usan acción delineada y comparación seleccionada con superficie suave. | Recetas React 8/9/12 y 44/48/54 permanecen como deuda explícita; no se altera todo el CSS sin observar. |
| C08 / C09 | Selección y consultas existentes se conservan; valores de comparación se alinean por atributo y se apilan con ancho/escala insuficiente. | Comuna conserva su subvista; no se modifica el controlador de filtros. |
| C10 | Confirmaciones existentes, consecuencias y busy conservados. | H07/H10 no cerrados: unificación de modal/foco/regreso requiere otro incremento observado. |
| C11 / C12 dominio | Capacidad compacta React usa una escala común 14/16 px en Inicio, rutas y pasajeros; detalle conserva tamaño mayor. `ParentServiceComparison` muestra la misma ruta pública priorizada por comuna en horario, cobertura, fecha y cupos, con `FurgoCapacity` existente. | No hay disponibilidad global sumada, presencia física, tarifas, reservas o proyecciones inventadas. C13–C15 permanecen especializados. |

`.21st/DESIGN.md` y `design.json` contienen el contrato vigente y conservan antecedentes/decisiones. La guía Flutter refleja tokens, superficies y destinos reales. El sistema compartido de los lotes anteriores queda rotulado como histórico; la propuesta unificada tiene estado conceptual autorizado con implementación parcial.

## Utilidad concreta

Conductor: Hoy mantiene horario, recorrido, estado confirmado, acción autorizada y capacidad juntos. La entrada a pasajeros ahora muestra el **conteo asignado del roster recibido**, sin afirmar presencia; se abrevia el apoyo de esa fila para que el objetivo sea alcanzable también en 320 × 480 al 200 %. Otros recorridos y anteriores conservan selección/fechas/recuperación. En web aumentan los textos de capacidad/fecha en todos los consumidores compactos, sin simular un Hoy que la API web no aporta. No se rehízo una composición que ya tenía buena base.

Apoderado: las alternativas mantienen identidad, cobertura, horario, capacidad fechada y reseñas; «Ver servicio» deja de competir como acción rellena en cada registro. La selección tiene estado semántico existente y fondo suave. Comparar dos/tres agrupa **ruta → días/horario → cobertura de esa ruta → fecha/cupos → reseñas**, con el nombre de cada servicio junto al valor. No repite fichas completas. Quitar conserva las otras selecciones; abrir consulta el ID correcto, vuelve a Buscar y conserva la selección, conforme al controlador actual. Las fechas pueden diferir y se advierte. No se restaura automáticamente la vista de comparación al regresar desde detalle; queda pendiente de UX. La validación se explica junto a la etiqueta y se conserva la explicación completa en detalle.

Administración: shell e iconos compartidos, badge de revisión neutral y fallback por confirmar en cola/expediente. Directorio, filtros aplicados/borradores, pestañas, límites de paginación, motivos, documentos y confirmaciones permanecen funcionales según la regresión DOM. Esto no equivale a un rediseño completo de administración.

## Cobertura real de la matriz

El [registro al final de la matriz](TASK12_UX_MIGRATION_MATRIX.md#seguimiento-del-primer-incremento--31-10-2026) tiene una fila por cada una de las 87 vistas/subflujos y 12 situaciones transversales, con anterior/nuevo, estado, funcional, visual y excepción. Se distingue migración específica, herencia de shell/tema y conservación sin cambio.

Cobertura específica: W04, W07, W09–W13, W15, W18, A04/A05/A07/A09/A11–A14, H01/H02/H06; D01/D02/D04/D07; P01/P03/P04/P06. Herencia Android de colores/superficies: M01–M04/M06, D01–D10, P01–P11 y F01–F07 según el componente consumido. Los otros destinos React solo heredan el icono del shell o conservan su contenido. M05 está fuera del tema. Ninguna fila se marca aceptada, ni se afirma que las 87 pantallas hayan sido rediseñadas.

## Pruebas y resultados

| Comprobación | Resultado / alcance |
| --- | --- |
| Web contract:check, typecheck, lint, build | Aprobados, sin cambios de contrato ni nuevas dependencias. |
| Vitest completo, un worker | **392/392**. Mismos límites por prueba; configuración y tiempos sin cambios. |
| Nuevo test React | Desconocido neutral en información del conductor y expedientes admin; sin decisión enviada. |
| Flutter formato en verificación | Aprobado sobre lib/test/tool; ver log de cierre. |
| Flutter analyze --no-pub | Aprobado, sin observaciones. |
| Flutter test --no-pub --concurrency=1 final | 11 archivos bloqueados al cargar por sockets localhost; no se declara aprobado. |
| Motor y ejecutor sin sockets existente | **207/207**, 11 archivos de tests, sin fallos; no sustituye el runner convencional. |
| Nuevos widgets | Comparación con 2/3, rutas/fechas/cupos distintos, comuna pertinente, nombres largos, ausencia de ruta, retorno/selección y callbacks; 390 normal, 320 al 200 %, paisaje 844 × 390 al 200 %. |
| Guideline API | Objetivos Android, etiquetas y contraste en una composición acotada de primitivas existentes. No se añaden goldens ni referencias sin revisión humana. |

Las regresiones conservan permisos, privacidad, sesión, respuestas tardías, conflictos, doble envío y recuperación. Se detectaron y corrigieron durante el incremento el botón de ficha bajo el pliegue, un objetivo de pasajeros demasiado alto con texto grande, liberación de semántica en el test nuevo y errores de compilación locales. Solo los logs de cierre corresponden a la fuente final. La inestabilidad web previa está separada de estas correcciones.

## Observación visual y pantallas no observadas

Se generaron 70 renders actuales; se inspeccionaron 26 viewports identificados en el manifest. Son renders del motor Flutter con transportes sintéticos de solo lectura, fuentes Roboto/Material del SDK, 390 × 844 normal y 320 × 844 al 200 %. La [evidencia](evidence/task12-visual-implementation/README.md) identifica los PNG y vistas inspeccionadas. Son capturas de widgets de la aplicación con fixtures; **no un APK, un teléfono ni aceptación humana**. El render de un viewport tampoco acredita todo el contenido desplazable/expandible.

No observados: todas las páginas React en navegador (1440, 1280, 768, 390 y 320), zoom/foco/contraste renderizados; acceso Android en esta nueva galería; estados físicos de teclado, paisaje en dispositivo, Android Atrás real, TalkBack y retorno desde mapas. Los tests ejercitan varios de esos contextos con motor/fixtures, pero no se presentan como observación física. No se descargaron documentos privados ni se conectó a datos académicos para tomar imágenes.

## Excepciones y siguiente incremento

- C01/C02/C06/C07 React conservan recetas y anchos en deriva. Se pospone su consolidación geométrica hasta poder observar transversalmente acceso, conductor, admin y Ayuda en navegador; no se añaden overrides para aparentar unificación.
- H07 y H10 siguen abiertos: cuatro contratos web de confirmación/regreso y la vuelta desde comparación requieren evaluación de foco/origen antes de tocar controladores. Se conservan todas las confirmaciones actuales.
- P02 conserva la subvista de comuna, P08 las tarjetas de solicitudes y P10 la política de cancelación existente. Se priorizó C02 compartido y P03 frente a otra mejora aislada.
- C13–C15, reportes, beneficios, historial y soporte heredan solo lo declarado. No se promete aceptación global, prueba de comprensión ni cierre de cada P1.
- No se instalaron paquetes, tocó negocio/backend/contratos/auth/sesiones/configuración Android/datos/infraestructura, ni se hizo commit, push, merge o deploy.

Recomendación: **evaluar visualmente este incremento primero**, en navegador accesible y Android real con fuente normal/ampliada y TalkBack. Después de esa evaluación, consolidar C01/C02/C06/C07 React en sus definiciones originales, verificando acceso, tareas del conductor, expedientes/planes admin y Ayuda juntos. Resolver H07 con un contrato explícito de confirmación en línea frente a modal; no empezar otra portada aislada. No se ejecuta ese segundo lote en esta entrega.
