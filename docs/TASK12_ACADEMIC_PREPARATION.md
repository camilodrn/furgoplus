> **Actualización T12.11 — implementación académica preparada (26-10-2026).**
> El usuario confirmó desde Fedora sobre `furgoplus-task12`: PostgreSQL, Django y
> React operativos; 1 administrador, 1 conductor, 0 apoderados; 0 suscripciones,
> rutas, recorridos, pasajeros, pagos, contactos, tickets y eventos de soporte;
> 0 pagos/contactos creados en octubre de 2026. **No repetir ese inventario.**
> Se autorizó implementar archivos y scripts, sin ejecutar operaciones que escriban
> en bases de datos. El escenario ahora está definido por
> [`infra/academic/README.md`](../infra/academic/README.md), con proyecto
> `furgoplus-task12-academic`, PostgreSQL exclusivo y puertos **18082 / 15173**.
> **Corrección mínima autorizada antes de provisionar:** el diagnóstico Docker
> real desde Fedora confirmó `furgoplus-demo-caddy-1` en `127.0.0.1:18080` y
> `furgoplus-demo-restore-task11-caddy-1` en `127.0.0.1:18081`.
> `furgoplus-task12` está detenido y se conserva; en ese diagnóstico el académico
> todavía no se había creado.
> La API académica cambia de `127.0.0.1:18080` a `127.0.0.1:18082`, con Django
> interno 8000. Web 15173, PostgreSQL, proyectos, redes, volúmenes y secretos
> mantienen su configuración. Los orígenes y sus guardas usan el nuevo puerto;
> no se amplía CSRF. Los comandos por fase están en el README académico enlazado.
> **Corrección posterior del guard de secretos:** el usuario confirmó que los
> secretos nuevos ya están provisionados y etiquetados con `chcon` en Fedora.
> Se reprodujo sin Docker el rechazo del destino legítimo
> `/run/secrets/<source>`: el guard solo aceptaba `<source>` y las pruebas
> simulaban esa forma. Se aceptan ahora ambas representaciones exactas y el
> destino omitido; permanecen las comprobaciones de identidad, propietario,
> permisos, enlaces y archivos exclusivos. El guard no compara etiquetas SELinux
> ni timestamps. No regenerar secretos: reintentar solo `control.py config`
> según el README. Esta corrección pasó 35/35 pruebas sin DB.
> **Corrección posterior del guard de arranque:** se obtuvo el JSON efectivo de
> Docker Compose 5.5.1, que incluye `command: null` y `entrypoint: null` en los
> tres servicios; el Compose original no declara ninguno. Ese JSON reproduce
> «Inicio reemplazado» con el guard anterior. El guard corregido permite solo
> campos ausentes o `None`; sigue rechazando cadenas/listas vacías y arranques
> personalizados. Se conservó una fixture real sin contenidos secretos y se
> verificaron **40/40 pruebas sin DB**, Ruff 0.13.2 y `git diff --check`.
> `control.py config` ya terminó con código 0, sin crear ni iniciar contenedores.
> **Aislamiento de la suite SQLite:** el usuario confirmó `config`, `build` y
> 13/13 pruebas Django aprobados en Fedora. El antiguo `compose run --no-deps`
> creó los dos volúmenes y dos redes académicos; que SQLite no escriba en ellos
> no evita que Compose los cree. `test` usa ahora la imagen backend local por ID,
> sin montajes persistentes ni secretos, con red `none` y `/tmp` en tmpfs.
> `create` mantiene todas sus comprobaciones. La recuperación se limita al
> [procedimiento manual exclusivo](../infra/academic/RECOVERY_TEST_RESOURCES.md):
> primero auditoría completa; nunca borrar desde Codex ni asumir volúmenes vacíos.
> Las inspecciones reales de esta corrección quedaron bloqueadas por permisos del
> socket. No se emitió un plan de eliminación real ni se borraron recursos.
> Validación local: **57/57 pruebas sin DB**, Ruff 0.13.2 y `git diff --check`.
> Esta actualización reemplaza las propuestas pendientes y puertos del diagnóstico
> histórico que sigue debajo. Solo se consultaron versión/configuración de
> Compose; no se ejecutaron construcciones, creación/inicio de contenedores,
> migraciones, cargas ni despliegues desde Codex. Los proyectos actuales y
> Task 11 quedan fuera de alcance.

# T12.11 — Diagnóstico y plan del escenario académico

Fecha: **25-10-2026**, America/Santiago. Revisión docente: **04-11-2026**.
El **05-11** es margen de recuperación y entrega, no fecha de primera validación.
Estado: diagnóstico de fuentes completado; inventario de DB bloqueado por acceso
local. **Preparación de datos y ejecución integral aún no autorizadas.**

La instrucción actual del usuario aprueba la base visual y la navegación Flutter
probadas en Samsung A54. Quedan tres ajustes puntuales; no corresponde otro
rediseño. Esta decisión posterior prevalece sobre «rechazada» / «pendiente» de los
informes históricos. No se atribuye a esta sesión una nueva prueba en el teléfono.

## 1. Estado comprobado y límites de evidencia

