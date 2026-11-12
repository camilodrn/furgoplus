# T12.11 — Auditoría UX integral de la web

Fecha: **27 de octubre de 2026**. Revisión académica principal: **4 de noviembre de 2026**.
Estado: **diagnóstico para revisión; implementación detenida**.

La mayor ganancia está en orientar la entrada del conductor, eliminar estados contradictorios y recuperar tareas sin perder lo escrito. No hace falta rediseñar la aplicación. Se recomienda un lote acotado de frontend y una decisión separada sobre identidad en soporte.

Principio de aceptación: **resumen primero → acción principal → detalles bajo demanda**. Resumir no debe ocultar consecuencias, consentimiento, errores ni restricciones efectivas del servidor.

## Alcance y evidencia

- Se revisó el árbol de trabajo actual, incluidos los cambios T12 aún sin commit; no solamente HEAD. Ya había numerosos archivos modificados y sin seguimiento. No se atribuyen a esta auditoría.
- Lectura de navegación y pantallas React, CSS, cliente/tipos API, contratos y serialización relevantes de Django, pruebas y decisiones de producto. Se contrastaron los informes anteriores con el código actual.
- **293/293 pruebas existentes, 18 archivos**, con `npm test -- --maxWorkers=1`, desde `web/`; duración 187,38 s. Typecheck, `contract:check` y lint también finalizaron con código 0. No se ejecutó build porque el diagnóstico no cambia implementación.
- **9/9 reproducciones adicionales** en `/tmp/furgoplus-ux-audit-20261027`, con componentes reales y API simulada; duración final 5,02 s. Son pruebas que confirman comportamientos actuales, no pruebas de que esos comportamientos sean deseables. No hacen llamadas a la API académica.
- No hay navegador conectado: inventario `apps: []`, `browsers: []`. No se afirma inspección visual nueva, medición de desbordes, lector de pantalla, comprensión sin capacitación ni prueba E2E real. Cambiar `innerWidth` en jsdom tampoco verifica responsive.
- Se conserva como evidencia aportada por el equipo la aceptación real Fedora + Samsung A54: tres planes, recorridos, reportes, 15/15 autorizaciones por plan y soporte administrador → conductor. No se repitió ni se reemplaza por pruebas simuladas.
- Sin consultas a bases, cuentas, documentos o APIs reales; sin Docker, migraciones, instalación de dependencias, commit, push, merge o deploy. T13, T14 y demo r4 quedan fuera de intervención. Solo se entrega documentación y evidencia temporal.

**P0 confirmado: ninguno en los casos revisados.** No se encontró un bloqueo total de los recorridos ya aceptados. Esto no certifica ausencia de P0 en renderizado o condiciones reales no observadas. Los fallos condicionales con salida alternativa se clasifican P1.

## Mapa de flujos reales por rol

La web mantiene las secciones en estado React; estas rutas describen el recorrido de interfaz, **no URLs nuevas**.

