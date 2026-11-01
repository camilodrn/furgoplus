# T12 — Corrección de entrada a Mi servicio (UX01/UX02)

Fecha: **27 de octubre de 2026**. Estado: **implementación para aceptación visual humana en Fedora; no aceptada visualmente**.

Continúa la [primera fase web](TASK12_WEB_UX_PHASE1.md). La revisión humana informó mejoras en Inicio y Plan y reportes, pero rechazó Mi servicio: una cuenta aprobada seguía entrando a «Prepara tu información», con instrucciones de envío, pasos de alta y aprobación repetida.

## Inspección y fuentes

- `App.tsx` dirigía el botón Mi servicio a `profile`, abriendo directamente el formulario. `DriverOnboarding` compartía encabezado e instrucciones de preparación entre estados.
- Se revisaron `DriverProfile`, `DriverChecklist`, `DriverDocuments`, `DriverValidations` y `Publication` en los contratos existentes, además de los evaluadores `backend/drivers/services.py` y `backend/drivers/publication.py` (solo lectura).
- La revisión se presenta desde `DriverProfile.validation_state`; visibilidad desde `Publication.eligible`; intención desde `publication_requested`; suspensión desde `profile_status` y blockers. Aprobación no implica publicación. Si no se recibió publicación, se muestra «Sin confirmar» y se ofrece consultarla.
- El servidor reinicia la revisión al cambiar el nombre de una versión enviada o reemplazar documentos. Los avisos existentes se conservan; tras guardar, la interfaz vuelve a leer el perfil y adopta su estado. Descripción y correo conservan sus reglas existentes. No se calcula vigencia documental con el reloj del navegador: se muestran las fechas y el bloqueo de vencimiento que entrega publicación.

## Cambio acotado

Mi servicio abre ahora un destino de resumen (`service`), separado del editor (`profile`). Inicio, Plan y reportes y las operaciones de publicación conservan sus flujos.

| Cuenta | Entrada y acción |
| --- | --- |
| Nueva/incompleta | Preparación con datos y documentos completados/pendientes. Acción principal para completar datos, completar documentos o revisar y enviar, según lo que falte. |
| Pendiente | «Tu información está en revisión», acción Ver revisión; acceso a datos y documentos sin pedir otro envío. |
| Rechazada | Acción Revisar cambios solicitados hacia la revisión y observaciones existentes. |
| Aprobada | «Resumen de tu servicio», estado de revisión y publicación separados; datos completados, cantidad de documentos y fechas visibles. Acción principal contextual y acceso a Editar datos, Revisar documentos, revisión/historial, publicación y rutas. Formularios ocultos hasta elegir una acción. |
| Suspendida/desactivada/inactiva | Aviso independiente del estado de revisión, publicación no visible según respuesta y acceso a Consultar publicación. No se ofrece autoaprobar ni levantar la suspensión. |

Los blockers de publicación que requieren atención permanecen visibles con su acción: documentos vencidos/faltantes, aprobación desactualizada, datos, ruta y plan. No se agrega otro resumen de vigencia del plan. Las fechas de documentos y las fechas requeridas ausentes aparecen sin desplegar detalles.

Los editores permanecen montados al navegar, para conservar borradores y archivos seleccionados dentro de la sesión. Tienen regreso explícito al resumen. En cuentas aprobadas se elimina el encabezado de preparación, el mensaje redundante Siguiente paso y el progreso numerado del encabezado; revisión e historial conservan su detalle bajo demanda.

Se usan botones nativos, regiones y encabezados con nombres accesibles, foco en el encabezado al navegar, estilos de foco existentes y grillas que pasan a una columna hasta 640 px. No se añadieron bibliotecas.

## Verificación

| Comprobación desde `web/`, salvo indicación | Resultado |
| --- | --- |
| `npm test -- --maxWorkers=1` | **318/318 pruebas, 20 archivos**, 73,15 s. Se conservan las 305 pruebas anteriores y se añaden 13. |
| `npm run typecheck` | Código 0. |
| `npm run build` | Código 0; TypeScript y Vite completados. |
| `npm run lint` | Código 0. |
| `npm run contract:check` | Código 0; sin regenerar contratos. |
| Prettier sobre los ocho archivos web de esta corrección | Código 0. |
| `git diff --check`, raíz | Código 0. |
| Comparación SHA-256 contra el inicio de esta corrección | **352 archivos iniciales intactos**; seis archivos fuente/pruebas/estilos modificados y tres incorporaciones (componente, pruebas e informe). También se regeneró el archivo ignorado `web/tsconfig.tsbuildinfo` al verificar TypeScript. |

Los seis archivos existentes modificados son `App.tsx`, `App.test.tsx`, `ValidationScreens.tsx`, `ValidationScreens.test.tsx`, `SessionPrivacy.test.tsx` y `style.css`, todos dentro de `web/src/`. No se modificaron dependencias ni configuración.

Log final de React: `/tmp/furgoplus-mi-servicio/react-final.log`. Manifiesto y comparación de preservación: `before.json` y `preservation-result.json` en ese mismo directorio. Las ejecuciones intermedias detectaron expectativas anteriores sobre entrada directa al editor, tres botones dentro de la navegación y mensajes de publicación repetidos; se actualizaron a la nueva entrada y todas pasaron en la ejecución completa final.

Las pruebas nuevas cubren cuentas incompletas/listas para enviar, pendientes, rechazadas, aprobadas visibles/no visibles/con publicación desconocida, suspensión, vencimiento y otros blockers, navegación al editor, foco al regresar, conservación de borradores y pérdida de aprobación informada por la API después de editar nombre o documentos. Las regresiones de App comprueban el acceso desde el menú real; la suite de privacidad mantiene el aislamiento de sesión al cambiar de cuenta con un archivo seleccionado.

Las pruebas usan API simulada y jsdom. No sustituyen la inspección visual, zoom, lector de pantalla real ni comprensión del conductor. No se accedió ni se modificó la cuenta académica durante esta corrección.

## Aceptación humana pendiente

1. En Fedora, entrar con `t12-basic@example.test` y abrir Mi servicio. Debe aparecer el resumen aprobado, con publicación según el servidor, sin formulario ni instrucciones de preparación/envío. Consultar publicación y volver desde Mi servicio en el menú.
2. Abrir Editar datos y Revisar documentos: comprobar acceso claro, avisos de nueva revisión y regreso al resumen. Escribir un borrador, pasar por Inicio y regresar al editor; comprobar su conservación. No guardar cambios académicos únicamente para revisar la composición visual.
3. Con las cuentas de prueba disponibles para incompleta y pendiente, verificar la tarea siguiente y el acceso al formulario o revisión correspondientes. Si se dispone de suspensión o vencimiento, comprobar que el aviso y la acción estén visibles; no alterar fixtures para producirlos.
4. Revisar escritorio 1280×800, tablet 768×1024, móvil 390×844 y 320 px, zoom 200–400 %, textos largos, Tab/Shift+Tab, Enter/Espacio, foco al regresar y lector de pantalla. Ningún aviso o acción debe quedar oculto o cortado.

**Punto de detención:** se entrega para aceptación visual humana. Sin reinicios de contenedores, deploy, commit, push o merge. Sin cambios de esta corrección a backend, permisos, datos académicos, contratos, Task 13, Task 14 o demo r4. Los cambios previos del árbol de trabajo se preservan; la comparación usa el manifiesto inicial en `/tmp/furgoplus-mi-servicio/before.json`, no solo el diff contra HEAD.
