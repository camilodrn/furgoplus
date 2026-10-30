# Task 13 · Transparencia de precios

> Informe histórico. La clasificación de capacidades de planes fue corregida el 28 de octubre de 2026; consultar [CONTENT_REVIEW.md](CONTENT_REVIEW.md) y [ACCEPTANCE_FEDORA.md](ACCEPTANCE_FEDORA.md) para el estado vigente.


Alcance: componente `Pricing`, sus estilos, fuente de precios/impuesto y pruebas. No se modifican Task 12, backend, suscripciones ni base de datos. Sin commit, push, merge o deploy.

`src/content/plans.ts` conserva los precios finales académicos y define el IVA del 19 %. El neto se redondea con `Math.round(total / 1.19)` y el IVA es `total - neto`. No se redondean ambos valores de forma independiente.

| Plan   | Total mensual CLP | Neto CLP | IVA CLP |
| ------ | ----------------: | -------: | ------: |
| Básico |           $19.990 |  $16.798 |  $3.192 |
| Pro    |           $39.990 |  $33.605 |  $6.385 |
| Elite  |           $69.990 |  $58.815 | $11.175 |

La vista predeterminada muestra el total con IVA incluido. En la otra vista, el total mantiene su posición y tamaño; el neto y el IVA se añaden debajo como desglose. El selector segmentado «IVA incluido / Desglose» se integra a la derecha del encabezado, sin radios visibles, título ni párrafo adicional. Una única nota académica junto a las tarjetas conserva el aviso de contratación no habilitada y se asocia a cada tarjeta y al selector. La etiqueta del total queda disponible para lectores de pantalla, sin añadir altura sobre el precio original. No hay precio tachado, descuento ni CTA de compra.

## Verificación ejecutada

Desde `landing/`:

```bash
npm run test:pricing
npm run build
npm run verify
npm run test:interactions
```

Estas comprobaciones pasaron: cálculos exactos de los tres planes, casos de redondeo al alza y a la baja, suma de neto e IVA igual al total para importes de 0 a 100.000 pesos, formato CLP, vista inicial, hidratación, cambios de vista repetidos, total invariable y conservación del foco. Las pruebas DOM comprueban dos botones nativos con etiquetas breves, agrupación accesible, estados mutuamente excluyentes mediante `aria-pressed`, nota académica asociada y actualización del mensaje de estado para tecnologías de asistencia. La verificación del HTML exige que el control esté dentro del encabezado, y la prueba de interacción de la landing comprueba su conexión con las tarjetas. Los cálculos y sus casos de prueba se conservaron.

Se conservaron los controles de contenido y de interacción existentes. No se agregaron dependencias.

## Pruebas preparadas, sin ejecución en navegador

```bash
npm run test:pricing:browser
# Alternativa si se dispone de otro Chromium compatible:
LANDING_BROWSER_PATH=/usr/bin/microsoft-edge npm run test:pricing:browser
```

La suite aislada usa Playwright y recursos de `dist/` interceptados localmente, sin servidor ni servicios externos. Contempla Tab/Shift+Tab, Enter y Espacio, foco, selección, ambas vistas, totales siempre visibles, nombres/estados/descripción en el árbol de accesibilidad de Chromium y región de estado con anuncio cortés. Revisa overflow, texto de al menos 14 px y botones de al menos 38 px de alto y el control de como máximo 300 × 50 px en once anchos de 320 a 1920 px. Las capturas de ambas vistas se guardan en `qa-artifacts/pricing/`.

El intento de ejecución en este entorno se detuvo al iniciar Chromium con `sandbox_host_linux.cc:41 ... Operation not permitted`. El diagnóstico queda en `qa-artifacts/pricing/browser-launch-error.log`. **No se declaran aprobados el teclado nativo, el árbol de accesibilidad ni el renderizado responsive.** Las pruebas DOM no sustituyen esas comprobaciones.

## Revisión manual pendiente con lector de pantalla

En un entorno con navegador y lector disponible (por ejemplo, Firefox/Orca o Chrome/NVDA), abrir la landing y llegar al selector de planes con Tab:

1. Confirmar que se anuncian el grupo «Opciones de IVA», la nota académica, los botones «IVA incluido» y «Desglose», y el estado pulsado inicial de «IVA incluido».
2. Usar Tab/Shift+Tab para recorrer ambos botones, y Enter o Espacio para activar cada vista. Comprobar foco visible, estado pulsado y anuncio actualizado sin trasladar el foco a las tarjetas. Tab desde el segundo botón debe continuar a la comparación de planes.
3. Leer cada tarjeta: nombre del plan, «Total con IVA incluido», total CLP/mes, «Valor neto», su importe, «IVA (19 %)», su importe y su descripción asociada sin contratación. Confirmar que las cifras corresponden a la tabla y no se anuncian como descuento u otra tarifa.
4. Volver a la vista final: el total se conserva y el desglose deja de aparecer en el recorrido del lector.
5. Revisar ambas vistas a 320, 360 y 390 px y con zoom al 200 %: etiquetas completas, importes legibles, foco visible y ausencia de recortes o desplazamiento horizontal de la página.

**No se ejecutó una sesión real con lector de pantalla en este entorno.** El árbol de accesibilidad automatizado, cuando pueda ejecutarse, tampoco acredita por sí solo el anuncio hablado de un lector concreto.

La corrección visual se detiene para revisión humana. Se conservaron las tarjetas, colores, tipografías, espaciados y animaciones originales; únicamente se retiró el espacio añadido por la etiqueta visible del total y se trasladó el control al encabezado. No se tocaron precios, impuesto, beneficios ni contenido comercial.

La simplificación editorial posterior conserva estos cálculos y pruebas, muestra tres beneficios por tarjeta y reúne las condiciones bajo demanda. Véase [EDITORIAL_QA.md](EDITORIAL_QA.md).