| Rol / flujo | Recorrido y observación sustentada |
| --- | --- |
| Acceso y registro | Restauración de sesión → inicio de sesión → espacio del rol. Registro web solo de conductor; apoderados se registran en Flutter, administradores se provisionan por procedimiento restringido. Hay etiquetas, mostrar contraseña, bloqueo de doble envío, mensajes de caducidad y reintento de restauración. En académico, el registro está deshabilitado; se conserva su carácter ilustrativo. |
| Conductor: primer uso y perfil | Entra siempre en Mi servicio / “Prepara tu información”, incluso aprobado y publicado. Datos del servicio → Documentos → Revisión son tres tareas existentes; no son un tour. Perfil y documentos conservan borradores al cambiar esas secciones. Inicio ya tiene actividad, requisito siguiente y progreso reutilizables. |
| Documentos y validación | Seleccionar → subir → revisar resumen → confirmar envío → recibir aprobación u observaciones. Formatos, tamaño, vencimiento, privacidad y archivos sintéticos están explicados. Aprobación y publicación se distinguen correctamente. Conservar estas salvaguardas y los documentos de cada envío. |
| Publicación y rutas | Publicación muestra requisitos y plan; la intención no equivale a visibilidad. Rutas usa tres etapas: horario, cupos/cobertura y revisión. Inicio/fin del recorrido diario se realiza en Flutter; no se añade operación web ni seguimiento de apoderados. |
| Solicitudes y pasajeros | Solicitudes de contacto muestra nombre del apoderado, estado, filtros y páginas de diez. Mensaje/correo se abren bajo demanda. Aceptar no reserva cupo ni crea pasajero: distinción correcta. Pasajeros registra estudiante, apoderado, ruta y vigencia; falta salida directa si no hay ruta. |
| Pagos | Registrar pendiente → marcar pagado o anular. Son registros manuales, sin cobro ni devolución bancaria. Nombres ya sustituyen IDs, pero no distinguen dos asignaciones del mismo estudiante. La acción sobre un pendiente está dentro de “Ver registro”. |
| Planes y reportes | Básico: continuidad; Pro: resumen mensual; Elite: comparación/detalle/tres Excel. Datos, meses vacíos y permisos son reales. La vista de reportes ya distingue vigencia efectiva; Publicación y administración no lo hacen con igual claridad. No se propone cambiar beneficios. |
| Administrador | Conductores → buscar/filtrar → estado del servicio → perfil/plan; observaciones e historial bajo demanda. Validaciones → envío concreto → documentos → comentario y decisión confirmada. Soporte → cola activa → revisar → responder/cambiar estado → volver al filtro/página. Se conservan motivos, versiones, orden, permisos y auditoría. |
| Apoderado en web | Sesión válida → “Usa la aplicación móvil”; conserva cierre de sesión, legales y ayuda/soporte. Buscar, comparar, solicitudes de contacto y perfil del apoderado están en Flutter, según ADR 0001; **no existen esos flujos operativos en React**. No existe pantalla de pago del apoderado por alcance del MVP. |

Fuentes: [App](../web/src/App.tsx), [validaciones](../web/src/ValidationScreens.tsx), [operación](../web/src/DriverOperations.tsx), [publicación](../web/src/PublicationScreens.tsx), [solicitudes](../web/src/DriverRequests.tsx), [reportes](../web/src/DriverReports.tsx), [administración](../web/src/AdminControls.tsx), [soporte](../web/src/HelpSupport.tsx), [ADR 0001](decisions/0001-client-surfaces-and-mobile-roles.md), [alcance](PRODUCT_SCOPE.md).

## Matriz de hallazgos

P0 impide completar o entender una tarea; P1 produce confusión o fricción importante; P2 es postergable. **FE**: presentación con contratos actuales. **BE + H**: modificación de backend/contrato con autorización humana específica. Toda implementación, incluso FE, espera la revisión solicitada por el equipo.

