# T12 — Recuperación Android y gestión de Pasajeros/Pagos

Lote autorizado en la continuación del 28-10-2026, rama `task/12-plan-capabilities`. Dirección: [sistema A + filas B](TASK12_SHARED_VISUAL_SYSTEM.md) y [matriz](TASK12_VISUAL_ROLLOUT_MATRIX.md). Implementación pendiente de revisión humana en Fedora y Samsung A54. No amplía los demás lotes.

## P0: diagnóstico y corrección verificable

Se inspeccionaron `AuthController.restore/login`, `NativeSessionApi`, transporte HTTP nativo, almacenamiento seguro, `DriverHome._refresh/_transition`, manifiesto Android y los endpoints existentes. **No se observó la sesión del Samsung ni su tráfico**: no había conexión ADB activa en esta ejecución. No se accedió al entorno académico. Los hallazgos siguientes son defectos reproducibles de cliente; no demuestran cuál produjo el incidente humano.

| Hallazgo | Evidencia y consecuencia | Corrección |
| --- | --- | --- |
| Estado de carga sin resolver tras un error de aplicación | `_home` incrementaba `sessionVersion` antes de convertir `identity.email`. Un tipo inválido lanzaba una excepción; restore/login la descartaban como obsoleta. Las dos pruebas nuevas fallaron con `AuthState.restoring` antes de corregirlo. | Validar y preparar identidad/estado antes de avanzar la frontera de sesión. El fallo pasa a error recuperable. Las dos regresiones pasan después de corregirlo. |
| Esperas de comunicación sin límite predeterminado | `restoreCookies → csrf → me`; `login → csrf/login → me`; Hoy esperaba `driver/today/`. El timeout opcional anterior se usaba en soporte, pero estas rutas no lo especificaban. El transporte incluye apertura, envío, cabeceras y lectura completa del cuerpo. | Timeout HTTP predeterminado de 15 s por petición; almacenamiento seguro de 5 s por espera/operación. No son un límite global de 15 s para toda la cadena. Las peticiones de soporte que ya especifican 20 s lo conservan. |
| Cualquier excepción de Hoy parecía un problema de conexión | El catch genérico decía «Revisa tu conexión», también ante datos incompatibles o errores del cliente. Algunos datos podían fallar fuera del try, al renderizar. | Separar timeout, Socket/TLS, error informado por API, respuesta inválida y error de aplicación. Validar los campos consumidos de Hoy antes de incorporarlos a la UI. No mostrar cuerpos, contactos ni errores crudos en avisos. |
| Resultado incierto al iniciar/finalizar | Un timeout no prueba que el servidor rechazó la operación. | Mantener el bloqueo existente de nuevas acciones hasta consultar estado. No repetir escrituras automáticamente. Conservar la mutación confirmada aunque falle la lectura posterior. |

`INTERNET` ya está declarado en el manifiesto principal; se mantiene el envío UTF-8 con `Content-Length`. No hay evidencia para atribuir el incidente a falta de permiso, red, reverse USB, certificado o backend. No se cambió origen, configuración Android, credenciales ni datos.

Las respuestas HTTP posteriores al timeout ya no pasan al procesamiento de cookies o a la UI. El almacenamiento mantiene su cola serializada para preservar el aislamiento entre cuentas: un timeout de lectura no borra la sesión persistida. Un plugin de almacenamiento que no responda no puede cancelarse desde Dart; su cola puede seguir pendiente y los intentos posteriores terminan con error acotado. No se usa limpieza de almacenamiento como reparación. Login con resultado de comunicación incierto ofrece restaurar/consultar sesión, sin repetir credenciales automáticamente.

## P1: capacidades reales y límites

| Fuente inspeccionada | Contrato real | Uso en este lote |
| --- | --- | --- |
| `driver/routes/`, `publication_api.py`, `capacity.py` | Lista completa; capacidad, usados, disponibles y fecha de próximo servicio. | Cupos por ruta provenientes de API, estado de ruta, medidor y acceso a sus pasajeros. Sin sumar cupos de fechas/rutas distintas ni ubicaciones físicas. |
| `driver/passenger-assignments/`, `operations_api.py:AssignmentsView` | Lista completa ordenada por ruta/id; acepta `route_id`. Sin cursor, límite, total paginado ni búsqueda de servidor. | Descargar lista actual completa. Buscar pasajero/apoderado/teléfono o ruta, filtrar ruta y vigencia, presentar 10 registros por página. Los resúmenes muestran 6 rutas por página. |
| `driver/payments/`, `operations_api.py:PaymentsView` | Lista completa ordenada por id descendente. `assignment_id`, período inclusivo, monto entero CLP, vencimiento, `pending/paid/void`, `paid_at`. Sin filtros ni paginación de servidor. | Resumen del total recibido: cantidades y suma CLP por estado. Buscar pasajero, número de registro, monto o fechas ISO. Filtrar estado, pasajero por asignación y mes que se superpone con el período del servicio. Páginas de 10 registros. |
| `driver/today/`, `daily_operation.py` | Proyección del día del servidor, rutas programadas y roster completo por ruta; sin paginación. | Flutter conserva Hoy, selección de ruta y operaciones nativas. Añade búsqueda por pasajero/apoderado en la ruta seleccionada, páginas de 10 y cupos en otras rutas. |

**Las páginas son de presentación local; no reducen la descarga ni el trabajo del servidor.** La interfaz lo indica como búsqueda/páginas sobre registros recibidos. La búsqueda recorre toda la colección recibida, no solo la página visible. No se envían parámetros de paginación ficticios. Filtros nuevos vuelven a página 1 y una actualización que reduce resultados ajusta la última página.

