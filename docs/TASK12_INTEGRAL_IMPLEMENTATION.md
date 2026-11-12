# FurgoPlus T12 — Implementación integral F01–F13

**Corte posterior C7/C8:** [cierre vigente](TASK12_FINAL_UX_CLOSURE.md). APK final actualizado en A54; C8 implementada para solo tecnologías necesarias. Cobertura actual: 34 migradas verificadas, 5 conservadas verificadas y 60 pendientes. Las cifras del cuerpo corresponden al incremento histórico anterior.

31-10-2026. **Implementación ampliada a todo el producto; aceptación integral todavía pendiente.** El alcance incluye conductor y administración React, conductor y apoderado Flutter, acceso, Cuenta, ayuda, formularios, documentos, planes, reportes y estados transversales. No se ha reducido al recorrido familiar ni a las pantallas de la feria.

La [cobertura completa](TASK12_INTEGRAL_COVERAGE.md) clasifica las **87 vistas/subflujos y 12 situaciones**: **37 migradas y verificadas, 5 conservadas y verificadas, 57 implementadas con validación visual pendiente y 0 bloqueadas por conectividad actualmente**. Una fila puede reunir varios estados o una escritura final: abrir su formulario no aprueba toda la fila. Las limitaciones específicas están en cada registro; no hay aceptación humana del producto.

[Galería antes/después](evidence/task12-integral/index.html) · [Manifiesto de procedencia](evidence/task12-integral/manifest.json) · [Cobertura JSON](evidence/task12-integral/coverage.json) · [Fuentes finales](evidence/task12-integral/source-hashes.json).

## 1. Fuentes y protección del proyecto

Se revisaron la auditoría unificada, la propuesta de sistema, la matriz de migración, la revisión de implementación y los informes QA/cobertura anteriores. Sus restricciones de un primer incremento son históricas: la instrucción actual autoriza F01–F13 completos. Se recuperó el paquete auténtico anterior de **71 capturas**, que se conserva como referencia. El prototipo HTML local `docs/design/task12-product-prototype/` es una referencia del repositorio; no se presenta como el HTML original de ChatGPT Work ni como evidencia de la aplicación ejecutada. El contenido F01–F13 aportado por el usuario fija el alcance vigente.

Antes de editar se guardaron estado, diff y hashes del árbol preexistente. El repositorio ya contenía una implementación extensa sin commit, incluidos cambios de backend e infraestructura ajenos a esta intervención. La comparación contra esa instantánea, y no contra HEAD solamente, permite distinguirlos. No se borraron archivos preexistentes. No se modificaron Django, contratos/API, migraciones, datos académicos, Docker, servicios, credenciales ni configuración de infraestructura. No hay commit, push, merge o despliegue.

Se reutilizan React y Material 3, fuentes de sistema, el azul `#0752AC` y los componentes existentes. No se añadió un framework UI ni una dependencia al proyecto. Playwright y Chromium proceden de las herramientas ya disponibles; axe-core 4.14.0 se instaló exclusivamente en `/tmp`, tras fallar DNS dentro del sandbox y aprobarse su ejecución externa.

## 2. Estado de los trece hallazgos