| ID / prioridad | Ruta | Problema y evidencia | Propuesta acotada | Criterio verificable de aceptación | Dependencia |
| --- | --- | --- | --- | --- | --- |
| **UX01 · P1** | Conductor → entrada / Inicio / Mi servicio / Publicación | Siempre inicia en preparación (`App.tsx:524`, D1). Inicio expone permanentemente requisitos aun con servicio visible; el checklist puede crecer a cinco por suspensión (D6). Publicación coloca todo `ActivationPath` antes del botón principal (`PublicationScreens.tsx:253`). La preparación domina a la tarea actual. | Abrir en Inicio; resumen de estado/actividad y una acción siguiente. Checklist opcional desplegable, máximo cuatro grupos, usando los estados del servidor. Suspensión como aviso independiente. En Publicación, intención y acción antes del detalle de requisitos. | Conductor publicado entra a actividad sin formulario de alta. Nuevo usuario identifica su siguiente acción. Puede ignorar/cerrar el checklist y seguir operando. Nunca hay más de cuatro pasos; una suspensión no agrega un quinto ni se presenta como tarea que el usuario pueda aprobar. | FE; lote principal. |
| **UX02 · P1** | Conductor → Publicación; Administrador → conductor → plan | Plan con `status=active` y período vencido muestra “Activo” y “Venció el” juntos (D5). `AdminStatusBadges` y `AdminPlanControls` también imprimen el estado administrativo sin un rótulo temporal inequívoco. Reportes sí tiene `planStatus`. | Reutilizar una presentación de vigencia efectiva: “Vigente”, “Vencido”, “Aún no comienza”, “Suspendido”, “Inactivo”, según respuesta/blockers existentes. Estado administrativo bajo demanda si es necesario. | Para vigente, vencido, futuro, suspendido, inactivo y sin plan, las tres vistas dicen lo mismo. Un plan vencido/futuro jamás se rotula vigente; no se calculan ni conceden permisos en el cliente. | FE; lote principal. |
| **UX03 · P1** | Administrador → Ayuda y soporte → cola / caso | Solicitante y autores se identifican como `Usuario #…`. La cola obtiene identidad leyendo hasta 25 detalles adicionales, con tres simultáneos (D7). El contrato no entrega nombres; ocultar el número dejaría solo el rol. | Solicitar un identificador humano mínimo y autorizado en lista/detalle, p. ej. nombre del servicio o nombre visible del apoderado + rol. IDs para referencia técnica bajo demanda. Resolver en serialización administrativa, sin consultar directorios desde React ni descargar historiales para rotular filas. | En página de 25 casos se identifica por nombre y rol al solicitante sin abrirlos, con un solo GET de lista. Revisar abre únicamente el caso elegido. Sin nuevos correos, documentos ni datos de menores; 403/404 y permisos actuales se mantienen. Fallback honesto si no existe nombre. | **BE + H**, opcional para el corte; revisión de privacidad y campos antes de implementar. |
| **UX04 · P1** | Conductor/apoderado/administrador → soporte → responder → conflicto → actualizar | Tras 409 se conserva borrador, pero la recuperación indicada llama `openTicket`, que ejecuta `setReply("")` y `setReason("")`. D2 reproduce la pérdida completa. La prueba existente solo comprueba el instante anterior a actualizar. | Separar “abrir otro caso” de “actualizar el mismo”. Releer versión/eventos conservando respuesta y motivo; revisar el estado/transición con los datos nuevos antes de un envío explícito. | Forzar 409 → actualizar mismo ticket → texto y motivo siguen disponibles → usuario revisa → un único envío manual usa la versión nueva. No hay reenvío automático. Cambiar de ticket/cuenta o caducar sesión sí limpia datos privados. | FE; lote principal. |
| **UX05 · P1** | Conductor → Pasajeros sin rutas; Pagos sin pasajeros | Se permite abrir un formulario que no puede enviarse. Solo dice “Primero configura una ruta en Mi servicio → Rutas” o “Primero agrega un estudiante en Pasajeros”; no ofrece navegación directa (D3 y `DriverOperations.tsx:808`). | Estado vacío con una única acción contextual “Crear ruta” o “Agregar pasajero”; conservar retorno al origen. Mostrar el formulario completo cuando exista el requisito. | Cuenta sin rutas llega a crear ruta desde Pasajeros en una acción. Cuenta sin pasajeros llega a agregarlos desde Pagos en una acción. Hay regreso al destino original, sin interpretar un botón deshabilitado ni perder borradores existentes. | FE, conectando navegación existente; lote principal. |
| **UX06 · P1** | Conductor → Pagos → registrar / marcar pagado | Dos asignaciones del mismo estudiante producen opciones idénticas (D4). El término “Asignación” exige conocer el modelo. “Marcar pagado” está oculto dentro de “Ver registro”, aunque es la tarea principal de un pendiente. | Selector “Pasajero y servicio”, con nombre + ruta + vigencia usando recursos propios existentes. En tarjeta pendiente, “Marcar como pagado” visible; período/historial/anulación bajo demanda. Mantener que crear genera pendiente y que no se procesa dinero. | Con el mismo estudiante en dos rutas/vigencias, se elige inequívocamente el registro y la API recibe el `assignment_id` correspondiente. Pendiente muestra acción sin desplegar. Pagado/anulado no la muestran. Anular conserva confirmación y consecuencias. | FE; `routes()` ya es lectura propia autorizada. No ampliar acceso a datos. Lote principal. |
| **UX07 · P1** | Cualquier solicitante → Ayuda falla → Mis solicitudes de soporte | Si falla `helpCenter()`, la lista de tickets puede funcionar pero “Crear solicitud” queda deshabilitado por `!help`. En esa sección no aparece reintento de guías; el vacío invita a crear algo bloqueado (D9). | Recuperación visible dentro de soporte que reintente ayuda y explique el requisito. Mantener listado/respuestas disponibles. No eliminar consentimiento ni inventar el aviso de privacidad para permitir el envío. | Con GET ayuda=500 y lista=200, se ofrece reintento local comprensible. Tras recuperar ayuda, se habilita crear sin recargar/cerrar sesión. Con error persistente no se promete envío; cancelar y consultar casos existentes sigue siendo posible. | FE; lote principal, sin desacoplar contratos ni políticas de privacidad. |
| **UX08 · P1** | Conductor → Rutas / formularios operativos | Continuar en Rutas queda deshabilitado sin días, cobertura o catálogo, sin indicación junto al botón (`PublicationScreens.tsx:735`). En pago, monto inválido genera alerta pero no marca/asocia el campo afectado (D8). La validación genérica solo dice revisar campos. | Explicar junto a la acción qué falta; asociar mensajes al grupo/campo y enfocar el primer error. Ej.: “Selecciona al menos un día”; “Ingresa un monto mayor que $0, sin decimales”. Mantener autoridad del servidor y formatos actuales. | Sin días/cobertura se entiende cómo continuar por texto y lector de pantalla. Monto inválido tiene `aria-invalid`, descripción de error y foco en Monto; conserva datos y no escribe. Catálogo vacío ofrece reintento, no avance imposible. | FE; incluir en el lote principal solo estos bloqueos y errores locales, sin refactorizar todos los formularios. |
| **UX09 · P1** | Conductor → Plan y reportes → cupos actuales / detalle Elite | Tabla de cupos omite la ruta: solo estado, fecha y cifras (`DriverReports.tsx:493`). Detalle de recorridos omite ruta/horario aunque dispone de `route_id` y horarios. Dos registros iguales son indistinguibles. Quitar IDs no basta para identificar. | Priorizar nombre de ruta y contexto del recorrido con mapa de rutas propias; conservar fallback sin inventar identidad. Nombres de pasajeros/apoderados en reportes son una propuesta de contrato aparte: los detalles de pagos/contactos actuales no traen esas asociaciones. | Dos rutas con mismos cupos y día se distinguen por nombre. Recorridos muestran ruta + fecha/horario existente. Sin datos asociados se indica limitación; no se consultan usuarios ajenos. Resúmenes, Pro/Elite y Excel mantienen permisos/contenido. | **FE** para rutas actuales mediante `routes()`; **BE + H** si se decide añadir identidades/asociaciones que no entrega el reporte. Segunda prioridad del corte. |
| **UX10 · P1** | Registro de conductor → Datos del servicio | Registro pide “Cómo te llamas”, pero lo guarda en `DriverProfile.display_name`; luego ese mismo campo se presenta como “Nombre del servicio” (`App.tsx:329`, `backend/api/auth.py:154`). Puede inducir a publicar el nombre personal creyendo que es otra información. | Alinear la etiqueta con el dato real: “Nombre del servicio”, con ejemplo breve. No crear campos nuevos ni convertir datos existentes. | Cuando el registro esté habilitado, el usuario ve el mismo concepto antes y después de crear cuenta; no se modifica ni renombra automáticamente ningún registro. El modo académico continúa ilustrativo y sin envío. | FE; **postergar después del 4/11**, porque el registro académico está cerrado. Separar nombre personal y comercial requeriría BE + H y está fuera de este lote. |
| **UX11 · P2** | Pasajeros / Solicitudes / Pagos; menú Plan y reportes | Se repite título del contenedor y título interno; Pagos y Plan/reportes comparten icono. No impide el flujo (`App.tsx:721`, encabezados internos). | Un título visible por página y encabezados de tarea; iconografía diferenciada solo si se reutilizan assets propios. | Identidad de página y jerarquía semántica claras, sin afectar nombres accesibles ni navegación. | FE; postergar. No justificar biblioteca o rediseño. |

