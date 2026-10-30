# Procedencia del conocimiento público — revisión 28/10/2026

La corrección del usuario y la implementación académica T12 prevalecen sobre
supuestos antiguos de planificación. El asistente usa extractos públicos fijos;
no recorre archivos, worktrees, bases de datos ni servicios para recuperar FAQ
durante una conversación. No hay integración ni importación de T12 en ejecución.

## Planes: afirmación anterior retirada

`docs/PRODUCT_SCOPE.md:Q2` de la base `c0854de` decía que Basic/Pro/Elite tenían
idénticas capacidades. Esa afirmación describía una etapa anterior y **no es
vigente para explicar T12**. Tampoco puede deducirse igualdad de capacidades de
los términos que no prometen beneficios comerciales. No se modifican esos
archivos ni T12: la rectificación queda en las fuentes de Task 14.

El 28/10/2026 se inspeccionaron, solo en lectura, estos archivos del worktree
`/home/duran/Proyectos/furgoplus-planes`, rama `task/12-plan-capabilities`.
Como sus cambios no están representados por el HEAD común `c0854de`, se registra
el contenido revisado mediante SHA-256, además del catálogo `2026-10-19.3`:

| Archivo relativo a T12 | SHA-256 |
| --- | --- |
| `backend/drivers/capabilities.py` | `37040247a9df3366e824197cede439639905fad11308497b40fbe0f499a84eda` |
| `backend/drivers/reports_api.py` | `fd14dac8f52e12c3e8c52f1562046f443d569fd673845cf275597967c630008a` |
| `docs/PLAN_CAPABILITIES_SPEC.md` | `b3141d6979db0a0897c8ea666b7236d5311fe9402d7775258f56c5ee4a537043` |

| Afirmación permitida | Evidencia y límite |
| --- | --- |
| Básico no incluye informes mensuales; Pro y Elite sí | `CAPABILITIES['reports.monthly.read']`: planes `pro/elite`, `implemented=True`; `MonthlyReportsView.get` exige esa capacidad. |
| Elite añade informes avanzados y XLSX | `reports.detail.read`, `analytics.period_comparison`, `reports.xlsx.export`: solo `elite`, implementadas; guards en endpoints avanzados y exportaciones. |
| Las capacidades académicas implementadas no prueban disponibilidad comercial | Especificación: matriz implementada, precios propuestos; `commercial_proposal=True`, `automatic_billing=False`. No se publican precios como una oferta disponible. |
| No hay contratación ni pago comercial dentro de FurgoPlus | Alcance confirmado por el usuario, matriz T12 sin pasarela/cobros/renovación/facturas y límites de la demo; no hay un proceso de compra que el asistente pueda indicar. |
| La asignación de planes es manual | ADR 0004, flujos de administración existentes y especificación T12; asignar para la demo no equivale a vender. |

Se leyeron también los guards y casos de `backend/drivers/test_reports.py`, que
esperan mensual 403/200/200 y avanzado/XLSX 403/403/200 para Basic/Pro/Elite.
No se ejecutaron pruebas ni se modificó código en ese worktree. Esta revisión
verifica la implementación y el alcance documental, **no su despliegue ni la
habilitación efectiva de una cuenta**. Los permisos y vigencia se consultarán
solo mediante un adaptador autorizado si se integra en el futuro.

## Solicitud del apoderado y pagos

- `docs/PRODUCT_SCOPE.md`, Parent journey; `web/src/legal/terms.md`, secciones
  1/4, y `docs/DEMO_MODE.md`: Buscar, comuna, servicio, solicitud de contacto con
  consentimiento para compartir correo; aceptar no reserva cupo. El contacto
  posterior no constituye contratación dentro de FurgoPlus.
- `web/src/legal/privacy.md`, sección 9; `web/src/legal/terms.md`, sección 7:
  registro manual de pagos de transporte, sin procesamiento de dinero. No es
  el pago de una suscripción ni una pasarela comercial.
- Las otras FAQ mantienen sus fuentes explícitas en `guides.py`. Las futuras
  funciones, precios y compromisos pendientes no se convierten en hechos por
  estar en una propuesta, un título de catálogo o una respuesta del modelo.

## Mantenimiento y aceptación

Al cambiar una afirmación, revisar primero implementación y alcance con fecha y
versión; actualizar la FAQ y el oráculo `acceptance_cases.py` por separado tras
revisión factual. El oráculo contiene respuestas literales independientes de
`GUIDES`: una FAQ falsa no debe convertirse automáticamente en su propio esperado.
Las pruebas de mutación comprueban que la aceptación rechaza igualdad de planes,
reserva automática y consulta personal ante una pregunta comercial.

## Base híbrida pública — revisión 29/10/2026

Se volvieron a leer las fuentes de este checkout para los recorridos generales,
conductor/apoderado, solicitudes, pagos manuales, publicación y límites demo.
Se recalcularon en lectura los tres hashes de T12: coinciden exactamente con la
tabla del 28/10 y el catálogo `2026-10-19.3`. No se ejecutó ni modificó T12.
La contradicción de Q2 continúa expresamente sustituida para planes.

Las nueve FAQ originales se conservan literalmente en `knowledge.json`. Se
agregan `driver` (PRODUCT_SCOPE: Driver journey; términos 2/4/5/7), `help`
(contrato experimental y solo lectura del propio asistente) y `demo_limits`
(DEMO_MODE: registro cerrado; PRODUCT_SCOPE: Deferred/future; términos 1/5).
Estos extractos no acreditan que una instancia o cuenta tenga esas funciones
habilitadas ni disponibilidad comercial. Cada registro tiene fecha, procedencia,
estado y límite explícito; el modelo solo puede seleccionar identificadores.

Huella de las fuentes locales consultadas (SHA-256; no se leen durante un turno):

| Archivo | SHA-256 |
| --- | --- |
| `docs/PRODUCT_SCOPE.md` | `fa6f7b2f4a5d468ebd10825c87b5a8c344a5dd99e8e6bc85434567e8aa73fbca` |
| `docs/DEMO_MODE.md` | `567f016147b02a8465cd6db82e031087e599dca71e939184a9ce84f16cf51e75` |
| `web/src/legal/terms.md` | `b29c74ee4c30a5bab7fc6db2ed8faeb867287984e97d49ececbf701fdfd23ee6` |
| `web/src/legal/privacy.md` | `fca3eb9d65bf7f5b714a625449c47befac5651f2fa4b665e5c358106177a2a21` |
| `backend/drivers/publication.py` | `6db3199ba4e57b5660a7d257518bcee080ba4496e9eecdbc5f105cf777668fac` |
| `backend/drivers/capacity.py` | `be3b99f66a17e4f4a5a5be45df3ea3b7a51ca81329031bcdab5800e0e8e582e1` |
| `backend/drivers/services.py` | `54297ea3dd723741198d4797a6919a2cc76bb22d6c0416050f17299ccfd371f7` |

Mantenimiento, confianza, abstención y evaluación: [KNOWLEDGE.md](KNOWLEDGE.md).
