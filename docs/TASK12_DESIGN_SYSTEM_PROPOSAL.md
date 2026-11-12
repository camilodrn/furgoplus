> **Actualización integral 31-10-2026:** el encargo vigente incluye F01–F13 completos. Las restricciones y bloqueos de incrementos anteriores de este documento son históricos. Estado actual, evidencia real y pendientes: [implementación integral](TASK12_INTEGRAL_IMPLEMENTATION.md) y [cobertura de 99 filas](TASK12_INTEGRAL_COVERAGE.md). No hay aceptación global ni accesibilidad completa declaradas.

# FurgoPlus T12 — Propuesta de sistema de diseño unificado

Fecha: 31-10-2026. **Referencia conceptual autorizada por el encargo de implementación unificada; implementación parcial, sin aceptación visual humana.** Se deriva de la [auditoría](TASK12_UNIFIED_DESIGN_AUDIT.md) y se aplica mediante la [matriz completa](TASK12_UX_MIGRATION_MATRIX.md).

Seguimiento vigente: [primer incremento y excepciones](TASK12_VISUAL_IMPLEMENTATION_REVIEW.md). Las instrucciones futuras y estimaciones de este documento conservan su contexto de propuesta; el encargo actual autoriza implementar el corte documentado, sin autorizar aceptación automática ni un segundo lote visual. Los tokens de color Flutter y la superficie común se implementan en este corte; geometría global React y contratos de navegación/confirmación continúan pendientes.

## Dirección de producto

FurgoPlus debe sentirse cercano, ordenado y confiable: transporte escolar que ayuda a coordinar tareas concretas. La marca existente, azul y tipografía de sistema, es suficiente. Se propone consolidar A · Panel operativo + filas/divisores B, sin nueva exploración estética, framework, ilustraciones decorativas ni lenguaje de dashboard comercial.

La identidad se reconoce por cuatro constantes: jerarquía de tarea, vocabulario de estados, superficies sobrias y acciones previsibles. El conductor ve operación/gestión; la familia ve alternativas y condiciones para contactar; administración ve casos, evidencia y consecuencias. La estructura puede variar por tarea sin variar arbitrariamente el componente.

Regla de composición: **dónde estoy → qué ocurre → qué puedo hacer → qué necesito consultar**. La información secundaria se despliega; identidad, estado, fecha relevante, bloqueo y consecuencia no dependen de abrir un acordeón. Una tarea tiene una acción principal; una lista de entidades puede tener una acción por registro, con énfasis moderado para no competir todas a la vez.

## Fundamentos y tokens propuestos

Estos valores son decisiones de diseño para revisión, no una instrucción para editar globalmente el CSS. Primero se deben mapear consumidores y validar en las dos plataformas. El inventario anterior acepta algunas diferencias durante el rollout; esta propuesta las vuelve explícitas y elimina solo las accidentales.

### Color

| Rol conceptual   | Valor propuesto       | React futuro / adaptación actual    | Flutter futuro / adaptación actual                 | Uso                                             |
| ---------------- | --------------------- | ----------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| brand            | `#0752AC`             | `--brand`                           | `FurgoColors.blue`, scheme.primary                 | Acción principal, selección, enlace             |
| brand-hover      | `#06458F`             | `--brand-hover`                     | Estado interactivo Material que mantenga contraste | Hover web; Android conserva feedback nativo     |
| brand-soft       | `#EAF3FF`             | `--brand-soft`                      | Unificar blueSoft, hoy `#EDF4FF`                   | Selección/fondo informativo puntual             |
| canvas           | `#F5F7FB`             | Token explícito del fondo existente | `FurgoColors.canvas`                               | Fondo general                                   |
| surface          | `#FFFFFF`             | `--surface`                         | scheme.surface                                     | Grupo de contenido o tarea                      |
| ink              | `#202B3A`             | `--ink`                             | scheme.onSurface                                   | Lectura y títulos                               |
| muted            | `#526176`             | `--muted`                           | scheme.onSurfaceVariant                            | Apoyo legible, sin bajar opacidad               |
| divider          | `#D8E0EB`             | `--border`, alias transitorio       | Unificar divider, hoy `#DCE3ED`                    | Separación; no único límite de un campo         |
| control-outline  | `#68788D`             | `--interactive-border`              | scheme.outline                                     | Campos/botones de contorno                      |
| positive / soft  | `#16643F` / `#E9F6ED` | `--positive` y fondo                | Unificar success, hoy `#246342`                    | Resultado confirmado o estado positivo textual  |
| attention / soft | `#835313` / `#FFF5DF` | `--warning` y fondo                 | warning y fondo                                    | Intervención pendiente, consecuencia a revisar  |
| danger / soft    | `#A32735` / `#FFF0F1` | `--danger` y fondo                  | error y fondo                                      | Error o acción destructiva confirmable          |
| neutral / soft   | `#526176` / `#EEF1F5` | Consolidar neutral del conductor    | Rol neutral común                                  | Espera, inactivo, desconocido con texto preciso |