## Primer uso: propuesta concreta de cuatro pasos, sin tour

Reutilizar `homeStatus`, `homeSteps` y `HomeRequirements`; no crear otra fuente de requisitos. Resumen compacto “Tu servicio aún no es visible” y botón al siguiente requisito corregible. Un desplegable opcional “Ver preparación del servicio” contiene:

1. **Datos y documentos:** dirige a perfil o documento faltante según blockers.
2. **Revisión del equipo:** distingue falta de envío, en revisión y correcciones; nunca ofrece autoaprobar.
3. **Plan vigente:** informa lo entregado por el servidor; si depende del equipo, enlaza a ayuda/soporte.
4. **Ruta y publicación:** dirige primero a ruta activa completa y después a solicitar visibilidad.

Los cuatro grupos son presentación, no un orden obligatorio ni una nueva regla de negocio. Mientras una revisión espera al equipo, se puede preparar otra tarea permitida. Con todo vigente, colapsar requisitos y priorizar actividad. Suspensión/desactivación va en un aviso separado con la acción de consultar soporte. Abrir/cerrar es estado de interfaz; no guardar progreso privado en almacenamiento compartido ni marcar pasos por pulsar botones.

Para administrador, no añadir onboarding: cola/lista → caso → acción ya es el patrón adecuado. Para apoderado web, explicar la derivación actual al móvil y conservar ayuda. Un checklist de búsqueda/contacto solo tendría sentido en Flutter y queda fuera de esta entrega.

