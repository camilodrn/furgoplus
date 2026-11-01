# FurgoPlus T12 · Cierre UX vigente, C1–C8

31-10-2026. **C7 ya existe en el APK instalado y comprobado en el Samsung A54. C8 está implementada para una aplicación con almacenamiento exclusivamente necesario. El producto completo sigue sin aprobación integral.**

[Antes/después auténtico y C8](evidence/task12-c7-c8/index.html) · [APK y revisión física](TASK12_C7_APK_PHYSICAL_VERIFICATION.md) · [Inventario y privacidad C8](TASK12_C8_STORAGE_PRIVACY_AUDIT.md) · [Cobertura de 99 filas](evidence/task12-c7-c8/coverage.json) · [Corte anterior conservado](evidence/task12-c7-c8/checks/closure-before-c7-c8.md).

## Resultado actual

| Corrección | Estado y alcance |
|---|---|
| C1 Responsive/estados | Resuelto en los casos registrados del cierre anterior: Rutas/Revisión a 320/390/768/1440 y texto CSS 200 %. Sin nueva auditoría de todas las vistas. |
| C2 Administración | Resuelto en las lecturas comprobadas anteriormente: cola y tarea seleccionada antes del contexto común. Decisiones/escrituras siguen en sus filas pendientes. |
| C3 Comparación | Acciones acercadas y regresión conservada. El APK actualizado contiene el cambio, pero falta observación física propia de P03; no se aprueba por instalarlo. |
| C4 Vocabulario | Rótulos React comprobados y guías adaptadas por plataforma. F02/F03 siguen pendientes de artículo/guías físicos del código nuevo. Dependencia editorial Django documentada, sin modificar backend. |
| C5 Formularios | Parcial. Avance frente a guardado, privacidad y advertencias contextuales aplicados; quedan estados/confirmaciones y escrituras finales no ejecutadas. |
| C6 Pulido | Cuenta/recorrido ya comprobados en APK nuevo; lector legal y foco comprobados en React. Refrescos excepcionales y accesibilidad hablada conservan pendientes. |
| **C7 Pasajeros/operación** | **Corregido y verificado en el recorrido físico disponible**: un título, contexto/fecha/horario, ocupación compacta real, filas con jerarquía de nombre/recogida, contacto agrupado bajo expansión y sin contador final redundante. Búsqueda, limpieza y Android Atrás comprobados. Equivalente React corregido e inspeccionado. No se afirma aprobación humana. |
| **C8 Cookies/privacidad** | **Implementado y comprobado para solo necesarias**. Panel permanente sin banner automático ni botones Aceptar/Rechazar sin efecto. Inventario, duración, controles y privacidad v0.2. Login/logout reales, cuatro anchos, teclado y zoom real 200 % comprobados. Revisión jurídica/producción y lectura hablada pendientes. |

El trabajo actual se limitó a C7/C8 y sus consumidores. Los problemas anteriores de doble Volver familiar, cabeceras sobre otros destinos y observación neutral como rechazo no se reabrieron.

## F01–F13 y cuatro dimensiones

| Hallazgo | Estado actualizado |
|---|---|
| F01 Buscar | Conservado; sin nueva aprobación global por componentes. |
| F02 Comparar | Cambios dentro del APK actual, pero P03 mantiene contraste físico pendiente. |
| F03 Solicitudes | Comportamiento y filtros conservados; decisiones finales pendientes. |
| F04 Comuna | Conservada; regresión familiar aprobada. |
| F05 Navegación | Búsqueda/limpieza/expansión y Android Atrás físicos; sesión conservada al actualizar; foco legal y logout React comprobados. |
| F06 Formularios | C5 parcial; C8 no altera envío, CSRF ni permisos. |
| F07 Responsive | Cobertura anterior conservada; C8 añade cuatro anchos reales y zoom real 200 % sin desborde. No equivale al barrido del producto. |
| F08 Administración | Lecturas anteriores conservadas; LegalAccess compartido recibe C8, sin reglas administrativas nuevas. |
| F09 Semántica | Estados conservados; sin nuevas métricas o estados de asistencia inferidos. |
| F10 Planes/reportes | Conservado; W31 sigue pendiente de tabla de cupos expandida tras cambiar su patrón. |
| F11 Confianza/contacto | Contacto del apoderado permanece oculto hasta expandir; grupo visual coherente entre nativo y web. C8 no autoriza tratamiento de datos de menores. |
| F12 Calidad/consistencia | Avance real C7/C8; no cerrado integralmente: 60 filas mantienen alguna comprobación pendiente. |
| F13 Accesibilidad | Regresión, semántica, teclado, foco, axe y zoom documentados; lectura hablada y barrido asistido completo pendientes. |

Evaluación independiente, sin sustituir calidad visual por tests:

| Rol/plataforma | Funcionalidad | Facilidad | Calidad visual | Consistencia |
|---|---|---|---|---|
| Conductor Flutter | Búsqueda, contacto autorizado, limpieza, regreso y restauración físicos; regresión aprobada | Contexto/ocupación compactos, registros reconocibles y detalle progresivo | Antes/después de APK auténtico inspeccionado; juicio favorable del agente | Material 3, FurgoSurface y capacidad existentes |
| Conductor React | Detalle y contacto reales; sesión/CSRF conservados | Recogida, apoderado y acción telefónica existente agrupados | Detalle real móvil inspeccionado | Mismos datos y lenguaje que Android |
| Acceso/Cuenta/legales React | C8 no escribe preferencias o credenciales; login/logout reales conservados | Información permanente, sin decisiones ficticias | Panel real a 320/390/768/1440 y zoom 200 % | Lector/modal/componentes existentes, sin frameworks nuevos |
| Administración React | Regresión completa y componentes legales compartidos | C2 anterior conservado | Sin nueva aprobación de todas sus variantes | C8 no cambia permisos ni decisiones |
| Apoderado Flutter | Regresión familiar conservada; política compartida | Sin banner web ni seguimiento inventado | Sin nueva aprobación física de Comparar/guías | Primitivas conservadas; esas filas siguen pendientes |

