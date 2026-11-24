# FurgoPlus — Estado y continuidad

Último corte incorporado: cierre académico de noviembre de 2026.
Este documento resume lo recuperado y debe contrastarse con el código y las evidencias.

## Task 16 · Cierre académico de noviembre de 2026

En `furgoplus-feria`, rama `task/16-cierre-academico`, base `9e6ef46`, el
operador confirmó el release `20261124-9e6ef46-2eff066a-01`, 730 pruebas
automatizadas y el ensayo integral HTTPS 15/15. Al cierre, el origen público
volvió a presentación en 18084. Ensayo conserva su base separada en 18083.
Task 15 y landing siguen en 18080 y 18081, respectivamente. El candidato se
empaquetó con cambios aún sin commit. El procedimiento reproducible de
infraestructura se añadió después del despliegue y queda pendiente validarlo
como conjunto nuevo en el HP. [Runbook y evidencia](../TASK16_DEMO_RUNBOOK.md)
· [Procedimiento operativo](../TASK16_DEPLOYMENT.md).

## Corte histórico de Task 12 · 1 de noviembre de 2026

## Procedencia de las decisiones reconciliadas
Fuente: confirmación explícita del usuario del 2026-11-01, en el encargo
«Etapa 3: registrar decisiones confirmadas y reconciliar continuidad», referida
a decisiones anteriores. Se registra aquí esa confirmación; los mensajes
originales de aquellas decisiones no están incorporados al repositorio.
Los informes, manifiestos, hashes y coberturas históricos conservan su contenido.
Sus pendientes de aceptación se complementan con las confirmaciones acotadas
siguientes, sin extenderlas a otros alcances.

## Producto
Plataforma de transporte escolar para conductor, apoderado y administrador.
Backend Django/DRF y PostgreSQL; web React/TypeScript; móvil Flutter.
El backend controla permisos, capacidades y reglas críticas.

## Trabajo al corte de Task 12
Task 12 — rama task/12-plan-capabilities.
Planes Básico, Pro y Elite; reportes, Excel, ayuda, soporte y asistente FAQ.
Rediseño integral F01–F13 para los tres roles.
No confundir implementación, pruebas automáticas y aceptación UX.

## Últimos hitos
- Matriz técnica T12: el usuario confirma la aprobación del alcance técnico del
  prototipo académico de planes, con ajustes. No se reconstruyen los ajustes cuyo
  detalle no esté suficientemente documentado; queda pendiente recuperar su alcance.
  Básico $19.990, Pro $39.990 y Elite $69.990 CLP siguen siendo propuestas
  comerciales, no precios definitivos ni autorización de facturación automática.
  Referencia técnica: [especificación T12](../PLAN_CAPABILITIES_SPEC.md).
- C7 Pasajeros: aceptación humana expresa del alcance funcional y visual revisado
  en el Samsung A54 el 2026-10-31, confirmada por el usuario el 2026-11-01.
  Comprendió seis comprobaciones positivas: jerarquía visual; recorrido y ocupación;
  presentación de pasajeros; contacto agrupado; búsqueda; navegación con Android
  Atrás. No acredita producción, seguridad integral ni otras funcionalidades.
  La [verificación física C7](../TASK12_C7_APK_PHYSICAL_VERIFICATION.md) conserva
  la evidencia técnica histórica, distinta de esta confirmación de aceptación.
- C8: el usuario aprobó el enfoque funcional de informar sobre almacenamiento
  necesario real, sin inventar un banner de consentimiento. No es aceptación
  jurídica ni cumplimiento normativo completo. Se conservan la revisión jurídica,
  verificación HTTPS productiva, lectura hablada y demás pendientes de la
  [auditoría C8](../TASK12_C8_STORAGE_PRIVACY_AUDIT.md).
- Últimos resultados históricos reportados: React 397/397 y Flutter 213/213.
  No se reejecutaron en esta reconciliación ni prueban por sí solos el HEAD actual.
- Feria académica prevista para 2026-11-04.
- Task 12 todavía no tiene aprobación integral.

## Cobertura UX reconciliada
Los cortes del 2026-10-31 corresponden al mismo conjunto de 99 filas
(87 vistas/subflujos y 12 situaciones), no a cantidades de tests automatizados:

