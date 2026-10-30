# Task 14 — evaluación de hardware y modelo, 28/10/2026

## Evidencia disponible

El [ADR 0007](../docs/decisions/0007-homelab-demo-deployment.md) documenta Debian
13, AMD A10-5750M de cuatro núcleos, **10 GiB de RAM y HDD de 1 TB**, compartidos
con FitFu y otros proyectos. Es un inventario documental anterior, no una lectura
actual. La [guía de la demo](../docs/HOMELAB_DEMO.md) declara cuotas de 1.875 GiB
y tres CPU entre PostgreSQL, Django y Caddy. Son techos, no consumos medidos ni
reservas: no se pueden restar para deducir RAM disponible.

No se proporcionó un destino SSH en esta sesión. No se intentó acceso remoto.
Se desconocen RAM disponible actual, swap, flags CPU efectivos, disco libre del
almacén Docker, límites cgroup y servicios realmente activos. **Ollama instalado,
compatibilidad de la imagen y rendimiento del modelo siguen sin comprobarse.**
El inventario Fedora anterior de REVIEW.md no representa este Debian.

## Decisión provisional

**Comenzar por Qwen3 0.6B Q4_K_M**, CPU, un hilo y una inferencia a la vez. Es una
inferencia conservadora del proyecto: el host es compartido, usa HDD y la app
tiene prioridad. El default del cliente y el Compose preparado siguen esa
elección. No hace falta GPU ni instalar drivers.

Qwen3 1.7B es un segundo candidato razonable **solo si la medición deja margen**;
10 GiB totales por sí solos no justifican cargarlo. El contexto se limita a 2048
tokens, salida a 128 y thinking desactivado. No se propone 4B para este lote,
aunque el adaptador conserva su compatibilidad previa.

| Condición previa propuesta | 0.6B | 1.7B |
| --- | --- | --- |
| RAM disponible mínima en uso habitual, antes de cargar | ≥3 GiB | ≥6 GiB |
| Techo inicial exclusivo de Ollama, sin swap | 2 GiB | 4 GiB, requiere revisar Compose |
| CPU asignada inicial | 1 CPU / 1 hilo | 1 CPU / 1 hilo; aumentar solo tras nueva revisión |
| Espacio libre orientativo para modelo y margen | ≥5 GiB más la imagen Docker | ≥6 GiB más la imagen Docker |
| Condición adicional | Sin presión de memoria/I/O ni deterioro de la app | Beneficio observable frente a 0.6B y FAQ |

Son presupuestos del proyecto, **no requisitos oficiales ni RAM medida**. Incluso
0.6B puede no caber o exceder el timeout en esa CPU; en tal caso mantener FAQ.
No ampliar cuotas automáticamente para resolver OOM o lentitud. Confirmar flags
con el diagnóstico, sin asumir AVX2 por el nombre del procesador; ejecutar la
imagen elegida será una comprobación de compatibilidad posterior autorizada.

Los catálogos oficiales consultados el 28/10/2026 muestran aproximadamente
[523 MB para 0.6B](https://ollama.com/library/qwen3:0.6b) y
[1.4 GB para 1.7B](https://ollama.com/library/qwen3:1.7b), Q4_K_M y licencia
Apache 2.0. Son tamaños de pesos, distintos de RAM, caché de contexto, buffers,
imagen y almacenamiento temporal de descargas. Los tags pueden cambiar;
registrar digest completo con la sonda local y conservar las licencias. El modelo
no tiene tarifa de API; la máquina y su operación consumen recursos propios.

## Diagnóstico pendiente

Ejecutar los comandos de [OPERATIONS.md](OPERATIONS.md) en Debian, primero en
reposo y luego durante el uso habitual, sin estrés. Medir en el volumen real de
Docker/modelos, que puede ser distinto del checkout. El modo `--services` solo
consulta metadatos: unidades conocidas, listeners, versión, contenedores y
consumo instantáneo. No consulta variables, logs, cuentas ni bases de datos.

El inventario cgroup informa la raíz visible, no resuelve todas las cuotas
heredadas de cada servicio. Para aceptar recursos, comprobar también las cuotas
efectivas del futuro contenedor. Las lecturas antes/después y `/api/ps` no son
picos RSS; combinar observación de `docker stats`, `vmstat`, PSI y memoria peak
del cgroup. No presentar estimaciones como mediciones.

| Medición Debian | Resultado de este lote |
| --- | --- |
| RAM, swap/PSI y disco libre actuales | Pendiente de diagnóstico del operador |
| CPU/flags e imagen Ollama compatibles | Pendiente |
| Disponibilidad de API/modelo | Pendiente; contrato simulado probado |
| Latencia fría/caliente y consumo peak | Pendiente; no se ejecutó un modelo |
| Calidad y beneficio frente a FAQ | Pendiente; el modelo solo selecciona texto aprobado |

No adoptar IA si afecta T12, FitFu o demo r4. FAQ continúa funcionando sin Ollama.
