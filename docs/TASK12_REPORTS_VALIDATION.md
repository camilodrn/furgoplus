# Entrega T12.4–T12.6 — reportes y planes

Rama: `task/12-plan-capabilities`. Autorización explícita del usuario posterior a
T12.1–T12.3. Trabajo secuencial: resúmenes Django, análisis/Excel Elite, integración
React. Fecha local de validación: 19-10-2026 (20-10 UTC). Revisión docente prevista:
4 de noviembre. Sin commit, push, merge ni deploy.

## Resultado y trazabilidad

| Etapa | Implementación | Evidencia |
| --- | --- | --- |
| T12.4 | Tres resúmenes mensuales Pro/Elite; Básico conserva Inicio y operaciones | `reports.py`, `MonthlyReportsView`, `ReportTests` |
| T12.5 | Detalle mínimo, comparación con mes anterior y tres archivos XLSX Elite | `AdvancedReportsView`, tres export views, `reports_xlsx.py`; ZIP/XML y aislamiento comprobados |
| T12.6 | Sección Plan y reportes desde navegación existente; plan, vigencia, capacidades, carga, vacío, error y sesión | `DriverReports.tsx`, pruebas de UI y regresión existente |

Catálogo `2026-10-19.2`: habilita `reports.monthly.read`, `reports.detail.read`,
`reports.xlsx.export` y `analytics.period_comparison` únicamente donde el catálogo
lo incluye y la suscripción/perfil lo permite. React consume `enabled`; no contiene
una matriz comercial para autorizar. Guard, roles, auditoría administrativa y
propiedad se reutilizan. No hay nuevas migraciones.

Ayuda, soporte, asistentes, notificaciones, capacitación diferenciada y
posicionamiento comercial siguen futuros. No se implementan ni se presentan como
servicios disponibles. Los precios permanecen como propuesta, sin cobro automático.
Flutter no se modifica en esta etapa.

## Contratos y semántica temporal

Todos usan sesión Django, GET, `Cache-Control: no-store` también en errores, y
propietario derivado de la sesión. No aceptan ID de conductor. Un único parámetro
opcional `month=YYYY-MM`, entre `2000-01` y `2099-12`; por defecto mes actual de
Santiago. Parámetros extra, repetidos o meses inválidos producen 400. Inicio
inclusivo, siguiente mes exclusivo. Los instantes de contactos se delimitan con
`ZoneInfo("America/Santiago")`, incluyendo su cambio de offset. Fechas de servicio
y vencimiento son DateField y no se convierten a fechas UTC.

| Endpoint bajo `/api/v1/` | Permiso obligatorio | Respuesta |
| --- | --- | --- |
| `driver/capabilities/` | Cuenta conductora, sin restricción comercial adicional | Catálogo y permisos efectivos |
| `driver/reports/monthly/` | `reports.monthly.read` | `MonthlyReport` |
| `driver/reports/advanced/` | `reports.detail.read` y `analytics.period_comparison` | `AdvancedReport` |
| `driver/reports/payments.xlsx` | `reports.xlsx.export` | Excel de pagos manuales |
| `driver/reports/runs.xlsx` | `reports.xlsx.export` | Excel de recorridos y cupos |
| `driver/reports/contacts.xlsx` | `reports.xlsx.export` | Excel de contactos |

OpenAPI vive en `api/contracts.py` y se genera a `openapi.json`; TypeScript se
regenera desde ese contrato. XLSX declara su MIME binario real y los encabezados
de descarga privada. No existe enlace público ni archivo persistido en servidor.
Anónimo o rol distinto: 403 según la convención existente. Plan insuficiente,
vencido, futuro, suspendido, inactivo o perfil no activo: 403. Perfil inexistente:
404. Escritura a reportes: 405, sin modificar datos.

