# FurgoPlus — Estado y continuidad

Actualizado: 2026-11-01.
Este documento resume lo recuperado y debe contrastarse con el código y las evidencias.

## Producto
Plataforma de transporte escolar para conductor, apoderado y administrador.
Backend Django/DRF y PostgreSQL; web React/TypeScript; móvil Flutter.
El backend controla permisos, capacidades y reglas críticas.

## Trabajo actual
Task 12 — rama task/12-plan-capabilities.
Planes Básico, Pro y Elite; reportes, Excel, ayuda, soporte y asistente FAQ.
Rediseño integral F01–F13 para los tres roles.
No confundir implementación, pruebas automáticas y aceptación UX.

## Últimos hitos
- C7 Pasajeros Android: aprobación física del usuario en Samsung A54.
- C8 Cookies y almacenamiento: información de privacidad sin banner ficticio.
- Últimos resultados reportados: React 397/397 y Flutter 213/213.
- Product Design: 57 filas pendientes en el dictamen del 31/10.
- Informes posteriores mencionan 60: reconciliar antes del cierre.
- Feria académica prevista para 2026-11-04.
- Task 12 todavía no tiene aprobación integral.

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
- docs/PLAN_CAPABILITIES_SPEC.md
- docs/TASK12_FINAL_UX_CLOSURE.md
- docs/TASK12_UX_MIGRATION_MATRIX.md
- docs/TASK12_VISUAL_QA_COVERAGE.md
- docs/TASK12_C7_APK_PHYSICAL_VERIFICATION.md
- docs/TASK12_C8_STORAGE_PRIVACY_AUDIT.md
- docs/evidence/task12-integral/manifest.json
- docs/evidence/task12-c7-c8/manifest.json

## Git
Los commits de backend, web, Flutter, infraestructura y documentación
se registraron localmente en Task 12 el 2026-11-01.
Revisar `git log` para el estado vigente.
Antes del push: revisión de seguridad, dependencias y alcance del PR.

## Continuación
Cerrar selección de evidencias, revisar el conjunto, publicar la rama
en GitHub y preparar PR sin merge automático.
Las validaciones UX pendientes se conservan como pendientes.
