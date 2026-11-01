# FurgoPlus · Prototipo de experiencia WEB + ANDROID

Diseño para revisión humana del **4 de noviembre de 2026**. Dirección **A · Panel operativo + filas y divisores de B**. No es una implementación del producto ni una aceptación visual de los lotes anteriores.

## Revisión responsive actual

Correcciones acotadas al prototipo aplicadas; validación de navegador y aceptación humana pendientes por bloqueo de Playwright en esta sesión. Consulta [matriz, defectos, guía manual y riesgos](RESPONSIVE.md). Las 27 capturas originales son históricas; no acreditan estos cambios.

## Abrir y recorrer

Abre **[index.html](index.html)** en el navegador. Funciona directamente desde el archivo, sin instalar dependencias y sin conexión a la aplicación. Conserva juntos HTML, CSS, JavaScript y `assets/`.

También puede servirse desde la raíz del repositorio:

```bash
python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/design/task12-product-prototype
```

Después abre [el prototipo local](http://127.0.0.1:8768/). Ese servidor solo entrega archivos de esta carpeta. No es un deploy.

La barra azul oscura superior pertenece a la revisión: cambia plataforma, rol y escenario. **Guía** abre los recorridos sugeridos. En teléfono, desliza esa barra si un control queda fuera de la vista. La barra conserva sus controles y tiene desplazamiento propio. La navegación del producto aparece debajo, en lateral web o barra inferior Android.

- [Guía sencilla y pauta de aceptación](GUIA.md).
- [Correspondencia con componentes reales y límites de simulación](CORRESPONDENCIA.md).
- [Validación y galería de capturas](VALIDACION.md).
- [Estado del árbol antes de empezar](git-status-before.txt) y [huellas de los archivos existentes](baseline.json).

## Qué se puede revisar

| Entrada                                                                                      | Experiencia                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Web conductor](index.html#web/conductor/inicio)                                             | Inicio, Mi servicio, datos, documentos, revisión e historial, Publicación, Rutas y editor, Pasajeros y asignaciones, Solicitudes, Pagos, Plan y reportes, guías y soporte.         |
| [Web administración](index.html#web/administrador/validaciones)                              | Cola y expediente de validación, comentario y decisión, conductores, cambios de cuenta y plan con motivo, historial y soporte. No se inventa un inicio administrativo de métricas. |
| [Android conductor](index.html#android/conductor/hoy)                                        | Hoy, selección de recorrido, información y mapas simulados, búsqueda y páginas de pasajeros, contacto bajo demanda, iniciar/finalizar, Mi plan, Ayuda, cuenta y acceso legal.      |
| [Android apoderado](index.html#android/apoderado/buscar)                                     | Buscar por comuna, resultados, comparación de 2–3 servicios, detalle, reseñas de muestra, consentimiento de contacto, solicitudes, cuenta y edición del nombre, Ayuda.             |
| [Web apoderado](index.html#web/apoderado/inicio)                                             | Entrada que dirige a Android y acceso a Ayuda, acorde al alcance actual.                                                                                                           |
| [Acceso web](index.html#web/acceso/ingresar) / [Android](index.html#android/acceso/ingresar) | Ingreso y registro de apoderado de muestra, mostrar contraseña y salida. No existe autenticación real en el prototipo.                                                             |

## Decisiones de composición

**Resumen primero → acción principal → detalles bajo demanda.** Azul `#0752ac`, tipografía del sistema, superficies blancas, fondo `#f5f7fb`, radio de 12 px, estados con texto y color. Sin animaciones decorativas ni fuentes remotas.

Inicio prioriza trabajo por resolver y operación. Mi servicio usa documentos y datos en dos áreas. Pasajeros sitúa los cupos junto al listado para evitar recorrer primero todas las rutas. Pagos separa el resumen global de los resultados filtrados. Solicitudes usa bandeja y mensaje. Validaciones combina cola, expediente y decisión. Los formularios se abren para una tarea concreta, con confirmaciones separadas donde corresponde.

Android usa una composición propia: AppBar, barra inferior, un contenido central desplazable y controles táctiles. En paisaje o con muy poca altura disponible, el contenido y la navegación pasan al flujo de documento para conservar acceso a toda la información. Hoy destaca recorrido, hora y acción. La información del recorrido y el manifiesto tienen destinos propios. La comparación de tres servicios permite deslizamiento horizontal dentro del comparador; no desplaza horizontalmente toda la app. Es una representación HTML de diseño, no un emulador Flutter.

## Datos y estados

Datos exclusivamente sintéticos, fecha de referencia **04-11-2026**, correos `example.test` y teléfono ficticio `+56 9 0000 0000`. Normal: 3 rutas, 24 asignaciones vigentes y dos registros fuera de la fecha de servicio; 24 pagos manuales, con montos derivados del listado. Muchos registros: 12 rutas y más de cien asignaciones, 38 contactos y colas administrativas mayores. No se suman cupos de distintas rutas como si fueran un único vehículo.

Los cambios viven en memoria y se comparten entre las entradas de la **misma pestaña**. Cambiar de escenario, recargar o pulsar Reiniciar restablece el ejemplo. Cada enlace identifica plataforma, rol, pantalla y escenario; no guarda las acciones previas.

El selector incluye normal, pendientes, vacío, error, muchos registros, carga y resultado incierto. Este último afecta la operación Hoy. No todos los estados tienen significado en todos los destinos. La guía indica dónde revisarlos.

No hay `fetch`, almacenamiento persistente, analítica, APIs, cookies de sesión ni escrituras de red. La política CSP bloquea conexiones y envío nativo de formularios. El logo es una copia del recurso de marca existente. Documentos, mapas, ingreso y descargas se simulan de forma explícita.

## Fuentes y referencias

Se revisaron [el sistema compartido](../../TASK12_SHARED_VISUAL_SYSTEM.md), [la matriz](../../TASK12_VISUAL_ROLLOUT_MATRIX.md), [el lote de recuperación](../../TASK12_RECOVERY_PASSENGERS_PAYMENTS.md), [la exploración A/B/C](../task12-mi-servicio/README.md), `.21st/design.json`, `.21st/DESIGN.md`, los componentes React y Dart indicados en la correspondencia y las capturas anteriores de Pasajeros y Flutter. Las capturas Flutter anteriores son históricas; el código actual se tomó como referencia funcional.

21st: consulta de metadatos de [Data Table de wensity](https://21st.dev/@wensity/components/data-table), [Table 05](https://21st.dev/@ephraimduncan/components/table-05), [Table Pagination](https://21st.dev/@shadcnui-blocks/components/pagination-14) y [Task List Card](https://21st.dev/@tailwind-admin/components/task-list). Aportan organización de filas, filtros, páginas y tareas. No se recuperó código, instaló un componente ni ejecutó generación alojada. Se aplicó el contexto del flujo `21st-ui-build` a un HTML aislado por la restricción expresa de este encargo; la dirección A + B ya estaba elegida.

## Alcance de la entrega

Todos los archivos creados están dentro de esta carpeta. Se conservaron React, Flutter, backend, contratos, documentos anteriores y cambios del árbol inicial. No se accedió a datos académicos, volúmenes ni contenedores. Task 13, Task 14 y demo r4 permanecen fuera del trabajo. Sin commit, push, merge o deploy.

**Entrega detenida en el prototipo para revisión humana. No se implementó el diseño en la aplicación.**
