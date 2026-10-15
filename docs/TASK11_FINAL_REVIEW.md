# Task 11 — revisión final del working tree y propuesta de PR

Auditoría local: 14-10-2026, rama `task/11-homelab-deployment`, base `816dda0`.
Sin staging, commits, push, merge, cambios de rama ni operaciones sobre Debian,
Cloudflare, contenedores, volúmenes o bases existentes. Todo permanece sin commit.

## Estado r4 y alcance de la evidencia

El operador confirma r4 desplegada y probada en Debian mediante
`https://demo.furgoplus.cl`: React, Django/Gunicorn, PostgreSQL y APK Android
funcionan con datos sintéticos. El escenario automático está preparado y respaldado.
Previamente confirmó reinicio físico Debian, backup/restore real Fedora,
18/18 tests de recuperación y 16/16 tests de infraestructura Django 5.2.18,
con Gunicorn 26.2.0. Estos resultados **son del operador**, no ejecuciones repetidas
por el agente. No se inspeccionaron el servidor, secretos ni datos operativos.

No se proporcionaron IDs/digests r4, checksum APK/snapshot, logs del gate aislado
con pins exactos ni resultados por paso de toda AUTH_ACCEPTANCE. No inventar esos
identificadores ni interpretar “funciona” como aprobación de cada negativa de
seguridad. Mantener referencias privadas a artefactos y evidencia redactada.
No hay nuevo SHA/tag ni CI remoto de este working tree; no es aprobación de producción.

## Inventario, atribución e higiene

Se revisaron 23 archivos rastreados modificados y 48 no rastreados inicialmente;
este informe agrega uno: **72 candidatos**, todos texto, sin symlinks ni binarios.
El manifiesto de commits abajo asigna cada archivo exactamente una vez. El índice
permanece vacío. No se descartó trabajo ni se accedió al otro worktree.

- **Task 09/10:** reconciliación de arquitectura/alcance/roadmap, documentación
  mobile, BACKUP_RESTORE, RELEASE_REHEARSAL y herramientas `infra/rehearsal*`.
- **Task 11:** runtime homelab, recuperación reforzada, proxy/throttling, registro
  ilustrativo React/Flutter/Django, provisión privada, escenario e Inicio.
- **Compartidos:** README, MVP_DEMO_FREEZE y DEMO_RUNBOOK integran la base documental
  Task 09/10 y los cambios Task 11. ARCHITECTURE, ROADMAP, mobile/README,
  BACKUP_RESTORE y RELEASE_REHEARSAL conservan su procedencia y añaden referencias
  de cierre r4. El plan conserva
  archivos completos; no exige descartar ni reconstruir hunks históricos.

Escaneo de los candidatos, incluidas líneas nuevas no rastreadas: no se detectaron
claves privadas, tokens reconocibles, URLs con credenciales ni secretos operativos.
No hay `.env` privado, DB, dump, respaldo, APK o archivo generado candidato.
Los identificadores `@example.test` son ejemplos sintéticos sin contraseña. Las
constantes de contraseña de tests son fixtures públicas de pruebas, **no claves
operativas**: no reutilizarlas para cuentas de demo. Los falsos positivos del
escaneo se limitaron a esas fixtures y textos de validación de formularios.
Un escaneo por patrones no garantiza ausencia absoluta de secretos.

Se reforzaron `.gitignore`/`.dockerignore`: variantes `.env*`, archivos DB/dump/
archivo de respaldo, APK/AAB/firma, carpetas secrets/backups y configuración
privada cloudflared. Ejemplos env/connector siguen candidatos en Git; env y
connector no son insumos de los Dockerfiles. Se probaron exclusiones Git con
rutas ficticias sin crear ni abrir archivos privados. Las exclusiones Docker se
revisaron estáticamente; no se construyó ni envió contexto al daemon. `.gitignore`
no protege archivos ya rastreados ni un `git add -f`: revisar el diff staged antes
de autorizar un commit. No usar `git add .` ni incluir artefactos ignorados.

## Hallazgos y correcciones de esta auditoría