Dependencia pendiente para escalar volumen/transferencia: backend y contrato con paginación autenticada, orden estable y totales coherentes, búsqueda y filtros por ruta/estado/fechas/asignación. Deben definir el alcance de agregados respecto de filtros y mantener las autorizaciones actuales. No está implementado ni simulado. No hay identificador global de pasajero distinto de la asignación: el selector de Pagos identifica cada asignación explícitamente.

Las lecturas web de rutas/asignaciones/pagos tienen límite de 15 s, incluyendo el cuerpo JSON, y abortan su fetch. El timeout local es recuperable y no expira sesión. Un error de autenticación tardío de una lectura abandonada no dispara el cierre de sesión. Este límite no cambia otras APIs ni añade reenvío automático de escrituras.

## Operaciones, privacidad y accesibilidad

Se conservan alta/edición/finalización de asignaciones con fechas, validaciones y conflictos del servidor; alta de pendientes, marcar pagado y anular. Recogida/contacto web quedan bajo un desplegable; Android mantiene el contacto cerrado y lo reinicia al cambiar ruta, búsqueda o página. El filtro de vigencia web conserva el criterio de fecha chilena previo; la capacidad siempre usa la fecha recibida del servidor, no un cálculo sobre el listado filtrado.

Marcar pagado exige confirmar pasajero, registro, monto y período; explica que es una declaración manual sin verificación bancaria. Se puede cancelar sin escribir. Anular conserva registro, confirma la consecuencia y no devuelve dinero. Las acciones siguen esperando respuesta y actualización del servidor. No se crearon cobros, conciliación, posiciones de pasajeros ni editores móviles. **Pagos Flutter no existe y no se agregó paridad ficticia.**

Primitivas reutilizadas: `CapacityText`, `DriverReadNotice`, `DriverActionError`, `FocusPanel`, controles nativos y tokens operativos; Material 3 y superficies Flutter existentes. Referencias 21st: metadatos [Data Table](https://21st.dev/@wensity/components/data-table) y [Table 05](https://21st.dev/@ephraimduncan/components/table-05), únicamente para organización de filtros/filas/páginas. Sin dependencias, código de catálogo ni generación alojada. Revisión determinista CLI 1.18.0: 3 archivos, 0 hallazgos; no es aceptación visual.

Navegación por teclado, etiquetas, encabezados de resultados enfocables, enlaces directos, foco al paginar y confirmaciones con Escape/Cerrar. Filas con divisores y estados textuales; controles de al menos 48 px; filtros adaptables. Se conserva sidebar web y barra inferior Android. Las pruebas de texto 2× siguen cubriendo Hoy a 320/390 px; TalkBack y Samsung requieren revisión física.

## Validación y evidencia

- Flutter: `flutter test --no-pub --concurrency=1 --reporter=expanded`: **182 pruebas pasan**, incluidas 13 nuevas de recuperación/búsqueda; `flutter analyze --no-pub`: sin incidencias. Formato Dart verificado.
- React: **344 pruebas pasan** en 20 archivos; typecheck, lint, contrato generado y build pasan. Resultado final en [evidencia del lote](evidence/task12-operations-recovery/README.md).
- Casos nuevos: identidad inválida en restore/login; timeout CSRF/me/login/almacenamiento/Hoy/escritura; recuperación manual y respuestas tardías; error de comunicación/API/aplicación; búsquedas fuera de página, acentos, filtros combinados, períodos superpuestos, capacidad fechada, muchas rutas, confirmación/cancelación y ajuste de última página.
- Regresiones: operaciones originales, conflictos de capacidad y recorridos, actualización de resúmenes, borradores, teclado y aislamiento/caducidad de sesión. Las pruebas de pago previas ahora atraviesan la nueva confirmación.
- [Capturas web](evidence/task12-operations-recovery/README.md) con respuestas interceptadas exclusivamente en navegador local, sin acceso al backend: 1280 y 390 px, sin desborde horizontal ni errores JS. Las capturas son datos de prueba locales, no datos académicos ni evidencia de producción.

No se generó ni instaló un APK nuevo; el binario previamente existente se conserva. No se ejecutaron pruebas contra DB académica ni cambios de backend, contratos o datos. Los cambios previos del checkout permanecen. No hubo commit, push, merge, deploy, reinicio de contenedores, desinstalación ni limpieza de almacenamiento. T13, T14 y demo r4 fuera del lote.

## Revisión humana de salida

1. **Samsung A54, con binario de este lote preparado posteriormente para el origen autorizado:** registrar versión y paso visible de carga (comprobación de sesión frente a Hoy). Ante fallo, anotar texto de categoría y duración. Contrastar, mediante observación de solo lectura, estado HTTP y tiempo en API si se dispone de acceso autorizado; omitir credenciales/cookies/datos privados. Sin esta correlación no atribuir una causa al incidente original. No limpiar almacenamiento ni reinstalar para diagnosticar.
2. Consultar Hoy, cupos de ruta, búsqueda de pasajeros y otras rutas. Probar texto grande, teclado y TalkBack, contacto bajo demanda y navegación nativa. No iniciar/finalizar servicios académicos. Timeout, errores y reintentos de escrituras ya se verifican mediante transportes de prueba.
3. **Fedora:** Pasajeros → comprobar cupos/fecha por ruta, acceso directo, búsqueda, filtros y páginas; Pagos → resumen de estados/montos, búsqueda, mes/estado/asignación y páginas. Revisar 1280/390 px y teclado/zoom. En entorno académico usar solo lectura; cancelación/confirmación de escrituras se revisa con mocks o entorno aislado ya autorizado.
4. Registrar aceptación o defecto concreto. Detener aquí: no continuar los demás lotes de la matriz.