- **Pagos:** cohorte por `due_on` (vencimiento), sin prorrateo de períodos de
  servicio. Cantidad y monto CLP por estado actual: pendiente, pagado manual y
  anulado. Monto no anulado = pendiente + pagado; anulados separados. Detalle
  incluye inicio/fin del servicio y vencimiento, sin nombres ni asignaciones.
- **Recorridos:** solo `RouteRun` realmente registrado, por `service_date`, con
  estados y capacidad snapshot. La suma de capacidades entre servicios no es
  ocupación, asistencia ni número de menores. Ausencia de ejecución no significa
  cancelación. Cupos actuales se muestran aparte con fecha de consulta y próximo
  servicio, asignaciones actuales y estado actual de la ruta (incluidas inactivas);
  no se atribuyen al mes histórico consultado.
- **Contactos:** cohorte por `created_at`; estados actuales pendiente, aceptada,
  rechazada y cancelada. Recibidas = suma de los cuatro estados. Aceptación no
  acredita contratación. No se exportan mensajes, emails ni identidad familiar.
- **Comparación Elite:** mes calendario anterior, misma semántica, usando estados
  actuales de ambas cohortes. Diferencia absoluta; sin porcentajes con base cero,
  tasas de conversión inventadas ni reconstrucción de estados al cierre. Meses
  vacíos conservan ceros y explican que no permiten inferir tendencia. Un mes en
  curso puede estar incompleto. El mes previo a enero de 2000 es diciembre de 1999,
  calculado internamente aunque no sea un filtro público permitido.

## Decisiones de Excel y seguridad

