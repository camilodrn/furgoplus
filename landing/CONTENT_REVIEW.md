# Task 13 · Matriz editorial y propuesta comercial

Corte original: 26 de octubre de 2026. Corrección de exactitud: 28 de octubre de 2026. Esta revisión sustituye la conclusión anterior de que cambiar de plan no añadía funciones. Se consultó T12 en modo lectura en `../furgoplus-planes` respecto de la raíz del worktree; no se ejecutaron sus servicios ni pruebas ni se modificaron sus archivos. La instrucción del usuario aporta además los hechos verificados de permisos y el límite de integración/UX de los asistentes.

La documentación histórica local (`PRODUCT_SCOPE.md`, ADR 0004 y congelación del MVP) describía gestión común y diferenciación pendiente. No acredita el estado posterior de T12. La ausencia de implementación en este checkout no permite clasificar como futuras las capacidades ya implementadas en T12.

## Precios y modelo

| Propuesta académica | Referencia | Tratamiento público |
| --- | --- | --- |
| Básico | $19.990 CLP/mes | Referencial, IVA incluido, sin contratación |
| Pro | $39.990 CLP/mes | Referencial, IVA incluido, sin contratación |
| Elite | $69.990 CLP/mes | Referencial, IVA incluido, sin contratación |
| Apoderados | Acceso inicial gratuito | Propuesta, sin inscripciones abiertas |

Configuración única de importes: `src/content/plans.ts`. No se cambian precios, IVA, desglose, permisos del producto ni activación manual. No se ofrece pasarela, suscripción automática, período de prueba ni reserva de servicios. La disponibilidad comercial futura **no está habilitada**, sin fecha confirmada.

## Verificación por capacidad

**Implementado en MVP académico** describe la referencia T12, sujeta a rol, perfil, permisos y vigencia; no implica disponibilidad comercial ni conexión de esta landing al producto. **Experimental** reconoce permisos y lógica implementados del asistente, con integración y UX pendientes de cierre. **Disponibilidad comercial futura** describe una oferta todavía no habilitada; no convierte en inexistente una implementación académica.

| Afirmación | Evidencia consultada | Presentación |
| --- | --- | --- |
| Publicación condicionada, solicitudes, rutas/cupos y pagos manuales | Documentación y vistas locales; T12 `backend/drivers/capabilities.py` (`operations.core`, `dashboard.basic`) | Gestión base común. Publicar conserva revisión interna, documentos vigentes y requisitos de elegibilidad. El contacto mantiene consentimiento; no reserva cupos ni constituye contrato. Los pagos no procesan dinero. |
| Informes mensuales | T12 `reports.monthly.read`, `test_capabilities.py`, `test_reports.py`; `TASK12_REPORTS_VALIDATION.md` | Implementado en MVP académico para Pro y Elite; excluido en Básico. No se infiere del dashboard base. |
| Informes avanzados y comparación con el mes anterior | T12 `reports.detail.read`, `analytics.period_comparison`; pruebas e informe de reportes | Implementado en MVP académico, solo Elite. No es la comparación de transportistas del apoderado ni analítica sin límites. |
| Tres tipos de exportación XLSX | T12 `reports.xlsx.export`, `reports_xlsx.py`, pruebas e informe de reportes | Implementado en MVP académico, solo Elite: pagos manuales, recorridos/cupos y solicitudes de contacto. Son tres tipos de archivo; no un cupo de tres descargas al mes. |
| Asistente FAQ automatizado | T12 `assistant.faq`; `PLAN_CAPABILITIES_SPEC.md`, `TASK12_SUPPORT_VALIDATION.md`; límite indicado por el usuario | Experimental para Pro y Elite. Permisos y lógica implementados; integración y UX pendientes de cierre. |
| Asistente contextual automatizado | T12 `assistant.contextual`; catálogo e informe de soporte | Experimental, solo Elite. Reglas y contenido revisado; no se promete IA generativa, acciones autónomas ni soporte humano 24/7. |
| Disponibilidad comercial | Instrucción del usuario y alcance de T13; T12 conserva precios de propuesta y ausencia de cobros automáticos | Futura, no habilitada, sin contratación ni fecha confirmada. No se anuncia ninguna capacidad como servicio comercial disponible. |
| Seguridad, revisión documental y accesibilidad | Alcance/ADRs y controles existentes | Transversales; sin certificación de permisos, seguros o seguridad del transporte. |

Fuentes T12 (lectura únicamente):

- [Catálogo y matriz](../../furgoplus-planes/docs/PLAN_CAPABILITIES_SPEC.md), versión `2026-10-19.3`, contrastada con `backend/drivers/capabilities.py`.
- [Validación de reportes](../../furgoplus-planes/docs/TASK12_REPORTS_VALIDATION.md), contrastada con las pruebas `test_capabilities.py` y `test_reports.py`, y la implementación `reports_xlsx.py`.
- [Validación de soporte/asistentes](../../furgoplus-planes/docs/TASK12_SUPPORT_VALIDATION.md), que documenta permisos FAQ/contextual y respuestas basadas en reglas/contenido.
- [Revisión de navegación Flutter](../../furgoplus-planes/docs/TASK12_FLUTTER_NAVIGATION_REVIEW.md) y [revisión de soporte web](../../furgoplus-planes/docs/TASK12_ADMIN_SUPPORT_UX_REVIEW.md): conservan aceptación humana pendiente.

Los resultados de pruebas consignados en esos documentos son evidencia previa de T12, no ejecuciones realizadas en esta revisión. No se añade al catálogo público ninguna otra funcionalidad encontrada durante la consulta.

## Comprobación adicional pendiente

