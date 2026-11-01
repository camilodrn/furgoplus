# T12.11 — Propuesta administrativa de Ayuda y soporte

Fecha: 2026-10-26. Rama: `task/12-plan-capabilities`.

**Implementada para revisión humana. No constituye aceptación visual.** El rechazo
del diseño anterior sigue vigente hasta revisar esta propuesta en navegador Fedora.
Las verificaciones previas de Samsung A54, recorridos, reportes y autorización por
plan (15/15, informadas por el usuario) no se repitieron ni se modificaron.

## Alcance y comprobaciones previas

Se inspeccionaron `HelpSupport.tsx`, su CSS, pruebas React y de sesión, integración
en `App.tsx`, tipos API, `backend/api/support_contracts.py`, `support_api.py`,
`support.py` y documentación de soporte. Se verificó que el retorno realmente vuelve
a la lista administrativa y conserva el filtro/paginación; no vuelve a solicitudes
propias. Se corrigió la etiqueta a «Volver a la cola de soporte».

La rama y el árbol ya contenían cambios anteriores sin commit, incluidos archivos
de soporte sin seguimiento. Esta intervención solo edita:

- `web/src/HelpSupport.tsx`.
- `web/src/help-support.css`.
- `web/src/HelpSupport.test.tsx`.
- Este documento.

No se modifican backend, endpoints, contratos, permisos, auditoría, migraciones,
datos, suscripciones, escenario académico, Flutter, reportes, Task 13/14,
infraestructura, homelab ni demo r4. No se ejecutan escrituras contra una API real.
Sin commit, push, merge ni deploy.

## Propuesta

1. **Resumen:** administración abre directamente la cola activa. Navegación compacta
   a guías/panel; total de la vista y tres indicadores de la página: críticas activas,
   abiertas por revisar y en revisión. Sin promesas de respuesta ni métricas simuladas.
2. **Acción:** lista de tarjetas compactas, sin tabla, con gravedad, asunto, solicitante,
   estado, fecha de creación y «Revisar». Críticas/altas tienen acentos y texto de gravedad;
   abiertas y en revisión destacan frente a espera del solicitante. La lectura no
   depende solo del color. El orden entregado por el servidor se conserva exactamente.
3. **Detalles bajo demanda:** regla de orden, prioridad comercial, prioridad original,
   versión, privacidad y límites de atención quedan en desplegables nativos.

El filtro añade abiertas, en revisión y esperando al solicitante, valores ya admitidos
por el endpoint. Conserva activas, historial completo, resueltas y cerradas. Cambiar
filtro inicia la primera página; volver del caso mantiene filtro y página. Paginación
y retorno restauran el foco en la cola; el cambio de filtro no roba el foco del selector.

El detalle usa encabezado con asunto, número, solicitante, gravedad, estado y fechas.
En escritorio amplio, historial y respuesta ocupan columnas diferenciadas; debajo de
1100 px se apilan. Se conservan todos los eventos, autores, fechas, textos, estados
anteriores/nuevos y motivos. Los anteriores se despliegan antes de los tres recientes,
para mantener el orden cronológico al abrirlos.

«Responder al solicitante» tiene un panel propio y acción principal azul. El estado
queda en «Cambiar estado (opcional)». Al seleccionarlo, el motivo obligatorio y la
indicación del cambio aparecen fuera del desplegable, incluso si se vuelve a cerrar.
El motivo opcional sin transición sigue accesible dentro del desplegable. Se conservan
los límites de 2000/300 caracteres, transiciones de la API y `expected_version`.
Se puede responder sin transición, responder y cambiar estado, o guardar solo un
cambio con motivo; la última operación tiene botón secundario y etiqueta específica.
Las solicitudes cerradas conservan historial y actualización, sin formulario.

Hay confirmación de respuesta o gestión de estado, bloqueo de doble envío y
conservación del borrador/motivo ante error. Los conflictos 409 requieren volver a
leer el caso; no se reintenta la escritura automáticamente. Cargas, errores y estados
vacíos conservan mensajes y acciones de recuperación. Para el usuario final se
mantiene «Esperando tu respuesta»; administración usa «Esperando al solicitante».

## Datos reales y límites de la API

- `count` es el total del filtro solicitado. **Los tres indicadores son de la página
  visible**, identificada por rango y texto explícito; no son totales globales por
  gravedad o estado. Resueltas/cerradas no cuentan como críticas activas.
- No se ordena ni agrupa de nuevo en React. Gravedad precede a prioridad comercial
  efectiva y antigüedad, como implementa el backend.
- La lista no entrega propietario, nombres ni contactos. El servicio de creación
  registra al propietario en el evento inicial (`from_state` vacío y `to_state=open`).
  Se usa exclusivamente ese evento del detalle para mostrar **rol e ID de usuario**.
  No se deduce el solicitante del ID del ticket ni del último autor, ni se inventa
  nombre, correo, plan o asignación de agente.
