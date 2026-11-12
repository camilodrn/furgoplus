# Revisión responsive del prototipo integral

Estado actual (28-10-2026): la ejecución real en Fedora produjo **443 casos: 377 con comprobación automática satisfactoria, 66 fallidos y 24 capturas**. Las causas de los 66 se diagnosticaron y corrigieron de forma acotada; la reejecución quedó bloqueada por el sandbox. Ver [diagnóstico, correcciones, inventario completo y validación pendiente](CORRECCIONES_RESPONSIVE.md). El informe real de Fedora se conserva intacto en `evidence/responsive/results.json` y en `results-fedora-before-fixes.json`. No hay resultados nuevos de navegador.

## Registro histórico anterior a la ejecución en Fedora

El contenido siguiente describe la revisión estática anterior. Sus menciones a 0 casos ejecutados, capturas pendientes y matriz pendiente corresponden a esa etapa; el estado vigente está en el documento enlazado arriba.

**Estado: correcciones de código aplicadas; verificación visual y aceptación humana pendientes.** No autoriza implementación. Se conserva la dirección A · Panel operativo + filas/divisores B.

La revisión de esta sesión es **estática**, con dos intentos de ejecución documentados: Playwright local encuentra Chromium pero el sandbox impide iniciarlo (`sandbox_host_linux.cc`, `Operation not permitted`); el conector Playwright exige una aprobación que la política de esta sesión no permite. No se solicitaron permisos adicionales ni se alteró el sandbox. El guion final también registra ese bloqueo. **0 de 443 casos de navegador ejecutados y 0 capturas nuevas.** «Pendiente» no significa aprobado.

## Matriz de tamaños, pantallas y resultados

Anchos en píxeles CSS; altura de referencia 844 para anchos menores que 768 y 1000 para los restantes. En Android, hasta 960 px el prototipo ocupa el ancho disponible; en escritorio muestra su marco de referencia de 412 px junto a la guía. Así, 1280/1440/1920 prueban el contenedor de revisión, no una aplicación Android de esos anchos.

**P = pendiente de ejecutar en navegador después de las correcciones.** Se inspeccionaron las reglas de composición y el marcado de las pantallas de estas filas; no se certifican ausencia de desbordes, superposición ni accesibilidad por esta inspección.

| Plataforma / rol y pantallas                                                              | 320 | 360 | 390 | 430 | 768 | 1024 | 1280 | 1440 | 1920 |
| ----------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | ---- | ---- | ---- | ---- |
| Web conductor: Inicio, Mi servicio, Datos, Documentos, Rutas                              | P   | P   | P   | P   | P   | P    | P    | P    | P    |
| Web conductor: Pasajeros, Pagos, Solicitudes, Plan/reportes, Ayuda                        | P   | P   | P   | P   | P   | P    | P    | P    | P    |
| Web administración: Validaciones, Expediente, Conductores, Gestión, Soporte               | P   | P   | P   | P   | P   | P    | P    | P    | P    |
| Android conductor: Hoy, Recorrido, Pasajeros, Plan, Cuenta                                | P   | P   | P   | P   | P   | P    | P    | P    | P    |
| Android apoderado: Buscar/resultados, Servicio, Comparar 3, Contacto, Solicitudes, Cuenta | P   | P   | P   | P   | P   | P    | P    | P    | P    |
| Acceso: registro Android e ingreso web                                                    | P   | P   | P   | P   | P   | P    | P    | P    | P    |

[Resultados detallados por caso](evidence/responsive/results.json): 252 combinaciones principales, 80 intermedias, 15 en paisaje, 48 de estados, 18 con texto al 200%, 12 aproximaciones de reflujo por zoom, 12 diálogos y 6 de navegación; **443 previstas, todas pendientes**. El JSON conserva el error de arranque, sin adjudicar fallos de interfaz a casos que no se ejecutaron.