## Accesibilidad, densidad y estados

El código ya ofrece skip link, landmarks, foco visible, etiquetas persistentes, contraste mediante tokens, estados textuales además de color y reducción de movimiento. El menú estrecho declara expansión, cierra con Escape y devuelve foco; la navegación enfoca el contenido. Modales administrativos usan `dialog`; formularios de conductor usan panel en flujo. No se deben uniformar a ciegas: tienen comportamientos distintos.

La revisión CSS encuentra columnas adaptables, `min-width: 0`, partición de textos largos, controles de al menos 48 px y refuerzo a 54 px en pantallas T12 estrechas. La tabla de reportes tiene desplazamiento local accesible. **Esto es evidencia de intención de diseño, no prueba de renderizado ni certificación de accesibilidad.**

Estados revisados: carga inicial, restauración fallida, sesión caducada, formulario pendiente, lista vacía, filtro sin resultados, documento faltante/vencido/rechazado, publicación bloqueada, plan ausente/futuro/vencido/suspendido, mes vacío, soporte cerrado y conflictos. Los vacíos de Solicitudes y reportes orientan correctamente; los problemas de recuperación concretos están en UX04/05/07/08. Evitar multiplicar mensajes globales con la misma información; conservar un anuncio y el contexto del campo/acción.

Reutilización recomendada: `ProductIcon`, tokens y botones existentes; `HomeRequirements` para preparación; `FocusPanel` y `AdminFocusPanel` según contexto; `DriverReadNotice`, `DriverActionError`, `FieldError` y `ChileanDateField` para recuperación/campos. Extraer solo una presentación compartida de vigencia. No crear un nuevo sistema de componentes ni reescribir los recursos/sesiones.

## Decisiones humanas y backend

**Antes de cualquier implementación:** revisión del lote, por solicitud expresa de esta auditoría. Adicionalmente:

| Decisión | Qué requiere autorización específica | Límite propuesto |
| --- | --- | --- |
| Identidad en soporte (UX03) | Campos visibles por rol, fuente del nombre y ampliación de contratos/lista/detalle administrativos. Backend, OpenAPI/tipos y pruebas de autorización. | Nombre visible/servicio + rol. No agregar correo, directorio global ni relaciones con menores/documentos/pagos. No asignar nuevos permisos a cuentas. Sin este cambio no se puede prometer “nombres reales” desde el contrato actual. |
| Asociaciones de reportes (UX09) | Solo si se quieren nombres o asociaciones ausentes del payload; decidir datos mínimos y permisos antes de modificar backend/exportaciones. | Resolver primero rutas con lectura propia existente. No ampliar el reporte mensual Pro ni introducir datos personales para resolver un problema de presentación. |
| Apoderado web / recuperación de acceso | Llevar búsqueda, registro, perfil/contacto o pagos de apoderados a React cambia el alcance aprobado. Recuperación de contraseña tampoco tiene flujo implementado en esta web. Deben decidirse producto, canal y backend por separado. | Conservar la derivación al móvil. Un enlace de instalación/ayuda de acceso necesita un destino aprobado; no inventarlo ni enlazar demo r4. No bloquear el corte por construir funcionalidades nuevas. |
| Identidad personal vs comercial | Separar esos conceptos en el modelo sería un cambio adicional de contrato/datos. | Solo corregir etiqueta cuando se aborde UX10; ninguna conversión de datos. |

21st.dev queda como referencia de patrones de resumen, acción y revelado progresivo, sin copiar componentes ni instalar paquetes. Chart.js se posterga: la web ya muestra agregados reales y comparación entre dos meses; eso no acredita una serie histórica suficiente ni una necesidad de gráfico. Una evaluación futura debe partir de una pregunta concreta y períodos comparables reales. No añadir métricas, tendencias ni gráficos sintéticos.

## Lote recomendado antes del 4 de noviembre

Orden propuesto, **sujeto a esta revisión**, sin iniciar implementación automáticamente:

| Ventana | Trabajo acotado | Salida verificable |
| --- | --- | --- |
| 28–29 octubre | UX04 y UX07: recuperación de soporte; UX02: vigencia consistente. | Borrador sobrevive al ciclo completo 409 → lectura → revisión; guía caída recuperable; seis estados de plan coherentes. |
| 29–30 octubre | UX05 y UX06: requisitos previos y registro inequívoco de pagos. | Crear ruta/pasajero desde el punto de necesidad y distinguir asignaciones homónimas; acción principal del pendiente visible. |
| 30 octubre–1 noviembre | UX01 y partes acotadas de UX08: Inicio contextual, cuatro pasos opcionales y mensajes de bloqueo/campo. | Conductor nuevo y operativo identifican su acción; funcionamiento por teclado y sin tutorial. |
| Solo si se autoriza el 28 octubre y cabe con margen | UX03: contrato mínimo de nombres; UX09: rotular rutas con lectura propia. | Una lectura de cola, identidad autorizada y rutas distinguibles; regresión de permisos. Si no cabe, documentar la limitación y postergar; no improvisar agregaciones. |
| 2–3 noviembre | Regresión y aceptación humana del lote aprobado; correcciones puntuales. | Matriz manual abajo y suite completa. El día 4 se revisa el resultado, no se reserva para rediseño. |

Postergar UX10/11, biblioteca estética, gráficos, paginación global nueva, unificación total de CSS, nuevo router, operación diaria web y funcionalidades nuevas de apoderado. El lote principal no exige migraciones ni cambios de permisos/contratos. Los cambios de backend opcionales se revisan y aceptan por separado.

## Verificación de aceptación del lote futuro