Azul nunca significa ubicación en vivo. Verde nunca acredita seguridad del transporte ni pago bancario. «En revisión» es espera neutral; no advertencia por defecto. «No visible» puede ser preparación normal y debe señalar su motivo cuando se conozca. Un estado desconocido usa neutral y «Estado por confirmar», nunca un éxito genérico.

Objetivo de contraste: texto normal ≥4,5:1; texto grande y componentes/foco según criterio aplicable ≥3:1. Verificar pares, estados interactivos y renderizado final; no se certifica accesibilidad de la app por esta tabla. Bordes de separación suaves no identifican controles. El estado siempre tiene nombre; icono complementario opcional.

### Tipografía

Fuentes de sistema: web conserva su pila; Android conserva fuentes y métricas del sistema/Material. No descargar tipografía. Usar rem en web y sp/TextTheme con escalado nativo en Flutter. No fijar altura de una caja de texto para mantener una maqueta.

| Rol                        | Web propuesto            | Android propuesto                 | Regla                                                                                         |
| -------------------------- | ------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Título de página           | 28–36 px, 700, línea 1,2 | headlineMedium 28 sp, 700         | Uno por vista; nombre estable de tarea                                                        |
| Dato operativo principal   | 24–28 px, 600/700        | headlineSmall/Medium 24–28 sp     | Horario de recorrido o dato que cambia la decisión; evitar sobredimensionar todos los números |
| Sección                    | 20–22 px, 600/700        | titleLarge 22 sp                  | Grupo real de información                                                                     |
| Registro/entidad           | 16–18 px, 600            | titleSmall/Medium 16–18 sp        | Identidad, ruta o caso                                                                        |
| Cuerpo/campo/acción        | 16 px, 400/600           | bodyMedium/labelLarge 16 sp       | Línea de lectura 1,45–1,55; puede crecer                                                      |
| Apoyo/fecha secundaria     | 14 px, 400/600           | bodySmall 14 sp                   | Nunca único soporte de estado crítico                                                         |
| Navegación nativa compacta | 14–16 px web             | labelSmall 12 sp en NavigationBar | Excepción nativa justificada; probar escala y etiquetas completas                             |

No usar 12 px para capacidad, fecha del servicio, consentimiento o error. No resolver texto largo bajando toda la fuente. Nombres, comunas, correos y motivos se parten o apilan; si se trunca una etiqueta secundaria, su contenido íntegro sigue accesible sin depender de hover.

### Espacio, superficies y dimensiones

| Concepto         | Propuesta                                                                                                  | Aplicación                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Escala           | 4, 8, 12, 16, 20, 24, 32, 48                                                                               | 4/8 para relaciones internas; 16/20/24 para grupos; 32/48 entre secciones cuando aporte separación |
| Márgenes         | Teléfono 16; escritorio 24–32                                                                              | Android SafeArea; web según ancho disponible                                                       |
| Padding          | Superficie 20; 16 en ancho muy reducido; fila 12–16 vertical                                               | Un componente decide padding; no margen adicional oculto por rol                                   |
| Radios           | Control 12; superficie 12; badge cápsula; filas interiores sin radio                                       | Unificar 8/9/17/20 accidentales. Diálogo nativo conserva adaptación Material documentada           |
| Bordes           | 1, foco 2–3 con separación visible                                                                         | Color de control distinto del divisor                                                              |
| Sombras          | Sin sombra en superficies de contenido; solo capa superpuesta si ayuda a distinguirla                      | El diálogo/menú puede usar separación de capa; no todas las tarjetas                               |
| Objetivo táctil  | ≥48 × 48 CSS px/dp como regla del producto; principal Android ≥52/56 dp                                    | Altura mínima, nunca máxima; crecer con texto. No imponer 54 solo a reportes/Ayuda                 |
| Anchos por tarea | Trabajo hasta 1.440 px; lectura hasta 65–70 ch; formulario hasta 40–48 rem; Android contenido hasta 720 dp | El ancho se aplica por tarea/componente, sin reglas especiales para cada rol                       |