| Elemento | Hallazgo / procedencia |
| --- | --- |
| Rama | `task/12-plan-capabilities`; HEAD `c0854de`, merge de T11. Su upstream sigue siendo `origin/main`; no se hizo fetch ni se afirma su estado remoto actual. |
| Cambios | 21 archivos versionados modificados y múltiples archivos nuevos sin seguimiento de backend, React, Flutter y documentación. Task 12 no tiene commits propios en el historial inspeccionado. Todo se conserva. |
| Catálogo | `backend/drivers/capabilities.py`: versión `2026-10-19.3`; diez capacidades implementadas. La autorización usa `enabled`, rol, propietario y dominio. |
| Reportes | Resumen mensual Pro/Elite, detalle/comparación Elite y tres XLSX están implementados en Django y React. Flutter los informa como funciones web. |
| Soporte | Guías por rol, tickets propios, historial, respuestas administrativas y asistente por reglas implementados. Administración exige rol admin + staff + `drivers.manage_support`; staff por sí solo no basta. |
| Esquema | Existe migración `0009_supportticket_supportevent_supportusage_and_more.py`. No se pudo comprobar si está aplicada en Task 12. |
| Validación histórica | Reportes: 153/153 PostgreSQL; soporte: 180/180 PostgreSQL; UX web: 285/285 React; última revisión Flutter: 166/166 con ejecutor alternativo. Son resultados de sus informes, **no suites repetidas ahora**. |
| APK local | `mobile/build/app/outputs/flutter-apk/app-debug.apk`, 108.537.794 bytes, mtime local 25-10-2026; metadata `com.example.furgoplus.task12`. SHA-256: `a47b5c79bd6abfac0736dfe47a23551103d9f312fbe95d382c75c345112ea6b8`. No se reemplazó ni instaló. |
| Configuración | Se inspeccionaron únicamente claves no secretas seleccionadas de `.env`. No se imprimió su contenido completo, contraseñas ni claves. |
| Acceso efectivo | `docker ps` y `docker compose ... ps` rechazados por permisos sobre `/var/run/docker.sock`. Podman no pudo consultar su configuración bajo el sandbox; no se corrigieron permisos. Consultas HTTP de salud a 8000 y al proxy 5173 rechazadas con `PermissionError`, errno 1. |
| Inventario real | **Desconocido**: no se ejecutaron SELECT contra PostgreSQL, no hay evidencia de cuentas existentes ni de cantidades cero. No se infiere el contenido de una DB a partir de fixtures o tests. |

No se encontraron `AGENTS.md` aplicables en el repositorio ni en sus directorios
ascendientes inspeccionados. Se guardó en `/tmp/furgoplus-t1211-preservation.json`
un manifiesto SHA-256 de los 312 archivos versionados/nuevos visibles antes de
añadir los dos entregables de esta fase. No incluye contenido de `.env`.

Verificación de cierre: los **312 archivos anteriores conservan su SHA-256**;
`git diff --check`, sintaxis AST del script, ausencia de espacios finales en los
dos entregables y `bash -n` de los tres bloques propuestos aprobados. El script
sin destino explícito rechazó la ejecución antes de importar Django/conectar.
No se ejecutaron suites de aplicación ni pruebas de integración contra una DB.

Referencias revisadas: [especificación](PLAN_CAPABILITIES_SPEC.md),
[reportes](TASK12_REPORTS_VALIDATION.md), [soporte](TASK12_SUPPORT_VALIDATION.md),
[UX web](TASK12_UX_UI_REVIEW.md), [integración móvil](TASK12_FLUTTER_VALIDATION.md),
[navegación](TASK12_FLUTTER_NAVIGATION_REVIEW.md),
[revisión visual](TASK12_FLUTTER_VISUAL_REVIEW.md) y
[preparador T11](DEMO_SCENARIO.md). Se conservan como historia, sin reescribir sus
resultados ni sus restricciones de aquella sesión.

## 2. Destino local confirmado por el usuario

| Componente actual | Destino exacto |
| --- | --- |
| Checkout | `/home/duran/Proyectos/furgoplus-planes` |
| Proyecto Compose | **`furgoplus-task12`** |
| Compose / variables | `infra/compose.yaml` / `.env` de este checkout |
| Web | `http://localhost:5173` → proxy `/api` → `http://backend:8000` |
| API Fedora | `http://127.0.0.1:8000` → puerto 8000 del backend |
| Samsung | `http://127.0.0.1:18001` → `adb reverse tcp:18001 tcp:8000` → API Fedora |
| Base configurada | PostgreSQL, host interno `db`, puerto 5432, DB `furgoplus`; **contenido no consultado** |

El mapeo ADB explica la diferencia de puertos. El APK contiene la cadena
`http://127.0.0.1:18001`; una cadena binaria no demuestra por sí sola el origen
activo. La identidad de entorno es **coherente por configuración y confirmación
del usuario**, pendiente de comprobación operativa en esta sesión.

Para cerrarla: registrar `adb reverse --list` en Fedora (solo consulta), URL web,
container IDs y el proxy activo; contrastar en ambas superficies la misma cuenta,
plan, `catalog_version` y ticket propio ya existente, sin crear nada. Salud `ok`
en dos puertos por sí sola no identifica una DB. Si no existen tickets, usar IDs
de ruta/plan ya disponibles y la trazabilidad Compose backend → db.

