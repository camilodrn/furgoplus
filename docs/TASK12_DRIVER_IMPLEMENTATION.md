# T12 · Implementación de la experiencia del conductor

Fecha: 28-10-2026. Revisión académica prevista: 04-11-2026.
Estado: entrega inicial revisada en Fedora; la revisión humana detectó migración incompleta. La continuación de coherencia web y su matriz vigente están en [TASK12_DRIVER_COHERENCE.md](TASK12_DRIVER_COHERENCE.md). Aceptación visual final pendiente.

La instrucción humana de esta ejecución finaliza el prototipado y autoriza la implementación completa del conductor. Reemplaza las restricciones temporales de los lotes previos. No autoriza implementar administración o apoderado.

## Referencia y alcance

Referencia obligatoria: [prototipo aprobado provisionalmente](design/task12-product-prototype/GUIA.md), [correspondencia](design/task12-product-prototype/CORRESPONDENCIA.md), [responsive](design/task12-product-prototype/RESPONSIVE.md) y [correcciones](design/task12-product-prototype/CORRECCIONES_RESPONSIVE.md), junto con HTML, CSS y JavaScript.

La [evidencia responsive actualizada del prototipo](design/task12-product-prototype/evidence/responsive/results.json), del 28-10 a las 13:26 UTC, contiene 443 casos aprobados, 0 fallidos y 24 capturas. Algunos documentos del prototipo conservan el relato histórico del intento anterior; no se han reescrito ni sustituido sus evidencias. Esos 443 casos corresponden al HTML del prototipo, **no** a React o Flutter.

Se conservan los datos y operaciones de `AuthApi` y `NativeSessionApi`. Ningún componente operativo importa `data.js`, estados simulados, fechas o nombres del prototipo. Los transportes sintéticos existen únicamente en pruebas y herramientas de captura.

## Componentes compartidos

| Patrón                       | React                                                                                                           | Flutter                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Superficie y grupos de tarea | `OperationalPanel`, `.driver-surface`, tokens en `operational.css`                                              | `FurgoOperationalPanel` con Material y radio compartido                                      |
| Fila operativa               | `OperationalRow`, `.route-line`                                                                                 | `FurgoTaskRow`, `FurgoFact` con `LayoutBuilder`                                              |
| Ocupación por ruta/fecha     | `CapacityText` existente, medidor compacto y cifras de API                                                      | `FurgoCapacity`, cifras y semántica sin asientos físicos                                     |
| Listado de registros         | `OperationalTable` / `OperationalCell`: una tabla semántica, reflujo por ancho del componente                   | Filas nativas, contacto desplegable, lista y páginas locales                                 |
| Navegación de colecciones    | `LocalPages`, tamaños 5/10/20, búsqueda normalizada y filtros                                                   | Búsqueda de la colección recibida, páginas de diez                                           |
| Formularios y confirmaciones | `DriverDialog` nativo: foco, fondo inerte, Escape, scroll y restauración de foco; visibilidad ligada al destino | Confirmación existente de finalizar; navegación con Atrás y navegación inferior persistente  |
| Recuperación                 | `DriverReadNotice`, `DriverActionError`, protección de sesión existentes                                        | Recuperación existente y estado visual por confirmar antes de repetir una operación incierta |

Los cambios visuales comunes se delimitan al conductor. Se reutilizan los colores y tipos del producto. No se instalaron bibliotecas. El contexto `.21st` incorpora la autorización actual y conserva las decisiones históricas.

## Matriz de pantallas implementadas

La tabla siguiente registra la entrega inicial. La revisión humana posterior detectó composición incompleta en Publicación, Solicitudes, Plan y reportes, Ayuda y legales; no debe interpretarse como aceptación ni como prueba de equivalencia visual. Consultar la [matriz actualizada pantalla por pantalla](TASK12_DRIVER_COHERENCE.md) para este bloque web.

