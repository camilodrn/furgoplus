# Requisito vigente C1–C7 · 31-10-2026

Calidad visual profesional es requisito transversal, independiente de funcionalidad, facilidad y consistencia. No aprobar por herencia de componentes o por pasar tests. Evidencia auténtica, renders y APK deben distinguirse. Estado y continuidad: `docs/TASK12_FINAL_UX_CLOSURE.md`.

# Contrato activo integral · 31-10-2026

El encargo definitivo autoriza F01–F13 sobre las 87 vistas/subflujos y 12 situaciones transversales, en todos los roles React/Flutter. Sustituye todos los recortes temporales conservados abajo como historia. La dirección es A/B, Material 3, azul #0752AC, superficies claras, tipografía del sistema y controles de 48 como mínimo del producto.

Composición: contexto breve → información para decidir → acción → detalle. Exploración y gestión compactas; revisión de consecuencias más espaciada. Una especificación conceptual, adaptada a cada plataforma. Tokens React en style.css y Material en furgo_theme.dart; superficies Android en FurgoSurface; foco/capas React en useModal. Conservar datos/roles, privacidad, consentimiento, permisos efectivos, borradores y protecciones ante resultados inciertos.

Ningún rol queda pospuesto por defecto. Documentar evidencia real y validación pendiente por fila; no inferir aceptación de tests o capturas sintéticas. Informe y cobertura: docs/TASK12_INTEGRAL_IMPLEMENTATION.md y docs/TASK12_INTEGRAL_COVERAGE.md. Sin backend/contratos/datos/infraestructura/dependencias UI nuevas/commit/push/deploy.

## Contexto histórico sustituido por el encargo integral

# Contrato visual activo de FurgoPlus T12

31-10-2026. Referencia conceptual autorizada: `docs/TASK12_DESIGN_SYSTEM_PROPOSAL.md`, con los ajustes del encargo de implementación unificada. Dirección A · Panel operativo + filas/divisores B, azul #0752AC, superficies claras, fuentes del sistema y Material 3. La aceptación visual de la implementación sigue pendiente.

El primer incremento consolida la superficie Android existente y sus consumidores de ambos roles, alinea azul suave/divisor/positivo, aclara la validación pública y presenta comparación familiar por atributos reales. En React consolida iconos existentes de shell/Ayuda, espera/desconocido neutral en revisión y legibilidad de capacidad. No cambia geometría global React sin observación de navegador. No crear más wrappers por rol ni overrides al final de las hojas.

Jerarquía: dónde estoy → qué ocurre → qué puedo hacer → qué necesito consultar. Una superficie por grupo; filas para registros y atributos comparables. Una acción principal por tarea, controles nativos accesibles y estados con texto. Mantener ruta/fecha en capacidad; contacto no reserva; revisión interna no garantiza seguridad. Inicio web mantiene gestión: no dispone de los datos de Hoy Android.

Reutilizar `FurgoSurface` (dueño de superficie), adaptadores existentes `FurgoOperationalPanel`/`ParentPanel`/`ParentDisclosure`, widgets Material, `ProductIcon`, `StatusBadge` y `CapacityText`. C11–C15 siguen siendo de dominio. Preservar recuperación, permisos, privacidad, confirmaciones y separación revisión/publicación. No cambiar controladores complejos para este lote.

Cobertura y resultados actuales: `docs/TASK12_VISUAL_IMPLEMENTATION_REVIEW.md`; seguimiento por fila en `docs/TASK12_UX_MIGRATION_MATRIX.md`. No iniciar otro lote que dependa de aprobación visual antes de evaluar este. Sin dependencias nuevas, backend, contratos, sesiones, datos académicos, infraestructura, commit, push o deploy.

## Antecedentes históricos (alcances temporales sustituidos por el encargo actual)

# Contexto visual de FurgoPlus T12

Decisión humana del 27-10-2026: **A · Panel operativo**, incorporando las filas y divisores de B. La decisión completa y los límites están en `design.json`.

La continuación humana extiende esta identidad progresivamente a web y Android. El primer lote autoriza únicamente Inicio web y Hoy del conductor Flutter, además de documentar sistema y matriz. Los demás destinos quedan planificados para revisión posterior. Se conservan menú lateral web, navegación Material 3 Android, editores y lógica existentes. Publicación y aprobación son estados separados; las intervenciones tienen prioridad.

La API aporta fechas y bloqueos; no aporta una categoría de «por vencer». Mostrar las fechas y ordenar por requisitos pendientes y fechas informadas, sin calcular vigencia con el reloj del navegador ni inventar permisos. Las simulaciones de exploración quedan fuera de la aplicación.

Inicio prioriza pendientes y accesos de gestión; Hoy prioriza el recorrido seleccionado, su acción y las filas de destino/pasajeros. No repetir la ficha documental de Mi servicio en cada pantalla. Sin bibliotecas nuevas, backend, contratos, datos académicos, Task 13/14 ni demo r4. No modificar otras pantallas en este lote ni declarar aceptación visual automática.

Sistema y correspondencia: `docs/TASK12_SHARED_VISUAL_SYSTEM.md`. Matriz: `docs/TASK12_VISUAL_ROLLOUT_MATRIX.md`. Implementación y revisión humana del lote: `docs/TASK12_INICIO_HOY_BATCH1.md`.

Referencias ya investigadas: `docs/design/task12-mi-servicio/README.md`. La exploración histórica se conserva; la implementación y su aceptación se documentan por separado.

La continuación del 28-10-2026 autoriza el lote acotado de recuperación Android, Pasajeros/Pagos React y pasajeros de Hoy Flutter. Su alcance, límites de paginación y revisión pendiente están en `docs/TASK12_RECOVERY_PASSENGERS_PAYMENTS.md`. Esta autorización posterior no amplía los demás lotes de la matriz.

La decisión humana del 28-10-2026 finaliza el prototipado y autoriza implementar la experiencia completa del conductor. Este alcance reemplaza las limitaciones temporales de los lotes anteriores: Inicio, Mi servicio/publicación, Rutas, Pasajeros, Solicitudes y Pagos React; Hoy, detalle, pasajeros y navegación del conductor Flutter. La referencia verificable es `docs/design/task12-product-prototype/`, con 443 comprobaciones responsive aprobadas según la reejecución humana y su evidencia. Sin nueva exploración estética. Administración y apoderado quedan fuera de esta implementación. Entrega, diferencias y aceptación: `docs/TASK12_DRIVER_IMPLEMENTATION.md`.

La revisión humana posterior de Ayuda y soporte sigue sin aprobarse. El usuario autoriza sustituir las dos colecciones simultáneas por tareas excluyentes: Guías con categoría/búsqueda y una guía íntegra seleccionada, Mis solicitudes con bandeja paginada y detalle a demanda, y navegación progresiva móvil. La implementación reutiliza A/B; no es una nueva aceptación visual. Verificación académica previa y entrega: `docs/TASK12_HELP_TASK_VIEWS_REVIEW.md`. No se modifican backend, Flutter ni datos o despliegue académico.
