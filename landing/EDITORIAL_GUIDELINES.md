# FurgoPlus · Criterio editorial permanente

**Menos texto, más claridad.** La landing presenta el producto; los detalles no deben convertirla en un informe. Esta regla se aplica a cada nueva edición, también a planes, demo y hero.

- **Una idea principal por sección.** El título debe permitir entenderla de inmediato.
- **Subtítulos opcionales y breves:** una frase, únicamente si aporta información nueva.
- **Hasta tres beneficios o ideas visibles por bloque.** Agrupar con sentido; no sumar párrafos para eludir el límite.
- **Eliminar redundancias:** no repetir el título, las cifras, los estados o lo que la ilustración ya comunica.
- **Detalle bajo demanda:** usar `details/summary` o los diálogos existentes para condiciones, comparación completa y explicaciones adicionales.
- **Honestidad en microcopy:** distinguir demo, implementación académica y futuro; precios referenciales y contratación no habilitada deben seguir claros. No declarar disponibilidad sin evidencia.

La síntesis no debe ocultar información imprescindible, eliminar condiciones importantes ni reducir la tipografía. Consentimiento, límites de la validación, ausencia de GPS, pagos manuales y privacidad mantienen contexto y acceso claro. Una tabla comparativa desplegable puede contener más de tres capacidades; navegación y controles de las interfaces ilustrativas no son listas de beneficios comerciales.

## Intención de cada sección

| Sección       | Idea principal                                     | Detalle                                                                       |
| ------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hero          | Simplificar la organización del transporte escolar | Ilustración conceptual, sin seguimiento en vivo                               |
| Propuesta     | Reunir información dispersa                        | Búsqueda, contacto y gestión                                                  |
| Demo          | Explorar la web y el celular                       | Controles con datos ficticios                                                 |
| Beneficios    | Mostrar el valor para cada audiencia               | Tres beneficios por audiencia                                                 |
| Cómo funciona | Explicar el recorrido del contacto a la gestión    | Tres pasos breves                                                             |
| Planes        | Comparar tres propuestas de plan                   | Tres beneficios por tarjeta; condiciones y capacidades completas desplegables |
| FAQ           | Resolver dudas concretas                           | Respuestas bajo demanda                                                       |
| Cierre        | Invitar a explorar la demo                         | Un destino y un aviso académico breve                                         |

## Aplicación y revisión

`src/App.tsx` referencia esta regla junto al contenido principal. `npm run verify` comprueba un encabezado principal por sección, listas y pasos con un máximo de tres elementos, subtítulos de una frase y planes sin bloques explicativos antes de las tarjetas. Las pruebas de precios conservan los importes, IVA, estados de implementación académica y experimentación, y nota accesible de contratación no habilitada.

Estos controles detectan crecimiento estructural; el sentido, la redundancia y la jerarquía requieren revisión humana. Antes de cerrar una edición, comprobar en escritorio y móvil que se entienda cada sección de un vistazo, que el texto aporte y que los detalles importantes sigan accesibles. Mantener los tamaños de lectura, la composición y las animaciones aprobadas.
