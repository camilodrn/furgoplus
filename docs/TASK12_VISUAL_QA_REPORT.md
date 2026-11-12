> **Actualización integral 31-10-2026:** el encargo vigente incluye F01–F13 completos. Las restricciones y bloqueos de incrementos anteriores de este documento son históricos. Estado actual, evidencia real y pendientes: [implementación integral](TASK12_INTEGRAL_IMPLEMENTATION.md) y [cobertura de 99 filas](TASK12_INTEGRAL_COVERAGE.md). No hay aceptación global ni accesibilidad completa declaradas.

# FurgoPlus T12 — Calidad visual y experiencia del primer incremento

31-10-2026. **Validación parcial con evidencia actual; sin aprobación visual humana ni aceptación global.** No se ejecuta un segundo lote de diseño. Se conservaron las funcionalidades, fuentes y cambios preexistentes.

El resultado útil de esta ejecución es una [galería de 101 renders Flutter actuales](evidence/task12-visual-qa/gallery.html), un diagnóstico de experiencia vinculado a esos renders, una [matriz de las 87 vistas más 12 situaciones](TASK12_VISUAL_QA_COVERAGE.md) y una suite web preparada con barrera de solo lectura. **React no pudo renderizarse; Playwright Test y axe no se instalaron por restricciones de red.** No se presentan capturas de prototipos ni evidencias históricas como observaciones de esta ejecución.

Referencias obligatorias leídas: [auditoría](TASK12_UNIFIED_DESIGN_AUDIT.md), [propuesta](TASK12_DESIGN_SYSTEM_PROPOSAL.md), [matriz original](TASK12_UX_MIGRATION_MATRIX.md), [revisión del incremento](TASK12_VISUAL_IMPLEMENTATION_REVIEW.md). Este informe complementa esos documentos, conserva H01–H19 como antecedentes y no cierra sus hallazgos por pruebas técnicas.

## Qué se comprobó y qué no

| Categoría | Evidencia actual | Límite |
| --- | --- | --- |
| Probado automáticamente | Contratos, TypeScript, lint, build; React **392/392**. Barrera de captura **4/4**. Flutter analyze sin observaciones; ejecutor de motor existente **207/207**. | No equivale a comprensión de usuarios ni aceptación visual. |
| Renderizado e inspeccionado por el agente | **101 PNG**: 70 de la galería integral, 16 de acceso/estados/planes y 15 de conductor. Widgets reales, motor Flutter, fuentes Roboto/Material del SDK y transportes sintéticos existentes. | Viewports concretos; no acredita todo el contenido desplazable, expansiones cerradas, APK, plugins ni Android físico. |
| Revisado por un humano | **Ninguna pantalla en esta ejecución.** El manifiesto mantiene `humanReviewed: false`. | Evaluación con conductores, apoderados, administradores y TalkBack pendiente. |
| Pendiente o bloqueado | Todas las pantallas React en navegador, axe sobre web, runner Flutter convencional, Samsung A54/ADB y referencias golden. | No se afirma que servicios estén detenidos: el sandbox impide comprobarlos. |

Todas las imágenes aceptadas fueron abiertas mediante láminas de conjunto. Además se abrieron individualmente el login normal/ampliado, Hoy, servicio/búsqueda y comparaciones/contacto representativos; la inspección de conjunto no mide contraste de cada píxel ni demuestra legibilidad física. [Manifiesto con SHA-256, fuentes y tamaños](evidence/task12-visual-qa/manifest.json). Los JPEG `review-*` son láminas auxiliares; los PNG enlazados son la evidencia original.

## Herramientas y comprobación del entorno