**Fuera de alcance:** `furgoplus-demo`, `furgoplus-demo-restore-task11`, r4,
`infra/demo/compose.yaml`, Debian, Cloudflare y cualquier base/volumen de esos
proyectos. No emplear el nombre implícito `furgoplus` del Compose para operar: usar
siempre `-p furgoplus-task12` en el diagnóstico actual.

## 3. Inventario pendiente y comandos de solo lectura

Estos comandos se proponen para una terminal Fedora con acceso Docker ya
autorizado. **No se han ejecutado exitosamente aquí.** No incluyen inicio,
reinicio, migraciones ni escrituras de dominio. No cambiar permisos del socket
para hacerlos funcionar desde esta sesión.

```bash
cd /home/duran/Proyectos/furgoplus-planes
current12=(docker compose -p furgoplus-task12 --env-file .env -f infra/compose.yaml)
"${current12[@]}" config --quiet
"${current12[@]}" ps --all
docker ps --filter label=com.docker.compose.project=furgoplus-task12 \
  --format '{{.ID}} {{.Names}} {{.Image}} {{.Ports}}'
"${current12[@]}" exec -T backend python manage.py migrate --check
"${current12[@]}" exec -T -e TASK12_AUDIT_EXPECT_DB=furgoplus \
  backend python - < backend/scripts/audit_task12_readonly.py
```

Antes del `exec`, revisar que los contenedores listados pertenecen al proyecto
confirmado. El script adjunto exige `config.settings`, PostgreSQL, host local o
`db`, DB esperada y ausencia del origen público r4. Abre `REPEATABLE READ READ
ONLY`, limita consultas a 20 s y finaliza con rollback. No usa clientes API,
logins, `get_or_create`, seeds ni endpoints de asistente. Su validación actual es
estática y de rechazo sin destino; falta ejecutarlo con Django/PostgreSQL reales.

Entrega IDs, roles, actividad, permiso de soporte, planes, vigencias, perfiles,
rutas/días/cobertura, asignaciones, pagos, contactos, documentos/validación por
metadata, tickets/eventos por estado, contadores de soporte, auditorías por tipo,
migraciones aplicadas y agregados por conductor de octubre/noviembre. Solo nombra
emails `@example.test`; omite nombres, textos libres, emails ajenos a ese dominio,
direcciones, contactos personales, documentos, hashes de claves y credenciales.
Cada sección informa total, primeras 200 filas y si se truncó. Una sección
truncada exige completar el inventario antes de preparar datos; no asumir ausencia
de conflictos. Ante esquema incompatible, falla sin imprimir excepciones/DSN.

El inventario debe responder, con IDs y sin credenciales:

- ¿Existen las cinco cuentas propuestas? ¿Hay colisiones de correo/rol/perfil?
- ¿Qué planes están asignados y cuáles son efectivos hoy y el 04–05/11?
- ¿Qué conductores tienen datos de octubre y noviembre en cada cohorte?
- ¿Hay dos servicios elegibles, con cobertura común, para discovery/comparación?
- ¿Qué rutas y pasajeros ficticios son vigentes el miércoles 04/11 y jueves 05/11?
- ¿Existen pagos por los tres estados, contactos no pendientes y algún par libre
  para la solicitud en vivo? ¿Hay ejecuciones reales registradas?
- ¿Está aplicada 0009? ¿Hay tickets con eventos del admin? ¿Tiene el admin permiso?
- ¿Existe manifiesto T11 y fue operado después? No repetir su preparador para resetearlo.

## 4. Revisión de los preparadores existentes

| Comando / archivo | Evaluación de uso seguro |
| --- | --- |
| `prepare_demo_scenario --dry-run` | Inspección sin escritura, exige demo mode y admin `.test` existente. Puede verificar hashes de archivos privados. No es inventario genérico de Task 12. |
| `prepare_demo_scenario --apply` | Es **T11**, emails fijos sin namespace T12; conserva datos compatibles y usa manifiesto/auditoría, transiciones, transacción y locks. Rechaza conflicto; no es reset. Prepara A/B Básico, control sin plan, familias, tres rutas, tres asignaciones, un pago pendiente y dos contactos; no crea admin, Pro/Elite, tickets ni ejecuciones. **No ejecutar sobre el entorno actual.** |
| `create_demo_account` | Apropiado para cuentas nuevas tras revisar destino: solo driver/parent, `@example.test`, nombre con Demo, TTY y clave privada sin eco; rechaza duplicados. No crea admin ni concede plan/publicación. Exige demo mode. |
| `createsuperuser` | Solo admin ausente en el nuevo destino, interactivo. No repetir sobre un correo existente. Superusuario sirve para la demo; una prueba de negativa de soporte usa otro rol o admin sin permiso en base de tests. |
| `seed_demo_communes` | Usa `update_or_create`: puede renombrar/reactivar registros anteriores. Solo proponible tras comprobar base nueva/códigos ausentes. |
| `seed_demo_reviews` | Puede inutilizar la contraseña/desactivar usuarios con sus emails calculados. No es necesario para T12.11; excluir. |
| `test_task12_postgres.sh` | Es runner efímero de tests con migraciones y eliminación automática del contenedor al salir. No es entorno persistente para Samsung; no se ejecuta en esta fase ni bajo la restricción actual de no borrar recursos. |
| `cleanup_private_uploads` | Borra archivos; excluido. No usar comandos de limpieza, reset o restauración. |