| Hallazgo | Implementación y comprobación | Estado y límite |
|---|---|---|
| F01 Buscar transporte | Identidad, cobertura, ruta, horario, fecha/cupos y reseñas preceden a Ver/Comparar. Identidad compacta y una explicación común de validación interna; el detalle conserva la explicación completa. Tres servicios reales inspeccionados en A54. | Aplicada y verificada en el recorrido real disponible. Vacío/error/variantes de capacidad tienen pruebas y previews; no se inventaron datos para fotografiarlos. |
| F02 Comparar servicios | Horario primero; después ruta, cobertura, fecha/cupos y reseñas. Cada valor conserva la identidad del servicio. Dos y tres alternativas se adaptan al ancho; Ver y Quitar siguen presentes. Volver desde detalle regresa a comparación. | Dos/tres alternativas y texto 200 % físicos; nombres/fechas diferentes y anchos extremos también automatizados. Comparar tres exige más scroll vertical en un teléfono estrecho; no se encogen las fuentes para ocultarlo. |
| F03 Solicitudes | Partición estable de pendientes antes de historial sobre la respuesta completa existente, tanto familiar como conductor. Se conservan todos los estados y el revelado/paginación posterior. La cola administrativa declara su límite de 50 y su búsqueda local. | Lista familiar real con cuatro estados; regresión de filtros/páginas web aprobada. Falta recapturar el título final de la bandeja conductor. No se presenta un orden parcial como global. |
| F04 Comuna | Selección contextual dentro de Buscar; resultados permanecen visibles. Borrador distinto de filtro aplicado, Buscar explícito, limpiar solo el borrador y Atrás/Cerrar sin aplicar. | Verificada físicamente: seleccionar, aplicar, limpiar borrador y regresar conserva la comuna aplicada. Pruebas de selección, resultados y comparación aprobadas. |
| F05 Navegación | Destinos nativos y sidebar conservados. Vistas visitadas retienen filtros/borradores; Ayuda y Mi plan mantienen estado. Cuenta devuelve al contexto anterior. Historial de sección administrativo añadido sin guardar datos privados. Consultas de soporte se diferencia de Solicitudes de contacto. Se eliminó el doble Volver físico de Ayuda del apoderado. | Recorridos reales y pruebas de regreso/estado descritos abajo. Cuenta conductor y el regreso entre destinos se repitieron en el último APK; falta el barrido de todos los estados restaurados/expirados. No se afirma persistencia de borradores privados tras terminar el proceso. |
| F06 Formularios | Títulos específicos; Datos del servicio / Identidad y contacto; Nueva consulta de soporte. Menos superficies/cabeceras repetidas. Consecuencias y privacidad permanecen junto al control relevante. Diálogos y confirmaciones comparten comportamiento nativo web. | Guardar, Continuar, validación, privacidad, versiones y recuperación conservan pruebas. Formularios reales de ruta, plan, contacto y soporte abiertos sin guardar/enviar. Faltan estados visuales de escrituras finales y algunos editores. |
| F07 Responsive | Pestañas, pasos, filtros y selectores envuelven o se apilan. Selector de rutas/cupos sin tira horizontal oculta; fecha nativa alternativa en contenedores estrechos. | Cinco anchos reales en vistas principales: 320, 390, 768, 1280 y 1440 px. No se observó desbordamiento horizontal global en los casos auditados. No equivale al barrido de las 87 vistas. Zoom real de navegador pendiente; texto CSS 200 % se identifica como tal. |
| F08 Administración | Expedientes/casos y tareas antes del resumen; superficies comunes y menos densidad redundante. Observaciones de expediente aprobado neutrales. Directorio/filtros/estado/plan/historial y lectores mantienen motivos, permisos y alcance. | Lecturas reales de directorio, ficha, estado, plan, historial, cola y expediente; editor de plan parcial; decisiones finales y algunos formularios/descargas pendientes. No se cambió ningún criterio administrativo del backend. |
| F09 Semántica visual | Colores compartidos para información/éxito/pendiente/error; etiquetas textuales conservadas. Observaciones aprobadas dejan de parecer un rechazo; una instrucción neutral de borrador deja de mostrarse como éxito. | Verificado en estados reales disponibles y pruebas de estados desconocidos. Avisos/cargas/éxitos excepcionales de todos los consumidores requieren completar el contraste visual. |
| F10 Planes y reportes | La consulta mensual y sus resultados preceden al bloque completo del plan en React. Mi plan Flutter conserva beneficios y capacidades del servidor. | Reportes reales a cinco anchos y Mi plan conductor real. No se inventaron reportes móviles ni beneficios. Variantes sin plan/restricciones y comparación expandida mantienen comprobaciones automáticas; algunas visuales pendientes. |
| F11 Confianza/contacto | Revisión interna explícita, sin certificación de seguridad. Destinatario y correo exacto visibles, consentimiento explícito sin marcar; no se reserva transporte. Aceptada muestra correo y aclara que no reserva cupo. | Comprobado físicamente en detalle, contacto y solicitud aceptada. No se envió una solicitud ni se alteró el consentimiento académico. |
| F12 Consistencia transversal | Tokens, controles, superficies, cabeceras, filas, estados, navegación, modales y lector compartidos aplicados a sus consumidores React y Flutter. Se editaron las reglas originales; no se agregó una hoja de overrides para tapar divergencias. | Implementada parcialmente y extendida a todos los grupos. **No cerrada**: la matriz conserva 57 filas con alguna validación visual pendiente; no se considera que una pantalla antigua cumpla solo por quedar fuera de la feria. |
| F13 Lectura/accesibilidad | Lector legal con scroll único web, foco/retorno/capas, controles de 48 px, texto adaptable y semántica nativa conservada. Fuente 2.0 y orientación física comprobadas en casos concretos. | **Parcial**: 61 ejecuciones axe, cero violaciones detectadas, 30 con comprobaciones incompletas. TalkBack instalado pero lectura hablada no realizada. Zoom real web, barrido de orientación y pruebas asistidas completas pendientes. No se declara accesibilidad completa. |

