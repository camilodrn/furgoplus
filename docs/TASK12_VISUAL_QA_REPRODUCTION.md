# T12 — Reproducción en Fedora y Samsung A54

31-10-2026. Complementa el [informe](TASK12_VISUAL_QA_REPORT.md). Estos pasos no fueron ejecutados en un teléfono ni en un navegador operativo por esta sesión. No acceder a demo pública, homelab ni puertos históricos 18080/18081/8000. Si falta un servicio, detener y registrar el bloqueo; este protocolo no incluye reconstrucción, despliegue, migración ni carga del escenario.

## 1. Instalar solamente lo que falta

En la terminal normal de Fedora, desde la raíz del repositorio:

```bash
cd web
node --version
npm ls --depth=0
npm ls @playwright/test @axe-core/playwright playwright playwright-core
```

La instalación en Codex quedó detenida por `EAI_AGAIN`; no hay cambios de dependencias en esta entrega. Si siguen ausentes los dos paquetes autorizados:

```bash
npm install --save-dev --save-exact @playwright/test @axe-core/playwright
npm ls @playwright/test @axe-core/playwright playwright-core
npx --no-install playwright --version
npx --no-install playwright install --list
```

No usar `--force`/`--legacy-peer-deps`. npm debe resolver versiones compatibles con Node y los peer dependencies, fijarlas en package.json y actualizar **el package-lock existente**, sin sustituir el gestor. Conservar y revisar ese diff. No instalar un `playwright` separado: Test ya aporta el navegador/controlador requerido.

Comprobar primero si el Chromium que requiere **esa versión** ya está instalado. El alpha externo encontrado espera revisión 1247, pero la caché contiene 1248; no se debe fijar una ruta incompatible como solución permanente. Solo si falta el binario compatible:

```bash
npx --no-install playwright install chromium
```

Ese es el comando de descarga pendiente para Fedora; no fue ejecutado en el sandbox. No descargar todos los navegadores ni deshabilitar el sandbox. Si faltan bibliotecas del SO, registrar el mensaje y resolverlas con el administrador de Fedora; no ejecutar scripts de apt ni `--no-sandbox`. Una instalación fallida no autoriza cambiar seguridad del equipo.

## 2. Confirmar académico y código actual antes del login

Desde `web`, con los servicios académicos **ya disponibles**:

```bash
node --input-type=module -e 'import check from "./visual/academic-preflight.mjs"; await check();'
```

El script usa únicamente consultas Docker, hashes de archivos, HTTP local y `docker exec … audit_academic_scenario`, comando existente de lectura. Requiere acceso normal al daemon, el proyecto `furgoplus-task12-academic`, PostgreSQL `furgoplus_task12_academic`, web 15173/API 18082, redes propias y volumen académico. No lee ni imprime secretos. También comprueba que HTTP sirva App.tsx del árbol actual, no solo que el archivo exista dentro del contenedor.

**Si falla: detener.** No cambiar origen, no reemplazar el backend por mocks, no iniciar contenedores ni modificar archivos en un contenedor para sortear la comprobación. Registrar qué comprobación falló. Un origen local por sí solo no demuestra identidad académica.

## 3. Capturas web y axe

Usar cuentas sintéticas **existentes y autorizadas** del académico. No crear cuentas para llenar un test. Introducir las credenciales en variables efímeras; no escribirlas en archivos, argumentos, .env ni repositorio. Evitar `set -x` y grabaciones de terminal:

```bash
read -rp 'Correo conductor académico (@example.test): ' TASK12_DRIVER_EMAIL
read -rs -p 'Contraseña conductor: ' TASK12_DRIVER_PASSWORD
printf '\n'
read -rp 'Correo administrador académico (@example.test): ' TASK12_ADMIN_EMAIL
read -rs -p 'Contraseña administrador: ' TASK12_ADMIN_PASSWORD
printf '\n'
export TASK12_DRIVER_EMAIL TASK12_DRIVER_PASSWORD TASK12_ADMIN_EMAIL TASK12_ADMIN_PASSWORD
node visual/readonly.check.mjs
npx --no-install playwright test --config=playwright.visual.config.mjs
unset TASK12_DRIVER_EMAIL TASK12_DRIVER_PASSWORD TASK12_ADMIN_EMAIL TASK12_ADMIN_PASSWORD
```

Si el test termina con error, ejecutar igualmente el `unset`. Para revisar la ejecución en pantalla usar el mismo comando con `--headed`; se mantiene la barrera. La configuración no arranca Vite ni backend, no comparte contexto entre roles y ejecuta 1440/1280/768/390/320. No guardar sesiones para acelerar el login. No generar trazas/vídeos/HAR ni ejecutar con `DEBUG=pw:api` durante el ingreso de contraseña.

Resultados: `/tmp/furgoplus-t12-playwright/results`. Cada estado tiene `viewport.png`, `full.png` y `audit.json`: geometría, violaciones axe, `incomplete` y reglas aprobadas. El archivo de peticiones bloqueadas no contiene cuerpos/queries/cookies. La bandera de revisión humana sigue falsa hasta una revisión real. Los selectores se basan en el código actual, pero están **pendientes de su primera validación en navegador**; ajustar solamente el harness si el DOM real revela un selector incorrecto y conservar el pendiente visible.

