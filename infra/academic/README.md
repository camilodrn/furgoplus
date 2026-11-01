# T12.11 — entorno académico aislado en Fedora

Implementación preparada para revisión; **no se ha creado ni cargado una base desde
Codex**. El inventario de datos de `furgoplus-task12` ya fue confirmado por el
usuario: 1 administrador, 1 conductor, sin apoderados ni datos de negocio.
El diagnóstico Docker posterior desde Fedora confirmó que ese proyecto está
**detenido y debe conservarse**; PostgreSQL académico todavía no se ha inicializado.
No repetir el inventario ni ejecutar estos comandos sobre ese proyecto.

**Estado posterior confirmado por el usuario:** `config` y `build` aprobados;
13/13 pruebas Django aprobadas con SQLite temporal. El antiguo ejecutor de tests
creó los dos volúmenes y dos redes académicos aunque no quedaron contenedores.
Su recuperación **todavía no está verificada**: el daemon no es accesible desde
Codex. Antes de `create`, seguir la
[auditoría y recuperación manual exclusiva](RECOVERY_TEST_RESOURCES.md).
El nuevo `test` ejecuta directamente la imagen ya construida, sin esos recursos.

**Corrección mínima autorizada (26-10-2026):** la demo r4
`furgoplus-demo-caddy-1` ocupa `127.0.0.1:18080` y el ensayo
`furgoplus-demo-restore-task11-caddy-1` ocupa `127.0.0.1:18081`.
La API académica pasa de `127.0.0.1:18080` a **`127.0.0.1:18082`**;
Django sigue en 8000 y React en `127.0.0.1:15173`. PostgreSQL, nombres de proyecto,
redes, volúmenes y secretos conservan su configuración. La corrección del puerto
no ejecutó la provisión desde Codex.

**Actualización del bloqueo de secretos:** el usuario confirmó después la provisión
de secretos nuevos y su etiquetado SELinux en Fedora. Se corrigieron después los
guards de destinos de secretos y arranque normalizado; **`config` pasa** con
Docker Compose 5.5.1. Conservar esos archivos y validar con `config`, sin volver
a ejecutar `provision.py`. No se creó ni inició ningún contenedor en esta revisión.

## Identidad y alcance

| Recurso | Destino exclusivo |
| --- | --- |
| Proyecto Compose | `furgoplus-task12-academic` |
| Archivo independiente | `infra/academic/compose.json` (JSON válido para Compose) |
| PostgreSQL | `furgoplus_task12_academic`, usuario del mismo nombre, `db:5432` |
| Volumen PostgreSQL | `furgoplus-task12-academic_pg_data` |
| Archivos privados | `furgoplus-task12-academic_private_uploads` |
| API Fedora | `http://127.0.0.1:18082` → backend:8000 |
| React Fedora | `http://127.0.0.1:15173` → web:5173; `/api` → backend:8000 |
| Redes | `furgoplus-task12-academic_database` (interna) y `_frontend` |
| Secretos nuevos | `$HOME/.local/share/furgoplus/task12-academic/` |

Conservar `furgoplus-task12`, `furgoplus-demo`, `furgoplus-demo-restore-task11` y
todos sus volúmenes. No usar `.env`, Compose base, backups ni secretos de r4/Task 11.
No hay restauración, reset, despliegue ni publicación. La única recuperación
prevista está limitada a los cuatro recursos accidentales del test; el auditor
no elimina nada y solo propone un plan después de verificarlos completamente.

`control.py` fija `-p`, un único `-f`, `--env-file /dev/null` y el directorio del
Compose. Cada acción valida el **modelo efectivo** de Compose antes de continuar.
La acción `test` utiliza esa validación, pero ejecuta las pruebas con `docker run`
sobre el ID de la imagen backend local y con red `none`; no usa `compose run`.
Rechaza puertos extra, incluidos 8000/5173 publicados por una combinación accidental
de archivos, los puertos 18080/18081 de las demos como sustitutos o adicionales,
destinos públicos, volúmenes/redes externos, variables heredadas y
secretos ajenos. No necesita ni imprime el `.env` actual. Los puertos internos
8000/5173 son correctos; lo prohibido es publicarlos también en Fedora.