1. Documentación contradictoria: r3, Tunnel inactivo y escenario/Inicio aún no
   desplegados. Corregida a r4 con atribución explícita al operador; se mantienen
   resultados históricos Task 08.5/09/10 y pruebas locales con sus limitaciones.
2. README/roadmap afirmaban que no existía preparación completa. Ahora distinguen
   `prepare_demo_scenario` de un reset: nunca borra ni renueva datos previos.
3. Exclusiones incompletas para variantes env y artefactos fuera de carpetas
   convencionales. Corregidas sin modificar archivos privados ni eliminar nada.
4. Procedimientos iniciales podían confundirse con pasos pendientes sobre r4.
   Se rotulan como referencia para instancia nueva/cuentas ausentes. No repetir
   createsuperuser, preflight DB vacía, migraciones ni preparación para resetear r4.

No se modificaron versiones, lockfiles, contratos, migraciones ni comportamiento
funcional durante esta auditoría. No se detecta un bloqueo de código/higiene para
**revisar y autorizar los commits propuestos**, una vez revisado su contenido.
Los cambios no fueron staged y requieren autorización humana antes de commit/push.

## Coherencia comprobada

- Compose demo independiente: solo Caddy en ingress y puerto IPv4 loopback;
  proxy/database internas, sin ports de backend/PG ni montajes privados en Caddy.
- Django confía únicamente en el peer Caddy exacto; IP única/canónica y fallo
  cerrado. Caddy sustituye IP/esquema y elimina cadenas de forwarding. La conexión
  local de cloudflared y procesos privilegiados sigue siendo frontera de confianza.
- Registro cerrado antes de crear usuarios/perfiles; CSRF/login/logout y permisos
  permanecen. React/Flutter impiden transporte y limpian el formulario ilustrativo;
  el entorno normal conserva registro. Discovery/comparación/contactos requieren
  cuenta de apoderado; visitantes anónimos ven identidad, login/registro ilustrativo,
  drafts legales, assets, salud genérica y bootstrap CSRF, sin datos privados.
- Contact-create usa dos budgets DB independientes (10/cuenta/h y 20/IP/h),
  adecuados para workers compartiendo PostgreSQL; las carreras requieren su test
  PostgreSQL real, no SQLite. Login solo limita por IP; riesgo de guessing distribuido.
- Backup DB+privados detiene escritores, helper sin red/RO sobre volumen existente;
  restore exige proyecto nuevo, puerto/subred distintos y sin sobrescritura. SHA256
  y archivos se verifican; fallos parciales conservan recursos para revisión manual.
- Escenario privado exige `--apply`, passwords por TTY, cuentas sintéticas y admin
  existente; transiciones por servicios/API del dominio, auditoría, idempotencia
  conservadora y conflictos sin reset. Inicio usa estado/métricas reales, detalles
  nativos accesibles y navegación existente; no cambia API ni permisos.
- Permanecen documentados los avisos HSTS deliberados **security.W005/W021**:
  sin includeSubDomains ni preload; no ocultar otros avisos con un pase global.

## Validaciones y límites

| Evidencia | Resultado y alcance |
| --- | --- |
| Auditoría actual de candidatos | Inventario, extensiones/tipo, patrones de secretos, whitespace y marcadores de conflicto; incluidos no rastreados. |
| Estáticas actuales | Ruff check backend/infra y formato (74 archivos); formato React completo, contract:check, lint y typecheck; AST/modelo Compose; bash -n de wrappers. Aprobadas. Shellcheck no instalado. |
| Topología/recuperación actuales | 9/9 topología, 18/18 recuperación **simulada**; 16/16 proxy/settings/CSRF sin DB. No backup/restore real ejecutado por el agente. |
| Gunicorn actual local | `--check-config` aprobado con **23.0.0** del venv; no importar Django/secretos/DB. Pin **26.2.0** validado previamente por el operador; no confundir resultados. |
| React reutilizado | 244/244 (15 archivos); build demo, typecheck/lint/contrato aprobados en la implementación final de Inicio. No se repite build/test sin cambio de código. |
| Django reutilizado | Escenario 11/11; suite relacionada 51 aprobadas/53, dos carreras PostgreSQL omitidas; modo demo ampliado 100/102, mismas dos omitidas. SQLite temporal, ORM/APIs/archivos reales, terminal simulado; Django local 5.2.12. No es pase del pin 5.2.18/PostgreSQL. |
| Contrato/schema reutilizado | OpenAPI --check y makemigrations --check --dry-run sin cambios. No migraciones sobre DB existente. |
| Flutter reutilizado | Analyze/formato aprobados; 20/20 con harness directo y transporte/storage de prueba. Runner normal bloqueado por sockets (0 tests); no APK construido por el agente. APK r4 funciona según el operador. |
| HOST/HTTPS | Funcionamiento r4 y recuperación/reinicio comunicados por operador. No nuevo ensayo de red/dispositivo/HTTPS por el agente. |

