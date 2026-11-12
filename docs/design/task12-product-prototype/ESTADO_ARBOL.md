# Estado del árbol y preservación

El inventario se registró **antes de crear el prototipo** en `/tmp/furgoplus-product-prototype-baseline` y luego se copió a esta carpeta.

- Rama inicial: `task/12-plan-capabilities`.
- HEAD inicial: `c0854de9e571686aabe10fb8dd57496e2f8d88dd`.
- El árbol ya contenía modificaciones y archivos sin seguimiento de backend, web, móvil, documentación, diseño e infraestructura. No se hizo limpieza ni restauración de esos cambios.
- [git-status-before.txt](git-status-before.txt) conserva el estado completo inicial, sin resumirlo como árbol limpio.
- [baseline.json](baseline.json) registra fecha UTC, rama, HEAD y SHA-256 de **367 archivos existentes**, incluidos archivos sin seguimiento. No copia datos ni el contenido de los archivos.

La comparación final está en [evidence/preservation.json](evidence/preservation.json): verifica las huellas, archivos faltantes, rama, HEAD y que las adiciones pertenezcan exclusivamente a `docs/design/task12-product-prototype/`. El estado posterior se guarda en [evidence/git-status-after.txt](evidence/git-status-after.txt).

Se puede repetir sin modificar el producto:

```bash
python3 docs/design/task12-product-prototype/evidence/check-preservation.py
```

El comprobador lee el árbol y escribe únicamente sus dos archivos de evidencia en la carpeta del prototipo. La comparación acredita el resultado final de los archivos inventariados; no representa una auditoría de servicios externos.

No se ejecutó commit, push, merge, deploy, acceso a datos académicos, migración, build operativo o comando de contenedores. El único servidor iniciado entrega los archivos estáticos locales del prototipo en `127.0.0.1:8768`.