## 3. Componentes compartidos y consumidores

| Patrón | Cambio | Consumidores pertinentes |
|---|---|---|
| Tokens web | Radio de controles/superficies 12 px, objetivo 48 px, ancho común y título compartido; cuerpo 16 px coherente con conductor/admin y la especificación. Se consolidan recetas contradictorias en sus definiciones originales. | Acceso, shell, administración, gestión del conductor, ayuda, reportes y documentos mediante style/operational/task12/role CSS existentes. |
| `useModal` + `TaskVisibility` | Top layer de `<dialog>`, bloqueo de scroll compartido y retorno de foco; cierre al ocultar un destino conservando su borrador. | DriverDialog, AdminFocusPanel, lectores legales y Confirmation de validaciones. Permite lectores anidados sin desbloquear el fondo prematuramente. |
| `App` | Montaje diferido de destinos visitados, ocultación/foco de tareas y `active` correcto; historial administrativo; ayuda retenida por rol. | Solicitudes, pasajeros, pagos, reportes, directorio/validaciones admin y soporte. No se guarda información privada en history. |
| Fecha/selección adaptables | Alternativa nativa de fecha para contenedor estrecho, formato chileno conservado; tabs/pasos/filtros ajustables. | Formularios que usan ChileanDateField, rutas, documentos, plan, servicio y bandejas. |
| Identidad/atributos familiares | Identidad compacta de resultados y composición por atributos; fila de solicitud con separadores y secciones pendientes/historial. | Buscar, comparación, detalle, contacto y solicitudes Flutter. |
| Shell nativo y `PlanHelpScreen` | Vistas visitadas con keys estables; `Offstage`, `TickerMode`, foco y `activePage` coordinados; Cuenta sin acción Cuenta duplicada; Ayuda apoderado con un solo regreso. | Conductor Hoy/Mi plan/Ayuda, apoderado Buscar/Solicitudes/Ayuda, Cuenta y soporte de ambos roles. |
| Sistema Material existente | FurgoPanel, estados, mensajes, cuenta, campos, texto y colores permanecen como base; el arranque inválido adopta el mismo tema. | Acceso, Cuenta, conductor, familia, legales, planes y ayuda; no se crean capacidades nuevas. |

## 4. Navegación y regresiones comprobadas

En A54: Buscar → filtro → aplicación → limpiar borrador → Atrás conserva filtro; seleccionar dos/tres → comparación → Cuenta → Atrás restaura comparación; comparación → Ver servicio → Atrás vuelve a comparación. Detalle → contacto → escribir borrador → Solicitudes → Buscar conserva el borrador. El teclado permite seguir cambiando destinos y los controles de consentimiento se alcanzan con scroll. La solicitud pendiente abre confirmación, Mantener solicitud la descarta y el estado sigue Pendiente. Historial muestra cancelada, rechazada y aceptada; el correo del servicio solo aparece en aceptada. Cuenta → lector legal → Atrás → Cuenta conserva contexto. Guías → artículo → Atrás vuelve a lista. En conductor, Pasajeros → Mi plan → Ayuda usa la cabecera del destino visible; Atrás en Ayuda y regreso a Hoy conserva Pasajeros. El borrador de soporte permanece entre los tres destinos y Cuenta. Tras corregir el regreso duplicado, Ayuda → Consultas → Android Atrás vuelve al nivel esperado.