Los 48 px son una decisión de usabilidad de FurgoPlus, más exigente que el mínimo de 24 CSS px con excepciones de [WCAG 2.2, tamaño de objetivo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). No presentar cualquier control de 44 px como incumplimiento automático de WCAG.

Superficies permitidas: grupo continuo, entidad comparable y capa de interacción. Para pagos, pasajeros, documentos, solicitudes y eventos, empezar por filas/divisores. Conservar tarjeta donde ayuda a delimitar una alternativa de servicio o una tarea, no por cada etiqueta/fecha.

### Movimiento

Mantener feedback de controles y transiciones nativas breves. Sin animación decorativa de cifras, gráficos o tarjetas. Web conserva `prefers-reduced-motion`; Android respeta preferencias del sistema. Carga usa indicador más texto; no un falso avance porcentual.

## Navegación y estructura

### React

Conservar sidebar y menú compacto existente, salto al contenido, ubicación actual, foco de entrada y cierre por Escape. Destinos del conductor: Inicio, Mi servicio (Publicación/Rutas y tareas de datos/documentos/revisión), Pasajeros, Solicitudes, Pagos, Plan y reportes; Ayuda y soporte y cuenta/legal en área secundaria. No añadir Hoy sin datos ni un menú nuevo de compras.

Administración conserva Inicio, Validaciones, Conductores, Ayuda/soporte y ficha de conductor con Resumen/Estado/Plan/Validaciones/Historial. No ocultar el acceso a los pendientes fuera de los 50 envíos recientes. Mantener búsqueda y filtros aplicados al regresar desde una ficha dentro del mismo contexto.

El encabezado tiene un título estable, estado cuando sea pertinente, una frase opcional y acciones. Breadcrumb/contexto puede indicar rol y ubicación, pero no repetir tres veces el título. Cuenta web sigue siendo el área lateral actual; no inventar una pantalla para igualar Android. Apoderado web conserva derivación móvil sin enlace de instalación inventado.

Contrato de regreso futuro: cerrar una capa vuelve al disparador; detalle vuelve a lista con filtros/página; sección vuelve a destino anterior según historial de aplicación; salir de sesión elimina contexto privado. El historial existente solo cubre partes de este contrato: completar y probar es trabajo futuro de UX, no un hecho actual.

### Android

Conservar tres destinos persistentes: conductor **Hoy / Mi plan / Ayuda**; familia **Buscar / Solicitudes / Ayuda**. Cuenta se abre desde AppBar. No copiar sidebar, tablas anchas o pestañas de escritorio en una barra de seis destinos. Recorridos/pasajeros siguen siendo subflujos de Hoy, no módulos de edición nuevos.

AppBar muestra origen/título y regreso en subpáginas. Android Atrás cierra primero lector/confirmación, luego tarea secundaria, luego vuelve a origen; la política de borrar o conservar borrador debe ser visible y consistente con el contexto actual. Consultar Cuenta conserva la tarea en sesión; cambiar de rol/cerrar sesión limpia datos. Abrir mapas es salida externa explícita y debe permitir volver.

La barra inferior se mantiene alcanzable con teclado y texto ampliado. Debe probarse altura útil en paisaje/320 px: no declarar resuelto por sumar `viewInsets`. No bloquear todo Atrás durante una lectura por conveniencia; cualquier bloqueo al confirmar/escribir debe evitar duplicados y comunicar espera.

## Catálogo de componentes compartidos

Los nombres siguientes son conceptos de diseño para la matriz; no una nueva API implementada. Compartir estructura y política visual, no controladores de negocio entre pagos, publicación y viajes.