La creación se detiene si cualquiera de sus nombres de recursos ya existe;
no adopta ni recrea esos recursos. Las fases posteriores comprueban las etiquetas
del volumen, proyecto del contenedor DB, su volumen montado, red y ausencia de
puertos PostgreSQL publicados. No cambian permisos del socket Docker.

## Provisión segura y requisitos

Terminal normal de Fedora con Docker y Compose disponibles. No ejecutar con
`set -x`, `script`, grabadores de terminal, pipes de contraseñas ni redirecciones
que capturen entrada. No poner contraseñas en argumentos, variables exportadas,
archivos versionados o logs. Las imágenes requieren acceso a sus registros durante
la construcción; no se instala nada globalmente con estos scripts.

`provision.py` requiere TTY y una confirmación escrita del nombre del proyecto.
Genera tres valores aleatorios nuevos sin mostrarlos; **no lee secretos anteriores**.
No sobrescribe un directorio existente ni regenera identidades. El directorio es
0700; DB/Django son 0600. Solo la marca de identidad, que debe leer el proceso
`postgres` durante la inicialización, es 0644 dentro de ese directorio privado.
No cambiar permisos para que otros usuarios puedan atravesarlo. Conservar el
directorio: perder/cambiar su identidad o contraseña provoca denegación, no reset.

### Corrección del rechazo «Secretos heredados o renombrados»

