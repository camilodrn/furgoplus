# FurgoPlus — Entrada de contexto para Codex

Complementa las instrucciones globales aplicables; conserva sus acuerdos sin
duplicarlos aquí. Este archivo orienta la lectura, no acredita el estado del producto.

## Antes de actuar

- Confirma el directorio del worktree, la rama, el commit y los cambios locales
  con `pwd`, `git branch --show-current`, `git rev-parse HEAD` y
  `git --no-optional-locks status --short --branch --untracked-files=normal`.
- Lee el [README](README.md). Cuando existan, consulta
  [estado y continuidad](docs/continuity/PROJECT_STATE.md) e
  [ideas y backlog](docs/continuity/IDEAS_BACKLOG.md).
- Según la tarea, consulta [producto](docs/PRODUCT_SCOPE.md),
  [arquitectura](docs/ARCHITECTURE.md), [modelo de datos](docs/DATA_MODEL.md)
  y los ADR pertinentes en `docs/decisions/`. Para Task 12, consulta la
  [especificación](docs/PLAN_CAPABILITIES_SPEC.md) y los informes correspondientes;
  el [cierre UX](docs/TASK12_FINAL_UX_CLOSURE.md) enlaza evidencia y pendientes.

## Interpretar y preservar el contexto

- Distingue encargos e informes históricos, estado vigente, evidencia de pruebas
  y aceptación humana. Contrasta fechas, revisión Git y alcance; si hay
  contradicciones, decláralas sin inferir aprobaciones ni funcionalidades terminadas.
- Una idea registrada no autoriza su implementación; las pruebas aprobadas no
  equivalen a aceptación humana. Sustenta cada afirmación con evidencia pertinente.
- Respeta los cambios locales, archivos sin seguimiento, evidencias y datos
  existentes. Limita las modificaciones al alcance autorizado; ante cambios
  inesperados o conflictos, detente y repórtalos.