| Plataforma / pantalla | Composición y operaciones preservadas                                                                                                                                                                                | Diferencia justificada / revisión pendiente                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web · Inicio          | Pendientes con solicitudes antes que pagos, operación, visibilidad contextual, tres primeras rutas/cupos y acceso a todas; preparación desplegable.                                                                  | El resumen de API no incluye horarios ni destino de rutas: no se fabrican ni se agregan consultas para imitar las muestras. Revisar composición real a 1280/1440.                                                 |
| Web · Mi servicio     | Pestañas, estado de revisión/publicación independiente, documentos y datos en dos áreas, observaciones, revisión e historial y rutas.                                                                                | Se conservan fechas y versiones reales; no se atribuye vencimiento a un archivo individual por un bloqueo agregado. Confirmar carga/errores y textos largos en Fedora.                                            |
| Web · Publicación     | Visibilidad y acción contextual; requisitos visibles de cuenta, datos/documentos, revisión, plan y ruta; plan con vigencia del servidor.                                                                             | Se conserva la capacidad existente de guardar intención de publicación aun con requisitos pendientes. Solicitar no concede elegibilidad; la API decide la visibilidad. El prototipo restringe más ese botón.      |
| Web · Rutas           | Filas con horario, destino, múltiples comunas, capacidad y fecha, edición y activación/desactivación; protección por revisión y recorrido iniciado/finalizado.                                                       | Se conservan los dos pasos de edición **más la revisión final existente**. El prototipo usa dos pasos totales. No se elimina la revisión ni la cobertura múltiple para copiar la muestra.                         |
| Web · Pasajeros       | Panel de cupos al lado del listado; franja desplazable en anchos menores; búsqueda, ruta, vigencia, páginas y tamaño. Detalle con recogida/contacto bajo demanda; crear, editar y finalizar con último día incluido. | Estado de vigencia sigue la lógica chilena existente; capacidad y conflictos siguen siendo autoridad del servidor. La franja no es un plano de asientos. Revisar muchos registros y formularios con teclado real. |
| Web · Solicitudes     | Bandeja por estado, detalle en área propia, lectura del mensaje/correo consentido, confirmación de aceptar/rechazar, páginas.                                                                                        | Aceptar comparte el correo del servicio según la API; no agrega pasajeros ni reserva cupos. Confirmar foco y lectura del panel en anchos estrechos.                                                               |
| Web · Pagos           | Montos y conteos globales por estado, búsqueda por pasajero/apoderado/registro/monto, filtros por estado/asignación/mes, paginación y tamaño; detalle, crear pendiente, confirmar pagado y anular.                   | Colecciones y filtros locales: mes por superposición de períodos. Registrar como pagado es declaración manual; sin verificación bancaria, cobro o devolución. Resumen no cambia al filtrar.                       |
| Android · Hoy         | Hora y estado del recorrido, nombre y acción principal, cupos, acceso a información y pasajeros; otros recorridos y servicios anteriores pendientes.                                                                 | Se preservan la confirmación de finalizar, estado confirmado por servidor y bloqueo tras respuesta incierta. Los servicios anteriores pendientes reales no existen en la muestra del prototipo y se conservan.    |
| Android · Detalle     | Destino privado, mapas externo existente, horario, fecha de servicio, estado y cupos; acceso a pasajeros.                                                                                                            | `driver/today/` no entrega días recurrentes ni comunas: no se presenta «lunes a viernes» ni cobertura inventada. No se solicita GPS ni seguimiento. Revisar mapas externo en Samsung.                             |
| Android · Pasajeros   | Destino propio con ruta/hora, cupos, búsqueda, recogida y contacto bajo demanda; páginas de diez.                                                                                                                    | El prototipo pagina de cinco. Se mantiene el tamaño nativo existente. Buscar/paginar/cambiar recorrido o identidad cierra el contacto. Revisar teclado y TalkBack físicos.                                        |
| Android · Navegación  | Hoy / Mi plan / Ayuda persistentes; cuenta en cabecera; Atrás vuelve al recorrido/Hoy y conserva estado operativo al consultar cuenta.                                                                               | Mi plan, ayuda, legales y cuenta existentes se conservan. No se añaden editores de datos comerciales ni pantallas administrativas móviles.                                                                        |

La web conserva las URLs actuales. Atrás/Adelante usa estado del historial del navegador; no convierte los fragmentos del prototipo en rutas de API. Los diálogos se retiran cuando su destino deja de estar visible y el editor de ruta conserva su borrador al volver.

## Pruebas y límites

Resultados y salidas reproducibles en [evidencia de implementación](evidence/task12-driver-implementation/). Consultar `checks.json` para el resultado final y comandos.

| Verificación                                          | Resultado final                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| React / Vitest                                        | 348/348, 20 archivos; dos workers para evitar saturación del entorno            |
| TypeScript, build Vite, lint y contratos              | Aprobados                                                                       |
| Flutter analyze                                       | Sin observaciones                                                               |
| Flutter con ejecutor sin sockets                      | 185/185, nueve archivos                                                         |
| Bundle Flutter de aplicación                          | Aprobado; Dart/recursos, sin APK                                                |
| Formato de los archivos modificados y diff whitespace | Aprobados                                                                       |
| Revisión estática 21st sobre implementación web       | 0 errores, 0 advertencias; tres notas informativas sobre definiciones de tokens |
| Capturas de widgets Flutter                           | 15 generadas; aceptación física pendiente                                       |

Se verifican creación/edición/finalización de asignación, conflictos de cupo y de ruta, último día incluido, creación/pagado/anulación de registros manuales, cancelación de confirmaciones, filtros combinados, búsqueda fuera de página, resumen independiente de filtros, paginación/tamaño, cambio de identidad, respuestas tardías y caducidad de sesión. Hay pruebas específicas para el menú compacto y para Atrás con un borrador de ruta.

Flutter verifica recorrido planificado/en curso/finalizado, resultado incierto y consulta obligatoria antes de repetir, mapas sin GPS, otros recorridos, pendientes anteriores, navegación nativa, privacidad de contactos y recuperación. Se prueban 320/390 px, paisaje 844 × 390, altura reducida y texto al 200%. Las pruebas generales existentes de plan/ayuda, sesión y apoderado se ejecutan como regresión; no se implementa ese siguiente bloque.