**Falta un preparador integral T12.** Para esta fecha propongo provisionar cuentas
con el CLI existente y completar dominio por pantallas reales, con un manifiesto
privado de IDs/pasos ya realizados. No repetir operaciones por estar incompleto un
guion. Si se automatiza después: comando separado con namespace, `--dry-run`
obligatorio, `--apply` explícito, verificación de DB/proyecto/IDs, rechazo de
colisiones, manifiesto append-only, rollback y transiciones auditadas. No anunciar
ese comando como existente ni reutilizar el manifiesto T11 para estos recursos.

## 5. Propuesta de escenario aislado — pendiente de revisión

Recomendación: conservar `furgoplus-task12` solo para el inventario y preparar
**otro proyecto local nuevo**, sin restaurar/copiar su DB ni compartir volúmenes.
Esto preserva todas las cuentas y operaciones anteriores. Si el inventario permite
preferir el actual, revisar expresamente esa alternativa antes de escribir; el
namespace por sí solo no aísla catálogos, archivos o contadores compartidos.

Destino propuesto: proyecto `furgoplus-task12-academic`, DB
`furgoplus_task12_academic`, API Fedora `127.0.0.1:18012`, web
`127.0.0.1:15182`, volúmenes propios de ese proyecto y `infra/rehearsal.compose.yaml`.
Verificar primero que nombres, puertos y recursos están libres; una colisión
detiene la preparación, no autoriza recrear nada. Un archivo env **nuevo** privado
fuera del repo contendrá secretos generados por el operador; no reutilizar `.env`
actual ni archivos de r4.

Configuración no secreta prevista: `DJANGO_SETTINGS_MODULE=config.settings`,
`DJANGO_DEBUG=true`, hosts `localhost,127.0.0.1,backend`, proxy SSL desactivado,
`FURGOPLUS_DEMO_MODE=true`, DB y puertos anteriores. Añadir en un override nuevo
exclusivo del escenario `web.environment.VITE_FURGOPLUS_DEMO_MODE: "true"`;
el Compose de ensayo no propaga hoy esa flag al frontend. No usar
`config.settings_demo` (fija el origen r4). Demo mode cierra registro público y
habilita el CLI privado; Django sigue siendo la barrera de registro.

| Cuenta propuesta, no existente confirmada | Estado objetivo |
| --- | --- |
| `driver-task12-basic@example.test` | Conductor Demo T12 Básico: perfil activo, revisión/documentos sintéticos vigentes, Básico efectivo, rutas/cupos; sin resumen/Excel/asistente. |
| `driver-task12-pro@example.test` | Conductor Demo T12 Pro: mismo volumen controlado de datos; resumen mensual y FAQ, sin detalle/comparación/XLSX/contexto. |
| `driver-task12-elite@example.test` | Conductor Demo T12 Elite: resumen, comparación, tres XLSX y FAQ/contexto propio. |
| `parent-task12@example.test` | Familia Demo T12: sin suscripción; descubrir/comparar al menos dos conductores y contactar; guías/tickets propios. |
| `admin-task12@example.test` | Admin sintético activo/staff; asignación/cambio con motivo, revisión y soporte autorizado. Administración web. |

El admin asigna planes mediante la pantalla existente, con vigencia sugerida
26-10-2026 00:00 hasta **07-11-2026 00:00 America/Santiago** (fin exclusivo;
registrar el instante que realmente se elija). Documentos y asignaciones vigentes
hasta después del 05/11. No se crea una suscripción al apoderado ni pagos bancarios.

Por conductor: dos rutas de capacidad 4, horarios válidos, cobertura demo común,
días que incluyan ensayos, miércoles 04 y jueves 05; dos pasajeros en principal y
uno en respaldo, con tutor/contacto ficticios. Principal: **2 usados / 2 libres**;
respaldo: **1 / 3**. No hay vínculo automático entre pasajero y cuenta apoderado.
Preparar aprobación/publicación por los flujos existentes; pagar/asignar un plan
no evita validación. Sin escaneos, RUT ni domicilios reales; archivos rotulados
«DOCUMENTO SINTÉTICO — NO VÁLIDO». No contactar números de prueba.

### Datos medibles por mes

Objetivo por conductor, antes de operaciones en vivo; registrar cada ID real.

| Cohorte | Octubre 2026 | Noviembre 2026 | Diferencia esperada Nov − Oct |
| --- | --- | --- | --- |
| Pagos por vencimiento | Pendiente 10.000, pagado manual 20.000, anulado 5.000 CLP | Pendiente 30.000, pagado manual 40.000, anulado 10.000 CLP | 3 registros vs 3: 0; monto no anulado 70.000 − 30.000 = **40.000 CLP** |
| Servicios realmente ejecutados | Dos finalizados en días de octubre, capacidad snapshot 4 cada uno | Uno finalizado el 02/11 o 03/11, capacidad snapshot 4 | 1 − 2 = **−1 servicio**; capacidades 4 − 8 = **−4** |
| Contactos por recepción | Dos: uno aceptado y otro rechazado | Uno cancelado por el apoderado | 1 − 2 = **−1 contacto** |

