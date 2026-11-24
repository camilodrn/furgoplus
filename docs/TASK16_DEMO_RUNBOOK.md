# FurgoPlus · Presentación del 25 de noviembre de 2026

## Candidato y resultados

Release **20261124-9e6ef46-2eff066a-01**, construido desde
`task/16-cierre-academico` sobre `9e6ef4620ef4362531527490c1b338508e0363c4`
con los cambios de Task 16 aún sin commit. El operador confirmó estos resultados
para el candidato de noviembre.

| Verificación | Resultado |
| --- | --- |
| PostgreSQL 17.6 aislado | 103/103. Migraciones `0010_student_identity` y `0011_require_student_identity`, system check y ausencia de migraciones adicionales. Cuotas, concurrencia de altas y cambio de plan, conservación de registros, contactos, semilla y XLSX aprobados. Base temporal eliminada. |
| React | 412/412. Lint, tipos, contrato y build aprobados. Validación privada 10/10. |
| Flutter | 215/215 y `flutter analyze` sin incidencias. Flutter 3.47.2, Dart 3.13.2, Temurin 21 y Android SDK 36. `pubspec.lock` intacto y APK previa preservada. |
| Samsung A54 SM-A546E | 10/10. La APK funcionó con datos móviles y el USB desconectado. |
| Ensayo integral HTTPS | 15/15. Alta 20 y rechazo comercial de la 21, registro, búsqueda, solicitud Flutter, recepción de esa misma solicitud en React Elite, comparación mensual y apertura de los tres XLSX. |
| Total automatizado | **730/730**. |

El `npm audit` completo arrojó cinco hallazgos del árbol de desarrollo.
`npm audit --omit=dev` devolvió cero. Este corte conserva las dependencias.

El [inventario congelado](evidence/task16-20261124-9e6ef46-2eff066a-01/CANDIDATE.SHA256SUMS)
recoge 28 archivos. Su SHA-256 es
`2eff066a055bb9c2bca9862e752b08eb94521366d5848f6c47a37a3b08555b66`.
Los 28 coincidían al iniciar el cierre. En el árbol de precommit,
`infra/task16/compose.yaml` difiere intencionalmente. Los otros 27 coinciden.
El archivo de transferencia conserva el Compose original, sus hashes y las dos
imágenes. Las plantillas, el verificador y la documentación del cierre son
posteriores al empaquetado. Consulta el [procedimiento operativo](TASK16_DEPLOYMENT.md)
y el [inventario de imágenes](evidence/task16-20261124-9e6ef46-2eff066a-01/IMAGES.tsv).

### Artefactos verificados en Fedora

- Paquete `~/Respaldos/FurgoPlus/task16-20261124-9e6ef46-2eff066a-01/task16-linux-amd64.tar.gz`.
  [SHA-256 del paquete](evidence/task16-20261124-9e6ef46-2eff066a-01/task16-linux-amd64.tar.gz.sha256).
- APK instalada `~/Descargas/FurgoPlus-Task16/FurgoPlus-Task16-2026.apk`,
  160.111.208 bytes, SHA-256
  `2311c93167870a2f87540d2be94d032e267e23f26b029dbf6931559e78eb4216`.
  [SHA-256 de la APK](evidence/task16-20261124-9e6ef46-2eff066a-01/APK.SHA256SUMS).

Para cotejar los archivos existentes, desde el repositorio:

```bash
e="$PWD/docs/evidence/task16-20261124-9e6ef46-2eff066a-01"
(cd ~/Respaldos/FurgoPlus/task16-20261124-9e6ef46-2eff066a-01 &&
  sha256sum -c "$e/task16-linux-amd64.tar.gz.sha256")
(cd ~/Descargas/FurgoPlus-Task16 && sha256sum -c "$e/APK.SHA256SUMS")
```

La APK usa `https://demo.furgoplus.cl`. La verificación de su hash acredita
identidad del binario conservado. El manifiesto congelado contiene los archivos
Flutter de Task 16 y la aceptación de esta APK fue en el A54. El hash de la APK
por sí solo no acredita que otra compilación produzca el mismo binario.