| Cobertura adicional | Dimensiones o condiciones previstas                                                                                                          | Resultado actual                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Fluidez             | 450, 451, 600, 759, 760, 761, 767, 769, 959, 960, 961, 999, 1000, 1001, 1023, 1025, 1250, 1251, 1599 y 1600; además arrastre continuo manual | Reglas revisadas; ejecución pendiente                                      |
| Paisaje móvil       | 568 × 320, 844 × 390, 932 × 430; los cuatro roles representativos y Contacto                                                                 | Flujo para poca altura corregido; pendiente                                |
| Texto               | Fuente raíz al 200% en 320, 768 y 1440                                                                                                       | Unidades relativas aplicadas; pendiente                                    |
| Zoom                | 640/720/960 × 500 aproximan espacio CSS de escritorio a 200%; **no son zoom real**                                                           | Zoom real 100/125/150/175/200% pendiente manual                            |
| Teclado / diálogos  | Alturas reducidas 480/320; agregar pasajero, soporte, plan administrativo, confirmación de salida                                            | Viewport visual y scroll ajustados; teclado real pendiente                 |
| Estados             | Vacío, carga, error, muchos en Pasajeros web, Validaciones, Hoy y Buscar; a 320/768/1440                                                     | Sin ejecutar; no todos los destinos tienen el mismo estado vacío funcional |
| Volumen             | Arrays de muestra existentes; 12 rutas, más de cien asignaciones, colas ampliadas, paginación de 5/10/20                                     | Es la muestra local, no una prueba de escalabilidad                        |
| Cupos               | Texto, valor y barra por ruta, ruta llena y con disponibilidad; ancho y alto del medidor                                                     | Reglas revisadas; visibilidad y proporción pendientes                      |

## Defectos corregidos en el código

Las causas siguientes se comprobaron en el código anterior. La eficacia visual de la corrección sigue pendiente de prueba en navegador.

| Defecto / riesgo concreto                                                                                                          | Corrección acotada                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablas estrechas retenían `min-width: 600px`, con datos y acciones fuera de la primera vista horizontal                            | Una sola tabla semántica con etiquetas de columna por celda; por debajo de 42rem de **su contenedor** cada registro se presenta en bloques. Por encima conserva filas compactas. No se duplican registros ni acciones.                                                                       |
| Marco Android de 412 × 850/866 px, mínimo 600 px en ciertos tamaños; a 451–760 y en paisaje podía superar la altura disponible     | Ancho fluido en móvil/tablet, altura del viewport visual y contenido central desplazable. Con altura disponible ≤512 px se usa flujo de documento, incluida navegación inferior, para que el marco no consuma toda el área útil. El máximo 866 px solo conserva la referencia de escritorio. |
| Barra de revisión y sidebar asumían offsets 49/52 px pese a cambios de altura                                                      | `ResizeObserver` mide la barra y actualiza el desplazamiento y alto de la navegación. La barra permite scroll propio visible y conserva Reiniciar.                                                                                                                                           |
| Tablet de 768 px mantenía sidebar y composición estrecha; menú móvil carecía de cierre propio y control de foco                    | Menú compacto hasta 48rem, cierre visible, Escape, retorno y contención de foco, fondo inerte; al pasar a escritorio se limpia el estado.                                                                                                                                                    |
| Botones compactos/paginador de 40 px y desplegables de 36–40 px                                                                    | Mínimo de 44 px en controles correspondientes; los checkbox mantienen icono de 20 px dentro de su etiqueta táctil de al menos 44 px. No se aumenta el icono decorativo.                                                                                                                      |
| Tipografía fija en px ignoraba el tamaño de fuente predeterminado del navegador                                                    | Fuente raíz 100% y tamaños en rem, incluidos los literales del HTML generado; tamaños iniciales equivalentes a 16 px de base.                                                                                                                                                                |
| Encabezados, métricas, filas de documentos, formularios, paginadores y resultados dependían de una sola fila o mínimos intrínsecos | Envoltura de acciones, columnas con mínimo 0, métricas según espacio, filtros/formularios acotados al contenedor y saltos de cadenas largas. Los cupos conservan barra y cifras.                                                                                                             |
| Comparador de tres columnas fijas de 180 px no acompañaba texto ampliado; dos columnas podían quedar demasiado estrechas           | Mínimos relativos al texto y scroll únicamente en el comparador; región enfocable con nombre y aviso de deslizamiento. La franja de selección deja de superponerse al contenido.                                                                                                             |
| Diálogos y contenido Android no contemplaban altura de teclado ni viewport visual                                                  | `interactive-widget=resizes-content`, medidas de `visualViewport`, diálogo desplazable acotado y acercamiento del campo enfocado al reducirse el área. Sin pies fijos que tapen el formulario.                                                                                               |

Código: [responsive.css](responsive.css), [prototype.css](prototype.css), [prototype.js](prototype.js) e [index.html](index.html). No se cambiaron los datos de muestra, acciones de dominio, colores, marca ni destinos del producto.

## Capturas comparables