Pagos se crean pendientes y se transicionan a pagado/anulado por UI. Seleccionar
vencimientos 28/10 y 02/11; los períodos de servicio no determinan la cohorte.
Contactos: crear/resolver secuencialmente para no dejar un pendiente bloqueante por
par. El par apoderado/Básico queda **sin pendiente** al inicio del 04/11; el contacto
en vivo sumará +1 en noviembre y debe anotarse como delta de la demostración.
Los aceptados no reservan cupo ni contratan transporte.

**No falsificar historia.** Crear los contactos de octubre antes del 01/11 y
ejecutar los dos servicios en fechas reales de octubre, tras aprobar este plan.
El endpoint de inicio solo admite la fecha Chile actual: no permite crear un
recorrido histórico. Si el tiempo restante o la aprobación impiden esos pasos,
ajustar cantidades esperadas a hechos reales y registrar la comparación parcial;
no cambiar reloj, `created_at`, `service_date` ni insertar `RouteRun` por ORM/SQL.
La comparación de noviembre es contra octubre; consultar octubre compara septiembre
y puede quedar vacío. Esta transición de mes hace necesario ensayar antes del 01/11.

Soporte: por conductor un ticket con respuesta administrativa y otro resuelto para
probar reapertura; apoderado con uno respondido. Para mostrar orden comercial,
usar misma gravedad entre Básico/Pro/Elite y luego un caso crítico sintético que
preceda a los normales. No saturar ventanas: crear ticket 5/h por usuario,
responder 30/h y asistente 60/h; contacto 10/h por cuenta y 20/h por IP; login
10/15 min por IP. Paginación >10 tickets se comprueba con fixture de tests o
preparación distribuida en varias ventanas, sin deshabilitar límites.

### Comandos futuros de preparación — **NO EJECUTAR EN ESTA FASE**

Primero se revisan el inventario, el destino nuevo y su override/env. No hay aún
archivo override creado. Esta es una propuesta concreta para la fase autorizada
posteriormente, no una receta para la base actual.

```bash
cd /home/duran/Proyectos/furgoplus-planes
export REHEARSAL_ENV_FILE=/home/duran/.config/furgoplus/task12-academic.env
export REHEARSAL_API_PORT=18012
export REHEARSAL_WEB_PORT=15182
t12=(docker compose -p furgoplus-task12-academic --env-file "$REHEARSAL_ENV_FILE" \
  -f infra/rehearsal.compose.yaml -f infra/task12-academic.compose.yaml)
# Solo inspección previa: si hay recursos, detenerse; no recrear ni reutilizar.
docker ps -a --filter label=com.docker.compose.project=furgoplus-task12-academic \
  --format '{{.Names}}'
docker volume ls --filter label=com.docker.compose.project=furgoplus-task12-academic
docker network ls --filter label=com.docker.compose.project=furgoplus-task12-academic
ss -ltn
"${t12[@]}" config --quiet
# A partir de aquí se crean recursos / se escribe SOLO en el destino nuevo:
"${t12[@]}" up -d --build db backend web
# Inspeccionar nombre de DB y tablas antes de migrate. Exigir cero tablas públicas:
"${t12[@]}" exec -T db sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' <<'SQL'
BEGIN READ ONLY;
SELECT current_database();
SELECT count(*) AS public_tables FROM information_schema.tables
WHERE table_schema = 'public';
ROLLBACK;
SQL
# Solo si destino y vacío están comprobados; nunca para actualizar la DB actual:
"${t12[@]}" exec -T backend python manage.py migrate --plan
"${t12[@]}" exec -T backend python manage.py migrate --noinput
"${t12[@]}" exec -T backend python manage.py migrate --check
"${t12[@]}" exec -T backend python manage.py seed_demo_communes
# TTY, claves únicas desde el gestor privado, sin argumentos/env/logs de claves:
"${t12[@]}" exec backend python manage.py createsuperuser --email admin-task12@example.test
"${t12[@]}" exec backend python manage.py create_demo_account --role driver \
  --email driver-task12-basic@example.test --display-name 'Conductor Demo T12 Básico'
"${t12[@]}" exec backend python manage.py create_demo_account --role driver \
  --email driver-task12-pro@example.test --display-name 'Conductor Demo T12 Pro'
"${t12[@]}" exec backend python manage.py create_demo_account --role driver \
  --email driver-task12-elite@example.test --display-name 'Conductor Demo T12 Elite'
"${t12[@]}" exec backend python manage.py create_demo_account --role parent \
  --email parent-task12@example.test --display-name 'Familia Demo T12'
```

Después: UI web para servicio/documentos/revisión/admin/plan/rutas/asignaciones/
pagos, Flutter para descubrimiento/contactos/recorridos, y ambas superficies para
soporte. Registrar pasos una vez; un resultado incierto exige leer historia antes
de reenviar. No hay comandos SQL de inserción/actualización ni restauración.

