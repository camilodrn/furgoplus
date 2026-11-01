# Guía de navegación y revisión humana

Para esta revisión, completar primero la [pauta responsive y su matriz de pendientes](RESPONSIVE.md). La aceptación debe incluir tamaños intermedios, paisaje, texto y zoom real al 200%.

Abre [el prototipo](index.html). Usa la barra superior para elegir plataforma y rol. **No cambies el escenario en mitad de un recorrido**: reinicia los datos. Sí puedes cambiar de rol y plataforma dentro del mismo escenario para continuar una acción.

La fecha, los nombres, documentos y montos son ejemplos. Puedes realizar las acciones del prototipo: no escriben en la aplicación real. Recargar o pulsar **Reiniciar** devuelve el escenario a su inicio.

## 1. Conductor web: atender y organizar

1. En **Normal → Web · Conductor → Inicio**, identifica la tarea principal y abre **Solicitudes**.
2. Abre una pendiente, lee el mensaje y acepta el contacto. Revisa la confirmación del correo que se comparte. El número de pasajeros debe mantenerse.
3. Abre **Pasajeros**. Elige Los Aromos y revisa ocupación, asignaciones y fecha. Busca `Nicolas` sin tilde: encuentra un registro que no estaba en la primera página. Limpia la búsqueda.
4. **Agregar pasajero**: completa datos sintéticos y período. En El Arrayán, la ruta llena, intenta guardar para ver el conflicto; cambia a Los Aromos y guarda. Los cupos se actualizan.
5. Abre un **Detalle**: recogida y contacto se muestran al desplegarlos. Puedes editar o indicar el último día de la asignación. Ese último día permanece incluido.
6. En **Rutas**, crea una ruta con el editor de dos pasos. Comprueba que aparezca en el listado y en el selector de asignaciones.

## 2. Pagos: registrar y confirmar

1. Abre **Pagos**. Distingue pendientes, registrados manualmente y anulados. El resumen superior corresponde a todos los registros; el listado responde a los filtros.
2. Filtra **Pendiente**, busca un pasajero y limpia filtros. Cambia el mes para revisar un período sin resultados. Prueba páginas y cantidad de filas.
3. **Registrar pendiente**: elige una asignación, monto, período y vencimiento. Guarda.
4. Abre el registro → **Marcar pagado**. Lee pasajero, monto, período y la aclaración bancaria. Cancela primero: el registro debe seguir pendiente.
5. Vuelve a abrirlo y confirma. Revisa el cambio del estado y los montos del resumen.
6. **Anular registro** conserva el registro, pide confirmación y no devuelve dinero. Prueba también cancelar esa confirmación.

## 3. Corregir información y volver a publicar

