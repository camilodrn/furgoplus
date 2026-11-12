# FurgoPlus T12 · Cierre de correcciones C1–C7

31-10-2026. **Cambios implementados; producto todavía sin aprobación integral.** Este informe registra el incremento, sus comprobaciones y su continuidad. No sustituye la matriz histórica ni presenta pruebas automáticas como aprobación visual.

[Galería dirigida](evidence/task12-closure/index.html) · [Procedencia](evidence/task12-closure/manifest.json) · [99 filas actualizadas](evidence/task12-closure/coverage.json) · [Versiones y hashes](evidence/task12-closure/source-hashes.json).

## Correcciones y cuatro dimensiones

«Resuelto» se limita al defecto y los casos indicados. F = funcionalidad, U = facilidad, V = calidad visual, C = consistencia. Las apreciaciones visuales son del agente; el usuario facilitó los inicios de sesión, sin aprobar el producto.

| Corrección | Estado | Cambio y comprobación independiente | Falta para cerrar su alcance completo |
|---|---|---|---|
| C1 Responsive/estados | Resuelto en los casos comprobados | Estado sin cortes dentro de Aprobado; resumen refluye. Ruta estrecha usa todo el ancho, horario primero, destino/días/capacidad/fecha y acciones legibles. Se corrigió además un desborde de 8 px en las pestañas del servicio a 320/200 %. F: navegación y regresión. U/V: capturas auténticas a 320/390/768/1440 y texto CSS 200 %; nombres largos en fixtures. C: reglas originales y consumidores compartidos. | Zoom real de Chromium y estados excepcionales de todos los consumidores siguen en S07/S10. |
| C2 Administración | Resuelto en las lecturas comprobadas | Cola primero; indicadores debajo; filtros locales progresivos con alcance explícito. En la ficha, pestañas junto a identidad; Plan/Validaciones/Historial antes de acciones y resumen comunes. F: motivos, versiones, límites, permisos y filtros conservados; 52 pruebas finales. U/V: cola y Plan/Historial reales inspeccionados en escritorio/móvil. C: composición y controles existentes. | Escrituras y variantes excepcionales de expedientes/soporte se mantienen pendientes en sus filas; no se aprobaron por esta lectura. |
| C3 Comparación familiar | Parcial | Ver servicio/Quitar dentro de cada fila de identidad y horario, antes de ruta/cobertura/cupos; sin cabecera grande nueva. F: selección, quitar, regreso y fechas/nombres largos en regresión. U/V: 2/3 servicios en renders nativos 390/100 % y 320/200 %. C: mismo componente por atributos y controles Material. | Nuevo código aún sin captura auténtica Android. P03 vuelve a pendiente. |
| C4 Vocabulario | Parcial | React unifica Gravedad / Describe el problema / Consultas de soporte; formulario real final inspeccionado. Guías Flutter adaptan «En esta web» a «En esta app» y «tickets de soporte» a «consultas de soporte». React normaliza esta última expresión en artículos. F: contrato/campos intactos. U: rótulos claros. V/C: React observado, Android solo código/regresión. | Comprobar el artículo real en Android actualizado. Normalización editorial canónica del contenido Django documentada abajo, sin modificarlo. |
| C5 Formularios/consecuencias | Parcial | Advertencia de revisión junto al nombre del servicio. Guardar y Continuar se explican según su comportamiento real. Editor de ruta distingue avance de borrador y guardado final; tres etapas capturadas sin guardar. Privacidad de soporte junto a la descripción, con gravedad/emergencias próximas. F: guardas y errores conservados. U/V: formularios reales de ruta/soporte inspeccionados. C: componentes existentes. | Completar estados visuales de errores, confirmaciones y todos los formularios; escrituras finales solo en entorno aislado autorizado. Contacto familiar ya posee destinatario/correo/consentimiento contextual; se conserva, sin nueva aprobación global. |
| C6 Pulido transversal | Parcial | Actualizar usa acción secundaria discreta en rutas/pasajeros/pagos/solicitudes. Cuenta conductor tiene un título; Recorrido evita cabecera duplicada. Índice legal cerrado inicialmente. Lector web en portal: conserva lectura al cambiar escritorio→móvil y Escape devuelve foco al contenido si el disparador quedó oculto. Se retiraron miniaturas históricas de carga engañosas y se excluyó una captura de pantalla anterior. F: regresión de consumidores y nuevo caso de foco. U/V/C: lector real y patrón compartido inspeccionados. | Cuenta/recorrido Android nuevos aún sin dispositivo actualizado; tratamientos de refresco excepcionales y accesibilidad hablada siguen pendientes. |
| C7 Pasajeros/operación | Parcial | Android: contexto de recorrido/horario/fecha diferenciado, capacidad en grupo propio, registros reconocibles con icono, recogida y contacto progresivo. Web: búsqueda antes de capacidad en ancho compacto, identidad destacada, metadatos de fila a ancho completo y filtros legibles; alcance secundario progresivo. F: búsquedas, páginas, privacidad, navegación y permisos conservados. U/V: web auténtica a cuatro anchos; Android sintético inspeccionado. C: FurgoSurface, capacidad, tabla e iconografía existentes. | Antes Android es APK auténtico; después Android es render sintético. Falta el antes/después físico de la versión nueva. No se afirma aceptación del conductor. |