Para pruebas automatizadas, preparar otro PostgreSQL **nuevo y vacío** exclusivo
de tests, en loopback 55432 con `settings_task12_tests`, sin usar ninguna DB de
demo. El runner Django crea/destruye su propia DB: su ejecución queda fuera de
esta fase y requiere revisar ese procedimiento bajo las restricciones vigentes.
No ejecutar el script con trap de eliminación durante este diagnóstico.

En la preparación posterior, conservar el APK aprobado antes de recompilar y
registrar el nuevo hash. Comandos móviles propuestos para el **nuevo destino**:

```bash
cd /home/duran/Proyectos/furgoplus-planes/mobile
flutter analyze --no-pub
flutter test --no-pub --concurrency=1
flutter build apk --debug --no-pub \
  --dart-define=API_BASE_URL=http://127.0.0.1:18012 \
  --dart-define=ALLOW_HTTP_API=true --dart-define=FURGOPLUS_DEMO_MODE=true
# En Fedora, serial del Samsung anotado por el operador; no usar otro teléfono:
adb -s "$TASK12_DEVICE_SERIAL" reverse tcp:18012 tcp:18012
adb -s "$TASK12_DEVICE_SERIAL" reverse --list
sha256sum build/app/outputs/flutter-apk/app-debug.apk
adb -s "$TASK12_DEVICE_SERIAL" install -r build/app/outputs/flutter-apk/app-debug.apk
```

El APK `.task12` se actualizaría solo en esa fase aprobada. Este reverse nuevo no
sustituye el mapeo actual 18001 → 8000. HTTP local USB sirve al ensayo académico;
no acredita el gate HTTPS. Sin llamadas a r4 ni cambios de certificados/red.

## 6. Tres ajustes UX, alcance y aceptación puntual

No se editaron pantallas en esta fase de diagnóstico. Programarlos junto con la
preparación, manteniendo el diseño y los flujos aprobados:

1. **Mi plan:** `ExpansionTile` de Detalles ya carece de apertura explícita en
   fuente (cerrado por defecto). Confirmar qué conserva PageStorage entre vistas
   y cuál APK se ejecuta; garantizar estado cerrado al entrar inicialmente y
   tras cambiar de cuenta. Mantener nombre/estado/beneficios principales; llevar
   información secundaria repetida bajo demanda. No atribuir el fallo a backend.
2. **Guías:** `_guides()` ya compara `category` y la prueba de apoderado cubre dos
   temas. La fuente de artículos no deduplica IDs y la categoría comienza nula
   (muestra todo); no se ha reproducido el fallo de dispositivo. Revisar entrada,
   retorno desde artículo/asistente y diferencias APK/fuente. Filtrar una lista
   efectiva y deduplicada por ID, sin duplicar listas/títulos. Aceptación: cada tema
   solo presenta sus artículos, cada ID una vez y «todos» restaura el conjunto.
3. **Soporte:** el texto exacto reportado está en `_ticketList()`, no en contactos
   del apoderado (estos ya explican buscar servicio). Proponer, con total cero:
   «Todavía no has enviado solicitudes de soporte. Usa Crear solicitud para
   consultar al equipo». Con total >0 y página vacía: «No hay solicitudes en esta
   página. Vuelve a la página anterior». Conservar paginación, permisos y acción.

Añadir solo regresiones de estos comportamientos; análisis, suite móvil estándar
y prueba A54. No otro rediseño. Las 166 pruebas históricas no prueban estos ajustes
futuros ni reemplazan la aceptación humana ya comunicada.

## 7. Guion de aceptación real Fedora + Samsung A54

Ejecutar tras preparación aprobada, con cuentas ficticias y datos inventariados.
En Fedora: dos perfiles/sesiones de navegador separados para admin y conductor,
libreta local privada de IDs y manifest de cantidades iniciales; sin contraseñas
en capturas. Samsung: APK `.task12`, hash, origen/reverse, versión Android, fuente
y escala registrados. Cada caso registra fecha, actor, IDs, esperado, observado,
APROBADO/RECHAZADO/BLOQUEADO y evidencia local. No marcar pase por ausencia de datos.