Una colección vacía produce una captura de vacío; la subvista sin registro queda pendiente. Nunca modificar planes/solicitudes/pagos/expedientes para obtener un ejemplo. Documentos privados y Excel quedan bloqueados aunque sean GET auditados. No pulsar guardar, enviar, aprobar, rechazar, activar, finalizar o cancelar una solicitud de negocio durante esta revisión. La suite no abre el editor de plan.

Inspeccionar todas las capturas antes de aceptarlas. Rechazar blanco, carga sin terminar, login inesperado o página incorrecta. Una pantalla de error capturada intencionalmente se registra como **estado de error**, sin aprobar la pantalla de datos. Revisar `incomplete` manualmente; no excluir reglas para ocultarlo. Guardar solo PNG/JSON sintéticos revisados en una carpeta de evidencia nueva; nunca copiar todo el directorio de ejecución al repositorio sin inspección.

Además de la suite, comprobar manualmente, manteniendo la barrera activa:

1. Inicio → Mi servicio → Datos/Documentos/Revisión/Publicación/Rutas; lista y formularios sin guardar.
2. Pasajeros y detalle; Pagos y detalle; Solicitudes y lectura; Plan/reportes con período y detalles abiertos, sin exportar.
3. Admin Inicio → Conductores → filtros aplicados/borrador → ficha Estado/Plan/Validaciones/Historial → expediente; volver conservando origen.
4. Ayuda/guía completa, bandeja, caso y formulario de soporte vacío; estados sin coincidencias y errores de lectura solo en fixtures aisladas si no ocurren naturalmente.
5. Tab/Shift+Tab, Enter/Espacio, Escape, foco visible y restaurado, salto al contenido, Atrás/Adelante. No confirmar operaciones.
6. Zoom real 200/400 %, 320 CSS px efectivos y contenido completo desplazado. Cambiar viewport no demuestra zoom ni aumento de tipografía del navegador.

No hay referencias aprobadas de snapshots. La configuración fija `updateSnapshots: "none"`; no ejecutar `--update-snapshots`. Primero comparar imágenes y aprobar referencias concretas, identificando SO, navegador, fuentes, viewport, estado y revisión de código. Solo después integrar aserciones de diferencias para esas referencias.

## 4. Regresión y renders Flutter sin nuevas dependencias

En Fedora con el SDK normal escribible y las dependencias del lock ya disponibles:

```bash
cd ../mobile
flutter --version
flutter analyze --no-pub
flutter test --no-pub --concurrency=1
```

El runner convencional debe pasar en Fedora: los 207 del ejecutor alternativo no sustituyen ese requisito. No modificar los tests de sesión, permisos o recuperación para acomodar la captura.

Para reproducir la evidencia de esta entrega, los tres generadores ya existentes funcionan sin conectarse a servicios ni persistir sesión. Desde `mobile`, indicar el SDK Flutter real instalado y un directorio temporal nuevo:

```bash
export TASK12_FLUTTER_SDK=/home/duran/develop/flutter
export TASK12_RENDER_DIR="$(mktemp -d /tmp/furgoplus-t12-renders.XXXXXX)"
export FLUTTER_SUPPRESS_ANALYTICS=true DASH__SUPPRESS_ANALYTICS=true
for TASK12_TARGET in integral_experience visual driver_experience; do
  "$TASK12_FLUTTER_SDK/bin/flutter" build bundle --debug --no-pub \
    --target="tool/${TASK12_TARGET}_preview.dart" \
    --dart-define="PREVIEW_FONT_DIR=$TASK12_FLUTTER_SDK/bin/cache/artifacts/material_fonts" \
    --dart-define="PREVIEW_OUTPUT=$TASK12_RENDER_DIR/$TASK12_TARGET" || break
  FLUTTER_TEST=true APP_NAME=furgoplus UNIT_TEST_ASSETS="$PWD/build/flutter_assets" \
    "$TASK12_FLUTTER_SDK/bin/cache/artifacts/engine/linux-x64/flutter_tester" \
    --disable-vm-service --enable-checked-mode --verify-entry-points \
    --enable-software-rendering --skia-deterministic-rendering --non-interactive \
    --disable-asset-fonts --flutter-assets-dir="$PWD/build/flutter_assets" \
    --packages="$PWD/.dart_tool/package_config.json" \
    build/flutter_assets/kernel_blob.bin || break
done
```

No compilar otro target entre el bundle y su ejecución. El resultado esperado del transporte sintético de cada generador es `PREVIEW RESULT: passed`; comprobar cantidad/fecha/estado y abrir imágenes, no solamente el mensaje. En esta entrega se usó la copia temporal del SDK que ya existía para permitir sus cachés, sin descargar nada. El manifiesto fija motor y SHA-256 de fuentes. No ejecutar `--use-test-fonts` en previews: reemplazaría Roboto por la fuente de prueba.