**No se pudieron producir capturas posteriores a las correcciones.** Las [27 capturas anteriores](gallery.html) son históricas; sus resultados no validan esta revisión. No se copiaron ni renombraron como nuevas.

El [guion responsive](evidence/responsive/audit.cjs) prepara 24 capturas: cuatro pantallas en 320 × 844, 390 × 844, 768 × 1000, 1440 × 1000 y 1920 × 1000, más paisaje de Contacto, diálogo estrecho, expediente con texto 200% y comparador de tres a 320. Escribe cada PNG con su dimensión y genera `evidence/responsive/gallery.html` **solo si llega a ejecutarse**. Esa galería aún no existe.

| Pantalla comparable            | Referencia anterior                                                     | Nueva serie                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pasajeros conductor web        | [1440 × 1000](evidence/web-pasajeros-1440.png)                          | Pendiente: 320, 390, 768, 1440, 1920                                                                               |
| Validaciones administrador web | [1440 × 1000, escenario pendientes](evidence/web-validaciones-1440.png) | Pendiente: mismos cinco anchos; usar también `estado=pendiente` para comparación idéntica con la captura histórica |
| Hoy conductor Android          | [390 × 844](evidence/android-hoy-390.png)                               | Pendiente: mismos cinco anchos; a 1440/1920 se muestra marco de 412 px                                             |
| Buscar apoderado Android       | [Marco 412, viewport 1080 × 1000](evidence/android-buscar-412.png)      | Pendiente: mismos cinco anchos, con resultados; capturar también 1080 × 1000 si se compara con esa referencia      |

Para captura manual, usar zoom 100%, escala del dispositivo 1, la misma dimensión CSS, escenario y estado inicial. Guardar la vista inicial y, si el contenido continúa, otra al final; en Android la captura completa de página no incluye por sí sola todo el scroll interno. Conservar las dos series sin estirar imágenes y registrar navegador, sistema, fuente y zoom.

## Guía manual necesaria antes de aceptar

1. Abrir `index.html` o el servidor estático del README. En herramientas del navegador fijar cada dimensión de la matriz, zoom 100% y el mismo escenario. Recorrer las 28 pantallas del JSON y registrar fecha, navegador, dimensión, estado, resultado y archivo de captura. Redimensionar **sin recargar** entre 320 y 1920: no basta con comprobar los extremos. Revisar especialmente ambos lados de 768, 960 y 1024.
2. En Pasajeros, Pagos, Validaciones y Conductores, comprobar lectura y acción de todos los campos en la presentación móvil y filas compactas en escritorio. Confirmar que la página no se desplace horizontalmente. Solo comparador, tira de rutas y pestañas/barra de revisión pueden desplazar su propio contenido cuando no cabe; se deben poder manejar con teclado/tacto. Llegar a la última ruta con escenario Muchos, alternar páginas y tamaños 5/10/20, buscar un registro de la última página y limpiar filtros.
3. En 320/360/390/430 comprobar campos de fecha, mes, selectores y textos largos. Usar únicamente datos sintéticos: nombre largo con espacios y correo o palabra sin espacios de 80 caracteres. Verificar que el dato siga disponible completo en detalles y que no empuje botones fuera del panel.
4. Revisar todas las barras de cupos: la pista, el relleno proporcional, ocupados/capacidad, ruta y estado lleno deben conservarse al cambiar ancho, orientación y fuente. No interpretar las barras como asientos físicos ni sumar capacidad de rutas diferentes.
5. Abrir el menú web en móvil y 768: Tab/Shift+Tab quedan dentro, Escape y Cerrar menú devuelven foco, todos los destinos y Cerrar sesión son alcanzables. Cambiar a escritorio con el menú abierto: no debe quedar fondo inerte ni scroll bloqueado. Android: probar destinos inferiores, avatar, Volver y última acción de cada pantalla.
6. En un teléfono real probar Agregar pasajero, soporte, edición de plan, contacto del apoderado y edición de nombre. Enfocar primer/último campo, abrir teclado, escribir, provocar validación, desplazar hasta Guardar/Enviar y Cancelar, cerrar y volver a abrir teclado. Probar retrato y paisaje. El campo, error y acción deben poder alcanzarse sin perder el borrador; cerrar diálogo con botón y Atrás cuando corresponda. Altura reducida en escritorio **no prueba un teclado real**.
7. En escritorio probar zoom **real** del navegador 100, 125, 150, 175 y 200%, anotando el ancho CSS efectivo. A 1280/1440/1920 comprobar reflujo, navegación, diálogos y acciones. En Firefox repetir «Solo ampliar texto» hasta 200%; repetir con fuente predeterminada 32 px y luego restaurarla. La modificación de la fuente raíz del guion es una aproximación adicional, no sustituye estas pruebas.
8. Seleccionar Vacío, Carga, Error y Muchos en las cuatro pantallas representativas. Confirmar mensaje completo, acción de recuperación visible, sin cifras recortadas o superpuestas y sin convertir un error en totales cero. Revisar resultado incierto en Hoy y expediente con observación/comentario largo. El escenario de carga es una muestra detenida; no mide red.
9. Medir área interactiva con el inspector: al menos 44 × 44 px para botones, enlaces de navegación, paginadores, desplegables y etiquetas táctiles. Los enlaces incrustados en prosa necesitan evaluación contextual. Revisar foco visible y lector de pantalla sobre tabla refluida: etiqueta, valor, orden y acción sin duplicación confusa.
10. Capturar dimensiones representativas, partes finales y defectos encontrados. Anotar explícitamente pendientes. La aprobación exige inspección humana y resolver cualquier caso fallido; ninguna marca automática sustituye esa decisión.

