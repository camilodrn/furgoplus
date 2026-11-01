# Recuperación manual de cuatro recursos creados por el antiguo test T12.11

Este procedimiento es exclusivo de los siguientes nombres completos:

| Tipo | Nombre exacto |
| --- | --- |
| Volumen | `furgoplus-task12-academic_pg_data` |
| Volumen | `furgoplus-task12-academic_private_uploads` |
| Red | `furgoplus-task12-academic_database` |
| Red | `furgoplus-task12-academic_frontend` |

El usuario confirmó que el antiguo `control.py test` los creó y que no quedan
contenedores con la etiqueta del proyecto. Eso **no demuestra que los volúmenes
estén vacíos ni que otros contenedores no los referencien**. La auditoría real
desde Codex está bloqueada por permisos del socket Docker. Por eso no se incluye
un bloque estático de eliminación ni se afirma que borrar sea seguro todavía.

El código nuevo no adopta estos recursos ni modifica las protecciones de `create`.
No se regeneran secretos, construyen imágenes, inicia PostgreSQL, migra ni carga
datos durante esta recuperación. Los demás proyectos conservan sus recursos.

## 1. Revisar y comprobar la corrección

Desde una terminal normal de Fedora:

```bash
cd /home/duran/Proyectos/furgoplus-planes
python3 infra/academic/test_without_db.py
git diff --check
```

Mantener el proyecto académico sin operaciones concurrentes durante la auditoría
y recuperación. No detener ni modificar los otros proyectos. No ejecutar la fase
`create` para intentar sortear el rechazo de recursos existentes.

## 2. Auditoría exclusiva de lectura

```bash
python3 infra/academic/audit_test_resources.py
```

El auditor consulta Docker con el usuario habitual. Requiere un daemon Linux
local accesible por socket Unix, sin `DOCKER_HOST` definido, con hostname y kernel
iguales al equipo que ejecuta el auditor y el mismo inventario al principio y al
final. Rechaza Docker Desktop y daemons remotos/VM: sus datos no se presuponen
accesibles desde el filesystem local. Si la identidad o ruta no es comprobable,
se detiene.

Si Docker es accesible pero falta permiso para leer sus directorios de volúmenes,
usar la opción de lectura privilegiada, sin cambiar permisos ni etiquetas:

```bash
sudo -v
python3 infra/academic/audit_test_resources.py --sudo-read-volumes
```

`sudo` se utiliza exclusivamente para un pequeño helper Python de lectura de
directorios. No ejecuta Docker como root. El helper usa `-I -B`, no sigue symlinks,
no lee contenidos de archivos ni imprime entradas. Si la autorización expira,
`sudo -n` falla y la auditoría se detiene. No modifica SELinux.

Antes de aprobar, el auditor exige:

1. Exactamente esos dos volúmenes y dos redes en el inventario etiquetado del
   proyecto; sin recursos adicionales, faltantes o identificados por prefijo.
2. Nombres exactos y etiquetas `com.docker.compose.project`, `volume`/`network`
   y versión de Compose presentes y coherentes con cada recurso.
3. Volúmenes locales, sin opciones de almacenamiento externo y con mountpoints
   exactamente bajo `DockerRootDir/volumes/<nombre>/_data`.
4. Redes bridge locales, sin opciones externas, database interna y frontend
   no interna; ningún endpoint conectado.
5. Ausencia de referencias desde **todos** los contenedores, incluidos detenidos
   y ajenos al proyecto. Revisa etiquetas, nombres de volúmenes, binds que cubran
   sus datos, redes por nombre/ID y `HostConfig.NetworkMode`. No imprime sus env.
6. Ambos directorios completamente vacíos: ninguna entrada, tampoco oculta,
   directorio vacío, documento ni archivo PostgreSQL. Cualquier symlink en el
   recorrido, falta de acceso o error de consulta provoca rechazo.
7. Segunda inspección de identidad, daemon y asociaciones, y segunda lectura de
   directorios. Si algo cambia, no emite un plan.

**Si falla cualquier comprobación, detenerse sin cambios.** No borrar contenidos,
editar etiquetas, relajar permisos ni retirar contenedores para forzar un pase.
Un volumen no vacío requiere otro diagnóstico; este procedimiento no lo recupera.

## 3. Obtener un plan para revisión, sin ejecutarlo

Solo después de una auditoría completa aprobada:

```bash
python3 infra/academic/audit_test_resources.py --sudo-read-volumes --print-plan
```

Si no se necesitó lectura privilegiada, omitir `--sudo-read-volumes`.
El comando vuelve a realizar todas las comprobaciones. Solo si pasan imprime
`VERIFICADO`, una huella de identidad y un plan de shell para revisión manual.
**El programa nunca ejecuta operaciones de eliminación.** No conectar su salida
a una shell ni usar `eval` o sustituciones para ejecutarla automáticamente.

El plan generado contiene una reauditoría completa con la huella revisada como
primera condición. Después se limita a las dos redes por sus IDs completos y a
los dos volúmenes por sus nombres completos. Fija el endpoint Docker auditado,
no usa force, comodines, coincidencias parciales ni limpiezas generales.

## 4. Revisión y ejecución manual

Revisar el plan mostrado contra la tabla inicial y ejecutarlo manualmente en la
misma ventana sin operaciones concurrentes. La reauditoría debe pasar de nuevo
antes de la primera eliminación; el encadenamiento se detiene ante cualquier error.
Docker también rechaza recursos en uso. No existe una transacción Docker conjunta
para cuatro eliminaciones: si una operación de eliminación falla, detenerse y
revisar los recursos restantes, sin repetir un plan antiguo ni usar force.

No se elimina ni se cambia el directorio de secretos. No se toca ningún recurso
de `furgoplus-task12`, `furgoplus-demo` o restauración Task 11.

## 5. Comprobar la recuperación y la nueva ejecución de pruebas

Consultar solo los nombres del proyecto académico:

```bash
docker volume ls --filter label=com.docker.compose.project=furgoplus-task12-academic --format '{{.Name}}'
docker network ls --filter label=com.docker.compose.project=furgoplus-task12-academic --format '{{.Name}}'
```

Ambas consultas deben terminar correctamente y no mostrar nombres. Después:

```bash
python3 infra/academic/control.py config
python3 infra/academic/control.py test
docker volume ls --filter label=com.docker.compose.project=furgoplus-task12-academic --format '{{.Name}}'
docker network ls --filter label=com.docker.compose.project=furgoplus-task12-academic --format '{{.Name}}'
```

El nuevo `test` usa la imagen backend existente, fijada por ID y con etiquetas
de proyecto/servicio verificadas. La prueba Django real conserva SQLite en memoria
y documentos temporales; no monta secretos ni volúmenes, no publica puertos y usa
la red `none`. El root filesystem es de solo lectura, `/tmp` es tmpfs y el proceso
no es root. Rechaza imágenes con `VOLUME` implícito para evitar volúmenes anónimos.
No usa Compose para ejecutar el contenedor ni descarga imágenes.

Las dos últimas consultas deben seguir vacías. Las 13 pruebas reales aprobadas
por el usuario corresponden al ejecutor anterior; repetirlas en Fedora verifica
esta nueva ruta. No se ejecutó esa integración desde Codex por el bloqueo del socket.

Solo una recuperación manual verificada permite retomar las fases académicas del
runbook. `create` conserva su rechazo ante cualquiera de los cuatro recursos
preexistentes; no hay adopción, excepción de test ni borrado automático.