| Área | Inventario comprobado / decisión |
| --- | --- |
| Web existente | React 19.2.8, Vite 7.3.6, TS 6.0.2, Vitest 3.2.7, Testing Library 16.3.3, JSDOM 27, oxlint 1.81.0, Prettier 3.6.2; npm y package-lock. Sin framework UI nuevo ni `components.json`. |
| Playwright | No hay `@playwright/test`, `playwright` ni `@axe-core/playwright` resolubles desde `web`. Hay Playwright **1.64.0-alpha-1790635538000** en una caché externa de npx: no es un runner equivalente declarado/fijado en el repositorio. No se copió a node_modules. |
| Chromium | Caché existente: chromium/headless shell **1248**, ffmpeg 1013. El Playwright externo espera headless **1247**; el lanzamiento con su ruta por defecto falla. Un único intento explícito con Chromium 1248 y sandbox habilitado aborta por `setsockopt: Operation not permitted`. No se descargó otro navegador ni se deshabilitó el sandbox. |
| Instalación autorizada | `npm install --save-dev --save-exact @playwright/test @axe-core/playwright` con caché en `/tmp`, sin scripts ni reintentos de red: **EAI_AGAIN** para registry.npmjs.org. Se detuvo la instalación. Package.json y package-lock permanecen iguales. [Log](evidence/task12-visual-qa/npm-install.log). |
| Plugins/MCP/skills | Disponibles metadatos de inspiración de 21st, herramientas de vídeo y Playwright MCP. Se aplicaron `21st:21st-ui-review` y `product-design:audit`. CLI `21st` ausente: no se ejecutó `21st review`. No se necesita importar diseños externos para medir este incremento. Product Design no tiene contexto guardado. |
| Acceso al navegador | Playwright MCP rechazó listar pestañas: requiere aprobación con política `never`. Computer Use devolvió `apps: []`, `browsers: []`. No hay navegador conectado utilizable demostrado. No se visitó la demo pública. |
| Servicios académicos | Sondeo exclusivamente a web **127.0.0.1:15173** y API **127.0.0.1:18082**: socket prohibido. `ss` tampoco puede abrir netlink; preflight Docker falla de forma cerrada. **Backend correcto y revisión servida no verificables desde aquí.** No se inició/reconstruyó ningún servicio ni se usaron puertos históricos/demo. |
| Flutter | SDK instalado fuera de rutas escribibles: falla al escribir engine.stamp. Se reutilizó la copia temporal **ya existente**, `/tmp/furgoplus-t12-sdk`, Flutter **3.47.2**, Dart **3.13.2**, motor `a804b261645ef8c13eb3d5c44a5c2fb0340c5539`. Sin pub get ni descarga. |
| Android | ADB 1.0.41 / 37.0.1 existe. `adb devices -l` no puede abrir listener 5037. No se observó ni instaló APK, no se cambió reverse. El código declara `com.example.furgoplus.task12` para debug; no demuestra qué está instalado en el A54. |
| Capturas existentes | `web/scripts/capture-admin-readonly.mjs`, tres generadores Flutter `*preview.dart`, ejecutor sin sockets, galerías históricas y prototipo HTML. Se reutilizaron los generadores; no se confundieron sus modos con web real ni APK. |

El helper web anterior conserva utilidad para aceptación manual admin, pero no cubre axe ni conductor. La configuración nueva está en [playwright.visual.config.mjs](../web/playwright.visual.config.mjs); **está preparada y verificada sintácticamente, todavía no ejecutada con sus dependencias**. No se modifica Vitest. Sus 15 casos previstos son acceso/conductor/admin × cinco anchos; cada caso recorre varias subvistas. Un test contado no representa una pantalla aceptada.

## Protección de las capturas web preparadas

El [preflight](../web/visual/academic-preflight.mjs) exige los tres contenedores académicos ya activos, puertos exactos, redes propias, volumen PostgreSQL académico, settings/base correctos y proxy `backend:8000`. Invoca únicamente la auditoría de escenario existente mediante `docker exec`; no usa compose run/up/build ni carga datos. Compara SHA-256 de **todos** los archivos `web/src` y `vite.config.ts` con el contenedor y comprueba el sourcemap HTTP de App.tsx actual y salud por el proxy. Ante discrepancia o permisos insuficientes, termina antes del navegador. Su integración real queda pendiente de Fedora.

La [barrera](../web/visual/readonly.mjs) restringe el origen exacto a 15173; bloquea todos los métodos de escritura excepto **un POST de login por contexto**, y lo sella tras autenticar. Bloquea descargas privadas, Excel, exports, redirecciones, WebSockets y terceros. No envía decisiones, formularios de negocio, cambios de plan, pagos, solicitudes ni expediente. El runner crea contextos efímeros; sin storageState, HAR, trazas, vídeos ni persistencia de cookies/tokens. Credenciales sintéticas solo en variables de la terminal. Las capturas se toman después del login, nunca con contraseña rellenada. Los resultados quedan en `/tmp/furgoplus-t12-playwright`, fuera del repositorio.