No se añadieron asistencia, presencia, GPS, ETA, reservas, métricas, pagos ni capacidad nuevos. El indicador utiliza los cupos del contrato existente; los datos de ensayo de renders están identificados como fixtures.

## Estado F01–F13

| Hallazgo | Actualización de este cierre |
|---|---|
| F01 Buscar | Conservado; no nueva aprobación de todos sus estados por compartir componentes. |
| F02 Comparar | Acciones acercadas; pendiente físico del nuevo código, C3/P03. |
| F03 Solicitudes | Orden/filtros conservados; refresco secundario React coherente. Mantiene pendientes previos de decisiones. |
| F04 Comuna | Conservado; pruebas familiares pasan. Sin nueva aprobación visual completa. |
| F05 Navegación | Tabs administrativas y fronteras de sesión comprobadas; lector legal conserva contenido entre anchos y foco al cerrar. Android nuevo pendiente. |
| F06 Formularios | C5 aplicado a nombre/avance de ruta/soporte. Confirmaciones y escrituras esenciales siguen abiertas. |
| F07 Responsive | C1 corregido en casos auténticos y fixtures; zoom real y barrido global pendientes. |
| F08 Administración | Cola/tarea seleccionada priorizadas; C2 comprobado en lectura, sin reglas de negocio nuevas. |
| F09 Semántica | Estados y observación neutral conservados; Aprobado legible. No se reabrió el defecto de observación como rechazo. |
| F10 Planes/reportes | Plan administrativo antes de contexto común; reporte mensual conserva datos. W31 reabierto para inspeccionar su tabla de cupos expandida tras cambiar el patrón compacto. |
| F11 Confianza/contacto | Privacidad/consecuencias conservadas; soporte coloca la ayuda cerca del campo. Sin envío académico ni reserva inferida. |
| F12 Consistencia/calidad | Se aplica el requisito de cuatro dimensiones. No cerrado: 65 filas tienen alguna comprobación pendiente. |
| F13 Accesibilidad | Mejoras de jerarquía, nombre accesible, reflujo y foco. Axe sintético dirigido complementa evidencia; no hay conformidad integral ni TalkBack hablado nuevo. |

## Calidad por rol y plataforma

| Área | Funcionalidad | Facilidad | Calidad visual | Consistencia |
|---|---|---|---|---|
| Acceso/registro React | Regresión de sesión/legal aprobada | Base anterior conservada | Registro completo y excepciones continúan pendientes | Sin cambio de marca/framework; no aprobación por herencia |
| Conductor React | Regresión y lecturas auténticas | Búsqueda primero en compacto; acciones/consecuencias más claras | Rutas, pasajeros, detalle, editor y soporte inspeccionados; faltan estados excepcionales | Tablas/acciones/estados compartidos y consumidores identificados |
| Administración React | Regresión final y lectura sin cambios de negocio | Cola y sección elegida preceden al contexto común | Soporte, Plan e Historial comparados con capturas anteriores | Una composición por tarea, mismos controles y navegación |
| Conductor Flutter | 213 pruebas de la app aprobadas | Mejor organización propuesta e inspeccionada en motor | Nuevo recorrido/pasajeros/contacto solo sintético; APK físico anterior conserva evidencia histórica | Material 3/FurgoSurface existentes; validación física pendiente |
| Apoderado Flutter | Regresión familiar aprobada | Acciones de comparación cercanas; contacto conservado | Comparación nueva solo sintética; Buscar/Solicitudes mantienen evidencia anterior | Mismo componente de atributos; textos de guía necesitan contraste físico |
| Ayuda/legales/estados | Contratos y regresión conservados | Índice progresivo; privacidad contextual; retorno de foco visible | Lector auténtico verificado al cambiar ancho; estados excepcionales aún parciales | Carga/vacío/error no se aprueban por heredar una superficie |

Se revisó la cobertura vigente y las zonas sin demostración suficiente, sin repetir la auditoría de 99 filas. Acceso/registro completo, estados de error/caducidad, documentos privados, decisiones, confirmaciones, variantes de plan y operaciones finales conservan pendientes explícitos. No se añadieron rediseños donde no apareció un defecto nuevo respaldado.

## Componentes y consumidores