| Código | Patrón y contrato                                                                             | React actual que consolidar                                                    | Flutter actual que consolidar                             |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| C01    | Shell + PageHeader: ubicación, título, acciones, foco de entrada                              | `AuthenticatedWorkspace`, page/publication/task12 headings                     | Contenedores driver/parent, AppBar, `_heading`            |
| C02    | Surface: grupo, énfasis, padding y ancho explícitos                                           | `.panel`, `.driver-surface`, `OperationalPanel`                                | `FurgoOperationalPanel`, `FurgoSurface`, `ParentPanel`    |
| C03    | TaskRow / RecordList: identidad, estado/fecha, acción contextual; divisor, no tarjeta anidada | `OperationalRow`, listas de rutas/solicitudes/admin                            | `FurgoTaskRow`, ListTile, listas familiares/soporte       |
| C04    | StatusLabel: texto, tono, icono semántico, desconocido neutral                                | `StatusBadge`, `AdminBadge`, badges task12                                     | `FurgoStatus`, `ParentStateLabel`, estado diario/soporte  |
| C05    | ReadState / ActionFeedback: inicial/actualizando/error parcial/desconocido/éxito              | `DriverReadNotice`, `DriverActionError`, `Notice`, `ActionFeedback`            | `FurgoMessage`, indicadores y mensajes locales            |
| C06    | Action: primary/secondary/quiet/destructive, busy, disabled con causa                         | Clases `.button` y botones nativos                                             | Filled/Outlined/Text/IconButton del tema                  |
| C07    | FieldGroup: etiqueta, ayuda mínima, valor, error asociado, requerido                          | `FieldError`, controles, `validateForm`, `ChileanDateField`                    | InputDecorationTheme, TextField/Dropdown, errores locales |
| C08    | FilterBar + CollectionNavigation: alcance, aplicado/borrador, resultado, páginas              | `CollectionPages`, `useLocalPage`, filtros admin                               | Comuna, búsquedas, páginas de pasajeros, bandeja soporte  |
| C09    | Details / Facts: label–valor adaptable, expansión y lectura completa                          | `dl`, details/summary, historial                                               | `FurgoFact`, ExpansionTile, ParentDisclosure              |
| C10    | Dialog / Confirmation: entidad, consecuencia, motivo si aplica, aceptar/cancelar, foco        | `DriverDialog`, `FocusPanel`, `AdminFocusPanel`, `Confirmation`, LegalDocument | AlertDialog/DialogRoute y lector legal con PopScope       |
| C11    | Capacity / Progress: numerador/denominador/fecha/alcance, alternativa textual                 | `CapacityText`, meter, requisitos derivados                                    | `FurgoCapacity` y estado de requisitos si existe dato     |
| C12    | ServiceSummary + Comparison: mismos atributos, ruta/fecha explícitas, privacidad pública      | Sin catálogo equivalente conectado en React                                    | ParentServiceIdentity/Card/RouteSummary y comparación     |
| C13    | PlanAccess: nombre/estado/fechas/capacidades efectivas, gestión según rol                     | `DriverReports`, `PlanValidity`, `AdminPublicationScreen`                      | `_plan`, `PlanHelpService`                                |
| C14    | Privacy + LegalReader: consentimiento específico, destinatario, alcance, documento íntegro    | Contacto recibido, formularios soporte y `LegalAccess`                         | Contacto familia, soporte, LegalScope/LegalLinks          |
| C15    | Timeline + Review: identidad/autor/fecha/versión/diferencia, expansión acotada                | Expediente, historial admin y soporte                                          | Conversación de soporte y solicitudes con estado          |

Unificar primero botones, estados, campos, encabezados, superficies, filas y contrato de confirmación. Mantener componentes específicos de capacidad, expediente, servicio y plan para proteger sus significados. La tabla no autoriza una extracción masiva de código en este corte.

## Estados e interacción

| Estado                       | Presentación propuesta                                                   | Acción/condición preservada                                                          |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Carga inicial                | Título estable + indicador etiquetado + texto breve                      | No presentar 0 registros/cupos mientras falta la respuesta                           |
| Actualización                | Conservar datos si el flujo actual lo permite, rotular que se actualizan | Datos anteriores pueden haber cambiado; no conservar permisos revocados como válidos |
| Vacío real                   | Una frase sobre la tarea y una acción existente útil                     | Sin tarjeta de advertencia por ausencia normal                                       |
| Sin coincidencias            | Resultado 0 + filtros activos + limpiar/ampliar búsqueda                 | No afirmar ausencia global de servicios si se filtró comuna                          |
| Error de lectura             | Qué no pudo consultarse y reintentar si es seguro                        | No repetir mutación para recuperar pantalla                                          |
| Error de campo               | Mensaje asociado al campo + resumen/foco cuando proceda                  | Conservar borrador y validación server/client                                        |
| Conflicto/versionado         | Dato cambió; consultar y revisar antes de confirmar de nuevo             | Mantener expected_revision/version y rechazo de obsoletos                            |
| Resultado incierto           | «No pudimos confirmar…» + consultar estado/lista                         | Bloqueo de reenvío conservado; no usar éxito ni reintento automático                 |
| Permiso desconocido/revocado | Disponibilidad por confirmar o restricción concreta                      | No deducir capacidad por nombre del plan, reloj local o CSS                          |
| Éxito confirmado             | Cambio reflejado + aviso breve; sin banner permanente                    | Error/consecuencia no desaparecen por temporizador de éxito                          |
| Confirmación                 | Acción específica sobre entidad y consecuencia; motivo cuando existe     | Confirmar/cancelar inequívocos, busy y foco; no «Aceptar» genérico                   |
| Sesión expirada              | Volver a iniciar sesión, limpieza de datos privados                      | Preservar separación de identidades y descarte de respuestas tardías                 |