## Componentes y cobertura

Cambios de este incremento: `DriverTodayPassengers` en `mobile/lib/driver_home.dart`; detalle equivalente en `web/src/DriverOperations.tsx` y `operational.css`; `LegalAccess`, nuevo `StoragePrivacy`, `legal-access.css`, `legal/cookies.md` y Privacidad v0.2. El asset legal Android comparte la fuente mediante el enlace existente. No se duplicó el sistema visual ni se tocaron los controladores de autenticación.

Se revisaron Hoy, información del recorrido, Pasajeros, expansión, Cuenta y Privacidad en el A54; el detalle web de pasajeros y C8 en la web auténtica. `FurgoCapacity` y `FurgoSurface` no cambiaron sus contratos ni sus demás consumidores. No se reabrió lo que ya funcionaba ni se volvió a auditar la matriz completa.

Las **87 vistas/subflujos + 12 situaciones = 99 filas** quedan en **34 migradas y verificadas, 5 conservadas y verificadas y 60 con alguna validación pendiente**. Se verificaron D03/D04/D05/D10 y W19 en su alcance de lectura/interacción. P03/F02/F03 ya están en el APK nuevo, pero continúan pendientes de observación propia. W31 mantiene su pendiente. **C8 se registra como ampliación transversal separada, sin inflar el denominador histórico de 99 filas.** Estas etiquetas describen evidencia, no aprobación simultánea de las cuatro dimensiones ni aceptación humana.

## Evidencia y pruebas

- **15 capturas auténticas dirigidas** en la nueva galería: 8 de Android (incluido el antes) y 7 web. No contiene renders sintéticos. La captura intermedia 42e2 y la prueba de teclado que no produjo zoom no se presentan como finales.
- APK anterior `b957…56da` frente al **final instalado `ecf88f06d3846d97196518051cb86169d6fdaa69231d59e3d34d877ae01b6ed1`**, misma firma y paquete `com.example.furgoplus.task12`, versión nominal **0.1.0+1**. Instalación como actualización, sin desinstalar ni borrar datos. Código exacto y parámetros en [fuentes y hashes](evidence/task12-c7-c8/source-hashes.json).
- **React 397/397**; último ajuste de distribución del enlace legal: **7/7** de consumidores directos. **Flutter 213/213** en regresión final, análisis sin incidencias. Tipos, lint, contratos y build React aprobados. `21st review`: cero errores/advertencias; dos sugerencias sobre colores preexistentes.
- C8 a cuatro anchos, detalle/teclado, contacto web y zoom: sin violaciones axe detectadas en el alcance registrado. No es certificación de accesibilidad. Chrome comprobó zoom **2.0**, DPR **2**, viewport lógico **720** sin desborde en ventana de 1440; el tamaño raíz seguía en 16px, sin simularlo con CSS.
- El panel no interfiere con autenticación: cookie CSRF antes del acceso, sesión + CSRF después, y solo CSRF tras logout confirmado; recarga permanece sin sesión. Se guardan solo metadatos, nunca valores de cookies/tokens o contraseñas. Aceptación/rechazo/revocación opcional **no aplican** porque no existen tecnologías opcionales.

Los tests conservaron las guardas de privacidad, sesión y permisos. El caso de desplazamiento único detectó un Scrollable adicional y se corrigió el widget, sin relajar la prueba. Las expectativas editoriales se ajustaron al contador útil de búsqueda, nuevo enlace y Privacidad v0.2, manteniendo las comprobaciones funcionales.

## Pendientes y preservación

C7 queda demostrado en el A54 con los registros ficticios existentes. Falta aceptación humana del resultado, TalkBack/lectura hablada y barrido físico completo de orientación/fuente ampliada. C8 requiere revisión jurídica y verificación efectiva del despliegue HTTPS antes de afirmar propiedades productivas. Las integraciones opcionales futuras necesitan controles reales antes de activarse; el panel actual no las inventa ni las autoriza.

Los demás pendientes esenciales de la matriz continúan: documentos privados, confirmaciones/estados excepcionales, variantes de plan, tabla W31 y escrituras de negocio autorizadas en entorno aislado. No se iniciaron/finalizaron servicios, crearon asignaciones o pagos, enviaron contactos/consultas ni tomaron decisiones administrativas. En la web solo se ejecutaron login/logout de prueba expresamente solicitados para C8.

Se preservaron 1973 archivos iniciales mediante estado, diff y hashes. Backend, contratos, infraestructura y archivos iniciales protegidos permanecen intactos; no hay archivos iniciales eliminados. No se modificó PostgreSQL de negocio ni contenedores, homelab o demo pública. El preparador recuperó únicamente lo autorizado. Sin commit, push, merge ni deploy.

**FurgoPlus no se declara candidata a aprobación integral por cerrar este recorrido.** La continuidad exacta está en la cobertura y en los informes C7/C8 enlazados; no es necesario repetir las auditorías anteriores.
