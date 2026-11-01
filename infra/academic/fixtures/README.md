# Captura efectiva de Compose para T12.11

`compose-5.5.1.config.json` es la salida real, sin modificar, de Docker Compose
**5.5.1** obtenida durante el diagnóstico del rechazo «Inicio reemplazado».
No procede del auxiliar `model()` ni de un JSON construido manualmente.

SHA-256: `56e9e712de8b7e3dcc09bb1d1a387a14c6cb427c3d1e2fe1adadb455e0cf276f`.

Se ejecutó desde la raíz del repositorio el equivalente a:

```bash
ACADEMIC_SECRETS_DIR="$HOME/.local/share/furgoplus/task12-academic" \
docker compose --project-directory "$PWD/infra/academic" --env-file /dev/null \
  -p furgoplus-task12-academic -f "$PWD/infra/academic/compose.json" \
  config --format json > /tmp/task12-academic-compose.config.json
```

La captura se realizó con `subprocess.run(..., capture_output=True)`, sin imprimir
el JSON completo. Antes de guardar se comprobó que los entornos de los servicios
coincidían con los valores públicos del Compose original y que los secretos solo
contenían nombres y rutas de archivos. No contiene contraseñas, claves, contenidos
de archivos secretos ni la marca aleatoria de identidad. No se leyeron esos archivos
ni se regeneraron secretos para obtener esta captura.

Los tres servicios incluyen `command: null` y `entrypoint: null`. El guard original
rechazó esta salida con «Inicio reemplazado»; el corregido acepta la misma captura.
La ejecución real posterior de `control.py config` terminó con código 0.
`config` y la consulta de versión no crean ni inician contenedores, construyen
imágenes, migran ni cargan datos.

`test_without_db.py` lee este archivo sin invocar Docker. Para ejecutarse desde
otros checkouts, solo adapta tres clases de rutas host: contextos de build,
el bind del hook de inicialización y los archivos de secretos. Conserva el resto
del modelo, incluidos los campos de arranque null. Las pruebas negativas mutan
copias de esta captura y comprueban que los demás guards siguen rechazándolas.
