# T12 · C7 en el APK real del Samsung A54

31-10-2026. **APK actualizado y C7 comprobada físicamente en el alcance descrito.** El A54 queda en Pasajeros con la sesión del conductor conservada. Este resultado sustituye el pendiente de instalación del cierre anterior, sin aprobar automáticamente el resto de FurgoPlus.

[Antes/después auténtico](evidence/task12-c7-c8/index.html) · [Procedencia](evidence/task12-c7-c8/manifest.json) · [Código](evidence/task12-c7-c8/source-hashes.json) · [Registro instalado](evidence/task12-c7-c8/checks/installed.json).

## Identidad y actualización

- Dispositivo: Samsung SM-A546E, Android 16, ADB conectado/autorizado. Se utilizó `furgoplus-t12-ready`: Django saludable, socat existente y `adb reverse` activo. El 404 en la raíz Django no se confundió con un fallo de salud; los endpoints de la aplicación respondieron.
- Paquete exclusivo: `com.example.furgoplus.task12`. Versión nominal **0.1.0+1**, sin incremento de número: el SHA-256 identifica inequívocamente esta actualización.
- APK anterior: `b957d8a625b8a538cae8c83f801063d62693e5356d41ea70c1c0eb11205956da`.
- Primera actualización del cierre anterior: `42e2871877fc5de1dc10af011e3403a386dfe85755cdc09a1e47a735a4868049`. Se instaló e inspeccionó antes de decidir el pulido adicional. No se presenta como APK final.
- **APK final instalado: `ecf88f06d3846d97196518051cb86169d6fdaa69231d59e3d34d877ae01b6ed1`.**
- Firma anterior/final idéntica: certificado SHA-256 `5faa6cdb7e6554cfd6dcce7cd3739c216406535bbdcb1d4332f40decb748467a`. Antes de instalar se verificaron paquete y certificado. Se aplicó `install -r --no-streaming`; no hubo desinstalación, borrado de datos ni sustitución de otra variante.
- El hash de la APK realmente instalada se leyó en el dispositivo y coincide con el archivo compilado. El aviso de privacidad empaquetado coincide byte por byte con la fuente v0.2. Los hashes de Dart se verificaron de nuevo al generar evidencia.

Compilación debug arm64 con el SDK existente y exactamente estos parámetros académicos:

```text
API_BASE_URL=http://127.0.0.1:18082
ALLOW_HTTP_API=true
FURGOPLUS_SYNTHETIC_DATA=true
```

El indicador sintético no concede permisos. En el A54 se vieron los datos de ensayo y Mapas deshabilitado; no se abrió un proveedor externo. El APK local está en `mobile/build/app/outputs/flutter-apk/app-debug.apk`; no se añadió el binario al repositorio.

## Qué se corrigió y qué se observó

| Problema anterior | Resultado físico del APK final |
|---|---|
| Pasajeros / Pasajeros del recorrido repetidos | Un título de destino en la barra; la superficie inicial identifica recorrido, horario y fecha. |
| Lista plana sin composición | Identidad con icono de persona, nombre destacado, recogida secundaria con icono de ubicación y divisores dentro de una superficie continua. No hay una tarjeta decorativa por pasajero. |
| Ocupación demasiado alta | Resumen compacto con los **3/4 cupos** de la API y disponibilidad textual, sin otra cabecera redundante. |
| Apoderado como líneas sueltas | Grupo diferenciado dentro de la expansión: icono de contacto, etiqueta, nombre destacado y contacto autorizado. Cerrado no expone teléfono. |
| «3 pasajeros» repetido al final | Eliminado en lista corta sin filtro. Se conserva el contador útil de resultados al buscar y el rango cuando hay paginación. |
| Pantallas equivalentes inconsistentes | Detalle React agrupa Recogida y Apoderado en bloques con etiquetas y conserva el enlace telefónico existente. Recorrido, Hoy, Cuenta y lector legal nativos se revisaron sin rediseñar otras tareas correctas. |

Comprobaciones auténticas sobre datos ficticios existentes:

1. Sesión restaurada después de actualizar, sin volver a introducir credenciales.
2. Lista completa de tres pasajeros, contacto oculto inicialmente y sin contador final repetido.
3. Expansión del primer pasajero: apoderado y teléfono ficticio disponibles en el grupo autorizado.
4. Búsqueda **«elite 2»**: solo el segundo pasajero y «1 resultado». La consulta inicial «2» coincidía también con el apoderado T12; se usó una búsqueda inequívoca, sin tratar ese resultado legítimo como defecto.
5. Limpiar búsqueda restaura las tres filas. Android Atrás oculta primero el teclado cuando está abierto y después vuelve a Hoy, sin iniciar ni finalizar servicios.
6. Información del recorrido, Cuenta sin título duplicado y Privacidad v0.2 abiertos; regreso conserva el destino pertinente. Se dejó finalmente Pasajeros visible.

Las capturas antes/después pertenecen a APK auténticos, al mismo A54 y a los mismos registros de ensayo. Los renders sintéticos anteriores conservan su etiqueta histórica y no se utilizan como después físico de esta entrega. El agente inspeccionó las imágenes; no se afirma aprobación humana del conductor.

## Cuatro dimensiones y pruebas

- **Funcionalidad:** búsqueda, expansión, datos autorizados, limpieza y Android Atrás comprobados; paginación de diez, fronteras de sesión y permisos conservados en pruebas.
- **Facilidad:** recorrido/capacidad antes de la búsqueda; identidad y parada reconocibles; contacto bajo demanda. Juicio favorable del agente en este recorrido.
- **Calidad visual:** diferencia real frente al APK anterior, con jerarquía, agrupación y uso consistente del espacio. La valoración no se reduce a legibilidad o tests.
- **Consistencia:** `FurgoSurface`, `FurgoCapacity`, Material 3 y azul existentes. El cambio web utiliza los componentes e iconos ya instalados. No se alteraron contratos ni se inventó asistencia, GPS, ETA, reserva o métricas.

**Flutter 213/213** en la regresión final y análisis sin incidencias. Se mantuvo el test de un único desplazamiento vertical: detectó que `SelectableText` creaba otro desplazamiento y se volvió al texto simple original. No se relajó esa expectativa. Se actualizaron solo las expectativas editoriales de «1 resultado» y del final de Privacidad v0.2. **React 397/397** y comprobaciones de tipos/lint/contratos/build aprobadas; los cambios finales del pie legal también pasaron su grupo dirigido de 7 pruebas.

Quedan pendientes TalkBack hablado y barrido físico completo de orientación/texto 200 %. El A54 conservó su escala 1.1; los casos 320/390 y texto 2.0 se probaron automáticamente. No se modificaron ajustes del dispositivo para fotografiar un resultado.

Se verificaron los alcances de D03/D04/D05/D10 y W19 con evidencia nueva; la matriz histórica de 99 filas queda en **34 migradas verificadas, 5 conservadas verificadas y 60 con alguna comprobación pendiente**. Las etiquetas indican alcance de evidencia, no aprobación integral. P03/F02/F03 ya están dentro del APK actualizado, pero siguen pendientes de observación física propia; W31 mantiene pendiente su tabla expandida.

No hubo cambios de backend, datos de negocio, infraestructura, contenedores, frameworks ni dependencias. Se preservó el trabajo T12 previo, sin commit, push, merge o deploy.