Un intento de descubrimiento genérico `unittest discover ... test_*.py` importó
`test_without_db.py`, que es un runner CLI con salida SystemExit, y terminó con
error de importación aunque sus 16 tests pasaron. No es un fallo de producto.
Se repitieron correctamente las suites con `test_config.py` y `test_recovery.py`;
usar `python infra/demo/test_without_db.py` separadamente, como documenta el runbook.

## Evidencia pendiente antes de aceptación final del PR/candidato

- CI remoto del SHA autorizado: PostgreSQL con pins, tests multiproceso sin skips,
  suite completa Django y runner normal Flutter/build. Adjuntar el resultado
  aislado de scenario-test o ejecutarlo en un proyecto de validación nuevo cuando
  corresponda; nunca contra la DB desplegada ni volúmenes existentes.
- Identidad de imágenes/APK/snapshot r4 y correspondencia con el código revisado,
  mediante referencias privadas sin credenciales ni respaldos en Git.
- Casos HTTPS sin evidencia detallada: sesión/cookies/CSRF negativo, expiración,
  cambio de contraseña/desactivación, force-stop/secure storage, denegaciones por
  rol/objeto, no caché privada, buckets por IP real y spoofing por la cadena completa.
  No declarar toda la matriz aprobada por el mero funcionamiento de login.
- Inspección visual/teclado de Inicio en escritorio/móvil y negativa de acceso LAN,
  si no tienen evidencia registrada. DOM/jsdom no prueba presentación en dispositivo.
- Sigue el riesgo de host/proceso local confiable, credenciales filtradas, NAT,
  carga pública/HDD y dependencias. Esta auditoría no ejecuta un SCA nuevo ni
  convierte la demo sintética supervisada en un servicio de producción.

## Plan exacto de commits propuesto (NO ejecutado)

Incorporar en este orden, tras autorización. Cada lista contiene archivos completos;
no hacer staging de carpetas abiertas ni de ignorados. Los cambios compartidos de
README/MVP_DEMO_FREEZE/DEMO_RUNBOOK van al último commit, preservando la integración
Task 09/10 junto al estado r4. Al completar todos, revisar diff staged, ejecutar
checks afectados y conservar todos los archivos del manifiesto.

### 1. `chore(rehearsal): incorporate Task 09/10 freeze and recovery tooling`

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/ROADMAP.md`
- `mobile/README.md`
- `docs/BACKUP_RESTORE.md`
- `docs/RELEASE_REHEARSAL.md`
- `infra/rehearsal.compose.yaml`
- `infra/rehearsal_checkpoint.py`

### 2. `feat(demo): disable public signup and provision fictional accounts privately`

- `backend/api/auth.py`
- `backend/config/settings.py`
- `backend/accounts/management/__init__.py`
- `backend/accounts/management/commands/__init__.py`
- `backend/accounts/management/commands/create_demo_account.py`
- `backend/accounts/test_demo_account.py`
- `backend/api/test_demo_registration.py`
- `mobile/lib/api_config.dart`
- `mobile/lib/auth_app.dart`
- `mobile/lib/auth_controller.dart`
- `mobile/lib/session_api.dart`
- `mobile/test/session_test.dart`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/demo.ts`
- `web/src/DemoRegistration.test.tsx`

### 3. `build(demo): add isolated homelab runtime and trusted proxy configuration`