Los avisos de soporte/contacto no se deben anunciar simultáneamente por varias regiones vivas sin necesidad. Ya hay toast, texto persistente y Semantics en algunas ramas: revisar anuncios reales con lector, además de DOM. Éxito y error comparten patrón visual con prioridades distintas.

### Formularios

Agrupar por decisión del usuario, no por modelo de base de datos. Datos del servicio: identidad visible/descripción/contacto. Ruta: información/horario → capacidad/cobertura/destino → revisión existente; no eliminar el tercer paso para copiar el prototipo. Asignación: pasajero/apoderado/contacto → ruta/período/recogida. Pago manual: asignación inequívoca/período/monto/vencimiento; mostrar ruta/identidad suficientes para homónimos con datos ya autorizados.

El label permanece visible; la ayuda solo explica formato/consecuencia. Los errores se ubican junto al campo, y el primer inválido recibe foco cuando corresponda. Guardar no cierra si falla; Cancelar/Escape no guardan. Revisión/confirmación conserva entidad, valor resultante y motivo. No añadir autosave, cobros o nuevos datos para mejorar una maqueta.

### Indicadores permitidos

- Ocupación: utilizados/total/disponibles con ruta y fecha recibidas; meter/progreso accesible con alternativa textual. No mostrar asientos físicos o estudiantes presentes.
- Preparación: requisitos confirmados del checklist/bloqueos existentes; un agregado no permite etiquetar arbitrariamente un documento individual como vencido.
- Pendientes: solicitudes/pagos/casos de la colección o total consultados, siempre con alcance. El conteo filtrado no sustituye el total global.
- Reportes: período, estados, importes manuales y comparación autorizada ya disponibles. Sin tendencias, porcentajes de puntualidad, ingresos bancarios, reputación inventada o gráficos vacíos para decorar.

## Composiciones de referencia por tarea

Son esquemas informativos, **no capturas ni diseños renderizados aprobados**. Todo contenido representa campos, no datos reales de personas.

| Tarea                 | Orden propuesto                                                                                          | Acción principal y secundarios                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hoy conductor Android | Fecha del servidor → horario + ruta + estado → acción → capacidad → destino/pasajeros → otros/anteriores | Iniciar o finalizar según estado; actualizar primero si incierto. Destino externo y contactos bajo demanda |
| Inicio conductor web  | Título → bloqueo accionable si existe → pendientes/gestión → rutas/cupos → preparación desplegable       | Requisito pendiente o contactos/pagos. Sin promesa de Hoy ni copia del expediente                          |
| Familia buscar        | Comuna en contexto → cantidad/alcance → alternativas compactas → comparación seleccionada                | Abrir servicio; comparar dos/tres cuando estén seleccionados. Sin precio de transporte inventado           |
| Familia comparar      | Identidades → atributo horario/días → ruta/cobertura → fecha/cupos → revisión/reseñas disponibles        | Abrir servicio seleccionado; quitar alternativa sin perder el resto. Si fechas difieren, declararlo        |
| Familia contacto      | Destinatario → correo a compartir → mensaje → aviso breve → consentimiento → enviar → estado             | Enviar solo con consentimiento. Duplicado/resultado incierto lleva a consultar solicitud                   |
| Familia solicitudes   | Estado + servicio + fecha por fila → detalle con mensaje/contacto autorizado                             | Pendiente: actualizar/cancelar; aceptada: correo; rechazo: buscar alternativa. Sin «reserva confirmada»    |
| Administración        | Pendientes → directorio/caso → estado independiente → evidencia/versión → acción/motivo → confirmar      | Revisar antes de decidir; separar lectura, edición y consecuencias                                         |
| Reportes              | Plan/permiso compacto → período → resultado/alcance → descarga autorizada → detalles                     | Consultar período o descargar; beneficios/explicación a demanda                                            |