La barrera tiene cuatro pruebas aprobadas sobre métodos, orígenes, URL malformadas, descargas, consumo único del login y redirecciones. Esto valida su política y simulación de rutas; **no acredita aún su integración en un Chromium real**. Una petición bloqueada es un fallo que revisar, no una autorización para quitar la protección. Los controles que falten generan pendientes explícitos; no se inventan registros para cubrirlos.

Los recorridos preparados incluyen Inicio/Mi servicio/Datos/Documentos/Revisión/Publicación/Rutas/Pasajeros y detalle/Pagos y detalle/Solicitudes/Plan y reportes/Ayuda/soporte; admin Inicio/Conductores/filtros/ficha y sus pestañas/Validaciones/expediente/Ayuda/soporte. Las altas, decisiones y operaciones finales quedan fuera de las capturas vivas. Una captura del contenedor de reportes no acredita todos sus desplegables ni las exportaciones.

## Evaluación de producto a partir del render actual

Juicio del agente sobre composición, no prueba con usuarios. Las diez columnas corresponden a las preguntas del encargo: **1** ubicación, **2** información importante, **3** acción principal, **4** tarea sin instrucciones extensas, **5** confianza, **6** orden/atractivo, **7** identidad común, **8** gráficos útiles, **9** texto/componentes con propósito, **10** diferencias entre roles justificadas. `P` = parcial; `NV` = no verificable. «Claro» describe el viewport observado, no una métrica de comprensión.

| Recorrido y evidencia | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Acceso [normal](evidence/task12-visual-qa/access/01-login.png) y [200 %](evidence/task12-visual-qa/access/01-login-text-200.png) | Claro | Claro | Claro | P: sin teclado físico | P: legales visibles, sin confianza medida | Ordenado | Sí | Logo identifica, ojo es control | Breve | Coherente con Android; web NV |
| Hoy → recorrido → pasajeros [lámina](evidence/task12-visual-qa/native/review-390x844-text-100-0.jpg) | Claro | Horario/estado claros | Visible a 100 % | P: sin operación real | P: ensayo identificado | Ordenado | Sí | Capacidad tiene texto/valor | P a 200 % | Subtareas nativas justificadas |
| Buscar → comuna → servicio [lámina](evidence/task12-visual-qa/native/review-390x844-text-100-0.jpg) | Claro | P: atributos después de acciones | P: abrir/comparar compiten | P: selector exige otra vista | Alcance de validación visible | P: ficha densa | Sí | Iconos apoyan datos | P: explicación repetida | Distinto de Hoy por tarea, justificado |
| Comparar 2/3 [normal](evidence/task12-visual-qa/native/apoderado-comparar-3-schedule-390x844-text-100.png) y [200 %](evidence/task12-visual-qa/native/apoderado-comparar-3-schedule-320x844-text-200.png) | Claro | Atributos agrupados | P: acciones lejos de atributos | P: lectura larga | Fechas/ruta explícitas | P a 200 % | Sí | Cupos textuales, sin precio inventado | P: nombres/acciones repetidos | Coherencia de superficie; optimización pendiente |
| Contacto → solicitudes → detalle [lámina](evidence/task12-visual-qa/native/review-390x844-text-100-1.jpg) | Claro | Destinatario/correo claros | Envío condicionado visible | P: sin envío ni teclado | Consentimiento/no reserva visibles | Ordenado; largo a 200 % | Sí | Iconos útiles, sin GPS | P: resumen explicativo repetido | Estados/contacto distintos por tarea |
| Mi plan, básicos/Pro/Elite/sin plan [lámina](evidence/task12-visual-qa/review-access-1.jpg) | Claro | Plan/estado/fecha | Lectura, sin compra | P: expansiones no vistas | No promete pago | Ordenado | Sí | Sin gráfico decorativo | P: longitud con escala grande | Nativo conductor; web NV |
| Ayuda → guías → soporte → formulario/hilo [láminas](evidence/task12-visual-qa/native/review-390x844-text-100-2.jpg) | Claro | P: metadatos antes de respuesta | P: refrescos repetidos | P: artículo fixture muy corto | Identifica equipo/autor | P en hilo ampliado | Sí | Iconos distinguen tareas | P: fechas largas/repetición | Familia tiene menos tareas según permiso; justificado |
| Cuenta → edición de nombre; legales [lámina](evidence/task12-visual-qa/native/review-390x844-text-100-3.jpg) | Claro | Claro | Claro | P: sin guardar ni leer documento completo | Borrador legal visible | Ordenado | Sí | Iconos funcionales | Legal extenso con propósito | Editar solo familia es diferencia funcional |
| Error/vacíos/aceptada/rechazada/cancelada [lámina](evidence/task12-visual-qa/review-remaining-1.jpg) | P: error antecede título | Estado textual claro | Reintentar/Buscar claros | P: recuperación en motor | No reserva explícito | Ordenado | Sí | Color acompaña texto | P: revisar copy de error inicial | Coherente entre estados observados |
| Conductor y administrador web | NV | NV | NV | NV | NV | NV | NV | NV | NV | NV |