- `.dockerignore`
- `.gitignore`
- `backend/requirements-demo.txt`
- `backend/config/demo_proxy.py`
- `backend/config/settings_demo.py`
- `backend/config/test_demo_proxy.py`
- `infra/demo/.env.example`
- `infra/demo/Caddyfile`
- `infra/demo/backend.Dockerfile`
- `infra/demo/web.Dockerfile`
- `infra/demo/compose.yaml`
- `infra/demo/cloudflared.example.yaml`
- `infra/demo/gunicorn.conf.py`
- `infra/demo/healthcheck.py`
- `infra/demo/check_config.py`
- `infra/demo/check_gunicorn.py`
- `infra/demo/test_config.py`
- `infra/demo/test_without_db.py`
- `infra/demo/security_test_settings.py`

### 4. `fix(backup): preserve consistent snapshots and restore only to fresh projects`

- `infra/demo/backup.sh`
- `infra/demo/restore.sh`
- `infra/demo/recovery.py`
- `infra/demo/test_recovery.py`

### 5. `fix(security): throttle contact creation by account and client IP`

- `backend/drivers/contact_api.py`
- `backend/drivers/contact_throttle.py`
- `backend/drivers/test_contact.py`
- `backend/drivers/test_contact_throttle.py`

### 6. `feat(demo): prepare an idempotent synthetic scenario through domain transitions`

- `backend/drivers/demo_scenario.py`
- `backend/drivers/management/commands/prepare_demo_scenario.py`
- `backend/drivers/test_demo_scenario.py`
- `infra/demo/scenario-test.compose.yaml`
- `infra/demo/scenario_postgres_test_settings.py`
- `infra/demo/check_scenario_dependencies.py`

### 7. `refactor(web): prioritize driver home status and compact accessible requirements`

- `web/src/DriverHomeStatus.tsx`
- `web/src/DriverHomeStatus.test.tsx`
- `web/src/DriverOperations.tsx`
- `web/src/DriverOperations.test.tsx`
- `web/src/style.css`

### 8. `docs(demo): reconcile r4 evidence and document deployment limitations`

- `README.md`
- `docs/AUTH_ACCEPTANCE.md`
- `docs/DEMO_MODE.md`
- `docs/DEMO_RUNBOOK.md`
- `docs/DEMO_SCENARIO.md`
- `docs/DEMO_SECURITY_REVIEW.md`
- `docs/HOMELAB_DEMO.md`
- `docs/MVP_DEMO_FREEZE.md`
- `docs/decisions/0007-homelab-demo-deployment.md`
- `docs/TASK11_FINAL_REVIEW.md`

## Resumen listo para Pull Request (borrador, no publicado)

**Título:** `Task 11: controlled synthetic homelab demo, recovery and driver home`

FurgoPlus necesita una demo académica reproducible en homelab sin registro público
ni exposición de documentos/datos privados. Este PR integra los procedimientos
Task 09/10 y añade Compose independiente PostgreSQL/Gunicorn/Caddy con frontend
compilado, loopback y frontera de proxy explícita; snapshots DB+privados y restore
solo a proyectos nuevos; límites de contacto por cuenta/IP compartidos entre
workers; modo de registro ilustrativo en Django/React/Flutter y provisión privada;
escenario sintético idempotente auditado y un Inicio compacto con resumen/acción,
métricas y detalles accesibles. Conserva el comportamiento normal y datos previos.

Validación: estáticas actuales aprobadas; topología 9/9, recuperación simulada 18/18,
proxy/CSRF 16/16. Evidencia previa: React 244/244 y build demo; Django escenario
11/11 y suites SQLite con dos carreras PostgreSQL omitidas; Flutter analyze y
harness suplementario 20/20. El operador confirma r4 Debian/HTTPS/APK funcional y
escenario preparado/respaldado, además de recuperación Fedora y reboot Debian.
El agente no desplegó ni operó DB/Docker existentes.

Pendiente: CI del nuevo SHA, log de carreras PostgreSQL/pins, identidad de artefactos,
matriz HTTPS/Android negativa y revisión visual/teclado si no está registrada.
HSTS W005/W021 deliberados; riesgo de confianza local y guessing distribuido.
Solo datos sintéticos y accesos controlados; no declaración de producción lista.