`XlsxWriter==3.2.9` se fija en requirements. Se elige una biblioteca especializada
de escritura para producir XLSX interoperable con formatos y varias hojas, sin
mantener un serializador OOXML propio ni añadir pandas. [PyPI](https://pypi.org/project/xlsxwriter/3.2.9/)
declara BSD-2-Clause, Python >=3.8 y uso de biblioteca estándar, sin dependencias
transitivas. Instalación realizada únicamente en el venv temporal de pruebas.

Revisión: la [página de seguridad del proyecto](https://github.com/jmcnamara/XlsxWriter/security)
no mostraba avisos publicados ni política SECURITY.md al consultar. Eso no garantiza
ausencia de vulnerabilidades; se mantiene versión fija y revisión posterior antes
de publicar. No se leen XLSX suministrados por usuarios, macros ni plantillas externas.

Generación `BytesIO` en memoria; sin almacenamiento público o temporal de reportes.
Todo texto se escribe con `write_string`; conversión automática a fórmulas y URLs
desactivada, según [documentación oficial](https://xlsxwriter.readthedocs.io/working_with_data.html).
Las pruebas cubren `=`, `+`, `-`, `@`, tabulador, salto de línea y URLs. Se inspecciona
XML para comprobar ausencia de fórmulas e hipervínculos. Los montos/totales son
valores numéricos calculados en Python, no fórmulas que dependan de recalcular Excel.

Cada libro incluye Resumen y Detalle; recorridos agrega Cupos actuales con su fecha.
Encabezados en español, período, generación Santiago, notas, totales por estado,
mes anterior, diferencia absoluta, filtros, anchos legibles y paneles congelados.
Fechas ISO explícitas como texto para no perder offsets. No incluye documentos,
direcciones, teléfonos, emails, mensajes o nombres de menores/adultos. Solo IDs de
registros/rutas propios necesarios para contrastar datos.

Límite: 10.000 registros por detalle mensual (y por tipo descargado); el exceso da
400 sin truncamiento silencioso. Los agregados mensuales no truncan datos.
PostgreSQL usa transacción `REPEATABLE READ READ ONLY` para que los totales, detalle
y comparación de una respuesta compartan snapshot ante escrituras concurrentes.
Una prueba PostgreSQL modifica un pago desde otra conexión y verifica que resumen
y detalle siguen concordando; la siguiente consulta ya ve el cambio.

## Permisos y comportamiento React

La pantalla refresca permisos al entrar, recuperar foco o visibilidad, cada 30 s
mientras está visible, al llegar el vencimiento y tras una denegación. El reloj
del cliente solo agenda la consulta: Django decide acceso. Existe actualización
manual sin recargar la app. Durante el refresco se retira el reporte anterior;
respuestas obsoletas, desmontajes y cambios de identidad no lo restauran.
Las descargas usan el cliente con invalidación de sesión existente, Blob local y
revocación de URL; la autorización siempre vuelve a ejecutarse en Django.

## Reproducción PostgreSQL aislado

`config/settings_task12_tests.py` ignora `DB_*` para seleccionar la base: SQLite
en memoria por defecto, o exclusivamente `127.0.0.1:55432/task12_isolated` cuando
`TASK12_TEST_POSTGRES=true`. Credenciales sintéticas solo para el contenedor.
No cargar `.env` de producción. La suite completa de concurrencia requiere PostgreSQL.

Desde `backend/`, con Podman local y dependencias del proyecto instaladas:

```bash
TASK12_PYTHON=/ruta/al/venv/bin/python bash scripts/test_task12_postgres.sh
```

El script crea PostgreSQL `17.6-alpine3.22`, tmpfs sin volúmenes del host,
publicación solo en loopback 55432 y nombre propio; espera disponibilidad, ejecuta
check de DB, detección de migraciones, migrate/migrate --check y la suite;
detiene/elimina el contenedor con trap. Si 55432 está ocupado falla;
no lo libera ni se conecta a una base alternativa. Django crea/destruye
`test_task12_isolated`; no se necesita migrar una base desplegada.
Se pueden pasar etiquetas de tests al script para una ejecución puntual.

## Evidencia final

- Django completo PostgreSQL aislado: **153/153**, sin skips, 64,833 s. Incluye
  `FinalSeatConcurrencyTests`, `ProfileControlConcurrencyTests`,
  `ContactConcurrencyTests`, `ConcurrentStartTests`, `ContactThrottleProcessTests`
  y las dos pruebas nuevas de snapshot. El script reproducible también se ejecutó
  y eliminó su contenedor. Antes: 150/150 sobre PostgreSQL, previo a ampliar casos.
- Reportes: nueve pruebas funcionales y dos transaccionales. Matriz Básico/Pro/Elite,
  futuras/vencidas/suspendidas/inactivas, perfil suspendido, cambios administrativos,
  otros propietarios/roles, vacíos, meses inválidos/repetidos, fin exclusivo,
  febrero bisiesto, cambio de año, XLSX y privacidad.
- SQLite se usó para iteración puntual de reportes y capacidades; no acredita
  concurrencia. El primer intento de conectar al contenedor fue bloqueado por el
  sandbox; se repitió con permiso de conexión local y settings aislados.
- OpenAPI `generate_openapi --check`, `makemigrations --check --dry-run`, Ruff check
  y Ruff format: aprobados. El runner PostgreSQL aplicó todas las migraciones a su
  base de pruebas. No hay migraciones nuevas.
- Preflight final PostgreSQL: `check --database default`, detección de migraciones,
  `migrate --noinput` y `migrate --check` aprobados en otra instancia desechable;
  después, **11/11** pruebas de reportes. No se suman como pruebas distintas a las
  153 de la suite completa. El contenedor se eliminó al terminar.
- React completo: **253/253**, 16 archivos, 72,79 s, con
  `npm test -- --maxWorkers=1 --no-file-parallelism`, sin otras suites simultáneas.
  Incluye las nueve pruebas nuevas de reportes (Básico, Pro, Elite, descarga,
  errores, downgrade, expiración de sesión, respuestas tardías, timer de vencimiento
  y polling de cambios administrativos).
- Web `contract:check`, `lint`, `typecheck` (incluido en build), `build` y
  `format:check`: aprobados. `git diff --check` y `bash -n` del runner: aprobados.
- Primer `npm test` con paralelismo por defecto: 242/252, diez timeouts en pruebas
  existentes (5 o 15 s), sin errores de aserción. Se repite con `--maxWorkers=2`,
  sin modificar tests anteriores ni ampliar límites de tiempo. Con dos workers:
  251/253, dos timeouts; primera serial: 250/253, tres timeouts. Se contrastaron los
  tres casos en una copia temporal con App, api y CSS de HEAD: 3/3 en 12,22 s;
  entrega actual: 3/3 en 13,47 s. La última suite completa serial pasó 253/253.
  El contraste se hizo en `/tmp`, sin restaurar ni descartar archivos de la rama.
  Estos resultados son compatibles con contención del entorno; no se declara que
  las primeras ejecuciones fallidas estuvieran aprobadas.

## Registro de vulnerabilidades npm

`npm audit --json`, contrastado con `npm ls --all`: cuatro paquetes afectados,
1 moderado, 1 alto, 2 críticos. No se ejecutó `audit fix`, ni se cambió lockfile.
Son dependencias de desarrollo/pruebas/build; `npm ls --omit=dev --all` solo muestra
React, React DOM y scheduler. Esto acota el alcance al tooling, sin declarar que el
equipo/CI sean inmunes. No se comprobó explotación mediante ataques.

| Paquete instalado | Gravedad informada por npm | Cadena y alcance revisado |
| --- | --- | --- |
| `@vitest/mocker@3.2.7` | Moderada | Vitest → mocker. Lectura arbitraria con redirecciones de mocks cuando el plugin y socket de dev están expuestos. El proyecto usa Vitest jsdom; no se configuró mockerPlugin público. [Aviso del mantenedor](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). |
| `source-map-js@1.2.1` | Alta | Vite → PostCSS y jsdom → dom-selector → css-tree. DoS al procesar sourcemaps indexados maliciosos en tooling; no es dependencia runtime del sitio estático. [Aviso registrado por npm](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| `tinypool@1.1.1` | Crítica | Vitest → tinypool. Gadget de ejecución de código en workers si existe contaminación previa de prototipos; afecta equipo de desarrollo/CI. Dos avisos: [opciones del worker](https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3), [opciones de run](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr). Los mantenedores los etiquetan High; se conserva aquí Critical tal como lo informó npm. |
| `vitest@3.2.7` | Crítica | Dependencia directa dev. Agrega el aviso moderado de mocker y la gravedad transitiva de tinypool; no es un quinto fallo independiente ni código del backend Django. |

Revisión pendiente: compatibilidad de una actualización de Vitest y cadenas
transitivas, en una tarea separada; npm propone un salto mayor. Mantener registro
de estas vulnerabilidades hasta aprobar y validar una solución. No se modifican
automáticamente en esta entrega.

## Riesgos y límites pendientes

- Estados mutables: consultar meses anteriores hoy puede producir cifras distintas
  tras corregir pagos/contactos. La UI y Excel lo explican; no es contabilidad ni
  balance histórico cerrado.
- Capacidad disponible es proyección con datos actuales; cambios posteriores de
  asignaciones alteran la proyección. No hay asistencia ni ocupación histórica.
- Un cambio administrativo se refleja al próximo refresco (hasta 30 s si la pantalla
  sigue visible); cada endpoint revalida de inmediato al recibir una nueva solicitud.
- Consultas síncronas/memoria con límite de detalle; grandes volúmenes pueden requerir
  índices y paginación/exportación en segundo plano, previa medición. No hay enlaces
  públicos, cola de reportes o nuevas tablas en esta entrega.
- Los XLSX se verificaron estructuralmente y por contenido. Apertura manual en Excel
  de escritorio y revisión docente del contenido siguen siendo aceptación humana.
- No se modifica Debian, Cloudflare, Docker de producción, registro cerrado, r4,
  infraestructura, PostgreSQL desplegado, soporte, chatbot ni notificaciones.

## Archivos de la entrega acumulada

Los archivos anteriores de T12.1–T12.3 se conservaron; no se descartó su diff.

| Archivo | Cambio |
| --- | --- |
| `backend/api/contracts.py` | Catálogo previo preservado; esquemas y cinco endpoints de reportes |
| `backend/api/urls.py` | Registro de vistas |
| `backend/openapi.json` | Contrato regenerado |
| `backend/requirements.txt` | XlsxWriter fijo |
| `backend/config/settings_task12_tests.py` | Settings de prueba sin resolución de DB desplegada |
| `backend/drivers/capabilities.py` | Catálogo anterior; versión y cuatro capacidades habilitadas |
| `backend/drivers/capabilities_api.py` | Preexistente T12.1–3, preservado sin cambios en esta continuación |
| `backend/drivers/test_capabilities.py` | Pruebas anteriores ajustadas a funciones ya implementadas |
| `backend/drivers/reports.py` | Cohortes, consultas, agregados, detalle y snapshots |
| `backend/drivers/reports_api.py` | Guards y respuestas privadas |
| `backend/drivers/reports_xlsx.py` | Tres libros Excel seguros |
| `backend/drivers/test_reports.py` | Contratos, privacidad, matriz y concurrencia de reportes |
| `backend/scripts/test_task12_postgres.sh` | PostgreSQL Podman desechable y suite completa |
| `web/scripts/generate-api-types.mjs` | Generación de tipos del catálogo y reportes |
| `web/src/api-types.ts` | Tipos regenerados |
| `web/src/api.ts` | Métodos autenticados y descargas privadas |
| `web/src/App.tsx` | Navegación del conductor |
| `web/src/DriverReports.tsx` | Plan, reportes y actualización de permisos |
| `web/src/DriverReports.test.tsx` | Casos UI de planes, errores, cambios, vigencia y sesión |
| `web/src/style.css` | Tablas legibles con scroll horizontal acotado |
| `docs/PLAN_CAPABILITIES_SPEC.md` | Matriz actualizada, separando historia y funciones futuras |
| `docs/TASK12_REPORTS_VALIDATION.md` | Contratos, evidencia, decisiones, riesgos y guion |

## Guion docente (5 minutos, datos sintéticos en entorno de ensayo autorizado)

1. **Básico:** entrar al Inicio existente y mostrar operaciones sin cambios. Abrir
   Plan y reportes: plan, vigencia y funciones disponibles. Explicar que resúmenes
   y Excel no están incluidos. Llamar al endpoint Excel desde esa sesión: 403.
2. **Pro:** con los mismos datos operativos comparables, consultar el mes con
   registros. Mostrar pagos por estado y montos, servicios registrados y contactos.
   Cambiar a un mes vacío. Explicar las fechas de selección y que cupos actuales
   no son ocupación histórica. Intentar XLSX directamente: 403.
3. **Elite:** mostrar análisis ampliado, comparación con mes anterior y detalle
   mínimo. Descargar los tres XLSX y contrastar cantidades/montos con Resumen y
   Detalle. Mostrar que no aparecen nombres de menores, contactos ni direcciones.
4. **Cambio administrativo:** desde sesión admin de ensayo, cambiar Elite → Pro con
   motivo y vigencia mediante el flujo existente. Volver al conductor y recuperar
   foco/actualizar: desaparecen análisis y descargas, sin recargar toda la app.
   Un enlace Excel anterior ya devuelve 403. Mostrar auditoría existente del cambio.
5. **Vencimiento y privacidad:** asignar vigencia corta en ensayo y mostrar el
   refresco/denegación al vencer. Cerrar sesión y abrir otra cuenta conductora:
   no aparecen datos anteriores. Finalizar con el registro de pruebas PostgreSQL
   y las cuatro vulnerabilidades pendientes de revisión, sin prometer funciones futuras.

Este guion no prepara ni altera cuentas de r4. La provisión de datos/cuentas para
una demo persistente y cualquier despliegue requieren un entorno autorizado aparte.