Se conserva una base valiosa: Hoy tiene una acción ligada al estado real del fixture; capacidad acompaña numerador/denominador/fecha; cuenta y Ayuda comparten tratamiento; los estados de contacto se explican con texto y no se presentan como reservas. No se detectó un overflow RenderFlex en estas capturas. **Que una acción quede bajo el pliegue con texto grande no demuestra que esté oculta o sea inalcanzable**: requiere observar desplazamiento y teclado en dispositivo.

## Correcciones propuestas, todavía sin implementar

| ID / prioridad | Evidencia actual y ubicación | Impacto observado / alcance | Cambio concreto para revisar y criterio de salida |
| --- | --- | --- | --- |
| V01 / P1 | P03, [comparación inicial 320/200](evidence/task12-visual-qa/native/apoderado-comparar-3-320x844-text-200.png), [horarios](evidence/task12-visual-qa/native/apoderado-comparar-3-schedule-320x844-text-200.png); `parent_service.dart:281` | La primera pantalla ampliada todavía está en identidades/acciones. Los mismos nombres ocupan varias líneas por atributo; comparar exige desplazarse. Sin medición de abandono. | Priorizar ruta/horario en la entrada y compactar el bloque inicial de acciones; conservar nombre junto a cada valor y toda fecha/capacidad. Revisar 2/3 servicios con nombres distintos/largos a 100/200 %, apertura/quitar/regreso. No reducir el texto global. |
| V02 / P1 | P01, [Buscar](evidence/task12-visual-qa/native/apoderado-buscar-390x844-text-100.png); `parent_service.dart:181–221` | «Ver servicio»/«Comparar» aparecen antes de horario/fecha/cupos; el dato que permite elegir queda después del control. | Ordenar identidad → ruta/horario/cupos → acciones. Conservar la explicación de validación próxima y completa. Validar que abrir/comparar se distingan y que el lector lea atributos antes de acciones. |
| V03 / P1 | P07, [contacto 320/200](evidence/task12-visual-qa/native/apoderado-contacto-320x844-text-200.png), [acción](evidence/task12-visual-qa/native/apoderado-contacto-accion-320x844-text-200.png); `parent_home.dart:1041` | Correo y explicación separan destinatario del mensaje/consentimiento; el consentimiento ocupa muchas líneas. No se observó teclado ni tamaño táctil real del checkbox. | Agrupar destinatario/correo en un resumen compacto, evitar reiteración literal del correo e identificar el consentimiento con texto específico. Mantener checkbox desmarcado, privacidad, consecuencia y destinatario. Comprobar con teclado A54, 200 % y TalkBack antes de implementar globalmente. |
| V04 / P2 | D03/D04, [recorrido 320](evidence/task12-visual-qa/driver/recorrido-320x844-text-100.png); `driver_home.dart:738` | AppBar trunca «Información del recorrido» y el cuerpo vuelve a titular «Tu recorrido». El cuerpo conserva el contexto: no es pérdida total de información. | Usar un título corto estable de subvista y evitar encabezados redundantes. Comprobar nombre completo accesible, Atrás y Cuenta en 320/200 %. |
| V05 / P2 | F04/F06, [hilo ampliado](evidence/task12-visual-qa/native/conductor-hilo-320x844-text-200.png); `plan_help_screen.dart:773,890` | Estado/gravedad/atención/fecha larga y refresco preceden la respuesta; en 200 % no se ve aún la conversación en el primer viewport. | Dar prioridad a la última respuesta y dejar metadatos secundarios bajo demanda, conservando estado/autor/fecha y motivo íntegros. Unificar la posición del refresco. Probar hilo largo y formulario inferior, sin SLA ni conteos nuevos. |
| V06 / P2 | P02, [comuna](evidence/task12-visual-qa/native/apoderado-comuna-390x844-text-100.png); `parent_home.dart:817` | Una vista completa contiene un selector y acción; se pierde visualmente la lista de alternativas. No es un fallo de consulta. | Evaluar el selector en contexto de Buscar con aplicado/borrador explícitos; conservar Aplicar/Limpiar/Cancelar y el error de catálogo. Comparar esfuerzo con personas antes de modificar navegación. |
| V07 / P2 | D01/P01/P04/F01, [conjunto 320/200](evidence/task12-visual-qa/native/review-320x844-text-200-0.jpg) | Aviso sintético, título, identidad y validación ocupan mucho alto antes del dato operativo. El escalado funciona; no justifica disminuir fuente ni esconder advertencias. | Revisar espacio entre grupos y duplicación de mensajes; mantener visible el aviso de ensayo y el alcance de validación. Aceptar desplazamiento normal y probar acceso real a la acción; nunca fijar altura de texto. |
| Q01 / P1 | Web bloqueada y guideline acotada; [logs](evidence/task12-visual-qa/) | No hay evidencia para aceptar deriva C01/C02/C06/C07 React ni los cuatro contratos de foco H07. | Ejecutar suite en Fedora, revisar axe/`incomplete`, teclado y zoom; después comparar acceso/conductor/admin juntos. No trasladar una corrección Flutter a CSS por suposición. |