| ID / superficie | Acción real | Resultado verificable |
| --- | --- | --- |
| A01 · Fedora/A54 | Login de cada rol y consultar cuenta/plan/datos ya existentes | Identidad correcta; web y teléfono reflejan los mismos IDs/plan/catálogo según mapeo. Admin usa web; no esperar panel admin móvil. |
| A02 · admin web | Conductor sintético sin asignación: asignar Básico con motivo/ventana; consultar historial | Suscripción efectiva y auditoría con actor, motivo y versión; no crea pago ni aprueba documentos. |
| A03 · Básico | Operar ruta/pasajeros; abrir plan, ayuda y ticket | Operación disponible bajo sus reglas; ayuda/soporte propios. No se ofrecen resumen, Excel ni asistente. GET premium directo con sesión → 403 `capability_unavailable`, sin archivo. |
| A04 · Pro web | Consultar noviembre y octubre, luego un mes inventariado vacío | Totales de la tabla del escenario, tres resúmenes reales; vacío con ceros reales y explicación. Detalle/comparación, tres XLSX y contexto denegados 403; FAQ disponible. |
| A05 · Elite web | Noviembre, comparación octubre, tres descargas | Diferencias absolutas de tabla; tres archivos binarios `.xlsx`, sin HTML/JSON renombrado. Descargar y abrir manualmente como se detalla abajo. |
| A06 · admin + conductor | Elite → Pro con motivo/versión; volver a foco y actualizar web/A54 | Retira detalle/Excel/contexto al refrescar (poll visible hasta 30 s); llamada nueva a enlace XLSX antiguo devuelve 403 inmediatamente. Resumen/FAQ siguen. Historial y datos operativos conservados. Reasignar Elite mediante nueva transición auditada. |
| A07 · ensayo de negativas | Suscripción sintética suspendida, futura y vencida, una a la vez mediante admin | Premium denegado por servidor; ayuda/soporte siguen; motivo comprensible. No cambiar reloj del equipo/teléfono. Restaurar vigencia mediante transición, sin borrar historia. |
| A08 · web/API | Anónimo; apoderado hacia reportes; conductor con IDs de ruta/ticket de otro | 403 sin sesión/rol; recurso privado ajeno 404 según endpoint; ningún dato cruzado. Filtro `month=2026-13`, duplicado o propietario extra → 400; método de reporte no admitido → 405 con sesión/CSRF válidos. |
| A09 · A54 guías/plan | Entrar en Mi plan; abrir/cerrar detalles; elegir cada tema, abrir guía y volver; repetir como apoderado | Detalles cerrados inicialmente; información secundaria bajo demanda; filtrado correcto, un artículo por ID y guías del rol; conserva barra y navegación aprobadas. |
| A10 · soporte A54/web | Vacío, Crear, cancelar; confirmar privacidad; editar texto y enviar una vez | Vacío útil; cancelar no crea ticket; edición desmarca confirmación; un envío crea un ticket y evento con estado/autor/fecha. Sin datos reales ni texto trasladado automáticamente desde asistente. |
| A11 · admin → A54 | Responder y pasar a esperando usuario; actualizar móvil, responder; resolver/reabrir/cerrar | Historial completo, autoría y fechas; versión incrementa; resuelta puede reabrirse por respuesta; cerrada es solo lectura. Versión antigua → 409 y exige refresco, sin sobrescribir. |
| A12 · cola admin | Misma gravedad en Básico/Pro/Elite y caso crítico sintético | Gravedad precede a plan, después prioridad comercial efectiva y antigüedad. Admin sin permiso en suite aislada → 403; no quitar permisos al admin de la exposición. |
| A13 · asistente | Pro pregunta «reportes»; Elite «plan» con contexto; pedir «cambia mi plan» | Pro responde FAQ con guía/versionado, sin contexto; Elite solo cinco estados propios. Fuera de alcance no ejecuta cambios. Derivar abre formulario vacío, no crea ticket. Básico/apoderado no tienen asistente. |
| A14 · apoderado A54 | Comuna demo → dos servicios → comparar → solicitar contacto al Básico → aceptar como conductor | Lista elegible, comparación con diferencias reales, un pendiente; aceptación actualiza solicitudes y entrega contacto según contrato. No reserva cupo, asigna pasajero ni implica contratación. Duplicado pendiente rechazado sin segundo registro. |
| A15 · conductor A54 | Hoy: principal 2/4, respaldo 1/4; iniciar principal, cancelar cierre, finalizar; volver entre destinos | Nómina ficticia y fecha Chile correctas; cancelación no finaliza; inicio/finalización únicos, estado persistente al refrescar. Inicio sobre finalizado → conflicto. Respaldo queda sin iniciar para contingencia; nadie cambia estados con SQL. |
| A16 · roles/red | Borrador → Cuenta → volver; pausar/reanudar; cerrar sesión/cambiar rol; cortar USB durante lectura/envío | Conserva borrador solo dentro de sesión; borra al salir/cambiar cuenta. Error de lectura recuperable. Envío incierto exige consultar historia antes de reenviar; no reintenta POST ni duplica. Reponer reverse tras reconexión. |
| A17 · visual/accesibilidad | Fedora 1440×900 y 1280×800, teclado/zoom 200%; A54 fuente normal/grande, teclado y TalkBack | Sin cortes/solapes, foco y lectura lógica, controles alcanzables y estados legibles. Barra persistente y Android Atrás correctos; diseño aprobado conservado. Revisar específicamente los tres ajustes. |

### Inspección manual de los tres XLSX

Abrir en LibreOffice Calc de Fedora; si se dispone de Microsoft Excel, registrar
también aplicación/versión. No afirmar aceptación en Excel de escritorio sin
haberlo usado. Mantener exportaciones/evidencia solo del escenario sintético.

- **Cada libro:** abre sin reparación/advertencia de formato, nombre/período y
  generación Santiago correctos; Resumen + Detalle; filtros, encabezados y paneles
  congelados legibles. Fechas/horas con zona explícita donde corresponde. Mes
  seleccionado/anterior y diferencias concuerdan con la pantalla en el mismo estado.
- **Pagos:** noviembre, tres filas de detalle y tres registros en resumen;
  30.000 pendiente, 40.000 pagado manual, 10.000 anulado; no anulado 70.000 CLP,
  anterior 30.000 y diferencia 40.000. Verificar montos numéricos, no texto/formulas.