Las pruebas automatizadas añaden conservación de filtros/borradores al cambiar destinos, Cuenta y navegador Atrás; cierre de capas ocultas; cambio de identidad que limpia datos privados; páginas/respuestas tardías; sesión expirada; denegación/conflicto/resultado incierto y ausencia de escrituras al cancelar. No se sustituyeron los contratos de navegación por una reescritura completa.

Los datos de prueba no se modificaron: no se inició/finalizó servicio, guardó perfil/plan/ruta/pago/asignación, aceptó/rechazó contacto, canceló contacto ni envió respuesta/consulta. Esas operaciones se ejercitan con los transportes ficticios de la suite; la matriz no las marca como ejecutadas físicamente.

## 5. Evidencia visual real y versiones

La galería conserva **71 capturas auténticas anteriores**, **100 capturas web de esta intervención** y **76 capturas físicas Android**. Son capturas lógicas; las páginas completas adicionales no incrementan ese número. Variantes, recapturas e incrementos no equivalen a vistas distintas aprobadas. El manifiesto mantiene fecha, rol, tamaño, fuente, hash de imagen y hash APK cuando corresponde; las capturas anteriores al último ajuste se rotulan expresamente.

Las comparaciones incluyen Buscar, comuna, dos alternativas, contacto, solicitudes, reportes, inicio administrativo y el doble regreso de soporte corregido. Se inspeccionaron hojas de contacto e imágenes individuales; las imágenes de página completa permiten revisar lo situado bajo el primer viewport. No hay revisión humana ni pruebas con usuarios realizadas por este agente.

Se excluyeron de la galería los nombres generados después de clics fallidos que no mostraban la tarea indicada; tampoco se cuenta el intento de zoom que no cambió la geometría. Algunas capturas de carga se conservan como incrementos, junto a recapturas estables. Se detectó que esperar solamente `networkidle` podía devolver antes de una lectura disparada por React: las capturas estables de Inicio admin se repitieron después de completarse las lecturas. La auditoría HTTP final confirma que **36 módulos/assets servidos corresponden a las fuentes locales actuales**.

Separadamente hay **70 previews sintéticos actuales**, generados con widgets y transporte ficticio, resultado `PREVIEW RESULT: passed`. Sirven para inspección de variantes/fuente y no se presentan como A54, API real, golden tests de aceptación o evidencia de usuarios.

## 6. Resultados técnicos

| Comprobación final | Resultado | Registro |
|---|---|---|
| React / Vitest | **394/394**, 21 archivos | [Pruebas](evidence/task12-integral/checks/t12-integral-react-verified-final.log) |
| Contratos API | Sin cambios; comprobación aprobada | [Contrato](evidence/task12-integral/checks/t12-integral-contracts-final.log) |
| TypeScript | Aprobado | [Typecheck](evidence/task12-integral/checks/t12-integral-typecheck-final.log) |
| Lint | Aprobado | [Lint](evidence/task12-integral/checks/t12-integral-lint-final.log) |
| Build React | Aprobado | [Build](evidence/task12-integral/checks/t12-integral-build-final.log) |
| Flutter analyze | Sin problemas | [Analyze](evidence/task12-integral/checks/t12-integral-analyze-visible-destination.log) |
| Flutter convencional | **213/213**, no runner alternativo en este resultado | [Pruebas](evidence/task12-integral/checks/t12-integral-flutter-visible-destination-final.log) |
| Previews actuales | 70 PNG; ejecución aprobada | [Generación](evidence/task12-integral/checks/t12-integral-preview-current.log) |
| APK ARM64, main.dart | Gradle offline / JDK 21, compilación aprobada | [APK](evidence/task12-integral/checks/t12-integral-apk-visible-destination.log) |
| Diff | Sin errores de whitespace; preservación de archivos protegidos contrastada contra instantánea inicial | [Preservación](evidence/task12-integral/preservation.json) |