Empieza con [Pendientes → Documentos](index.html#web/conductor/documentos?estado=pendiente).

1. La credencial tiene una observación y el servicio no es visible. **Actualizar** usa un archivo sintético y una fecha.
2. Ve a **Revisión** → **Enviar a revisión**. El estado pasa a En revisión.
3. Cambia arriba a **Web · Admin**, conservando Pendientes. Abre el expediente de **Transportes Los Aromos** y consulta los documentos.
4. Prueba **Solicitar correcciones** sin comentario: debe pedirlo. Luego revisa **Aprobar información** y confirma.
5. En **Conductores → Transportes Los Aromos**, observa que aprobar no activó el plan ni publicó el servicio.
6. **Editar plan**: estado Activo, fechas vigentes para el 04 nov 2026 y motivo sintético. Revisa y confirma.
7. Regresa a **Web · Conductor → Publicación** y solicita publicación. Ahora se ve el resultado completo.
8. Prueba suspender el servicio desde administración: cuenta, revisión y plan se muestran por separado. El servicio deja de ser visible y Publicación explica el bloqueo.

## 4. Android conductor: una jornada completa

Empieza en [Normal → Android · Conductor](index.html#android/conductor/hoy).

1. Reconoce de inmediato hora, ruta, estado y **Iniciar servicio**.
2. Abre **Información del recorrido**. Consulta destino y horario. **Abrir en mapas** muestra una simulación local.
3. Vuelve a Hoy → **Pasajeros del recorrido**. Busca un nombre, pagina y despliega un contacto. Cambiar búsqueda, página o recorrido vuelve a cerrar el contacto.
4. En Hoy, inicia el servicio. Debe quedar **En curso**.
5. Finaliza, cancela la confirmación y verifica que sigue En curso. Repite y confirma para llegar a Finalizado.
6. Despliega **Otros recorridos** y cambia de ruta. El estado corresponde a cada recorrido.
7. Revisa **Mi plan**, **Ayuda** y **Mi cuenta** desde el avatar. Cuenta conductor es de lectura; no inventa edición de datos comerciales.
8. En [Resultado incierto](index.html#android/conductor/hoy?estado=incierto), comprueba que no se permite repetir el inicio: **Consultar estado** recupera En curso antes de ofrecer finalizar.

## 5. Android apoderado: buscar, comparar y contactar

Empieza en [Normal → Android · Apoderado](index.html#android/apoderado/buscar).

1. Busca en **La Florida**. Selecciona dos servicios y compara horario, cobertura y cupos.
2. Vuelve, selecciona **Todas las comunas**, busca y agrega la tercera opción. El comparador permite deslizar las tres opciones dentro de su área.
3. Abre **Transportes Los Aromos** → detalle, cobertura y reseñas de ejemplo.
4. **Solicitar contacto**: escribe un mensaje sintético y autoriza compartir el correo. Envía. No se reserva un cupo.
5. Revisa el estado pendiente en **Solicitudes**. El correo del conductor aún no aparece.
6. Cambia a **Web · Conductor → Solicitudes**, selecciona la solicitud de María Vega y acepta contacto.
7. Regresa a **Android · Apoderado → Solicitudes** y abre ese registro. Ahora se ve el correo del servicio. Los pasajeros no cambiaron.
8. Intenta solicitar otra vez al mismo servicio: se ofrece la solicitud existente. Prueba también cancelar una solicitud pendiente.
9. Revisa **Mi cuenta → Editar nombre**, acceso a Ayuda y documentos legales de muestra.

El apoderado web mantiene su acceso limitado, disponible desde **Guía → Apoderado web**. No tiene un catálogo, pagos o panel inventados.

## 6. Ayuda y soporte

1. Busca una guía y abre un artículo. En **Nueva solicitud**, escribe un asunto y descripción sintéticos, selecciona gravedad y confirma la revisión de privacidad.
2. Abre el hilo, responde y revisa su historial.
3. Cambia a **Web · Admin → Ayuda y soporte**. Abre ese caso, cambia a En revisión, responde y resuelve con un motivo.
4. Regresa al rol que lo creó para revisar el mismo hilo. La prioridad y el historial aparecen en contexto. El asistente de la aplicación no se rediseña en esta entrega.

## Estados y volumen

| Selector           | Dónde conviene revisar                                                     | Qué observar                                                                                        |
| ------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Normal             | Todas las entradas                                                         | Jerarquía, acciones y detalles.                                                                     |
| Pendientes         | Mi servicio, Documentos, Revisión, Publicación, Mi plan                    | Observaciones claras, plan suspendido, requisitos y recuperación.                                   |
| Sin registros      | Rutas, Pasajeros, Pagos, Solicitudes, validaciones, Hoy; buscar en Android | Vacío con orientación útil; no tabla de ceros artificial durante un error.                          |
| Error de lectura   | Cualquier consulta de producto                                             | Error recuperable; resultados y totales desconocidos no aparecen como cero.                         |
| Muchos registros   | Pasajeros, Pagos, Solicitudes, Conductores, Validaciones, soporte          | Búsqueda fuera de página, filtros combinados, paginación y capacidad de cada ruta.                  |
| Cargando           | Consultas de producto                                                      | Carga deliberadamente detenida para revisar la composición; **Ver resultado de la carga** continúa. |
| Resultado incierto | Hoy conductor                                                              | Consulta de estado antes de permitir otra acción. Otros destinos conservan su estado normal.        |

Cambiar filtros vuelve a la primera página. Los cupos no cambian por buscar ni por paginar. Las páginas son de presentación local, tanto aquí como en las colecciones actuales descritas en la correspondencia.

## Pauta de aceptación visual

Revisar primero en escritorio a 1440 y 1280 px; después Android a 390/412 px. Usar teclado, botón Atrás del navegador, Escape en diálogos y zoom. En móvil de escritorio el contenido se desplaza dentro del marco; en teléfono desaparece el marco.

| Pregunta                                                           | Resultado humano |
| ------------------------------------------------------------------ | ---------------- |
| ¿La primera vista deja clara la tarea y la acción principal?       | Pendiente        |
| ¿Cada sección tiene una composición útil para su tarea?            | Pendiente        |
| ¿Se encuentran pasajeros y pagos sin recorrer toda la colección?   | Pendiente        |
| ¿Son claras ocupación, fecha y disponibilidad por ruta?            | Pendiente        |
| ¿Se entiende que un pago es un registro manual?                    | Pendiente        |
| ¿Android se siente como app, con navegación y controles adecuados? | Pendiente        |
| ¿Pendientes y errores son evidentes sin llenar todo de avisos?     | Pendiente        |
| ¿Los recorridos completos se entienden sin explicaciones externas? | Pendiente        |

Para un defecto, registrar **plataforma + rol + pantalla + escenario + ancho + observación visual concreta**. Las verificaciones de navegación no sustituyen esta pauta. La revisión del HTML tampoco acredita TalkBack ni el comportamiento físico de Samsung.

**Detener la entrega aquí. La implementación posterior requiere una nueva instrucción; no forma parte de este trabajo.**