## Estado final confirmado por el operador

| Servicio | Origen y estado |
| --- | --- |
| Task 15 | `127.0.0.1:18080`. Instancia preservada para reversión. |
| Landing | `127.0.0.1:18081`. HTTP 200. |
| Ensayo | `127.0.0.1:18083`, proyecto `furgoplus-task16-rehearsal-01`, base independiente y ensayo concluido. |
| Presentación | `127.0.0.1:18084`, proyecto `furgoplus-task16-presentation-01`, base independiente. Cloudflare volvió a dirigir la demo aquí. |

La API pública respondió HTTP 200 con health correcto, el bundle React fue
`index-B0qRJdIM.js`, HTTP redirigió a HTTPS con 308 y la cabecera de ensayo
quedó ausente. El HTTP Host Header del túnel es `demo.furgoplus.cl`.

La base de presentación conserva el marcador
`task16-2026-11-v1:presentation`. Básico está en **19/20**, con un cupo
comercial, y Elite en **7/150**, con 143. El 7 coincide con la semilla original,
que crea cuatro estudiantes en el primer recorrido y tres en el segundo.
`t16-movil-presentation@example.test` permanece reservado y sin registrar.
[Semilla de noviembre](../backend/drivers/november_scenario.py).

## Guion de la presentación

| Persona | Acción | Resultado |
| --- | --- | --- |
| Sebastián | Entrar como `t16-basic@example.test` → **Pasajeros**. Mostrar 19/20. Crear dos estudiantes ficticios nuevos, uno por intento, en **Ruta ficticia basic mañana**, con inicio **25/11/2026** y término vacío para ambos. Confirmar que esa fecha sea el día actual en Chile. Usar responsable y recogida ficticios y teléfono sintético `000000000`. | El primero lleva el contador a 20/20. Queda un asiento físico. El segundo recibe `409 student_limit_reached`. |
| Alonso | Abrir la APK en el A54 con datos móviles. Registrar `t16-movil-presentation@example.test`, iniciar sesión, buscar **Comuna ficticia elite**, abrir el perfil, consentir y enviar una solicitud con un texto identificable para el guion. | Confirmar **Pendiente** en Flutter. Si se pierde la respuesta, consultar Solicitudes antes de reenviar. |
| Camilo | Entrar como `t16-elite@example.test`. Mostrar Inicio, Pasajeros, Rutas y localizar en **Solicitudes** el mismo texto enviado desde Flutter. En **Plan y reportes**, consultar noviembre frente a octubre, cambiar de período y descargar `payments.xlsx`, `runs.xlsx` y `contacts.xlsx`. | Mostrar que ambos clientes usan el mismo backend y base. Abrir los tres XLSX y comprobar período y detalle. |

La semilla Elite aporta **4 → 6 pagos**, **3 → 5 ejecuciones** y **3 → 5
contactos** de octubre a noviembre. El nuevo contacto sube noviembre a seis.
El monto sin anulados pasa de **$86.000 a $175.000 CLP**. Son pagos manuales,
ejecuciones de demostración y solicitudes de contacto. La disponibilidad del
siguiente servicio y la capacidad histórica son medidas distintas. Una
solicitud aceptada acredita el intercambio de datos de contacto.

### Qué ocurrió con el contador durante el ensayo

El alta 20 se creó el **24/11/2026**, con inicio **25/11/2026** y término
**30/11/2026**. PostgreSQL de ensayo confirmó 19 estudiantes únicos el día
del alta y 20 en la fecha de inicio. React **Pasajeros** y **Mi plan** mostraron
19/20 el día del alta. **Inicio** mostró 19 asignaciones vigentes. Es el
comportamiento esperado. La cuota mostrada aplica al día actual en Chile, con
ambos extremos del intervalo incluidos. El rechazo comercial considera además
las fechas futuras del alta. Si hay ida y regreso, **Pasajeros** cuenta al
estudiante una vez y **Inicio** cuenta cada asignación vigente.
[Cálculo comercial](../backend/drivers/student_quota.py).