Las referencias anteriores de 392 web / 207 Flutter no se reutilizan como resultado actual. El runner convencional Flutter funciona en esta ejecución con el SDK temporal ya disponible; las limitaciones históricas del runner de sockets no invalidan ni sustituyen este resultado. Los emuladores ensayados terminaron con SIGSEGV (139); no se cuentan como validación. La validación Android real se hizo en Samsung A54.

## 7. Android: diagnóstico, APK y accesibilidad

Ante el error de comunicación se inspeccionaron primero la compilación y el APK instalado. La URL esperada seguía siendo `http://127.0.0.1:18082`; no se cambió backend ni configuración para ocultar el fallo. El usuario recuperó ADB, reverse y socat. Después se reutilizó esa conexión existente y el inicio de sesión familiar funcionó. Una sonda `nc` devolvió respuesta vacía y queda como **inconclusa**, no como HTTP 200.

El APK final instalado es `b957d8a625b8a538cae8c83f801063d62693e5356d41ea70c1c0eb11205956da`, paquete académico `com.example.furgoplus.task12`, target `lib/main.dart`, ARM64. Conserva `API_BASE_URL=http://127.0.0.1:18082`, `ALLOW_HTTP_API=true` y `FURGOPLUS_DEMO_MODE=true`. Se instaló con `-r`, sin limpiar datos. La última actualización corrige una cabecera que conservaba Pasajeros al cambiar a Mi plan/Ayuda y el manejo de Atrás del contexto oculto, después de corregir el doble regreso y el vocabulario. Las capturas de hashes previos siguen identificadas y no se atribuyen todas al último APK. La comparación de los hashes de fuentes entre las dos últimas compilaciones confirma que solo cambió `lib/driver_home.dart`; Buscar/comparación/contacto y los componentes familiares mantienen las fuentes de la verificación física anterior.

En el A54 (Android 16) se comprobó fuente de sistema **2.0**, además de su configuración original **1.1**, en comparación y formulario de contacto. Consentimiento, envío deshabilitado y lector desplegable siguen alcanzables con scroll. Se capturó horizontal con fuente ampliada y navegación visible; la cabecera y los destinos ocupan buena parte de la altura, por lo que el contenido exige scroll. No se aprueba por ello la orientación de todas las vistas. Se restauraron fuente y orientación originales.

En Chromium se ejecutó axe-core 4.14.0 **61 veces**: **0 violaciones detectadas**, **30 ejecuciones con comprobaciones incompletas**. Los resultados originales se conservan: contraste con elementos parcialmente tapados/no visibles en el viewport, glifos decorativos, orden de encabezados o relaciones ARIA que el motor no pudo concluir. No se eliminaron reglas ni se corrigieron contratos ARIA solo para silenciar esos resultados. Requieren revisión manual por caso; cero violaciones no significa conformidad completa.

Teclado, foco de diálogos, Escape, retorno y lectores tienen comprobaciones automatizadas y algunos recorridos reales. El escalado CSS 200 % no se presenta como zoom real. TalkBack está instalado y desactivado: **no se realizó prueba hablada** ni se infiere su resultado del XML de accesibilidad. El XML expone algunos contadores de caracteres en inglés; falta revisar/localizar esos anuncios y comprobarlos con lectura hablada. Quedan pendientes zoom real de navegador, navegación hablada, anuncios de éxito/error, orientación de todas las vistas y revisión manual de contrastes incompletos.

## 8. Problemas encontrados y resueltos

