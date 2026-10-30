# FurgoPlus · Demostración académica en Fedora

## Levantar la landing

Con Node.js ≥22.12 y las dependencias locales presentes:

```bash
cd ~/Proyectos/furgoplus-landing/landing
npm run build
npm run preview
```

Abrir **http://127.0.0.1:4313** en Chromium/Edge o Firefox. Mantener la terminal abierta; detener con Ctrl+C. Si falta `node_modules`, ejecutar antes `npm ci`. Para editar durante preparación, usar `npm run dev` en lugar de `preview`; ambos usan el mismo puerto, así que detener uno antes de iniciar el otro.

No requiere backend, Docker, cuentas ni variables de entorno. Los recursos son locales y el build no requiere servicios externos. En el sandbox actual el servidor y Chromium están bloqueados; estos pasos deben ensayarse en una terminal normal de Fedora antes de presentar.

## Recorrido de 4–5 minutos

1. **Presentación y propuesta:** “FurgoPlus es un proyecto académico para ayudar a familias y transportistas a organizar el transporte escolar”. Mostrar el problema de información dispersa y pulsar **Ver cómo funciona**.
2. **Conductor:** mantener **Soy conductor**, elegir **Regreso a casa** y después **Ida al colegio**. Mostrar cómo cambian horario y cupos en la web y el celular. Aclarar que son datos ficticios; no hay seguimiento GPS.
3. **Apoderado:** elegir **Soy apoderado**, alternar **Perfil B / Perfil A**. Comparar horarios y cupos. Explicar que solicitar contacto requiere autorizar compartir el correo; la coordinación ocurre fuera de FurgoPlus y no reserva cupos. La landing solo ilustra esa experiencia.
4. **Beneficios y funcionamiento:** señalar los tres beneficios de cada audiencia y los tres pasos. Los enlaces **Ver demo del…** permiten volver a la experiencia correspondiente.
5. **Planes:** mostrar **$19.990 / $39.990 / $69.990 CLP por mes, IVA incluido**. Alternar **Desglose / IVA incluido**: los totales permanecen iguales. Abrir **Comparar funciones y condiciones**: Básico sin informes mensuales, Pro con mensuales, Elite con avanzados y archivos XLSX. Asistentes experimentales. Todo corresponde al MVP académico, sin contratación ni cobros habilitados.
6. **Preguntas y cierre:** abrir la pregunta sobre GPS y, si hace falta, la de precios. Mostrar **Sobre el proyecto** en el footer para los hitos académicos; cerrar con Escape. Terminar con la acción de explorar la demo.

Antes de presentar, revisar la [lista de aceptación humana](FINAL_QUALITY_REPORT.md#comprobaciones-humanas-pendientes), el zoom real, la resolución del proyector y la consola. Para repetir el lote automatizado: `npm run audit:fedora`; el reporte queda en `qa-artifacts/final-report.html`. Recargar restablece recorrido, audiencia, perfiles y vista de precios; no se guarda estado ni se envían solicitudes reales.