## Reproducir la automatización cuando el navegador esté permitido

Sin instalar dependencias del producto:

```bash
FURGOPLUS_PLAYWRIGHT=/ruta/al/modulo/playwright \
FURGOPLUS_CHROMIUM=/ruta/al/chromium \
node docs/design/task12-product-prototype/evidence/responsive/audit.cjs
```

Usa `file://` y solo lee recursos del prototipo; escribe JSON, PNG y galería dentro de `evidence/responsive/`. No toca servidor operativo ni necesita levantar contenedores. El informe comprueba desborde de página/contenido Android, controles seleccionados, medidores, campos, etiquetas de tabla, menú/foco y errores de consola. No detecta toda superposición visual ni prueba todos los recorridos funcionales. Revisar cualquier fallo antes de aceptar.

La ejecución de esta sesión está [registrada como bloqueada](evidence/responsive/results.json). También se comprobó sintaxis JavaScript, análisis CSS y formato. [21st](evidence/responsive/21st-review.json) es un análisis estático, no evidencia de ejecución responsive.

## Riesgos al trasladar a React y Flutter

| Área                    | Comprobación necesaria después de una autorización de implementación                                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React                   | Reproducir adaptación por **ancho de componente**, tabla/lista semántica y navegación sin duplicar controles, identificadores o manejadores. Mantener foco y scroll tras renders reales y al abrir/cerrar diálogos. Validar container queries, `inert`, `dvh`, `ResizeObserver` y `visualViewport` en navegadores soportados. |
| Flutter                 | Usar restricciones reales (`LayoutBuilder`), escalado de texto (`TextScaler`), `SafeArea`, insets del teclado, pantallas desplazables y navegación nativa; no copiar las alturas ni el marco HTML. Validar TalkBack, Atrás, recortes de pantalla, barras del sistema y Samsung A54 físico.                                    |
| Texto y zoom            | Rem en HTML no equivale al escalado tipográfico Android. Probar fuente grande, negrita/accesibilidad y escala de pantalla; zoom real y solo texto en navegadores admitidos.                                                                                                                                                   |
| Formularios / teclado   | Selectores nativos de fecha/mes, teclado IME, validación del servidor, errores largos y foco pueden cambiar el espacio útil. Preservar borradores y acceso a acciones, también con teclado en paisaje.                                                                                                                        |
| Registros y rendimiento | La muestra no certifica cientos/miles de filas reales, latencia, virtualización, paginación del servidor ni orden de foco con listas recicladas. No cambiar datos, contratos o paginación para copiar el prototipo.                                                                                                           |
| Estados / cupos         | Mantener estados de red reales y API como autoridad de capacidad, fechas y permisos. Cupos con nombres y cifras extensos, actualizaciones simultáneas y estados vacíos reales requieren nueva evidencia.                                                                                                                      |
| Lectores de pantalla    | Los roles explícitos mantienen intención semántica al refluir tablas, pero su anuncio debe probarse en NVDA/VoiceOver/TalkBack. El HTML no valida la semántica Flutter.                                                                                                                                                       |

La [preservación de archivos ajenos al prototipo](evidence/responsive/preservation.json) documenta el alcance de esta sesión. Sin cambios operativos, contenedores, datos, contratos, commits, push, merge ni deploy. **Trabajo detenido en el prototipo, pendiente de verificación visual y aceptación humana antes de cualquier implementación.**
