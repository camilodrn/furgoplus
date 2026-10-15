# Task 11 — escenario automatizado e Inicio

Estado actual comunicado por el operador: **r4** está desplegada y probada en
Debian mediante `https://demo.furgoplus.cl`; React, Django/PostgreSQL y APK funcionan
con datos sintéticos. El escenario automático está preparado y respaldado.
La implementación se realizó en Fedora; el agente no desplegó ni inspeccionó la DB
Debian, Tunnel, WAF o recursos Docker. Los dos cambios se revisan por separado y
permanecen sin commit. Ver [revisión final](TASK11_FINAL_REVIEW.md): la confirmación
operativa no equivale a un log del gate PostgreSQL ni a toda la matriz HTTPS.

## A. Preparación privada del escenario

```bash
python manage.py prepare_demo_scenario --dry-run
python manage.py prepare_demo_scenario --apply
```

El comando requiere modo demo y **administrador existente**, activo/staff y con
correo `.test`; no crea ni altera admin. `--admin-email` permite seleccionar un
administrador ficticio distinto del predeterminado admin-demo@example.test. Los
modos son excluyentes y obligatorios; solo `--apply` escribe. Dry-run lista cuentas,
campos vacíos a completar, cantidades/transiciones y vigencias relativas al día
chileno, sin contraseñas, escrituras ni PNG persistentes.

| Escenario pequeño | Preparación |
| --- | --- |
| Conductor Demo A | Conserva cuenta, clave, nombre y campos del servicio con valor; completa únicamente vacíos. Tres documentos sintéticos, revisión y aprobación por la vía administrativa; Basic vigente; rutas Ida Demo y Respaldo Demo, ambas con cobertura norte/sur. Publicación solicitada mediante API y elegibilidad confirmada por el dominio. |
| Conductor Demo B | Cuenta privada si falta, mismo recorrido de aprobación/plan; una ruta independiente publicable para búsqueda/comparación, sin reseñas inventadas. |
| Conductor Demo Control | Tres documentos y presentación; queda pendiente, sin plan ni solicitud de publicación. No aparece en discovery. |
| Familias Demo A/B | Cuentas privadas si faltan. A tiene contacto aceptado con B; B tiene contacto pendiente con A. El par Familia A/Conductor A queda libre para el contacto en vivo. |
| Operaciones A | Dos pasajeros ficticios en Ida (2/4 cupos) y uno en Respaldo (1/4); un pago manual CLP 50.000 pendiente. No hay reserva de cupo por contacto: las asignaciones son un paso independiente del conductor. |
| Documentos | Nueve PNG blancos con aviso visible **DOCUMENTO SINTÉTICO — NO VÁLIDO**, nombre Demo y categoría. Sin escaneos ni datos reales; aviso exacto también en metadata PNG. Se generan en memoria y pasan por el mismo upload/inspección/versionado del producto. |

Comunas faltantes son solo demo-norte/sur; las existentes se conservan si son
compatibles, no se renombran/activan. Basic debe existir por migración; el comando
no inventa planes de catálogo. Datos fijos: correos @example.test, pasajeros/tutor
Demo, dirección “Calle Ficticia 123, Comuna Demo”, teléfono de formato demo
900000001 (no se presume número inexistente, no contactar). No RUT, DOB, domicilios
personales, transacciones de pago reales ni integración de comunicaciones.

Solo las cuentas nuevas solicitan claves únicas dos veces con getpass y terminal
privado. Se validan con Django y se rechaza reutilización entre las nuevas y las
cuentas demo existentes, incluido el admin seleccionado. No hay claves en argv,
env, Git, fixtures operativos o logs. Las existentes no se resetean ni se pide su
clave; el acceso a la consola es la autorización administrativa privada.

Las escrituras de servicio/documentos/presentación/aprobación/plan/ruta/cobertura/
pasajeros/pagos/publicación/contactos reutilizan **APIView, serializers, permisos,
servicios y auditorías existentes**. El adaptador interno force_authenticate
identifica al actor en la consola, sin sesiones ni autenticación HTTP: no es una
vía de registro pública. Aprobación/plan quedan auditados por el admin seleccionado.
`--apply` autoriza explícitamente esa preparación sintética; no certifica documentos
de transporte ni aptitud legal. No se asignan flags de aprobación/publicación/plan
o estados de pago directamente. Si una API rechaza, se aborta sin forzar su regla.

No se automatizan inicio/fin de recorridos, pago como pagado, aceptación del contacto
principal A/A ni cambios de control durante la exposición: deben demostrarse con
los actores/pantallas reales. Hoy usa rutas de todos los días, incluida la fecha
de ejecución, sin falsificar reloj ni escribir RouteRun. No existe relación de
pasajeros con una cuenta de apoderado en este dominio: no se inventan servicios
diarios privados para familias ni endpoints nuevos. No hay transición requerida
sin una vía segura en el conjunto inicial, pero los rechazos del dominio bloquean
el paso; no se sustituyen por escrituras de flags.

### Conservación, idempotencia y fallos

