# T12 — Primer lote: Inicio web y Hoy Android

27-10-2026, America/Santiago. **Implementación para revisión humana; aceptación visual pendiente.** La revisión humana comunicada de Fedora confirma A como dirección para Mi servicio. No se extiende esa aceptación a Inicio, a Flutter ni a los lotes siguientes.

## Resultado del lote

Se inspeccionaron las [referencias de Mi servicio](design/task12-mi-servicio/README.md), su [implementación A](TASK12_WEB_MI_SERVICIO_PANEL.md), `ServiceOverview.tsx`, auditorías T12, navegación, datos y pruebas de Inicio/Hoy, `ThemeData` y componentes compartidos Flutter. El [sistema visual común](TASK12_SHARED_VISUAL_SYSTEM.md) define tokens, patrones, semántica y correspondencias nativas. La [matriz de extensión](TASK12_VISUAL_ROLLOUT_MATRIX.md) cubre los destinos existentes por rol/plataforma y explicita dónde no hay una función equivalente.

**Inicio web:** conserva saludo, lectura/respuesta del resumen, actualización manual/al recuperar foco, navegación y estados reales. El contenido admite hasta 1520 px incluyendo padding, igual que el máximo actual de Mi servicio. Publicación visible se presenta como franja compacta con consulta secundaria. Si faltan requisitos, se conserva su acción contextual previa. Pendientes y Tu operación comparten una superficie con filas de solicitudes/pagos y rutas/pasajeros; no cuatro tarjetas de indicadores ni una copia de la ficha documental.

En un servicio visible, una acción operativa se destaca según datos existentes: solicitudes pendientes, después pagos pendientes, pasajeros asignados y finalmente rutas. Mientras se consultan solicitudes no se anticipa ese énfasis. Si falla esa consulta se muestra el error/reintento, sin inventar un cero; la otra información disponible se conserva. Los controles de destino siguen pasando por las reglas existentes. Preparación conserva cuatro grupos y detalles nativos; cupos por ruta conserva datos, fecha y semántica de capacidad bajo demanda, ahora en filas.

**Hoy Android:** fecha y estado siguen viniendo de `driver/today/`. El nombre del recorrido seleccionado gana jerarquía sobre un estado compacto con texto e icono. La superficie blanca reserva el azul sólido para Iniciar/Finalizar. Destino, mapas, capacidad y pasajeros forman un grupo con divisor; los contactos siguen bajo demanda y se reinician al cambiar ruta/sesión. Otras rutas y servicios anteriores conservan su despliegue, selección y recuperación. Se mantiene el vacío con Consultar guías, carga/error/reintento, bloqueo tras resultado incierto, confirmación de cierre y respuesta autoritativa del servidor.

La barra Material 3 Hoy / Mi plan / Ayuda, AppBar, Cuenta, teclado, Android Atrás y documentos legales conservan el comportamiento existente. No hay sidebar móvil, WebView ni componentes HTML. `FurgoOperationalPanel` y `FurgoLayout` se añaden como primitivas optativas; no cambian las superficies o el tema global de las otras pantallas.

## Archivos de esta ejecución

| Área                   | Archivos                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                    | `App.tsx` (solo clase de ancho de Inicio), `DriverOperations.tsx` (presentación de Inicio), nuevos `OperationalPanel.tsx` y `operational.css`                     |
| Pruebas web            | `DriverHomeStatus.test.tsx`, `App.test.tsx` (expectativas de ancho al entrar/regresar)                                                                            |
| Flutter                | `driver_home.dart` (presentación de Hoy), `furgo_theme.dart` (nuevas constantes optativas), `furgo_widgets.dart` (nuevo panel optativo)                           |
| Pruebas Flutter        | `driver_home_test.dart`                                                                                                                                           |
| Documentación/contexto | Este informe, sistema compartido, matriz y actualización de `.21st/design.json` / `DESIGN.md` que conserva la decisión histórica y registra la nueva autorización |

Los imports/primitivas no cambian destinos, operaciones o recursos de dominio. No se modifica `homeStatus`, backend, contratos, tipos API, bibliotecas, cuentas, planes/pagos/recorridos ni datos sintéticos del servidor. Los escenarios de prueba usan API/transportes simulados locales. No se tocaron landing T13, asistente T14 o demo r4. No hubo instalación de paquetes, reinicio de contenedores, commit, push, merge ni deploy.

## Verificación técnica

La evidencia temporal de esta ejecución está en `/tmp/furgoplus-home-batch1/`. Los resultados finales están registrados en la tabla siguiente. No son aceptación visual.