| Problema observado | Solución y evidencia |
|---|---|
| Paginación de solicitudes podía volver a la página anterior al resolverse una lectura. | Se elimina la sincronización incondicional de la página y se limita solo cuando realmente disminuye el total; dependencias de pageSize completas. Regresión aprobada sin aumentar timeouts. |
| Retorno de foco de modal interfería con el desmontaje en pruebas. | Efecto de apertura/cierre y restauración compartido; pruebas de admin/validaciones y sesión aprobadas. |
| Montar Mi plan después de Ayuda reemplazaba su estado por falta de identidad estable. | Keys por sesión/destino y vistas visitadas retenidas; prueba de borrador entre Hoy/Mi plan/Cuenta aprobada. |
| Un indicador oculto seguía animándose y bloqueaba la estabilidad del runner. | TickerMode, foco y actividad coordinados; navegación disponible durante lecturas pendientes. |
| Cabecera Pasajeros permanecía visible en Mi plan/Ayuda y el Atrás exterior podía afectar un contexto oculto. | Se condicionan AppBar y PopScope al destino visible, conservando el estado de Hoy. Nueva prueba específica y transición física repetida en APK final; 213/213. |
| Dos controles Volver en Ayuda apoderado cerraban niveles distintos. | Se conserva el regreso contextual interno y Android Atrás; AppBar deja de competir. Prueba automatizada y recaptura física en APK final. |
| Soporte mezclaba Consulta y Solicitud con contacto. | Vocabulario de soporte actualizado en ambos frontends, sin renombrar contratos del backend ni textos de guías recibidos del servidor. |
| Previews usaban etiquetas antiguas y fallaban al localizar acciones. | Generador y selectores actualizados a las etiquetas reales; 70 imágenes regeneradas correctamente. El fallo anterior no se presenta como resultado aprobado. |
| Captura inicial podía fotografiar carga en lugar de información estable. | Recaptura estable y separación de incrementos; evidencia mal nombrada excluida del manifiesto. |

## 9. Pendientes, riesgos y solución propuesta

Los **57 registros pendientes** están individualizados. No significan 57 pantallas sin implementación: varios agrupan una escritura final, un estado excepcional o un último ajuste de vocabulario todavía sin captura específica. Tampoco se consideran aprobados por tener tests o una imagen similar.

1. Completar los editores/detalles React pendientes y recapturar los últimos textos del conductor. Reutilizar la sesión académica correspondiente; no alterar perfiles/planes/datos para obtener variantes.
2. Revisar confirmaciones y resultados de escrituras mediante entorno de prueba aislado con respuestas ficticias, y etiquetar esa evidencia como tal. La restricción actual impide ejecutar esas escrituras sobre los datos académicos. Los contratos y las pruebas existentes permanecen como respaldo técnico.
3. Completar los estados físicos de restauración/expiración disponibles y orientación/fuente ampliada por tarea. Cuenta, soporte y borrador conductor ya se repitieron con el APK final. No atribuir capturas de APK anteriores al último binario.
4. Ejecutar un protocolo hablado de TalkBack y zoom real de Chromium, revisar cada resultado axe incompleto y los anuncios. Se necesita evidencia observada, no una declaración de accesibilidad basada en la ausencia de errores automáticos.
5. Contrastar la coherencia visual y la facilidad de tareas con revisión humana. No se hicieron pruebas de usuarios ni se promete una fecha de aceptación sin esa evidencia.

La conectividad ya no bloquea el recorrido familiar. No se ha detectado una necesidad de cambiar negocio, permisos o backend para continuar. Si una futura validación exige alterar esos comportamientos, debe documentarse la decisión y continuarse el trabajo independiente.

## 10. Evaluación integral

La experiencia comparte ahora composición, tokens, controles, superficies, estados y convenciones de regreso entre gestión, administración, ayuda y familia. El recorrido familiar y las vistas principales reales permiten reconocer una misma aplicación; reportes y administración dejan de relegar la tarea bajo bloques secundarios. Las diferencias de sidebar web y tres destinos Android son convenciones justificadas.

**No se declara terminado el rediseño integral.** Permanecen subflujos esenciales y estados sin contraste visual final, junto con accesibilidad asistida y aceptación humana pendientes. La matriz y el manifiesto permiten continuar esos puntos sin excluir roles, reducir silenciosamente F01–F13 ni confundir implementación, prueba automatizada y aprobación visual.