V01–V07 son recomendaciones de experiencia del agente basadas en imágenes, no defectos WCAG certificados. No se modificó producto para resolverlas. Se propone primero revisar V01/V02/V03 con personas y obtener evidencia web; después decidir un incremento acotado con todos los consumidores.

## Accesibilidad: resultados y pendientes

La suite preparada ejecuta `new AxeBuilder({ page }).analyze()` en cada estado capturado, con reglas predeterminadas, sin exclusiones. Conserva IDs, severidad, objetivos e `incomplete`; no guarda cuerpos HTTP ni HTML con valores. Una violación falla el test; no se modifica una regla o referencia para hacerlo pasar. **En esta sesión: cero análisis axe ejecutados; no significa cero violaciones.**

Flutter volvió a ejecutar las pruebas de `unified_visual_system_test.dart`: objetivos Android, nombres y contraste de una composición de primitivas; comparación de dos/tres, atributos de rutas/fechas distintos, 320/200 % y paisaje 844×390/200 %; ausencia de ruta sin capacidad fabricada. También se ejecutaron las suites de semántica de capacidad, enlaces legales, privacidad, sesión, retorno y recuperación. El motor aprueba 207 pruebas, pero no valida el orden TalkBack real ni todos los controles de cada pantalla. [Log](evidence/task12-visual-qa/flutter-motor-tests.log).

Contraste calculado de primitivas y guideline **no sustituyen** contraste renderizado web, estados hover/focus, foco al volver, anuncios duplicados ni revisión física de checkbox/campos/diálogos. No se aplicaron puntuaciones de accesibilidad inventadas.

Goldens: **pendientes, sin referencias generadas o aceptadas**. El runner convencional no carga ningún archivo por sockets; no se usa el ejecutor interno para dar por aprobada una infraestructura nueva de comparación. Primero revisar dos candidatos de C02/C04/C06 (normal y 200 %), fijar SDK/motor/fuentes y aprobarlos humanamente; después añadir un golden acotado con `matchesGoldenFile`. No copiar los 101 renders como referencias ni ejecutar una actualización masiva. Las capturas actuales sirven para esa revisión inicial, no como baseline tácita.

## Consumidores compartidos y continuidad