- Para ofrecer solicitante también en la cola, se leen los detalles existentes de
  la página visible: hasta 25 GET adicionales y tres en paralelo por lote. No bloquean
  «Revisar»; solo se conservan las etiquetas de identidad en el estado de esa lista,
  sin cachear historiales. Al cambiar vista o desmontar se ignoran respuestas tardías
  y se detiene el inicio de lecturas restantes. Las ya enviadas pueden terminar.
- Mientras se obtiene identidad se indica carga; si falla se indica indisponibilidad.
  Se puede revisar el caso o actualizar la cola para reintentar. No se consultan
  directorios, perfiles, documentos ni otras fuentes de datos.
- Revisar con datos abundantes el costo de estas lecturas en Fedora. Si se requiere
  eliminar ese costo o mostrar nombres/totales globales, habrá que revisar por separado
  un contrato administrativo mínimo. **No se ha cambiado el backend ni se propone
  aprobarlo implícitamente con esta revisión visual.**

## Validación automática

```bash
npm run test --prefix web -- --maxWorkers=2
npm run test --prefix web -- src/HelpSupport.test.tsx src/HelpSupportSession.test.tsx --maxWorkers=2
npm run build --prefix web
npm run typecheck --prefix web
npm run contract:check --prefix web
npm run lint --prefix web
web/node_modules/.bin/prettier --check web/src/HelpSupport.tsx web/src/HelpSupport.test.tsx web/src/help-support.css
git diff --check
```

- Regresión completa: **293/293 pruebas**, 18 archivos (39,86 s).
- Soporte y aislamiento de sesión: **36/36 pruebas**, incluidas ocho nuevas.
  Cubren indicadores con paginación, orden sin promoción por plan, identificación
  real, concurrencia limitada/lecturas tardías, fallo de identificación, respuesta
  sin transición, doble envío, motivo obligatorio visible, cambio sin respuesta,
  confirmación, retorno a filtro/página con foco, conflicto y auditoría cerrada.
- Build de producción, tipos, contratos, lint y formato de archivos editados:
  aprobados. Se corrigió un error de tipos por acceso indexado potencialmente vacío
  detectado en el primer build. No se amplían timeouts ni se deshabilitan pruebas.
- Comprobación matemática de colores reutilizados sobre blanco: texto 14,30:1,
  secundario 6,31:1, azul 7,47:1, crítico 7,24:1, alta 6,54:1. Sobre el fondo azul
  suave: texto 12,78:1 y secundario 5,63:1. Foco existente: 4,97:1 sobre blanco y
  4,44:1 sobre azul suave. No sustituye revisar foco, zoom y contraste en navegador.
- No se ejecutaron pruebas Django ni migraciones: esta intervención no cambia
  backend. Las pruebas React usan datos y API simulados.

La primera ejecución de las pruebas de soporte falló en tres esperas del contenido
de guías porque administración ahora abre la cola. Se ajustó la preparación de las
pruebas a la entrada real; las aserciones funcionales se mantienen y amplían.

## Revisión humana pendiente en Fedora

No se encontró navegador conectado en esta sesión. Pendiente revisar el renderizado
y uso real, sin atribuir aceptación a las pruebas DOM o a los cálculos de color:

- [ ] En administrador autorizado, abrir Ayuda y soporte: resumen primero y cola
  activa; identificar la acción de revisión y las críticas frente a otras pendientes.
- [ ] Revisar 1440×900 y 1280×800 con navegación lateral, 768×1024, 390×844 y 320 px;
  asuntos largos, historial abundante y zoom 200–400 %, sin cortes ni scroll horizontal.
- [ ] Tab/Shift+Tab, Enter y Espacio: filtros, revisión, respuesta, desplegables,
  motivo, actualización y paginación. Comprobar foco visible, orden y lector de pantalla.
- [ ] Verificar rol/ID del solicitante con casos sintéticos de conductor y apoderado,
  identidad cargando/no disponible, y costo de consultas con una página completa.
- [ ] Responder sin transición, responder cambiando estado con motivo y gestionar
  solo estado. Cerrar los controles secundarios con cambio pendiente: motivo visible.
- [ ] Revisar confirmaciones, recuperación de errores 403/409/red, retención de
  borrador en conflicto y ausencia de doble escritura.
- [ ] Abrir historial anterior, estados y motivos; resolver/cerrar con transiciones
  permitidas y confirmar ausencia de formulario al cerrar.
- [ ] Volver a la cola conservando página/filtro. Comprobar totales e indicadores en
  varias páginas, vistas sin resultados y filtro de espera del solicitante.
- [ ] Confirmar gravedad antes que beneficio comercial en una cola sintética real,
  sin reordenación al terminar de cargar las identificaciones.
- [ ] Confirmar acceso a guías, privacidad y límites sin que dominen la pantalla.

La propuesta se detiene aquí para revisión humana de T12.11.