- Aceptación humana de integración y UX de asistentes en web/móvil; se conserva su estado experimental aunque existan permisos y lógica.
- Verificar en navegador la legibilidad y el responsive del texto corregido, y con lector de pantalla los estados asociados a cada plan.
- Definir y validar alcance, condiciones y operación de una eventual oferta comercial, incluida la política futura de acceso de apoderados. No se afirma disponibilidad en producción, despliegue, contratación ni fecha de lanzamiento.

## Dos hitos · información secundaria del proyecto

- **Noviembre de 2026 · Evaluación académica:** presentar y evaluar la demostración, sus capacidades y pendientes. No se afirma una evaluación ya aprobada.
- **Feria de Software 2027:** aspiración de exhibir una versión más madura, probada con usuarios y comercialmente validada. No se afirma participación confirmada, pruebas ya realizadas ni validación comercial existente.

Los hitos se conservan dentro de “Sobre el proyecto”, accesible desde el footer. La Feria de Software no ocupa una sección de la landing pública ni se presenta como beneficio, lanzamiento confirmado o validación comercial.

## Identidad y límites públicos

- Ilustración de ruta original y conceptual, rotulada “Sin GPS”. No es mapa operativo ni simulación de un seguimiento real.
- Mockups web/móvil ilustrativos, con datos ficticios; no son capturas autenticadas ni muestran registros de producción.
- Sin testimonios, clientes, usuarios, volumen de uso, convenios, certificaciones ni métricas inventados. Las cifras operativas de los mockups están identificadas como datos de demo.
- Las marcas de validación se explican como revisión interna demostrativa; no acreditan permisos, seguros o seguridad del transporte.
- No hay checkout, registro, lista de espera, contacto comercial o descarga pendientes disfrazados de CTA. Los enlaces funcionan dentro de la landing y los botones modifican demostraciones o abren información local.

## Revisión editorial pendiente

Confirmar en revisión humana el mensaje comercial corregido, la claridad de los límites de informes y XLSX, el estado experimental de los asistentes y la futura política de acceso gratuito. La diferenciación de informes está acreditada en T12 como implementación académica; la oferta comercial sigue sin habilitar. Estos pendientes no se resuelven alterando Task 12, planes del backend, bases de datos ni infraestructura.

## Refinamiento visual · segunda iteración

- Se conserva el titular «Un buen día empieza con un buen trayecto».
- El recurso de marca de `web/public/brand/furgoplus-logo.png` se copia sin modificar a `landing/public/brand/`. Es un recurso disponible en este worktree; no se consultaron otros worktrees. Se adopta el azul compartido `#0752AC`, conservando las superficies y la tipografía editorial.
- La demo aparece después de la propuesta. Sus interfaces se identifican como ilustrativas y los logos interiores dejan de ser enlaces que llevaban inesperadamente al inicio.
- Los planes conservan tres beneficios destacados. La comparación distingue gestión base e informes implementados en el MVP académico, asistentes experimentales y disponibilidad comercial futura no habilitada; conserva activación manual y condiciones de acceso.
- No se modifican importes, funciones ni estados reales del producto. Los precios continúan como propuesta académica, con las mismas advertencias y sin checkout.
- Privacidad se limita al comportamiento del código de la landing y distingue sus recursos del mismo origen de los posibles registros técnicos del servidor. No afirma que visitar una página evite por completo el tratamiento de datos técnicos.

### Significado de los CTA

| Control                                                             | Acción real                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Logo del header/footer y “Volver arriba”                            | Ir a `#inicio`. Los logos de los mockups son imágenes sin enlace.             |
| “Explorar la demo” en hero/header/menú, demo del footer y CTA final | Ir a `#producto`, la demostración local. No inicia sesión ni abre una cuenta. |
| “Así funciona” y navegación por secciones                           | Ir a un anchor existente dentro de la misma página.                           |
| CTA del conductor/apoderado en beneficios                           | Seleccionar la audiencia correspondiente y llevar a `#producto`.              |
| Pestañas, recorridos y perfiles A/B                                 | Modificar únicamente datos ficticios en memoria.                              |
| Comparación de planes, explicación de estados y FAQ                 | Abrir/cerrar información existente con `details/summary`.                     |
| Sobre el proyecto, privacidad y accesibilidad                       | Abrir el diálogo local con el contenido correspondiente.                      |
| Cerrar/Entendido                                                    | Cerrar ese diálogo; el navegador gestiona el foco modal nativo.               |

No hay botones de compra, descarga, contacto comercial o registro sin destino. El comportamiento nativo del diálogo y los targets táctiles requieren todavía comprobación en navegador de esta segunda iteración.

## Simplificación editorial

La simplificación anterior solo consultó fuentes de este checkout. La corrección actual incorpora evidencia T12 en modo lectura y sustituye sus conclusiones de madurez de planes, conservando la estructura editorial. “Implementado en MVP académico” no acredita lanzamiento comercial.

`highlight` selecciona tres beneficios por tarjeta sin retirar el catálogo de funciones. Los demás se conservan en la comparación bajo demanda: publicación condicionada, informes mensuales, informes avanzados, exportaciones y asistentes experimentales. No se cambian precios, IVA, permisos ni capacidades del producto.

El encabezado de planes precede directamente a las tarjetas. Una sola nota visible reúne precios referenciales, IVA y contratación no habilitada; cada tarjeta la referencia con `aria-describedby`. Los límites de revisión documental y contacto siguen también en beneficios y FAQ. Hero, ilustraciones, orden de secciones, animaciones y destinos se conservan.

Resultados y límites de la revisión: [EDITORIAL_QA.md](EDITORIAL_QA.md).
