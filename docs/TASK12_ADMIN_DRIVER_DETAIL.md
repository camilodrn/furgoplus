# T12 — Detalle administrativo del conductor

Rama `task/12-plan-capabilities`. Entrega del 29-10-2026 para revisión humana en Fedora. **Aceptación visual pendiente**: no se comprobó la aplicación real en un navegador durante esta sesión.

Se aplica el sistema aprobado **A · Panel operativo + filas/divisores B** y el principio **resumen primero → acción principal → detalles bajo demanda**. Se conserva el trabajo previo sin commit. Este lote modifica exclusivamente el detalle administrativo, su CSS acotado, sus pruebas y el ayudante/documentación de aceptación.

## Matriz breve

| Área          | Cambio                                                                                                                                                                                           | Conservación                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada       | Identidad y correo; una superficie ejecutiva con perfil, validación, visibilidad, plan/vigencia y rutas activas completas. Hasta tres bloqueos reales inicialmente; los restantes se despliegan. | Datos y orden API, etiquetas compartidas y `planValidity`; sin métricas nuevas ni permiso de operación inferido. «Visible para apoderados» expresa `eligible`, no una habilitación general inventada.                                                      |
| Navegación    | Resumen, Estado, Plan, Validaciones e Historial son vistas excluyentes. La identidad, el estado ejecutivo y las acciones permanecen accesibles.                                                  | Sidebar y búsqueda/filtros/páginas del directorio sin cambios. Botones nativos, sección actual textual y foco en su encabezado.                                                                                                                            |
| Resumen       | Solo una fila de la última validación enviada y una de la última acción, con fecha y acceso a su sección. No muestra motivos, observaciones ni colecciones completas.                            | La vista reciente se conserva separada de la página consultada: avanzar a registros antiguos no los convierte en los más recientes. Una observación histórica no se presenta como bloqueo actual.                                                          |
| Estado y plan | Estado contiene la explicación del perfil, solicitud de publicación, cobertura y revisiones actual/aprobada. Plan conserva su vista y editor existentes, ahora en su destino propio.             | Fechas chilenas, alcance académico, capacidades y restricciones existentes. El componente de plan permanece montado para conservar borradores/lecturas y actualizar la publicación autorizada; ocultar una sección no es una nueva política de permisos.   |
| Acciones      | Accesos directos a revisar antecedentes y gestionar plan; suspender, desactivar o reactivar según el perfil actual.                                                                              | Abrir un destino/editor no escribe. Motivo, consecuencia, confirmación explícita, versión/estado esperado, bloqueo de doble envío, 403/409, caducidad y limpieza de sesión conservados.                                                                    |
| Registros     | Validaciones e historial muestran como máximo tres registros por vista; avanzar **reemplaza** las filas. Retroceso contiguo, rangos y total API.                                                 | Lecturas existentes de hasta 25 por página, sin descargar páginas futuras ni retener todas las páginas. Observaciones exactas, expediente por ID, autor, motivo y cambios permitidos siguen disponibles. Búsqueda global solo donde ya existe: directorio. |
| Presentación  | Filas compactas, controles que se envuelven y columnas que se adaptan; las secciones ocultas salen del recorrido de teclado.                                                                     | Tokens, `AdminBadge`, `AdminFocusPanel`, botones nativos, títulos semánticos y patrón `admin-task-row`; sin dependencias, animaciones ni contenedores nuevos con scroll interno.                                                                           |

Los estados ejecutivos se presentan una sola vez en el contexto persistente. El resumen reciente es una entrada a los registros completos, no otra copia de sus párrafos o controles. Los detalles de plan conservan la información necesaria para revisar una modificación sensible.

## Verificación

**381/381 pruebas React en 21 archivos**, TypeScript, lint, build, contratos, formato de archivos editados y `git diff --check`: aprobados. Revisión determinista 21st: cuatro archivos, cero hallazgos. Resultados y logs: [evidencia de esta entrega](evidence/task12-admin-driver-detail/README.md).

```bash
npm run test --prefix web -- --maxWorkers=2
npm run typecheck --prefix web
npm run lint --prefix web
npm run build --prefix web
npm run contract:check --prefix web
web/node_modules/.bin/prettier --check web/src/AdminControls.tsx web/src/AdminControls.test.tsx web/src/SessionPrivacy.test.tsx web/src/admin-coherence.css web/scripts/capture-admin-readonly.mjs
git diff --check
```

Se adaptó la preparación de las pruebas de privacidad a la navegación excluyente, manteniendo las aserciones de limpieza de datos, borradores, confirmaciones, avisos y respuestas tardías. Las pruebas nuevas cubren entrada real en Resumen, una sola sección accesible, foco DOM y acciones persistentes, conservación de página/observación, acceso exacto a expedientes, recorrido de 54 validaciones y de 201 acciones hacia adelante/atrás, máximo de tres registros y ausencia de precarga de páginas futuras. Se conservan las pruebas de motivos, confirmaciones, cancelación, permisos, conflictos, doble envío y aislamiento de sesiones.

Las pruebas que usan `innerWidth` verifican comportamiento DOM, **no geometría responsive**. JSDOM tampoco acredita teclado nativo, foco modal del navegador, zoom ni lector de pantalla.

