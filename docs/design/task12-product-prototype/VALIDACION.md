# Validación del prototipo y evidencia visual

**Estado de aceptación: pendiente de revisión humana.** Esta evidencia acredita navegación y comportamiento del HTML; no aprueba su composición ni los lotes operativos anteriores.

## Revisión responsive posterior

La evidencia de abajo corresponde a la revisión original, anterior a las correcciones responsive actuales. **No fue repetida en esta sesión.** La [matriz responsive](RESPONSIVE.md) registra el bloqueo de ejecución, los casos pendientes, la guía manual y la ausencia de capturas nuevas. No interpretar los 156 casos ni las 27 capturas históricos como comprobación de la versión actual.

## Resultado histórico

- **68 comprobaciones** de recorridos y estados, incluidas confirmaciones, cancelaciones, contacto entre roles, conflicto de cupos, revisión/publicación y recuperación.
- **156 combinaciones de pantalla/ancho**: 39 rutas representativas a 1440, 1280, 390 y 320 px. Un encabezado principal y sin desborde horizontal de página.
- **27 capturas finales**, comprobando también que el contenido Android no desborde horizontalmente. La tabla web estrecha y el comparador de tres servicios desplazan únicamente su propia área cuando hace falta.
- Sin errores JavaScript o de consola en la ejecución final. Solo lecturas de recursos del servidor local; ninguna petición de API, escritura de red o conexión externa.
- Apertura directa de `index.html` mediante `file://` comprobada en Chromium.
- Sintaxis de JavaScript y formato de los archivos propios verificados. Sin instalar paquetes.

Resultados detallados: [validation.json](evidence/validation.json), [captures.json](evidence/captures.json) y [preservación del árbol](evidence/preservation.json).

La herramienta Playwright del conector no tenía su distribución de Chrome disponible. Se utilizó Playwright y Chromium headless **ya instalados** en el equipo, con permiso de ejecución para el navegador y el servidor local. No se descargó un navegador ni se cambió el proyecto operativo.

## Qué se ejercitó

| Recorrido                 | Evidencia comprobada                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pasajeros                 | Búsqueda sin tilde fuera de la primera página, conflicto en ruta llena sin perder el formulario, asignación en otra ruta y actualización de cupos.                                  |
| Pagos                     | Distinción manual/banco en confirmación, cancelación sin cambio, confirmación de estado y navegación de registros filtrados.                                                        |
| Preparación y publicación | Documento → envío → aprobación administrativa → plan vigente → solicitud explícita de publicación. Aprobar por sí solo no publica ni activa un plan.                                |
| Administración            | Cambio de cuenta con motivo sobre el conductor seleccionado y estado separado de otros registros.                                                                                   |
| Hoy Android               | Inicio, cancelar finalización, confirmar finalización; bloqueo de nueva acción ante resultado incierto y recuperación por consulta.                                                 |
| Apoderado                 | Comparación de dos servicios, contacto con consentimiento, aceptación desde conductor, correo visible después y pasajero sin asignación automática; control de solicitud existente. |
| Soporte                   | Creación, lectura y respuesta desde administración conservando ambos lados del hilo.                                                                                                |
| Estados                   | Normal, pendiente, vacío, error, volumen, carga e incierto en seis destinos representativos; error sin totales inventados y reintento.                                              |
| Navegación                | Destinos de ambos roles principales web y Android, acceso, apoderado web, regreso y enlaces de detalle.                                                                             |

## Galería

Abre **[la galería completa](gallery.html)** para comparar las 27 capturas. También puedes abrir estas directamente:

| Web                                                                              | Android                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Inicio](evidence/web-inicio-1440.png)                                           | [Hoy conductor](evidence/android-hoy-390.png)                     |
| [Mi servicio](evidence/web-mi-servicio-1440.png)                                 | [Pasajeros](evidence/android-pasajeros-390.png)                   |
| [Pasajeros con volumen](evidence/web-pasajeros-muchos-1280.png)                  | [Mi plan](evidence/android-plan-390.png)                          |
| [Pagos](evidence/web-pagos-1440.png)                                             | [Buscar con resultados](evidence/android-buscar-412.png)          |
| [Confirmación manual](evidence/web-confirmar-pago-1280.png)                      | [Detalle del servicio](evidence/android-servicio-390.png)         |
| [Solicitudes](evidence/web-solicitudes-1440.png)                                 | [Solicitar contacto](evidence/android-contacto-390.png)           |
| [Plan y reportes](evidence/web-plan-reportes-1440.png)                           | [Comparar dos](evidence/android-comparar-390.png)                 |
| [Expediente y decisión](evidence/web-expediente-1440.png)                        | [Comparar tres a 320 px](evidence/android-comparar-tres-320.png)  |
| [Soporte y críticos](evidence/web-soporte-criticos-1440.png)                     | [Resultado incierto](evidence/android-estado-incierto-390.png)    |
| [Vacío](evidence/web-pagos-vacio-1280.png), [error](evidence/web-error-1280.png) | [Solicitudes del apoderado](evidence/android-solicitudes-390.png) |

Las capturas corresponden al prototipo. El expediente muestra la preparación de un nuevo envío pendiente mediante datos de memoria; `captures.json` registra ese ajuste como `setup: review`. Buscar y comparación también registran su preparación. Los controles superiores pertenecen a la revisión y no al producto.

## Revisión 21st

Se ejecutó `21st review` local 1.18.0 sobre HTML, JavaScript y CSS: **0 errores, 0 advertencias, 41 sugerencias informativas** por literales de color. Se revisaron como definiciones de tokens compartidos o colores del marco de revisión. No se sustituyeron por tokens de la aplicación porque el prototipo debe permanecer aislado. [Resultado completo](evidence/21st-review.json).

Es una revisión determinista del código, no una evaluación visual humana ni una generación de 21st. Las referencias del catálogo se describen en [README.md](README.md).

## Reproducir la comprobación

`evidence/verify.cjs` conserva el guion de navegador utilizado. Requiere Node, Playwright y Chromium disponibles **solo como herramientas de revisión**, fuera de las dependencias operativas. Con el servidor local de README activo:

```bash
FURGOPLUS_PLAYWRIGHT=/ruta/al/modulo/playwright FURGOPLUS_CHROMIUM=/ruta/al/chromium node docs/design/task12-product-prototype/evidence/verify.cjs
```

Si Playwright y su navegador ya se resuelven de forma predeterminada, basta ejecutar el archivo con Node. El guion recorre únicamente el prototipo en `127.0.0.1:8768` y su `index.html` local; regenera JSON y capturas en esta carpeta. No utiliza la aplicación operativa.

## Límites y revisión pendiente

No se ejecutaron las suites React/Flutter: no hay cambios en esos productos. Los resultados anteriores de 344 React y 182 Flutter son antecedentes del usuario, no pruebas repetidas en esta entrega.

No se generó APK, build React o instalación Android. El HTML no acredita TalkBack, Samsung A54, fuente/escalado nativo, teclado o Atrás del sistema. No prueba paginación de servidor, autorización, versiones, disponibilidad o cálculo completo de capacidad futura.

Las capturas fueron inspeccionadas para ajustar densidad, el caso con muchas rutas, la comparación móvil, la confirmación de pago y la cercanía entre documento y decisión. La decisión final de experiencia y composición corresponde al guion humano de [GUIA.md](GUIA.md).

**No se implementa el diseño al terminar esta revisión.**
