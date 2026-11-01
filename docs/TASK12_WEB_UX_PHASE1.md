# T12.11 — Primera fase de correcciones UX web

Fecha: **27 de octubre de 2026**. Rama: `task/12-plan-capabilities`.
Estado: **implementación de interfaz para aceptación; revisión humana en Fedora pendiente**.

Fuente y criterios: [matriz original de auditoría](TASK12_WEB_UX_AUDIT.md). Esta entrega aborda **UX01 y UX02**, por la autorización de entrada/orientación del conductor y coherencia de vigencia, plan y publicación. No ejecuta el resto del lote recomendado de la auditoría. La matriz original se conserva como diagnóstico histórico.

## Comportamiento comprobado y corrección

Se leyó la matriz completa antes de implementar y se contrastaron los componentes, sus pruebas, los contratos actuales y los evaluadores de publicación y capacidades del servidor. No se dedujeron soluciones solo a partir de los títulos.

| Hallazgo | Causa comprobada en la versión inicial | Cambio en esta fase |
| --- | --- | --- |
| UX01: entrada | `App` inicializaba siempre `driverSection` en `profile`, aunque el servicio estuviera aprobado y publicado. | La entrada del conductor es Inicio, con estado, una acción contextual y actividad existente. Mi servicio sigue accesible desde el menú y las acciones contextuales. |
| UX01: preparación dominante | Inicio montaba todo `HomeRequirements` permanentemente. Publicación mostraba `ActivationPath` antes de solicitar o retirar visibilidad. | Inicio y Publicación reutilizan un desplegable nativo «Ver preparación del servicio», cerrado inicialmente. En Inicio queda después de la actividad; en Publicación, después de intención, acción y plan actual. Las consecuencias de solicitar/retirar visibilidad siguen junto al botón. |
| UX01: quinto paso | `activationSteps` añadía un grupo para otros blockers, incluidos suspensión y desactivación. | Cuatro grupos fijos de presentación: Datos y documentos; Revisión del equipo; Plan vigente; Ruta y publicación. Suspensión/desactivación/cuenta inactiva van en un aviso independiente con «Consultar soporte». No hay autoaprobación. |
| UX01: orientación contextual | Datos, documentos y validación compartían un solo grupo; una revisión pendiente podía dominar la preparación. | La acción inicial usa los blockers para dirigir a datos o documentos. «En revisión» identifica la espera del equipo y permite preparar otro requisito. Ruta y publicación dirige primero a la ruta pendiente y después a solicitar visibilidad. Plan pendiente enlaza a ayuda/soporte existente. |
| UX02: rótulos contradictorios | Publicación y administración imprimían `subscription.status` («Activo»), aunque el servidor entregara `subscription_expired` o `subscription_not_started`. Reportes tenía otra función de etiquetas. | Una presentación compartida muestra Vigente, Vencido, Aún no comienza, Suspendido, Inactivo o Sin plan asignado. Se usa en Publicación, lista/resumen administrativos, control del plan y reportes. Editor y filtro se identifican como «Estado administrativo del plan». |

## Límites y preservación

- Los cuatro grupos y el progreso son presentación de la respuesta actual. No crean requisitos, permisos, fechas efectivas ni aprobación local. `eligible` continúa determinando visibilidad; las capacidades continúan determinando acceso a reportes y exportaciones.
- La vigencia se rotula usando `status`, los blockers del servidor y, en reportes, `effective`. No se decide vencimiento con el reloj del cliente. Suspensión e inactividad tienen precedencia sobre el período; las fechas siguen disponibles. Perfil suspendido y plan vigente siguen siendo conceptos separados.
- Abrir/cerrar preparación no escribe progreso ni datos privados en almacenamiento compartido. Se mantienen los componentes que conservan borradores de perfil, documentos y rutas, la frontera de sesión por identidad, las versiones de concurrencia y las operaciones existentes.
- Se reutilizan botones, tokens, `HomeRequirements`, progreso y desplegables HTML. No se agregan bibliotecas, tour, router ni rediseño. Los destinos existentes conservan foco en el contenido; el desplegable mantiene semántica y operación nativas de teclado.
- Sin cambios a backend, OpenAPI, tipos generados, permisos, modelo de datos, datos sintéticos persistidos, volúmenes o contenedores. Sin intervención en T13, T14 o demo r4. No se hizo commit, push, merge ni deploy.

## Dependencias detenidas y trabajo fuera de fase

UX03 requiere identidad humana autorizada en el contrato administrativo de soporte; UX09 requiere contrato/permisos si se incorporan asociaciones ausentes del reporte. Esas partes quedan detenidas y no se simulan desde React. UX04–UX08, la parte de rutas de UX09 y UX10–UX11 no forman parte de esta fase.

Al contrastar los evaluadores existentes se observó un límite adicional de UX02: `backend/drivers/capabilities.py` detecta `subscription_invalid_window` y `plan_unknown`, mientras `backend/drivers/publication.py` expone otro conjunto de blockers. Una garantía de igualdad para períodos malformados o planes desconocidos exige armonizar evaluadores/contratos en backend, fuera de esta autorización. No se modificó esa parte ni se consultaron registros para buscar esos casos. Si la respuesta no confirma vigencia, la presentación compartida evita afirmar «Vigente» y muestra «Vigencia no confirmada»; esto no repara ni concede acceso. La aceptación automatizada de equivalencia en esta fase cubre los **seis estados ordinarios de la matriz**, no saneamiento de datos ni contratos nuevos.