1. **Escritorio/móvil real:** 1280×800, 768×1024, 390×844 y 320 px, además de zoom 200–400 %. Nombres/asuntos largos, textos multilínea y estados de carga/error: sin desborde de la página, cortes ni acciones fuera de alcance. Comprobar que el aviso fijo no tape menú/campo activo. Solo la tabla puede desplazarse horizontalmente en su región.
2. **Sin capacitación:** pedir a un conductor que encuentre su próxima tarea y registre un pago inequívoco; a un administrador que identifique al solicitante y responda; a un apoderado web que encuentre ayuda y comprenda dónde buscar transporte. Criterio: identificar destino/acción en 10 s sin explicación del evaluador; completar con datos sintéticos sin pistas. Registrar errores, no solo opinión estética.
3. **Teclado/lector:** Tab/Shift+Tab, Enter, Espacio y Escape en menú, desplegables, fechas y confirmaciones. Campo inválido anunciado y asociado, foco visible/restaurado, estados comprensibles sin color. Retomar respuesta tras 409 sin pérdida ni envío automático.
4. **Estados y permisos:** Básico/Pro/Elite, sin plan, futuro, vencido y suspendido; perfil suspendido; soporte sin permiso; sesión caducada/cambio de cuenta. Conservar las 15/15 autorizaciones por plan como regresión del lote, sin conceder acceso desde checklist o etiquetas. Repetir recorridos y Excel solo si las áreas tocadas o el backend lo justifican, en el entorno aislado autorizado.
5. **Datos:** solicitudes de contacto no reservan cupo; pagos no son transacciones bancarias; documentos privados y sintéticos; historial y motivos intactos. La validación es sobre datos sintéticos de prueba preparados por el equipo, no sobre modificaciones a los registros académicos preservados.

## Anexo de reproducciones y preservación

Evidencia temporal: [pruebas diagnósticas](/tmp/furgoplus-ux-audit-20261027/ux-audit.test.tsx), [configuración](/tmp/furgoplus-ux-audit-20261027/vitest.config.mjs), [log final](/tmp/furgoplus-ux-audit-20261027/diagnostic.log) y [preservación](/tmp/furgoplus-ux-audit-20261027/preservation-result.json). Se usa la instalación existente de `web/node_modules` mediante enlace en `/tmp`; no se instalaron bibliotecas. El primer intento no recolectó pruebas por el límite de acceso de Vite al importar `privacy.md?raw` desde fuera de su raíz; se ajustó únicamente la configuración temporal para permitir leer la web local. La ejecución final pasó sin omitir casos ni modificar la aplicación.

| Reproducción | Resultado actual confirmado |
| --- | --- |
| D1 | Conductor aprobado/publicado abre preparación y no consulta el resumen de Inicio. |
| D2 | 409 conserva texto; actualizar ese mismo ticket borra respuesta y motivo. |
| D3 | Sin rutas, formulario de pasajero bloqueado con instrucciones textuales sin enlace de acción. |
| D4 | Dos asignaciones del mismo estudiante muestran el mismo nombre en el selector de pago, pese a IDs distintos. |
| D5 | Plan vencido conserva rótulo “Activo” junto a “Venció el”. |
| D6 | Suspensión eleva el checklist a cinco grupos. |
| D7 | Cola administrativa muestra rol/ID y consulta detalle por fila para obtenerlo. |
| D8 | Monto negativo impide escritura y anuncia error, pero Monto no tiene marca ni descripción de error asociada. |
| D9 | Fallo de ayuda bloquea crear soporte aun con lista operativa; falta reintento en esa vista. |

Comando de las reproducciones, desde `web/`:

```bash
./node_modules/.bin/vitest run --root /tmp/furgoplus-ux-audit-20261027 --config /tmp/furgoplus-ux-audit-20261027/vitest.config.mjs --reporter=verbose
```

La comparación SHA-256 al cierre confirma **207/207 archivos de implementación, pruebas, contratos y configuración sin cambios** respecto del manifiesto levantado antes de las reproducciones y de escribir este informe. El contraste de `git status` identifica únicamente este informe como incorporación de la auditoría; los cambios anteriores siguen intactos. `git diff --check` pasó. No se requiere tocar una base ni repetir aceptación real para revisar este diagnóstico.

**Punto de detención:** revisar lote principal y decidir por separado UX03/contratos. No se ha implementado ninguna propuesta.