| Comprobación                                                                            | Resultado                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React focalizado: Inicio, operación y T12 (`react-targeted-final.log`)                  | 40/40; antes de añadir la comprobación adicional de contraste                                                                                                             |
| React Inicio con contraste (`react-home-contrast.log`)                                  | **12/12**, incluida comprobación de colores sobre el CSS real                                                                                                             |
| React suite completa (`react-full-verified.log`)                                        | **335/335**, 20 archivos, 101,93 s                                                                                                                                        |
| TypeScript, Vite build, lint y contratos                                                | Código 0 en los cuatro comandos; logs `typecheck-final.log`, `build-final.log`, `lint-final.log`, `contracts-final.log`. Contratos comprobados sin regenerarlos           |
| Flutter `analyze --no-pub` (`flutter-analyze-final.log`)                                | Sin observaciones                                                                                                                                                         |
| Flutter `test --no-pub --concurrency=1 --reporter=expanded` (`flutter-tests-final.log`) | **169/169**, suite convencional con motor Flutter; 166 anteriores + 3 nuevas                                                                                              |
| Formato de archivos modificados y `git diff --check`                                    | Prettier y Dart sin cambios pendientes; diff sin errores de espacios                                                                                                      |
| 21st CLI review (`21st-review-final.json`)                                              | 4 archivos web revisados; 0 errores, 0 advertencias y 0 sugerencias. La CLI no inspecciona Dart; no se atribuye una revisión Flutter a esta herramienta                   |
| Preservación SHA-256 (`preservation-result.json`)                                       | **352 archivos previos**: cambian solo los 10 previstos; los otros **342** mantienen su contenido. Se añaden dos archivos web y tres documentos; ningún cambio inesperado |

Cobertura nueva web: prioridad de solicitudes/pagos/pasajeros/rutas, una acción principal en estado estable, publicación visible secundaria, requisitos no visibles prioritarios, consulta de solicitudes fallida y recuperación sin cero ficticio ni copia de Documentos/Datos. Contraste de pares de texto sobre tokens declarados. Las pruebas previas cubren suspensiones, revisión pendiente, cupos fechados, errores/reintento, respuestas tardías, caducidad, navegación y conservación de borradores.

Cobertura nueva Flutter: destino/pasajeros agrupados con divisor manteniendo barra nativa y contacto privado; completado/desconocido sin acción de mutación; nombres/direcciones largos a 320 px y texto al 200 %, mapas y contactos alcanzables. Se ejecutan también los casos anteriores de inicio/fin, cancelación, conflictos, resultado incierto, selección/recuperación, múltiples rutas, privacidad, planes y sustitución de sesión. Los tests no realizan operaciones académicas.

El primer intento Flutter dentro del sandbox no pudo escribir la caché del SDK, situada fuera del workspace. Tras autorización explícita se ejecutaron análisis y suite convencional fuera del sandbox, con dependencias existentes y sin `pub get`. No se recurrió al runner alternativo sin sockets. No se compiló ni instaló APK en este lote.

Las primeras verificaciones React detectaron expectativas del ancho anterior al entrar y regresar a Inicio. Se actualizaron manteniendo la comprobación de ancho antiguo para los editores. Se conservó la actualización concurrente existente que verifica el aislamiento de sesión. La prueba adicional de contraste lee los tokens del CSS real con el patrón de lectura ya utilizado por la suite y respeta la configuración estricta de TypeScript. La suite final pasa completa; no se omiten casos. Una corrida previa registró además un fallo de paginación de Solicitudes que pasó al reejecutarse sin modificar ese componente, sus pruebas ni sus tiempos de espera; queda registrado como observación intermitente.

## Revisión humana en Fedora — solo lectura

Usar el entorno académico existente, normalmente `http://127.0.0.1:15173`, con sesión ya autorizada. Verificar qué checkout sirve el proceso: este lote no lo inicia ni reinicia. Si el proceso sirve un build previo, la captura no acredita este cambio. No publicar credenciales, nombres, contactos ni capturas con información privada. Usar los estados ya disponibles; si falta alguno, marcarlo no observado y recurrir a las pruebas simuladas, sin preparar ni modificar datos académicos.

1. Abrir **Inicio** como conductor. A 1920×1080, 1440×900 y 1280×800, revisar amplitud útil, saludo, franja compacta, dos áreas y filas; sin solapamientos ni franjas vacías desproporcionadas. El checklist no domina la entrada y Documentos/Datos no se repiten aquí.
2. En servicio visible, comprobar que Consultar publicación es secundario y la acción destacada corresponde a las cantidades recibidas. Seguir el acceso solo hasta el destino de lectura y volver con Inicio. No registrar, aprobar, aceptar, marcar pagos o cambiar rutas.
3. En una cuenta ya preparada con requisitos pendientes, comprobar siguiente acción, suspensión/desactivación y preparación desplegable. Conservar motivos y estados independientes; no asumir publicación a partir de aprobación. No completar requisitos en esta revisión.
4. Abrir/cerrar preparación y cupos por ruta; comprobar fechas, estado de rutas y nombres largos. Comparar conteos con las vistas de lectura correspondientes, sin confundir solicitudes de contacto con asignaciones.
5. Revisar 768×1024, 390×844 y ancho 320 px, además de zoom 200–400 %. A ≤1150 px la superficie apila los grupos; el menú actual se adapta a ≤900 px. Acciones de filas se expanden en el ancho pequeño. No debe existir desplazamiento horizontal de la página ni texto cortado. Los párrafos y cifras no se superponen.
6. Usar teclado (Tab, Shift+Tab, Enter y Espacio), salto al contenido, foco al navegar y lector disponible. Revisar nombre/orden de encabezados, botones y desplegables, estados comprensibles sin color y foco visible. Los botones conservan al menos 48 px de alto.
7. Para carga/error/reintento, utilizar exclusivamente un transporte local simulado o el entorno de pruebas aislado autorizado. Las pruebas automatizadas ya cubren estos casos; no cortar ni cambiar infraestructura académica para provocarlos.