| Corte documental | Migradas verificadas | Conservadas verificadas | Pendientes |
| --- | ---: | ---: | ---: |
| [Integral](../evidence/task12-integral/coverage.json) | 37 | 5 | 57 |
| [Cierre intermedio](../evidence/task12-closure/coverage.json) | 29 | 5 | 65 |
| [C7/C8](../evidence/task12-c7-c8/coverage.json) | 34 | 5 | 60 |

Se reabrieron D03/D04/D05/D10/P03/F02/F03/W31 (57 → 65); posteriormente se
verificaron D03/D04/D05/D10 y W19 (65 → 60). El último corte documentado C7/C8
conserva 60 pendientes; C8 es una ampliación transversal separada del denominador.
Esta confirmación de aceptación C7 no recalcula la cobertura ni cierra pendientes
de otras filas. Las etiquetas de verificación no equivalen a aceptación integral.
El [cierre UX](../TASK12_FINAL_UX_CLOSURE.md) y la
[cobertura integral](../TASK12_INTEGRAL_COVERAGE.md) explican sus alcances.
La cifra 57 procede del corte integral; no se conserva aquí su atribución a un
dictamen externo de Product Design sin recuperar la fuente original.

## Método de trabajo
1. El usuario plantea objetivos e ideas.
2. ChatGPT analiza, define alcance y redacta encargos precisos.
3. Codex implementa y valida en Fedora, React y Samsung A54 mediante ADB.
4. Se contrastan capturas reales, comportamiento y pruebas.
5. Product Design en Work audita visualmente cuando corresponde.
6. El usuario aprueba la experiencia; tests verdes no bastan.
7. Antes de cambiar infraestructura: diagnosticar, respaldar y limitar alcance.

## Protección de entornos
Conservar sesiones y datos del escenario académico.
No ejecutar escrituras destructivas ni alterar datos académicos para obtener capturas.
Para operaciones de negocio usar pruebas aisladas con datos sintéticos.
No mezclar los worktrees de Task 11, 12, 13 y 14.
No hacer merge, push o despliegue como consecuencia automática de una auditoría.

## Documentos principales
- [Especificación T12](../PLAN_CAPABILITIES_SPEC.md)
- [Cierre UX C7/C8](../TASK12_FINAL_UX_CLOSURE.md)
- [Matriz de migración UX](../TASK12_UX_MIGRATION_MATRIX.md)
- [Cobertura QA visual](../TASK12_VISUAL_QA_COVERAGE.md)
- [Verificación física C7](../TASK12_C7_APK_PHYSICAL_VERIFICATION.md)
- [Auditoría de almacenamiento C8](../TASK12_C8_STORAGE_PRIVACY_AUDIT.md)
- [Manifiesto integral histórico](../evidence/task12-integral/manifest.json)
- [Manifiesto C7/C8 histórico](../evidence/task12-c7-c8/manifest.json)
- [Ideas y decisiones por recuperar](IDEAS_BACKLOG.md)

## Git
Los commits de backend, web, Flutter, infraestructura y documentación
se registraron localmente en Task 12 el 2026-11-01.
Al inicio de esta etapa (2026-11-01): worktree
`/home/duran/Proyectos/furgoplus-planes`, rama `task/12-plan-capabilities`,
HEAD local `aab3b8f55f34650b274f8dc3daa4f2a3dc062562`; sin cambios rastreados
ni staging, con 630 archivos de evidencia sin seguimiento.
La referencia local `origin/task/12-plan-capabilities` apunta a `da5d496`:
HEAD está un commit por delante de esa referencia. No se consultó el remoto;
esto no confirma el estado actual de publicación en GitHub ni de un PR.
Esta etapa modifica únicamente los dos documentos de continuidad.
Revisar `git log` y `git status` al retomar: este registro es un corte fechado.
Antes del push: revisión de seguridad, dependencias y alcance del PR.

## Continuación
Revisar el diff de los dos documentos de continuidad, sin staging ni commit.
Siguen pendientes recuperar fuentes originales y ajustes de planes, seleccionar
evidencia duradera y comprobar el estado remoto antes de planificar una publicación.
No se autoriza publicación, merge ni otra etapa automáticamente.
Las validaciones UX pendientes se conservan como pendientes.