- **Recorridos:** noviembre una fila finalizada inicial, capacidad registrada 4;
  octubre dos y capacidad 8. Hoja adicional **Cupos actuales**: principal 2/2 y
  respaldo 1/3 según asignaciones vigentes; separada del mes histórico. Tras la
  operación en vivo, registrar +1 servicio/capacidad +4, no exigir cifras anteriores.
- **Contactos:** noviembre una fila cancelada inicial, octubre aceptada/rechazada;
  sin mensajes, emails ni identidades familiares. La solicitud en vivo agrega una
  fila y cambia su estado: contrastar con el manifiesto actualizado.
- **Privacidad/seguridad de los tres:** no nombres de menores/adultos, direcciones,
  teléfonos, documentos, mensajes ni datos ajenos. Sin fórmulas activas,
  hipervínculos ni macros; comprobar tipos de celda/barra de fórmulas y revisión
  ZIP/XML complementaria de las pruebas. No introducir texto malicioso en una
  base previa para comprobarlo. Guardar hashes y capturas sin credenciales.

### Puertas de aceptación y cronograma

- [x] Rama, archivos e informes inspeccionados; aprobación visual actual registrada.
- [x] Topología actual confirmada por el usuario, incluido reverse 18001 → 8000.
- [ ] Inventario real de solo lectura ejecutado y revisado; migración 0009 y datos
  ficticios identificados, sin secciones truncadas ni colisiones pendientes.
- [ ] Revisar/aprobar destino nuevo, env/override privados, cuentas y cantidades;
  recién entonces autorizar preparación. Nada de `--apply` sobre el actual.
- [ ] **26–28/10:** preparar entorno nuevo/cuentas y datos de octubre por flujos;
  ejecutar primer servicio real y completar tres ajustes UX con regresiones.
- [ ] **29–31/10:** segundo servicio/contactos de octubre; ensayo de permisos,
  soporte y Excel preliminar; resolver bloqueantes. Preservar rutas de respaldo.
- [ ] **02–03/11:** datos de noviembre, ensayo completo Fedora+A54, tres Excel
  inspeccionados y resultados reales; comprobar vigencias hasta después del 05/11.
- [ ] Suites apropiadas en DB exclusiva de tests: Django/PostgreSQL sin skips de
  concurrencia, React serial, contratos/análisis/build y Flutter estándar + APK.
  Un bloqueo de herramientas se registra, no se convierte en pase histórico.
- [ ] **03/11:** cerrar candidato local, registrar hashes/fuentes/configuración no
  secreta y checklist. Copia de seguridad separada y verificada según procedimiento
  revisado; sin restaurar sobre proyectos existentes. No hacer commit por este cierre.
- [ ] **04/11:** preflight de lecturas, reverse correcto, principales sin ejecutar
  ese día, pares de contacto libres y presupuesto de límites disponible; revisión
  docente con 12–15 minutos + margen. Orden: Básico → Pro → Elite/Excel → cambio
  admin → soporte → apoderado → recorrido. Negativas largas se muestran con evidencia
  del ensayo y se repiten en vivo las centrales.
- [ ] **05/11:** margen para correcciones puntuales y repetición de fallos. No
  incorporar rediseños o funciones nuevas como condición tardía de la entrega.

## 8. Riesgos y punto de detención

1. **DB desconocida:** no se conocen cuentas, vigencias ni datos actuales. Es el
   primer gate; ninguna tabla o recurso se considera vacío por defecto.
2. **Cambio de mes:** sin operaciones/contactos de octubre creados a tiempo habrá
   comparación parcial. Es aceptable mostrarla honestamente; no falsificar historia.
3. **Desajuste de candidato:** hay APK más reciente que los informes, pero aún no
   está trazado a todos los cambios fuente. Registrar hash/origen y repetir solo
   aceptación pendiente; no desconocer la aprobación visual del usuario.
4. **Efectos acumulativos:** inicio/finalización, pagos, contactos y soporte mutan
   el escenario. No resetear entre ensayos: usar respaldo, nuevos IDs revisados y
   actualizar manifiesto/esperados. No sobrepasar límites ni limpiar sus contadores.
5. **Aislamiento y secretos:** el Compose de ensayo usa nombres/volúmenes según
   `-p`; verificar labels y archivo env privado nuevo antes de crear. No volcar
   `docker inspect` completo, `compose config` completo, dumps o credenciales en logs.
6. **Semántica:** pagos manuales no son cobros de plan, contactos no son contratos,
   cupos proyectados no son asistencia, asistente determinista no ejecuta acciones,
   prioridad no es atención humana inmediata. Los esperados reflejan esos límites.
7. **Herramientas pendientes:** historial de advisories npm y gate HTTPS siguen en
   informes previos; esta fase no reaudita paquetes ni resuelve esos asuntos. La
   ruta USB local no acredita funcionamiento de un despliegue público.

**Detención actual:** solo se añadieron este plan y la herramienta de consulta.
No se modificaron fuentes de aplicación previas, bases, credenciales, APK,
contenedores ni volúmenes; no hubo migraciones, seeds, instalación, commit, push,
merge o deploy. Antes de cualquier escritura en DB o creación/actualización de
servicios, revisar el inventario pendiente y aprobar este plan de preparación.