- Antes de escribir, se rechazan cuentas/perfiles incompatibles, correos de servicio
  fuera de `.test`, comunas no compatibles y documentos/revisiones/planes/rutas/
  contactos previos sin manifiesto. **No se adoptan ni sobrescriben automáticamente.**
  Es posible que un dry-run posterior detecte un conflicto no observable desde Fedora.
- El manifiesto v1 es un registro append-only en AdminActionLog, con fecha y hashes
  de recursos/IDs, sin contraseñas ni sus hashes. Una segunda ejecución idéntica
  verifica DB y SHA de archivos y no escribe nada ni genera nuevas revisiones/logs.
- La transacción PostgreSQL usa advisory lock para serializar preparadores y locks
  de participantes antes de revalidar el plan. NO KEY UPDATE en usuarios permite
  checks FK de auditoría; perfiles conductor antes de apoderado siguen el orden del
  dominio; OF self evita ampliar locks a joins de usuarios. Ver
  [semántica de locks de Django](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update).
  **Este comportamiento PostgreSQL aún necesita el gate real de abajo.**
- Fallo de dominio: rollback de cuentas nuevas/filas/auditorías; se limpian solo los
  PNG creados por ese intento tras comprobar que no están referenciados en DB.
  Archivos existentes/canary se preservan. Si el resultado DB es incierto, conservar
  archivos y revisar manualmente; no reintentar a ciegas ni borrar el volumen.
- Si posteriormente se opera o modifica la demo, el manifiesto puede señalar conflicto:
  se conserva historia, no se resetea. No hay renovación/reset automático. Pasajeros
  vigentes hasta día inicial+60 (inclusive), plan hasta +90 a mediodía Chile (exclusivo)
  y documentos hasta +120. Repetir no desplaza fechas; después de +60 se detiene y
  requiere renovación por transiciones revisadas o una preparación aislada distinta.

### Gate Fedora aislado con PostgreSQL y pins — evidencia específica no adjunta

El sandbox no dispone de PostgreSQL, no puede conectar al daemon Docker ni abrir
sockets TCP/Unix y no resuelve PyPI. No modificar grupos/permisos/daemon para evitar
este bloqueo. Se proporciona un Compose **nuevo e independiente**, sin puertos,
secretos ni volúmenes existentes. DB usa tmpfs y trust solo en su red interna
exclusiva; no reutilizar esa autenticación/configuración en el homelab. Fuentes RO
y label=disable solo en el contenedor de tests evitan relabel :Z de archivos usados
por proyectos Fedora. El test runner usa placeholders y PNG temporales, nunca cuentas
operativas. Comprueba cada pin de requirements antes de ejecutar tests.

En un HOST Fedora con Docker autorizado, seleccionar una imagen backend con los
pins exactos (la imagen r4 solo si los verifica), sin reconstruir ni sobrescribir su tag:

```bash
export SCENARIO_TEST_PROJECT=furgoplus-scenario-validation-r4-unico
export SCENARIO_TEST_BACKEND_IMAGE=furgoplus-demo-backend:TAG_VERIFICADO
check=(docker compose -p "$SCENARIO_TEST_PROJECT" -f infra/demo/scenario-test.compose.yaml)
"${check[@]}" config --quiet
docker ps -a --filter "label=com.docker.compose.project=$SCENARIO_TEST_PROJECT" --format '{{.Names}}'
docker network ls --filter "label=com.docker.compose.project=$SCENARIO_TEST_PROJECT" --format '{{.Name}}'
# Si cualquiera lista recursos, DETENER y escoger otro nombre, no recrearlos.
"${check[@]}" up --no-build --pull never --abort-on-container-exit --exit-code-from tests
```

Este comando es **manual futuro, no ejecutado aquí**: crea exclusivamente ese nuevo
proyecto. Exigir exit 0, todos los pins exactos y los dos tests multiproceso de
contacto ejecutados sin skips, junto con los tests de escenario/permisos/registro.
Conservar logs y recursos de validación; no añadir down -v o limpieza automática.
No apuntar estos tests a DB Fedora existente ni Debian.

### Referencia para una instancia futura — no repetir sobre r4

El operador ya ejecutó y respaldó el escenario r4. El agente no ejecutó el gate
anterior y no recibió su log; conservar esa distinción y registrar su evidencia
antes de aceptar un nuevo candidato. No aplicar de nuevo para restablecer datos: el
comando se detiene ante cambios posteriores y no renueva ni borra el escenario.
Para una futura instancia/candidato, una vez aprobado por humanos, incorporar el
código con una imagen nueva,
según HOMELAB_DEMO, manteniendo registro cerrado y la ruta Tunnel/WAF actuales.
Revisar snapshot recuperable y detener escrituras de participantes durante la
ventana mediante el procedimiento operativo ya autorizado; no cambiar flags de
negocio para simular esa pausa. No hay migración nueva. No restaurar Fedora sobre
Debian ni repetir createsuperuser/create_demo_account para admin/A existentes.