La causa reproducida sin Docker es una diferencia en la representación del modelo:
el guard exigía `target` igual a `source`, pero Compose puede expandirlo a
`/run/secrets/<source>`. Su [normalizador oficial](https://github.com/compose-spec/compose-go/blob/main/transform/secrets.go)
asigna precisamente ese destino a la sintaxis corta. El auxiliar de pruebas
anterior solo simulaba `target: <source>` y ocultaba el caso real.

Ese mensaje se emite en `validate_model`, después del control local de archivos.
El control local solo consulta propietario, modo y enlaces simbólicos; no compara
etiquetas SELinux, atributos extendidos, `ctime`, `mtime` ni inodos con un registro
previo. No hay una marca de metadatos creada por `provision.py`. Por eso el
etiquetado `chcon` no explica este error y se conserva el procedimiento SELinux.

La corrección admite únicamente `target` omitido, `<source>` o la cadena exacta
`/run/secrets/<source>`, que representan el mismo archivo dentro del contenedor.
No usa normalización de rutas ni comparación por basename. Conserva la lista
exacta de secretos por servicio y sus archivos host, y rechaza también duplicados,
renombrados, rutas alternativas, travesías y recursos externos. Las comprobaciones
de propietario, permisos, symlinks y contenido/identidad académica no cambian:
los settings leen los secretos montados y `academic_boundary.verify_server`
comprueba el formato de identidad y la marca PostgreSQL.

Con los secretos ya provisionados y etiquetados, reintentar desde Fedora:

```bash
cd /home/duran/Proyectos/furgoplus-planes
python3 infra/academic/test_without_db.py
python3 infra/academic/control.py config
```

`config` solo consulta y valida la configuración; no construye, crea contenedores,
migra ni carga datos, ni imprime contenidos secretos.

### Corrección del rechazo «Inicio reemplazado»

Confirmado con `docker compose ... config --format json`, **Compose 5.5.1**:
los tres servicios contienen `command: null` y `entrypoint: null`, aunque
`compose.json` no declara ninguno de esos campos. El guard anterior rechazaba
su mera presencia. El JSON real reproduce el error antes de la corrección y
pasa `validate_model` después, sin alterarlo. También pasó la ejecución real de
`python3 infra/academic/control.py config` con código 0 y los puertos 18082/15173.

La [semántica oficial de Compose](https://docs.docker.com/reference/compose-file/services/#command)
conserva el arranque de la imagen con `null`; `""` y `[]` lo sustituyen por un
valor vacío. El guard usa ahora `is not None`: permite solo ausencia o `None`
en ambos campos y rechaza valores vacíos, personalizados y tipos inválidos.
No se modificaron Dockerfiles, Compose ni las demás comprobaciones.

La captura real, sin contenidos secretos, está en
[`fixtures/compose-5.5.1.config.json`](fixtures/compose-5.5.1.config.json);
su [procedencia y SHA-256](fixtures/README.md) quedan documentados. Las pruebas
no ejecutan Docker: leen esa captura y solo adaptan los paths host para permitir
ejecutarlas desde otro checkout. No modifican los campos de arranque normalizados.

Las cinco claves de acceso se introducen después, durante `load`, mediante
`getpass` sin eco, confirmación, validadores Django y verificación de que sean
distintas entre sí. Una terminal sin entrada segura causa rechazo. Crear una clave
nueva por cuenta en el gestor de contraseñas; nunca reutilizar claves de r4 ni de
cuentas reales. El preparador no puede comparar con sistemas externos y no accede
a ellos para hacerlo. Guardar las claves en el gestor, nunca en este documento.

## Comandos exactos, por fase

Ejecutar **después de revisar los archivos**. Cada acción imprime la identidad
pública del destino. Ningún comando usa el Compose o la base actual de Task 12.

### 1. Revisión sin Docker ni base de datos

```bash
cd /home/duran/Proyectos/furgoplus-planes
python3 infra/academic/test_without_db.py
python3 -m json.tool infra/academic/compose.json >/dev/null
python3 - <<'PY'
import ast
from pathlib import Path

paths = [
    *Path("infra/academic").glob("*.py"),
    Path("backend/academic_boundary.py"),
    Path("backend/config/settings_academic.py"),
    Path("backend/drivers/academic_scenario.py"),
]
for path in paths:
    ast.parse(path.read_text(), filename=str(path))
print(f"Sintaxis Python válida: {len(paths)} archivos")
PY
sh -n infra/academic/10-academic-identity.sh
git diff --check
```

### 2. Secretos nuevos, configuración y construcción (sin escribir en PostgreSQL)

```bash
cd /home/duran/Proyectos/furgoplus-planes
ss -ltn '( sport = :18082 or sport = :15173 )'
```

Si `ss` muestra algún listener en esos puertos, detener la preparación y revisar
la colisión conservando los proyectos actuales.

Solo si ambos puertos están libres, continuar en la terminal privada:

```bash
python3 infra/academic/provision.py
```

Si SELinux está en `Enforcing`, etiquetar **solo estos archivos nuevos** para sus
montajes de secretos. El script de inicialización se monta `ro,Z` desde Compose.
No desactivar SELinux ni cambiar permisos del socket.

```bash
if command -v getenforce >/dev/null && [ "$(getenforce)" = Enforcing ]; then
  chcon -t container_file_t -- \
    "$HOME/.local/share/furgoplus/task12-academic" \
    "$HOME/.local/share/furgoplus/task12-academic/db_password" \
    "$HOME/.local/share/furgoplus/task12-academic/django_secret_key" \
    "$HOME/.local/share/furgoplus/task12-academic/academic_identity"
fi
python3 infra/academic/control.py config
python3 infra/academic/control.py build
```

Si algún puerto/recurso ya está ocupado, detener esta preparación y revisar la
colisión. No liberar puertos eliminando o recreando los proyectos conservados.
`config` confirma la topología; la disponibilidad real de puertos se comprueba al
iniciar los servicios y nunca autoriza detener el servicio que los ocupa.

### 3. Creación exclusiva — ESCRIBE en el volumen PostgreSQL nuevo

Si el ejecutor antiguo de `test` creó recursos académicos, no ejecutar esta fase
hasta revisar y completar el [procedimiento exclusivo](RECOVERY_TEST_RESOURCES.md).
No se omiten las verificaciones de recursos preexistentes.

```bash
python3 infra/academic/control.py create
```

Esta fase inicializa el clúster vacío y la base **`furgoplus_task12_academic`**.
El hook `10-academic-identity.sh` añade una marca aleatoria al comentario de esa
base únicamente durante su primera inicialización. No carga cuentas ni negocio.
Espera hasta 90 segundos por el healthcheck de PostgreSQL (`Compose --wait`).
Si falla la inicialización, revisar y volver a ejecutar solo la fase pendiente.
No repetir `create` si los recursos ya existen: su rechazo es intencional.

### 4. Migración protegida — ESCRIBE esquema/metadatos en la base académica

```bash
python3 infra/academic/control.py migrate
```

Llama a `manage.py migrate_academic --expect-project furgoplus-task12-academic
--expect-database furgoplus_task12_academic`. Verifica identidad antes de llamar a
`migrate`, también con esquema todavía ausente. Antes de la primera carga solo
admite tablas vacías de aplicación y metadatos de migración/ContentTypes/permisos
y los tres planes exactos creados por las migraciones. Tablas desconocidas,
cuentas preexistentes o actividad sin manifiesto causan rechazo.

### 5. Previsión de carga — SOLO LECTURA en la base académica

```bash
python3 infra/academic/control.py dry-run
```

Llama a `prepare_academic_scenario --dry-run` con ambas identidades explícitas.
Abre una transacción PostgreSQL `REPEATABLE READ READ ONLY`, con límite de consulta,
y termina con rollback. No solicita claves, no crea archivos ni modifica contadores.
Debe indicar destino vacío verificado antes de la primera carga.

### 6. Carga interactiva — ESCRIBE exclusivamente datos sintéticos académicos

```bash
python3 infra/academic/control.py load
```

Llama a `prepare_academic_scenario --apply --expect-project
furgoplus-task12-academic --expect-database furgoplus_task12_academic` sin argumentos
secretos. Repite la comprobación de solo lectura, pide las cinco claves privadas y
revalida identidad/esquema bajo transacción, bloqueo de tablas y bloqueo asesor
antes de crear la primera cuenta. Si otro proceso cargó el escenario durante las
preguntas, devuelve «sin cambios».

La primera carga solo se permite en **octubre real de 2026, America/Santiago**.
Después del 31/10, una base vacía requiere revisar un escenario nuevo; no cambiar
el reloj, parchear validadores ni pasar fechas falsas. Una carga completada en
octubre se puede repetir en noviembre: será una operación sin cambios.

Se usan los modelos y vistas existentes para aprobar documentos sintéticos,
asignar planes, publicar, validar cupos, registrar/transicionar pagos, consentir y
resolver contactos y cambiar estados de soporte. `force_authenticate` es el
adaptador interno del CLI de confianza; conserva los controles de rol,
propiedad, capacidades y validaciones de las vistas. No se exponen endpoints nuevos.
No se usan fixtures ni se alteran validadores, límites o fechas de creación.

El manifiesto se registra en `AdminActionLog` dentro de la misma transacción,
con identidad, IDs, fecha real y recursos base. No incluye claves ni hashes de
contraseña. Repetir no reinicia estados, renueva planes, cambia claves ni recrea
filas: reconoce el escenario y se detiene. Permite conservar cambios posteriores
hechos por las cinco cuentas del escenario, como suspensiones y nuevos pagos.
Rechaza cuentas ajenas, pérdida de recursos base, documentos alterados/ausentes y
manifiestos incompatibles. No adopta cuentas preexistentes aunque coincida el correo.

Un error revierte la transacción y elimina solo documentos creados por ese intento
fallido; conserva archivos previos. Si el resultado del commit es incierto,
conserva los documentos y exige revisión manual. No reintentar a ciegas ni restaurar
un backup sobre este destino para sortear las verificaciones.

### 7. Auditoría del nuevo escenario — SOLO LECTURA

```bash
python3 infra/academic/control.py audit
```

Llama a `audit_academic_scenario` con proyecto/base explícitos. Reporta cuentas
ficticias, permisos, cantidades, capacidades efectivas, cupos, estados y meses
reales de creación. Usa una transacción `READ ONLY` con rollback. No hace login,
no invoca el asistente y no consume cuotas. **Esta es la auditoría del entorno
nuevo, no la repetición del inventario ya confirmado de `furgoplus-task12`.**

### 8. Iniciar API y React locales

```bash
python3 infra/academic/control.py start
```

Abrir `http://127.0.0.1:15173`. La API queda en `http://127.0.0.1:18082`.
La creación, migración y carga no ocurren en el arranque de estas aplicaciones.
Las cookies locales no se aíslan por puerto: usar un perfil de navegador separado
para evitar mezclar sesiones con Task 12 o Task 11. Usar estas URL exactas mantiene
la comprobación CSRF coherente a través del proxy React.
`settings_academic.py` exige los orígenes exactos de `academic_boundary.py`:
API `http://127.0.0.1:18082` y web `http://127.0.0.1:15173`. El proxy mantiene
el `Host` del navegador (`changeOrigin: false`) y conecta a `backend:8000`;
no hace falta ampliar `CSRF_TRUSTED_ORIGINS` ni permitir los orígenes de las demos.

## Datos y criterios de aceptación iniciales

| Cuenta ficticia | Criterio comprobable |
| --- | --- |
| `t12-admin@example.test` | Admin activo, staff y superusuario ficticio; administración de planes, validaciones y cola de soporte, con `drivers.manage_support` efectivo. |
| `t12-basic@example.test` | Básico activo; operaciones y ayuda/soporte disponibles; reportes mensuales/detalle/XLSX y asistentes denegados por servidor; prioridad `standard`. |
| `t12-pro@example.test` | Pro activo; reporte mensual y asistente FAQ habilitados; detalle/comparación/XLSX y asistente contextual denegados; prioridad `preferred`. |
| `t12-elite@example.test` | Elite activo; reporte mensual, detalle, comparación, tres XLSX y ambos modos de asistente habilitados; prioridad `priority`. |
| `t12-parent@example.test` | Apoderado con perfil ficticio; descubre/compara los tres servicios elegibles, consulta sus contactos y su ticket; no accede a operaciones de conductor, capacidades comerciales ni administración. |

En cada conductor: 1 suscripción vigente desde el instante de carga por 90 días,
3 documentos PNG marcados sintéticos, revisión aprobada mediante el flujo normal,
servicio publicado y 1 ruta activa con cobertura común en dos comunas ficticias.
Rutas diarias durante la vigencia, 4 cupos, **3 ocupados y 1 disponible**. Hay
9 pasajeros en total, asignados desde el día real de carga por 60 días. Estos son
intervalos de disponibilidad; no constituyen actividad realizada en noviembre.

En cada conductor hay 3 pagos manuales: `pending`, `paid`, `void`. Período y
vencimiento = día real de carga, `paid_at` = instante real de transición. No se
simula cobro automático. Total 9 pagos. Los 4 contactos del apoderado quedan:
Básico pendiente, Pro aceptado, Elite rechazado y Elite cancelado; solo el aceptado
comparte el correo del servicio. El par con Elite queda sin pendiente para una
solicitud interactiva posterior.

Hay 6 tickets y 11 eventos: Básico abierto normal y abierto crítico; Pro en
revisión; Elite esperando usuario y otro cerrado tras resolución; apoderado
resuelto. Demostrar los cinco estados y las tres prioridades, y que la gravedad
crítica precede al plan comercial. No se deshabilitan los límites de soporte.
La carga consume las cuotas normales de creación/respuesta; las demostraciones
posteriores están sujetas a esos mismos límites.

La auditoría inicial debe mostrar 5 usuarios, 3 perfiles conductor, 1 apoderado,
3 suscripciones, 3 rutas, 9 asignaciones, 9 pagos, 4 contactos, 6 tickets y
11 eventos; **0 recorridos ejecutados**. Ninguna fecha de creación debe estar
fuera del momento real de carga ni aparecer actividad artificial de noviembre.
Una comparación octubre/noviembre puede mostrar noviembre vacío; los recorridos
solo se ejecutan realmente por las pantallas cuando corresponda.

Tras demostrar operaciones, las cantidades/estados pueden variar. Repetir el
preparador debe mantener esos cambios; la auditoría comunica vigencias actuales
y no renueva nada. No atribuir la ejecución del escenario a Fedora hasta contar
con la salida real de estas fases.

## Pruebas automatizadas y evidencia de esta entrega

Ejecutadas tras aislar el ejecutor SQLite en Codex: **57 pruebas stdlib sin DB**,
Ruff **0.13.2**, sintaxis Python/JSON y shell, y `git diff --check` (también revisión de espacios
finales en los archivos modificados, incluidos los aún sin seguimiento).
Cubren cada componente de identidad, r4/producción/Task 12/
destinos desconocidos, marca/rol/propietario PostgreSQL, base no vacía/tablas
desconocidas, catálogo modificado, puertos heredados, recursos compartidos,
denegación sin TTY, dry-run, repetición y carrera entre preparadores.
La normalización de pruebas lee los puertos del Compose real. Se comprueban el
par exacto 18082→8000 / 15173→5173, el guard de orígenes de los settings sin leer
secretos ni importar Django, el rechazo de 18080/18081/8000/5173 como puertos
publicados y de otros puertos, rangos, UDP, destinos internos incorrectos,
bindings públicos/IPv6 y puertos agregados mediante combinaciones de Compose.
El modelo simulado usa ahora destinos de secretos absolutos como Compose.
Las nuevas regresiones cubren las tres representaciones equivalentes, secretos
ajenos/renombrados, destinos alterados, faltantes, duplicados, fuentes externas,
y el flujo real de `config` con subprocess simulado. Comprueban que variaciones
de timestamps no afectan al guard y que un propietario, permiso o symlink
incorrecto en cualquiera de los cuatro paths detiene la acción antes de Compose.
Las regresiones de arranque y las pruebas del flujo de `config` utilizan además
el JSON real de Compose 5.5.1. Verifican las cuatro combinaciones de campos
ausentes/null, sustituciones vacías y personalizadas por servicio y campo, y
rechazos de proyecto, identidad, secretos, redes, volúmenes y puertos alterados.
No ejecutan `chcon` ni simulan una aceptación de integración SELinux en Fedora.
Las funciones de orquestación/esquema se cargan desde su AST real con adaptadores
simulados: estas pruebas no ejecutan SQL, conexiones, Docker ni Django.
Las pruebas de provisión usan un directorio temporal eliminado al terminar;
no provisionan secretos del entorno académico. Ruff se ejecutó desde una copia
temporal del binario 0.13.2, sin instalar paquetes ni modificar otros proyectos:

```bash
/tmp/furgoplus-t1211-tools/ruff check --config backend/pyproject.toml \
  infra/academic/control.py infra/academic/test_without_db.py \
  infra/academic/audit_test_resources.py infra/academic/test_resource_recovery.py
```

Las nuevas regresiones comprueban el contenedor de test sin montajes ni redes de
Compose, las etiquetas/ID de imagen y el rechazo de volúmenes implícitos; también
que `create` rechaza cada uno de los cuatro recursos existentes. La recuperación
cubre identidad, asociaciones con contenedores detenidos/ajenos, directorios
ocultos/no vacíos, symlinks, carreras de identidad y ausencia de plan ante errores.

Las consultas de inspección del daemon en esta corrección fallaron por permisos
del socket, sin cambios. No se borró ni se afirmó vacío ningún recurso.

Confirmadas desde Fedora por el usuario: **13/13 pruebas Django** con el ejecutor
anterior; nueva ejecución aislada pendiente en Fedora. Son las pruebas de
en `backend/drivers/test_academic_scenario.py`. Incluyen carga completa con las
vistas/validadores reales, idempotencia comparando todo el estado, preservación de
contraseñas/suscripciones modificadas, rollback de archivos, colisiones, esquema
ajeno, publicación, capacidades/prioridades, permisos y cupos/propiedad.

Ejecutarlas desde Fedora, después de `build`:

```bash
python3 infra/academic/control.py test
```

La nueva fase **escribe exclusivamente en SQLite `:memory:` y tmpfs de pruebas**,
con `config.settings_task12_tests`, `TASK12_TEST_POSTGRES=false`, documentos en
`/tmp`, usuario 65534:65534, root filesystem de solo lectura y red `none`.
La imagen backend ya construida se inspecciona, verifica por etiquetas y se fija
por ID; un `VOLUME` declarado provoca rechazo. No monta volúmenes ni secretos,
no publica puertos, crea redes de Compose ni descarga imágenes. No conecta
a PostgreSQL académico. Las pruebas sustituyen explícitamente el sondeo de
identidad y primitivas PostgreSQL por adaptadores de test; nunca sustituyen los
validadores de negocio. No hay un indicador de entorno que desactive la seguridad
en el comando real. La protección real de PostgreSQL y la configuración efectiva
de Docker en ejecución quedan pendientes de verificar con `migrate`, `dry-run` y
`audit` en Fedora. `config` ya valida el modelo efectivo, sin probar contenedores
ni PostgreSQL. No se afirma una integración PostgreSQL ya aprobada.

## Si una fase se detiene

No editar la marca de PostgreSQL ni el manifiesto ni regenerar secretos. Fuera
del procedimiento exclusivo para recursos de test verificados vacíos, no borrar
volúmenes. Verificar localmente la fase pendiente y los nombres exactos.
Un destino inesperado se rechaza antes de cualquier escritura de dominio. La
marca bootstrap y el manifiesto prueban pertenencia a este escenario, no son una
defensa contra un administrador que falsifique intencionalmente toda la identidad
o clone sus secretos y volumen. Ese tipo de clonación está fuera de este flujo.

No se requiere commit, push, merge ni despliegue para revisar o ejecutar estas fases.

## Archivos de esta implementación

Todos son nuevos salvo la actualización indicada del diagnóstico histórico.

| Archivo | Función |
| --- | --- |
| [compose.json](compose.json) | Compose independiente, puertos y recursos exclusivos. |
| [10-academic-identity.sh](10-academic-identity.sh) | Marca de pertenencia durante la primera inicialización PostgreSQL. |
| [provision.py](provision.py) | Provisión interactiva de secretos nuevos, sin mostrarlos. |
| [control.py](control.py) | Comandos Fedora, validación efectiva de Compose y recursos en ejecución. |
| [test_without_db.py](test_without_db.py) | 57 pruebas sin conexiones ni escrituras en bases de datos; incluye las de recuperación. |
| [audit_test_resources.py](audit_test_resources.py) | Auditor exclusivo de lectura; solo imprime un plan manual después de comprobar los cuatro recursos. |
| [test_resource_recovery.py](test_resource_recovery.py) | Regresiones del auditor y lectura real de directorios temporales. |
| [RECOVERY_TEST_RESOURCES.md](RECOVERY_TEST_RESOURCES.md) | Procedimiento manual limitado a recursos vacíos, con reauditoría antes de cualquier eliminación. |
| [fixtures/compose-5.5.1.config.json](fixtures/compose-5.5.1.config.json) | Captura real de Compose con campos de arranque null, sin contenidos secretos. |
| [fixtures/README.md](fixtures/README.md) | Procedencia, captura segura y hash de la fixture real. |
| [README.md](README.md) | Comandos por fase, restricciones y aceptación por rol. |
| [academic_boundary.py](../../backend/academic_boundary.py) | Política pura de identidad y denegación. |
| [settings_academic.py](../../backend/config/settings_academic.py) | Settings exclusivos con secretos montados. |
| [academic_scenario.py](../../backend/drivers/academic_scenario.py) | Preparación transaccional, idempotencia, validaciones y manifiesto. |
| [prepare_academic_scenario.py](../../backend/drivers/management/commands/prepare_academic_scenario.py) | Comando de dry-run/carga. |
| [migrate_academic.py](../../backend/drivers/management/commands/migrate_academic.py) | Migración con identidad verificada. |
| [audit_academic_scenario.py](../../backend/drivers/management/commands/audit_academic_scenario.py) | Auditoría exclusiva de solo lectura. |
| [test_academic_scenario.py](../../backend/drivers/test_academic_scenario.py) | 13 pruebas reales aprobadas por el usuario con el ejecutor anterior; nueva ruta aislada pendiente en Fedora. |
| [TASK12_ACADEMIC_PREPARATION.md](../../docs/TASK12_ACADEMIC_PREPARATION.md) | Actualizado: inventario confirmado, autorización vigente y enlace al escenario; conserva el diagnóstico anterior. |