Se consultó el catálogo de 21st para detalle compacto/navegación. Sus propuestas de drawer/sidebar no mejoraban los componentes existentes; no se recuperó código ni se generó otra estética. Se ejecutó su revisión determinista local sobre las fuentes/CSS de este lote; no equivale a una revisión visual.

## Guía de aceptación en Fedora

1. Usar el entorno académico sintético **ya existente**, con administrador autorizado, normalmente `http://127.0.0.1:15173`. No cargar/preparar datos, migrar, reconstruir servicios ni desplegar. Confirmar que el servidor sirve el código actual: `/src/AdminControls.tsx` contiene `Secciones del detalle del conductor` y `/src/admin-coherence.css` contiene `admin-driver-snapshot`. Si no corresponde, registrar la discrepancia antes de evaluar.
2. Conductores → buscar un conductor → abrir ficha. En pocos segundos identificar nombre/correo, perfil, validación, visibilidad, plan y rutas. Verificar bloqueos contra la respuesta API; distinguir estado actual de revisión histórica. Con servicio visible no debe aparecer una alerta inventada. Registrar si se entiende qué requiere atención sin abrir todas las secciones.
3. Recorrer las cinco secciones. Solo una tarea debe mostrarse cada vez; resumen ejecutivo y acciones siguen localizables. Resumen muestra solo las dos filas recientes. Estado conserva cobertura/publicación/revisiones; Plan conserva fechas/capacidades; Validaciones permite abrir el expediente exacto; Historial conserva actor, motivo y cambios permitidos bajo demanda.
4. Con los registros que ya existan (uno o cientos), avanzar/retroceder: máximo tres filas, rango correcto y orden recibido. En el límite de 25, comprobar el siguiente GET con `offset=25` y luego `50`, etc.; no debe haber lectura anticipada de todas las páginas. Volver a Resumen sigue mostrando el registro más reciente. Volver a la colección conserva su página. Mantener búsqueda, filtros y páginas del directorio al regresar. Si el escenario carece de volumen suficiente, marcar ese caso pendiente: no fabricar datos para aceptarlo.
5. Revisar **1440×900, 1280×800, 768×1024, 390×844 y 320×844**, nombres/correos/motivos largos y **zoom real 200 % y 400 %**. Comprobar que acciones, etiquetas, rangos y contenido no se cortan, que la navegación se envuelve y que no aparecen scroll horizontal ni listas con scroll interno. Redimensionar el viewport no sustituye hacer zoom real.
6. Usar Tab/Shift+Tab, Enter y Espacio para secciones, accesos, desplegables y paginadores. Verificar foco visible, salto al título al cambiar tarea y al primer registro al paginar; los controles de secciones ocultas no deben recibir foco. Abrir y cancelar perfil/plan: Escape, contención del foco, fondo inerte y retorno al disparador. Recorrer todo el editor con zoom. No confirmar cambios durante la revisión visual.
7. Revisar perfiles activos, suspendidos/desactivados, plan ausente/inactivo/vencido y validación pendiente/con observaciones **solo si existen en el escenario autorizado**. Comparar estados textuales y acciones permitidas. No aprobar/rechazar, suspender/reactivar, guardar planes ni descargar documentos (la descarga genera auditoría). La navegación de solo lectura no debe generar mutaciones.
8. Registrar navegador, viewport, zoom, resultado por caso y observaciones; aceptar/rechazar visualmente mediante revisión humana. No atribuir el resultado a pruebas DOM ni a capturas de lotes anteriores.

El ayudante existente [capture-admin-readonly.mjs](../web/scripts/capture-admin-readonly.mjs) se actualizó para capturar cada sección por separado y verificar la fuente de este lote. Abre React real con la API real y autenticación manual, bloquea escrituras salvo login y bloquea descargas documentales. No guarda sesión ni credenciales. Requiere Playwright/navegador ya disponibles en Fedora; no es necesario instalar dependencias del producto:

```bash
PLAYWRIGHT_MODULE=/home/duran/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs node web/scripts/capture-admin-readonly.mjs http://127.0.0.1:15173 /tmp/furgoplus-driver-detail-acceptance
```

Si cambia esa ruta del caché, usar el módulo local disponible. El ayudante también recorre los otros destinos administrativos ya existentes, sin modificarlos. Sus PNG y `manifest.json` documentan capturas/desbordes; **no aceptan automáticamente** el diseño ni sustituyen teclado/zoom humanos. Copiar solo evidencia sintética autorizada.

## Límite visual y alcance

El conector Playwright rechazó incluso listar pestañas: `MCP tool call requires approval, but approval policy is never`. CUA devolvió `apps: [], browsers: []`. Vite pudo iniciarse en el puerto local 15174, pero las lecturas HTTP de los puertos 15173/15174 fallaron con `failed to open socket: Operation not permitted`. La comprobación inicial de Chromium local informó que faltaba el ejecutable esperado por la versión de Playwright. No se instalaron navegadores ni se solicitaron excepciones. No se obtuvieron capturas de este lote ni se comprobó visualmente la aplicación real.

Se entrega la implementación para revisión humana. Sin cambios de backend, Flutter, contratos/tipos API, datos académicos, Task 13/14, homelab, infraestructura ni demo r4. Sin migraciones, cargas, operaciones Docker, commit, push, merge o deploy. La comparación con el inventario SHA-256 anterior a editar está en `preservation.json` de la evidencia.