## Verificación automatizada

| Comprobación desde `web/` (salvo indicación) | Resultado final |
| --- | --- |
| `npm test -- --maxWorkers=1` | **305/305 pruebas, 19 archivos**, 186,31 s. Las 293 pruebas anteriores se conservan y se agregan 12 casos. |
| `npm run typecheck` | Código 0. |
| `npm run build` | Código 0; TypeScript y Vite completados. |
| `npm run lint` | Código 0. |
| `npm run contract:check` | Código 0, sin regenerar ni modificar contratos. |
| Prettier sobre los archivos web de esta fase | Código 0. |
| `git diff --check`, desde la raíz | Código 0. |
| Comparación SHA-256 contra el inicio | **317/334 archivos iniciales intactos**; solo 17 archivos web modificados y tres incorporaciones: este informe, `PlanValidity.ts` y `Task12UxPhaseOne.test.tsx`. Auditoría original, backend, contratos, móvil y archivos ajenos al alcance sin cambios respecto del inicio. |

Log completo de React: `/tmp/furgoplus-t1211-phase1/react-accepted-check.log` (el nombre del archivo no representa aceptación humana). Comparación del delta: `phase1.diff`; preservación: `preservation-result.json`, en ese mismo directorio.

Se añadieron regresiones específicas para comparar los seis estados en componentes reales de Publicación, administración y reportes; desplegable cerrado y cuatro grupos con suspensión separada; orden de la acción de publicación; entrada de conductor publicado/nuevo; conservación de borrador al pasar por Inicio; y preparación de otra tarea mientras espera revisión. También se ajustaron las pruebas que asumían la entrada directa al editor o los rótulos anteriores.

Una ejecución completa intermedia detectó una carrera en la prueba de regreso desde Conductores: esperaba el perfil, pero intentaba abrir el plan sin esperar su lectura independiente. Se sustituyó esa búsqueda síncrona por la espera del botón de plan. No se alteró el flujo administrativo ni se amplió un timeout; la ejecución completa posterior pasó sin omitir pruebas.

Se ejecutaron ocho de esos escenarios sobre una copia del código inicial en `/tmp/furgoplus-t1211-phase1/baseline-web`: **8/8 fallaron por los comportamientos previstos**, sin errores de ejecución en la reproducción final. La configuración y dependencias son las existentes. La primera preparación de esa reproducción necesitó completar el fixture de capacidades y copiar `tsconfig.json`; esos errores de preparación no se cuentan como evidencia funcional.

Las pruebas usan API simulada y jsdom: no validan renderizado, responsive, lector de pantalla real ni comprensión de usuarios. En particular, las consultas de jsdom pueden encontrar descendientes de un `details` cerrado; se verifica su propiedad nativa `open`, sin afirmar visibilidad visual a partir de esas consultas.

Evidencia temporal: `/tmp/furgoplus-t1211-phase1/`, con copia inicial, manifiesto SHA-256, reproducción previa y logs de verificación. Los cambios anteriores del árbol de trabajo se distinguen del delta de esta fase mediante ese manifiesto, no únicamente mediante `git diff` contra HEAD.

## Aceptación manual pendiente en Fedora

Usar las cuentas y datos de prueba ya preparados; esta entrega no prepara ni modifica el entorno académico.

1. Entrar con conductor aprobado/publicado: debe abrir Inicio, mostrar actividad y una acción de estado; el formulario de alta no debe verse. La preparación comienza cerrada. Entrar con conductor nuevo: identificar la siguiente acción en diez segundos y llegar al dato/documento pendiente sin instrucciones del evaluador.
2. Abrir y cerrar preparación con ratón y con Tab, Enter/Espacio. Debe haber cuatro grupos, con razones bajo demanda y acciones alcanzables. Con revisión pendiente, comprobar «En revisión» y que se puede preparar una ruta u otra tarea pendiente. Con suspensión/desactivación, comprobar aviso independiente y llegada a soporte sin opción de autoaprobar ni quinto grupo.
3. En Publicación, comprobar estado e intención primero, acción de solicitar/retirar accesible antes de los requisitos y consecuencias junto a ella. Solicitar no debe mostrar «Visible» si el servidor conserva blockers. Retirar conserva rutas y registros privados según la operación actual.
4. Comparar Publicación, lista/detalle administrativos, control de plan y Plan y reportes para vigente, vencido con estado administrativo activo, futuro con estado administrativo activo, suspendido, inactivo y sin plan. Los rótulos deben coincidir; vencido/futuro nunca dicen Vigente. En el editor y filtro, Activo se identifica expresamente como estado administrativo. Perfil suspendido puede coexistir con plan vigente, sin conceder acceso.
5. Escribir un borrador en Mi servicio, ir a Inicio y volver; repetir con documentos y una ruta abierta. Mantener texto/archivo/etapa conforme a los comportamientos existentes. Revisar cierre de sesión, caducidad y cambio de cuenta: no deben reutilizar datos privados de otra identidad.
6. En 1280×800, 768×1024, 390×844 y 320 px, más zoom 200–400 %, revisar textos largos, foco visible, acciones sin cortes ni desbordes y avisos que no tapen el control activo. Verificar Tab/Shift+Tab y Escape en la navegación existente, y anuncios con lector de pantalla.

**Punto de detención:** esta primera fase queda lista para revisión humana. No se inicia la siguiente fase ni se afirma aceptación visual sin la revisión del equipo en Fedora.