| Archivos/patrón | Consumidores revisados y límite |
|---|---|
| `style.css`: StatusBadge/status-summary | Perfil/revisión/historial propios y cola/expediente administrativos. Revisión real; variantes restantes en regresión, no todas recapturadas. |
| `operational.css`: route-line/onboarding-steps | Inicio, Rutas y etapas del servicio. Cuatro anchos de Rutas; Revisión 320/200 % sin desborde tras corregir pestañas. |
| `operational.css`: OperationalTable | Pasajeros, pagos manuales, cupos de reportes. Pasajeros/pagos reales; **tabla de cupos expandida W31 pendiente**, no aprobada por herencia. |
| `DriverOperations.tsx` | Identidad del pasajero, filtro de ruta con nombre accesible completo, alcance progresivo; acciones y contacto privado conservados. |
| `AdminControls.tsx`, `HelpSupport.tsx`, `help-support.css` | Cinco pestañas del conductor; cola, resumen de página, filtros y formularios de soporte por rol. Las pruebas finales mantienen razones, versiones y recuperación. |
| `PublicationScreens.tsx`, `ValidationScreens.tsx`, `DriverRequests.tsx` | Tres etapas de ruta; nombre/identidad y paso a documentos; refrescos secundarios. Crear/editar/decidir no se ejecutó contra datos académicos. |
| `LegalAccess.tsx` | Acceso, registro, sidebar conductor/administración y entrada familiar web. Portal, índice, Escape y retorno probados; no cambió el contenido ni la aceptación legal. |
| `driver_home.dart` | Hoy→información→pasajeros→contacto y Cuenta; conservada navegación de destinos y filtros. Contexto nuevo y superficies inspeccionados en motor. |
| `parent_service.dart` | ParentServiceComparison desde Buscar; detalle/regreso/quitar y selección mantienen regresión. Sin modificación de búsqueda/contacto. |
| `plan_help_screen.dart` | Guías conductor/apoderado; adaptación de plataforma solo en presentación de artículos. Contrato y contenido persistido intactos. |

La búsqueda 21st se usó como contraste de patrones de identidad; se reutilizaron componentes del proyecto, sin instalar el catálogo. `21st review`: 0 errores, 0 advertencias y 2 sugerencias sobre colores preexistentes; no se cambiaron por estética.

## Cobertura y evidencia

Las **87 vistas/subflujos + 12 situaciones = 99 filas** conservan sus IDs. Estado vigente: **29 migradas y verificadas, 5 conservadas y verificadas, 65 con alguna validación pendiente**. Estas etiquetas indican el alcance de evidencia de la matriz; **no significan aprobación simultánea de las cuatro dimensiones**.

Se reabrieron **D03, D04, D05, D10, P03, F02, F03** porque el nuevo Dart no está en el APK observado, y **W31** porque cambió su tabla compartida sin nueva captura de ese detalle expandido. No se añadieron aprobaciones por pasar tests. Las demás filas mantienen su alcance histórico, con la evaluación independiente y límites en el JSON de cierre. Todas las situaciones S01–S12 conservan sus pendientes previos salvo el alcance puntual documentado.

La galería contiene **32 capturas lógicas React auténticas** (viewport + full cuando corresponde), **12 renders Flutter sintéticos** y **7 ejemplos React sintéticos**. Los 22 escenarios del diagnóstico axe están separados de la galería auténtica. Capturas intermedias, la lectura legal oculta la captura vacía al desplazar y el intento de abrir filtros mediante un selector incorrecto no se muestran como resultados finales.

Comparación visual del agente:

- Rutas 320: desaparece la columna estrecha que comprimía destino/días/cupos; horario, contenido y acciones ocupan el ancho disponible.
- Administración: Plan/Historial suben antes de contexto y acciones comunes; la cola deja de anteponer indicadores y filtros locales expandidos. Los indicadores siguen describiendo **esta página**, sin inventar totales globales.
- Pasajeros web: búsqueda y registros preceden a capacidad en compacto; la identidad no compite con una columna de etiquetas estrecha. No se interpreta una asignación como presencia física.
- Android: antes auténtico del APK anterior frente a después **sintético**, con datasets de ensayo distintos; permite valorar composición, **no es una comparación física equivalente ni una aceptación humana**.
- Legales: índice cerrado deja ver el documento inmediatamente; el diálogo permanece visible fuera del sidebar y vuelve al contenido al cerrar si el botón original quedó oculto.

## Pruebas y accesibilidad