El ejecutor alternativo de regresión se reproduce con target `tool/test_without_sockets.dart` y el mismo motor añadiendo `--use-test-fonts`; está documentado en [la entrega anterior](evidence/task12-visual-implementation/README.md). Debe rotularse siempre como alternativo.

Goldens pendientes: escoger primero C02/C04/C06 con texto normal y 200 %, revisar el render y aprobar referencia/SDK/fuentes antes de añadir `matchesGoldenFile`. No regenerar galerías históricas ni tomar estos renders como baseline sin revisión. No hay paquete Flutter visual adicional que instalar en este corte.

## 5. Samsung A54: comprobar identidad antes de observar

No se ejecutaron estos pasos desde Codex: ADB no puede abrir 5037. En Fedora, activar depuración USB y autorizar físicamente el equipo, sin cambiar APK:

```bash
adb devices -l
read -rp 'Serial del Samsung autorizado: ' TASK12_DEVICE_SERIAL
adb -s "$TASK12_DEVICE_SERIAL" shell getprop ro.product.model
adb -s "$TASK12_DEVICE_SERIAL" shell pm list packages com.example.furgoplus
adb -s "$TASK12_DEVICE_SERIAL" shell pm path com.example.furgoplus.task12
adb -s "$TASK12_DEVICE_SERIAL" shell dumpsys package com.example.furgoplus.task12 \
  | rg 'versionCode=|versionName=|DEBUGGABLE'
adb -s "$TASK12_DEVICE_SERIAL" reverse --list
```

Confirmar físicamente que es el A54 elegido y que existe **exactamente** `com.example.furgoplus.task12`; el nombre «FurgoPlus» del launcher no basta. El build debug del repositorio usa ese sufijo, pero puede no coincidir con el APK instalado. Comprobar procedencia/hash del APK y revisión de código con el registro de compilación aprobado, además de la API compilada; una cadena encontrada en el binario no prueba por sí sola el destino activo.

No instalar, reemplazar, borrar datos ni cambiar reverse desde este protocolo. Si el paquete o el destino académico no pueden comprobarse, registrar el bloqueo. Los mapeos antiguos 18001→8000 no son autorización para usar ese backend. Solo observar si el APK y su mapeo existente apuntan al académico 18082 y su identidad fue verificada por el preflight. Abrir manualmente la variante confirmada; login académico autorizado sin fotografiar el campo con contraseña.

Con cuentas sintéticas y sin pulsar acciones de negocio, recorrer:

1. Acceso: etiquetas, mostrar contraseña, autofill y teclado; volver sin registro nuevo.
2. Conductor: Hoy, detalle, selección/lectura de otros recorridos y pendientes, pasajeros/búsqueda/expansión del contacto sintético; Mi plan y Ayuda/Cuenta. **No Iniciar/Finalizar** ni abrir mapas con destinos sintéticos.
3. Familia: Buscar/comuna, comparar dos/tres, abrir servicio y expandir cobertura/Acerca/validación/reseñas; contacto vacío y consentimiento desmarcado; solicitudes/detalle; Cuenta/editar sin guardar. **No enviar/cancelar solicitud**.
4. Ambos roles: Ayuda, guías largas, soporte/caso, formulario sin enviar, Privacidad y Términos. Android Atrás debe cerrar la capa correcta y conservar la tarea.
5. Tamaño de fuente 100/150/200 % y máximo accesible; paisaje, pantalla ampliada y teclado abierto/cerrado. Registrar configuración original y restaurarla al finalizar. No juzgar por una captura a escala reducida.
6. TalkBack: ubicación actual, nombre/rol/estado de controles, orden de lectura, checkbox, capacidad sin anuncios duplicados, lector legal/regreso. Comprobar con persona, no declarar cumplimiento por tener Semantics.

Guardar solo imágenes de pantallas sintéticas ya estabilizadas:

```bash
export TASK12_PHYSICAL_DIR="$(mktemp -d /tmp/furgoplus-t12-a54.XXXXXX)"
adb -s "$TASK12_DEVICE_SERIAL" exec-out screencap -p \
  > "$TASK12_PHYSICAL_DIR/01-hoy-sintetico.png"
```

Repetir con nombres de paso/rol/escala propios. No capturar notificaciones, contraseñas, otras apps ni datos reales. Registrar quién revisó, fecha, modelo/Android, paquete/versión/hash, origen confirmado, escala, orientación y tarea. Añadir cada evidencia a la matriz sin convertir una subvista observada en aprobación de la fila completa.

## 6. Revisión humana y cierre del siguiente incremento

Para cada recorrido, preguntar sin enseñar antes: dónde está, qué importa, cuál es la acción y qué ocurrirá. Anotar confusiones, ayuda solicitada y respuesta literal; no inventar tiempos o porcentajes. Revisar atractivo/orden/coherencia junto a la tarea, y distinguir preferencia estética de un obstáculo observable.

Marcar por separado pruebas automáticas, render observado, revisión humana y aceptación con alcance. Resolver V01/V02/V03 mediante una propuesta revisada; mantener pendientes web/axe/A54/goldens hasta obtener sus evidencias. No hacer commit, push, merge o deploy como parte de este procedimiento.