Capturas propuestas: `fedora-inicio-1920-visible.png`, `fedora-inicio-1440-pendientes.png`, `fedora-inicio-390.png`, `fedora-inicio-320-zoom200.png`, y preparación/cupos abiertos sin datos privados. Registrar resolución, zoom, estado observado, checkout servido, fecha y comentario; son nombres sugeridos, **no capturas ya generadas**.

## Revisión humana en Samsung A54 — solo lectura de datos existentes

Se necesita una compilación que incluya este lote y el origen aislado ya acordado. El APK anterior no acredita estos cambios. Compilar/instalar es una operación posterior del operador; esta ejecución no cambia URL, firma, configuración Android ni el dispositivo. Comandos de preparación si corresponde, desde `mobile/`:

```bash
flutter analyze --no-pub
flutter test --no-pub --concurrency=1
# El operador suministra el origen existente autorizado, sin credenciales en logs.
flutter build apk --debug --no-pub --dart-define=API_BASE_URL="$TASK12_API_BASE_URL"
```

No ejecutar el último comando con variable vacía ni contra un origen improvisado. Comprobar aplicación `.task12`, versión/hash del APK y que no sustituye r4.

1. Abrir **Hoy** con sesión conductor ya existente. Revisar fecha chilena recibida, nombre del recorrido, estado y horario; la acción de inicio/fin debe ser fácil de encontrar. **No pulsarla sobre registros académicos.** La corrección de esas operaciones se verifica con transportes simulados en la suite.
2. Desplazar a destino y pasajeros. Confirmar que comparten superficie, que mapas es secundario y que cupos y recogida permanecen legibles. Abrir/cerrar contacto privado; seleccionar otra ruta si existe, sin cambiar sus datos, y comprobar ausencia del contacto anterior.
3. Consultar otras rutas y servicios anteriores si existen. No finalizar servicios pendientes durante revisión visual. Completado y estado desconocido no deben ofrecer iniciar/finalizar. Si el escenario no está disponible, marcarlo no observado; no fabricarlo en el servidor.
4. Revisar vacío y error solo con cuenta/escenario ya preparado o transporte aislado. Vacío ofrece Consultar guías; error ofrece recuperación y no parece un día sin servicios. Tras error de operación no se invita a repetir una escritura sin actualizar estado.
5. Ir a Mi plan/Ayuda y regresar; comprobar selección conservada, barra inferior nativa y Cuenta. Android Atrás debe mantener su comportamiento previo; no se exige rediseño de las pantallas ajenas al lote. No enviar formularios ni cambiar perfil.
6. Repetir fuente normal/grande, tamaño de pantalla grande y TalkBack. Verificar lectura de estado/nombre/horario/capacidad, acceso a contacto/mapas, desplazamiento único y objetivos ≥48 dp; acción del recorrido ≥56 dp. No debe haber texto cortado, botones tapados o navegación convertida en sidebar.

Capturas propuestas: `a54-hoy-planificado.png`, `a54-hoy-en-curso.png`, `a54-hoy-completado.png`, `a54-hoy-vacio.png`, `a54-hoy-texto-grande.png` y destino/pasajeros desplazados. Usar solo estados disponibles y ocultar información privada. No son capturas realizadas por el agente.

## Registro de aceptación y punto de detención

| Superficie      | Estado al cierre de implementación | Evidencia humana requerida                                                             |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| Inicio Fedora   | Pendiente                          | Resolución/zoom, cuenta anonimizada, captura y observación, APROBADA/RECHAZADA         |
| Hoy Samsung A54 | Pendiente                          | Versión/hash APK, fuente/pantalla, TalkBack, captura y observación, APROBADA/RECHAZADA |
| Resto de lotes  | Solo planificados                  | Autorización de alcance después de revisar el primer lote                              |

Solicitar al revisor identificar su siguiente tarea sin explicación y explicar el estado observado. Registrar problemas de comprensión además de opinión estética. Las pruebas técnicas y una captura parcial no certifican accesibilidad ni aceptación de producto. **Detener aquí: no implementar los lotes posteriores.**