- React: **394/394** en regresión completa con un trabajador. Después, **52/52** de administración y **77/77** de lectores/sesión/App tras los últimos ajustes; este último grupo incluye **un caso nuevo** de foco al quedar oculto el sidebar. No se afirma una suite completa nueva de 395 casos ejecutada de una vez.
- Flutter: **213/213**, runner convencional. `flutter analyze --no-pub`: sin incidencias. El intento inicial dentro del sandbox falló al abrir puertos; se ejecutó después con el permiso correspondiente, sin alterar expectativas para ocultarlo.
- Tipos, lint, contratos y build React: aprobados. Fuentes HTTP de **35 archivos** comparadas con el árbol en **15174**, proxy saludable. Sin utilizar 15173 como versión actual.
- Axe 4.14.0: **22 comprobaciones sintéticas dirigidas, 0 violaciones, 8 con incompletos de contraste**. Los nodos incompletos son flechas/checks decorativos `aria-hidden`; se revisaron fuente y composición, con texto redundante de estado/acción. Esto no se convierte en conformidad de contraste global ni sustituye comprobación asistida.
- Corregidas jerarquías de títulos y nombre accesible de selección de ruta observadas en axe. Conservados objetivos de 48 px, foco, estado textual y semántica Material. Teclado/Escape y reflujo legal comprobados realmente; el retorno final tiene `activeElement: MAIN`.
- Texto **CSS 200 % no equivale a zoom real**. Zoom de Chromium, TalkBack hablado, teclado/errores en todos los formularios, orientación y todas las combinaciones de estados siguen pendientes.

Los fallos iniciales React incluyeron selectores que debían seguir el vocabulario/estilo autorizado, un nombre accesible sin espacios entre nodos y dos timeouts bajo ejecución paralela. Se corrigieron espacios y se esperó el resultado asíncrono real en la prueba pertinente; la regresión completa pasó con un trabajador, sin aumentar timeouts ni relajar contratos. El test de orden administrativo ahora comprueba que Plan precede al resumen, conforme a C2, conservando el resto de verificaciones.

## Versiones, preservación y continuidad

Base Git `c0854de9e571686aabe10fb8dd57496e2f8d88dd`, árbol con cambios T12 preexistentes. La identidad exacta del código nuevo está en `source-hashes.json` (`workingTreeId` y SHA-256 por fuente), no en un commit nuevo. Los PNG/JSON registran hora, pantalla, viewport, API y ausencia de acciones bloqueadas.

A54 comprobado con el preparador aportado por el usuario: **SM-A546E, Android 16, 0.1.0+1**, APK SHA-256 **`b957d8a625b8a538cae8c83f801063d62693e5356d41ea70c1c0eb11205956da`**. Django saludable, socat existente y reverse recuperado; sesión conductor vigente. El APK instalado **no contiene este incremento**. No hubo reinstalación, borrado de datos ni nuevo APK presentado como final. `flutter attach` no encontró servicio de depuración; se detuvo sin recargar código. No se desactivó autenticación.

Antes de editar se guardaron estado, diff y hashes de 1819 archivos. La comprobación incremental conserva backend/contratos/infraestructura y no encuentra archivos iniciales eliminados. Sin PostgreSQL académico, cambios de Django/API, contenedores, homelab, demo pública, commit, push, merge o deploy. Solo se recuperó el puente mediante el preparador autorizado y se levantó la web actual en 15174. Servidor temporal de fixtures limitado a localhost y separado de las capturas auténticas.

Origen de C4: `backend/drivers/help_content.py`, artículo `parent-start`, versión `2026-10-19.1`, incluye la frase de web/tickets. Se adapta al presentar en cada cliente. Una futura edición canónica debe neutralizar la referencia de plataforma, usar «consultas de soporte» y versionar el contenido; **este cierre no cambia Django, contratos ni datos**.

Próximos pasos exactos:

1. Preparar un APK con las fuentes registradas, comprobar paquete/hash/configuración y acordar su actualización en el A54. Esta ejecución respeta la instrucción de no reinstalar. Repetir solo D03/D04/D05/D10/P03/F02/F03 con antes/después auténtico, Android Atrás, selección, filtros y texto ampliado.
2. Abrir **Plan y reportes → Ver cupos actuales** en 320/390/768/1440, inspeccionar la tabla expandida y cerrar W31 únicamente con su evidencia.
3. Completar los pendientes ya enumerados en cada una de las 65 filas: documentos privados, confirmaciones, variantes de plan/errores y operaciones esenciales. Iniciar/finalizar servicios, altas/ediciones de asignaciones/rutas, pagos, decisiones administrativas y envío/respuesta de consultas **no se ejecutaron** sobre datos académicos.
4. Comprobar zoom real, TalkBack hablado, foco/teclado, orientación y estados excepcionales; después obtener revisión humana de las cuatro dimensiones por área. Ningún pendiente ha sido aceptado por el usuario como excepción para aprobar el producto.

La implementación queda preservada y revisable. **FurgoPlus todavía no se declara candidata a aprobación integral.**