| Patrón actual | Dueño y consumidores comprobados | Evidencia / siguiente revisión transversal |
| --- | --- | --- |
| C02 superficie Flutter | `furgo_widgets.dart:20` → FurgoOperationalPanel, FurgoTaskRow, ParentPanel, ParentDisclosure, ParentServiceComparison, plan/Ayuda. DriverHome usa adaptador operacional; ParentHome usa panel/disclosure. | D01/D03/D09/D10, P01/P03/P04/P07/P08/P09/P11 y F01 observados parcialmente. P05/P06: encabezados/etiquetas; expansiones pendientes. No cambiar padding global desde una sola ficha. |
| C04/C05 estados/feedback | FurgoStatus/FurgoMessage; ParentStateLabel; tema `furgo_theme.dart`; feedback local de DriverHome/Help. | Hoy planned/in_progress/completed/vacío, contacto pendiente/aceptada/rechazada/cancelada, vacío y error. Unknown/ocupado/conflicto y anuncios reales pendientes. |
| C06/C07 tema Material | `furgo_theme.dart` usado por AuthApp y ambos roles, campos/botones nativos y legales. | Login, comuna, contacto, nombre y soporte renderizados. Teclado, autofill y errores físicos pendientes; sin cambio de métricas. |
| C11 capacidad | `FurgoCapacity` → Hoy/detalle/pasajeros y servicio/comparación familiares. Web `CapacityText` → PublicationScreens y DriverOperations (rutas/pasajeros/Inicio). | Flutter con fecha/alcance; distintos valores comprobados en widgets, no en todas las capturas. Consumidores React bloqueados. |
| C12 servicio/comparación | `parent_service.dart` → Buscar, servicio y ParentServiceComparison en ParentHome. | V01/V02 deben revisarse juntos, conservando ruta pertinente, privacidad y fechas. |
| C01 iconos web | `ProductIcon` en DriverExperience → App (shell driver/admin), HelpSupport, DriverReports, PublicationScreens, DriverOperations. | Consumo comprobado en código; apariencia/foco no observados. |
| C04 badges web | StatusBadge de ValidationScreens → información del conductor, historial, cola y expediente. AdminStatusBadges sigue especializado. | Regresión DOM pasa; neutral renderizado aún no observado. |

La [matriz nueva](TASK12_VISUAL_QA_COVERAGE.md) contiene una fila por cada ID original, conserva plataforma/rol/componentes y enlaza la evidencia parcial. Hay **24 de 87 filas con algún viewport Flutter observado**, incluyendo dos filas solo por etiquetas/encabezados; ninguna fila queda aprobada en su totalidad. Las 53 vistas React carecen de observación actual. Las 12 situaciones se registran aparte sin convertir una captura de vacío en cobertura de carga/conflicto/sesión.

## Verificación técnica y preservación

| Comando / modo | Resultado actual |
| --- | --- |
| `npm run contract:check`, `npm run typecheck`, `npm run lint`, `npm run build` | Aprobados. Logs separados en evidencia. |
| `npm test -- --maxWorkers=1` | 21 archivos, **392/392**, 112,43 s. No se cambiaron tiempos ni configuración Vitest. |
| Sintaxis Node + oxlint + Prettier sobre nueva configuración/visual | Aprobados; imports de Playwright/axe no resolubles aún. |
| `node visual/readonly.check.mjs` | **4/4**, sin navegador. Se corrigió en la barrera una URL malformada detectada por su propia prueba; no se retiró el caso. |
| `flutter analyze --no-pub`, SDK temporal existente | Sin observaciones. |
| `flutter test --no-pub --concurrency=1`, mismo SDK | **Bloqueado: 0 casos ejecutados, 11 archivos fallan al cargar**, bind localhost `Operation not permitted`. [Log](evidence/task12-visual-qa/flutter-test.log). |
| `tool/test_without_sockets.dart` + flutter_tester | **207/207**, modo alternativo explícito; no sustituye al runner convencional. |
| Tres generadores de previews existentes + flutter_tester | Aprobados; **70 + 16 + 15** PNG nuevos. Sin transporte real, sin escrituras de negocio. |

No se modificaron fuentes React/Flutter, tests de producto, backend Django, contratos, base, migraciones, infraestructura, sesiones ni configuración Android. Package.json/package-lock/pubspec.lock se conservaron. [Preservación por hashes](evidence/task12-visual-qa/preservation.json). Sin commit, push, merge, deploy ni acceso a servicios externos del producto.

Reproducción concreta, instalación interrumpida, verificación previa del académico y protocolo físico: [Fedora y Samsung A54](TASK12_VISUAL_QA_REPRODUCTION.md). La siguiente revisión debe ejecutar esos recorridos y contrastar V01–V07 antes de autorizar otro lote visual.