Limitaciones comprobadas del entorno:

- Chromium no pudo arrancar: `sandbox_host_linux.cc`, `Operation not permitted`. [Intento registrado](evidence/task12-driver-implementation/browser-attempt.log). No se produjo evidencia visual nueva de React ni se afirma una aprobación responsive operativa. JSDOM verifica interacciones/DOM, no geometría, zoom real o anuncios de lectores de pantalla.
- `flutter test` estándar no pudo crear el socket de localhost. Se ejecutaron los mismos tests mediante el ejecutor existente `test_without_sockets.dart`, ampliado para incluir `loading_recovery_test.dart`, usando el motor Flutter y `test_api`, sin canal WebSocket. No equivale a una ejecución convencional ni a un dispositivo Android.
- Las [15 capturas Flutter](evidence/task12-driver-implementation/native/gallery.html) son de widgets reales y fuentes Roboto/Material, con transporte sintético, generadas por `tool/driver_experience_preview.dart`. No son capturas de Samsung ni prueban plugins, barras del sistema, TalkBack o teclado IME.
- Se compila el bundle Dart/recursos de la aplicación. No se generó ni instaló un APK ni se validó Gradle o Samsung A54. No se ejecutó integración HTTP contra el backend académico ni se escribieron datos académicos.

## Revisión visual real breve

Usar el entorno de revisión ya autorizado, sin cambiar backend, reiniciar contenedores ni reemplazar r4. Anotar revisión, navegador, dimensión, escala y captura. Las operaciones de escritura deben usar registros de ensayo destinados a revisión; cancelar confirmaciones permite comprobar los controles sin modificar registros.

**Fedora**

1. Conductor: Inicio → Mi servicio/Publicación → Rutas → Pasajeros → Solicitudes → Pagos. Comparar con el mismo destino del prototipo a 1440 y 1280; revisar también 768, 390 y 320. Verificar una sola jerarquía, paneles compactos y ausencia de desplazamiento horizontal de página. La tira de rutas/pestañas puede desplazarse dentro de su área.
2. Pasajeros: seleccionar ruta, leer fecha y cupos, buscar un registro fuera de la primera página, cambiar tamaño y limpiar filtros. Abrir/cerrar detalle y recogida/contacto. Comprobar que filtrar no cambia la ocupación.
3. Pagos: comprobar montos globales, filtrar estado y mes, buscar por apoderado, paginar y cambiar tamaño. Abrir registro, cancelar marcar pagado y anular; el estado debe permanecer igual. Revisar la aclaración manual.
4. Solicitudes: leer mensaje, cancelar aceptar/rechazar, alternar estado/página y volver a abrir. Confirmar que el contacto no se muestra en la lista. Revisar suspensión y requisitos pendientes sin confundir revisión, plan y publicación.
5. Abrir formularios de ruta/asignación/pago: campos y errores deben ser alcanzables con altura reducida, sin perder borrador al redimensionar. Revisar calendario, Cancelar, Escape y retorno de foco. Probar Atrás/Adelante con borrador de ruta.
6. Menú compacto: Tab/Shift+Tab, Escape, cerrar y pasar a escritorio. Probar zoom real 100–200% y Firefox «Solo ampliar texto» al 200%; verificar tabla refluida y acciones con lector de pantalla.

**Samsung A54**

1. En la compilación de revisión acordada: abrir Hoy en retrato/paisaje. Identificar hora, recorrido, estado y acción principal; consultar detalle y pasajeros y volver con Atrás. La navegación Hoy/Mi plan/Ayuda permanece accesible.
2. Pasajeros: buscar, abrir contacto, cambiar página y volver al recorrido. Reabrir pasajeros: contacto cerrado. Probar texto y escala de pantalla grandes, teclado real, búsqueda con tilde/sin tilde y TalkBack.
3. En registros de ensayo, iniciar y finalizar con confirmación; cancelar primero. Si la respuesta es incierta, consultar estado antes de repetir. Cambiar de recorrido y verificar que cada uno mantiene su estado. Revisar pendientes anteriores si existen.
4. Abrir mapas externo desde el detalle; probar volver a la app y fallo de proveedor. Abrir cuenta/Mi plan/Ayuda y volver sin perder el recorrido seleccionado. Probar sin red y caducidad de sesión; no deben quedar contactos de la cuenta anterior.

## Preservación y cierre del bloque

La [comparación de hashes](evidence/task12-driver-implementation/preservation.json) identifica los archivos cambiados durante esta ejecución y comprueba que backend, contratos, datos de referencia, prototipo, administración, apoderado e infraestructura conservaron su contenido inicial. El árbol tenía trabajo previo sin commit: no debe confundirse el diff completo de Git con los cambios de esta entrega.

Sin instalaciones de dependencias, commit, push, merge, deploy ni reinicio de contenedores. Task 13, Task 14, homelab y demo r4 fuera del alcance. El trabajo se detiene al entregar esta experiencia del conductor para aceptación humana; administración y apoderado son el bloque posterior.