```bash
demo=(docker compose -p furgoplus-demo --env-file /ruta/externa/demo.env -f infra/demo/compose.yaml)
"${demo[@]}" exec -T backend python manage.py migrate --check
"${demo[@]}" exec -T backend python manage.py prepare_demo_scenario --dry-run
# Revisar el plan y resolver cualquier conflicto antes. Sin -T para getpass:
"${demo[@]}" exec backend python manage.py prepare_demo_scenario --apply
"${demo[@]}" exec -T backend python manage.py prepare_demo_scenario --dry-run
```

El operador proporciona las claves nuevas en su terminal privado y guarda accesos
solo en su gestor. Debe revisar PNG descargados, auditorías de aprobación/plan,
búsqueda/comparación como Familia A, Control oculto y las métricas/operación como A.
La segunda inspección debe decir Sin cambios. Registrar candidato/fecha/snapshot;
mantener salud, HTTPS, CSRF, roles y las negativas de archivos privados. Ante un
rechazo o resultado ambiguo, conservar fuente/archivos y revisar sin reset/borrados.

## B. Inicio del conductor

Se conserva logo, paleta, componentes e API. Orden: saludo y estado real/acción
principal/progreso → cuatro métricas reales → checklist compacto → cupos por ruta
bajo demanda. Publicado, pendiente, suspendido y no publicado se derivan de
eligible/profile_status/validation_state/blockers; nunca se habilita publicación
por progreso local. El siguiente paso prioriza blockers del backend (datos,
documentos, validación, plan, ruta o solicitud). Publicado conduce a la pantalla de
publicación existente; no crea un catálogo público ni cambia roles.

La acción principal aparece una vez. Cada otra etapa pendiente tiene una acción
útil; las razones de la misma etapa se agrupan sin repetir botones de validación.
Los detalles usan details/summary nativos, accesibles con teclado y estado anunciado
por el navegador, sin scroll interno. Métricas muestran cero/estado vacío únicamente
cuando se reciben datos reales; solicitudes conserva su endpoint y carga/error
independientes. Cupos extensos empiezan cerrados. Placeholders de carga y tamaños
mínimos evitan colapsar el área inicial sin imponer alturas que corten contenido.

Escritorio: sidebar sticky persistente con altura natural/mínima, sin overflow-y
interno. El documento tiene el desplazamiento principal. Móvil: menú/Escape/foco
existentes sin cambios; métricas en dos columnas y textos adaptables, controles
táctiles de al menos 48px. No se cambia navegación ni desmontaje de formularios
de otras pantallas; las pruebas existentes preservan borradores y privacidad.

### Evidencia separada y archivos

| Validación real local | Resultado / límite |
| --- | --- |
| Escenario | **11/11** tests: objetivo inicial admin-only y admin/A existentes, dry-run sin writes/archivos/prompts, conservación de campos/claves, idempotencia, conflictos, archivos alterados, roles/modo/correos, claves reutilizadas/TTY, rollback/canary, fechas Chile y verificación de claves sin actualizar hashes. ORM/API/files reales; terminal simulado, SQLite en memoria y hasher rápido solo de tests. |
| Backend relacionado | **51 aprobadas de 53**, dos carreras PostgreSQL omitidas; registro demo, CLI privado, auth, controles, contactos y contratos. Entorno complementario Django 5.2.12/Python 3.14.8, **no** los pins exigidos para el gate. |
| Pins/PG | Gate estricto local falla con Django 5.2.12 vs 5.2.18. Compose aislado parsea; **no arrancado ni validado en PostgreSQL**. No se alteran pins para convertirlo en pase. |
| Inicio y operaciones | **24/24** dirigidas; **244/244** suite React completa, 15 archivos. Incluye nuevos estados/progreso/disclosures/métricas/vacíos y pruebas existentes de navegación, roles y borradores. DOM/transport de prueba. |
| Frontend estático | Typecheck, lint, contrato y build demo pasan. Sin endpoint/contrato cambiado ni librería nueva. |
| Visual | PNG sintético generado y examinado: aviso exacto legible sin depender de fuentes OS. Firefox headless intentado para escritorio; no produjo captura por restricción de perfil/sandbox y fallo del proceso. **Inspección visual/teclado real en ambos tamaños queda pendiente**, no inferida de jsdom. |

Archivos A: nuevos `backend/drivers/demo_scenario.py`,
`backend/drivers/management/commands/prepare_demo_scenario.py`,
`backend/drivers/test_demo_scenario.py`, `infra/demo/scenario-test.compose.yaml`,
`infra/demo/scenario_postgres_test_settings.py`, `infra/demo/check_scenario_dependencies.py`.
Archivos B: `web/src/DriverOperations.tsx`, `web/src/DriverOperations.test.tsx`,
`web/src/style.css`, nuevos `web/src/DriverHomeStatus.tsx` y su test.
Documentación: este archivo y enlaces/contexto actualizados en DEMO_RUNBOOK,
DEMO_MODE, HOMELAB_DEMO. Todos sin commit/staging nuevo; cambios anteriores intactos.