Para comparación móvil, preferir un grupo por atributo con valores identificados de cada servicio, en vez de repetir toda la ficha vertical. En ancho/escala insuficiente, apilar valores del mismo atributo; no ocultar columnas esenciales. La solución final requiere prueba con dos y tres servicios y nombres largos.

## Responsive, orientación y accesibilidad

Diseñar por ancho útil del componente y escala de texto. Conservar inicialmente el cambio del shell web a 900 px; los puntos de quiebre de contenido se eligen donde dejen de caber las tareas, no por cada rol. Probar 1440/1280, 1024, 768, 390 y 320 CSS px, además de zoom 200–400 %. El objetivo de [reflujo a 320 CSS px](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) permite excepciones para contenido que requiere dos dimensiones; cualquier tabla desplazable debe tener región/etiqueta y acceso a la misma información esencial.

Android: 320/390 dp, paisaje 844 × 390, texto 100/150/200 % y máximo accesible del dispositivo, pantalla grande del sistema, teclado abierto/cerrado. Probar listas, formularios, diálogos y avisos largos; no solo portada. Evitar overflow, altura máxima de mensajes y acciones fijas que tapen contenido.

Web: Tab/Shift+Tab, Enter/Espacio, Escape, flechas/Home/End en tablists que los implementen; foco siempre visible y retorno al control correcto; skip link; labels y errores asociados; orden lógico al refluir tablas. Android: TalkBack, semántica de botón/selección/estado, sin doble anuncio de capacidad; Android Atrás, cierre de lector legal y retorno de mapas. No resolverlo con un test de presencia de `aria-*` o `Semantics`.

## Gobernanza para evitar otra fragmentación

1. Mantener este sistema como referencia conceptual activa y `.21st/DESIGN.md`/`design.json` como contexto de implementación con cobertura explícita. El primer incremento autorizado los actualiza y conserva el historial; las restricciones temporales de lotes antiguos se rotulan como antecedentes. La auditoría inicial no los modificó.
2. Mantener una tabla de equivalencia React/Flutter: token conceptual, valor, dueño, consumidores y excepción justificada. No exigir un generador nuevo antes de la feria; revisar ambos archivos en el mismo cambio de diseño.
3. Toda pantalla nueva o modificada declara patrones C01–C15 usados y filas de matriz afectadas. Si falta un patrón, se extiende el catálogo y se revisan todos sus consumidores.
4. Regla de revisión: ningún nuevo literal visual sin token/excepción; ningún wrapper por rol que reproduzca una primitiva; ningún override al final de una hoja como solución permanente. No bloquear valores que pertenecen a datos reales, geometría específica o feedback nativo documentado.
5. Referencias visuales por componente y estados aprobadas por una persona, con revisión/versión, SO, fuente, tamaño y escala. Las diferencias nuevas se revisan; no se regeneran todas para hacer pasar CI.
6. Cerrar lote solo con cobertura de consumidores y pendientes explícitos. Una pantalla terminada no convierte las demás en aceptadas. La migración global solo se cierra al completar todas las filas aplicables de la matriz.
7. Cada cambio incluye pruebas funcionales proporcionales, comparación visual actual y revisión de contraste/foco/retorno en sus contextos. Mantener los componentes del dominio y los límites de privacidad como condiciones de conservación.

## Decisiones concretas para aprobar

La propuesta es conservar A/B y Material 3; adoptar los tokens conceptuales/escala y C01–C15; priorizar estados/acciones y comparación familiar; ejecutar una migración por componentes con revisión transversal; reservar 02–03 de noviembre para regresión/observación. Se recomienda aprobar Playwright Test y axe-core solo si la integración cabe en el margen, sin bloquear el uso inmediato de las herramientas existentes. El primer incremento agrega pruebas acotadas de Guideline API con `flutter_test` existente; los goldens y sus referencias siguen pendientes de revisión humana.

No se aprueban por este documento nuevas capacidades, acceso a entornos o escrituras de datos. El plan completo y su recorte realista de feria están en la matriz. La aplicación actual sigue sin aceptación visual nueva de esta auditoría.
