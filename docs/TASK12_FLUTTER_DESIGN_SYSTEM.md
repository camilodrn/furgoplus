# FurgoPlus móvil — guía visual de Task 12

Actualizada 31-10-2026 según el primer incremento unificado; aceptación humana pendiente. [Cobertura y evidencia](TASK12_VISUAL_IMPLEMENTATION_REVIEW.md). Implementación en `mobile/lib/furgo_theme.dart` y componentes en
`mobile/lib/furgo_widgets.dart`. La guía aplica a conductores y apoderados.

## Colores y roles

| Rol | Color | Uso |
| --- | --- | --- |
| Marca / acción | `#0752AC` | Acción principal, enlaces, selección e iconos |
| Énfasis suave | `#EAF3FF` | Resumen de plan, identidad e información |
| Texto principal | `#202B3A` | Títulos y contenido |
| Texto secundario | `#526176` | Fechas, etiquetas y apoyo |
| Fondo / superficie | `#F5F7FB` / `#FFFFFF` | Página / grupos relacionados |
| Borde de control | `#68788D` | Campos y botones secundarios |
| Divisor | `#D8E0EB` | Separación visual sin significado propio |
| Correcto | `#16643F` sobre `#E9F6ED` | Confirmación y vigencia |
| Atención | `#835313` sobre `#FFF5DF` | Operación por confirmar o recuperación |
| Error | `#A32735` sobre `#FFF0F1` | Error recuperable / validación |

El color siempre se acompaña de texto y, cuando corresponde, icono. Los pares de
texto semántico se verifican con contraste mínimo 4,5:1. Un divisor tenue no se
utiliza como único indicador de un control.

## Tipografía

Fuentes del sistema, sin paquetes ni fuentes nuevas en la app. Jerarquía:
28 para título principal; 24 para estado destacado; 22 para sección; 18 para
subtítulo; 16 para contenido y acciones; 14 para apoyo; 12 para etiquetas de la
barra Material 3. Peso 700 en títulos, 600 en acciones y 400 en párrafos. Interlínea
1,2–1,45 según jerarquía. Los documentos legales bajo demanda mantienen texto de
lectura amplio. No limitar el escalado del sistema ni truncar datos esenciales.

## Composición y componentes

- Espaciado en múltiplos de 4: 8/12 entre elementos, 16/24 entre grupos y 32 para
  separar marca del formulario. Márgenes de página de 16–24 según contexto; 20
  dentro de las superficies compartidas. Ancho máximo 720; autenticación 480.
- Superficies blancas, borde sutil, radio 12, elevación 0. Resumen de plan e
  identidad usan azul suave. Hoy con recorrido utiliza cabecera azul suave y acción
  de marca. La cabecera admite elevación funcional de 1 al desplazar. Sin gradientes.
- Radios de campos y botones: 12. Una acción rellena por tarea; acciones
  secundarias delineadas o de texto. Altura mínima de botones principales 52 y
  objetivos táctiles de al menos 48. Sin alturas fijas para párrafos ni tarjetas.
- `FurgoSurface`: único dueño de superficie y padding; los adaptadores existentes
  `FurgoOperationalPanel`, `ParentPanel` y `ParentDisclosure` lo reutilizan.
  Familia conserva 12 dp de separación entre grupos de su lista, sin tema de
  tarjetas distinto. La comparación usa un solo grupo con atributos y divisores.
- `FurgoSurface`: un grupo relacionado. Beneficios, fechas y desplegables no se
  convierten en tarjetas individuales. `FurgoMessage`: información, error o éxito
  con icono y región viva. `FurgoStatus`: texto e icono, sin depender del color.
- Vacíos compactos: qué falta, una frase útil y una acción existente. Mantenerlos
  arriba; evitar ilustraciones grandes, relleno vertical y mensajes de advertencia
  para la mera ausencia de datos.
- Iconos Material reconocibles: calendario (Hoy), medalla (plan), libro (guías),
  conversación (solicitudes), chat (asistente), persona (Cuenta), salida (sesión).
  Iconos decorativos excluidos de la lectura; controles de solo icono con tooltip.

## Navegación y accesibilidad

Barra Material 3 con icono y etiqueta siempre visibles. Conductor: Hoy / Mi plan /
Ayuda. Apoderado: Buscar / Solicitudes / Ayuda; Cuenta se abre desde AppBar. Ayuda usa el mismo contenedor
del apoderado; la barra también queda sobre el teclado. Cambiar de destino cierra
el teclado. Cuenta del conductor ocupa el contenido, conserva la barra y permite
volver al formulario anterior con su borrador. Una sesión nueva elimina esos datos.
Los documentos legales son una lectura modal existente: Android Atrás cierra el
documento sin cambiar la pantalla que hay debajo.

Resumen primero, acción después y condiciones bajo demanda. Listas desplazables,
filas con texto expandible y campos con etiquetas persistentes. Con texto muy grande,
Cuenta conserva un acceso de icono con etiqueta accesible para liberar cabecera.
No usar el tamaño del texto para conceder o negar acceso. Mantener las capacidades
estrictas del servidor, la confirmación de privacidad y el control de respuestas
tardías. Verificar TalkBack y fuente/tamaño de pantalla en el Samsung A54 real;
los tests y las vistas sintéticas no aprueban esa aceptación.
