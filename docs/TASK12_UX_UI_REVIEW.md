# Task 12 — Revisión UX/UI de React

Fecha: 20 de octubre de 2026. Alcance: Plan y reportes, seguido de Ayuda y soporte.

La dirección visual fue aprobada por el operador mediante capturas reales de
escritorio y simulación móvil de 390 × 844. Los ajustes puntuales posteriores a
esa aprobación se describen al final de este informe. Las comprobaciones de la
primera revisión y su checklist se conservan como registro histórico.

La herramienta local de inspección sigue sin navegador conectado (`apps: []`,
`browsers: []`). Por eso no se declara una nueva validación visual de los ajustes
ni una revisión de tablet en navegador; la aprobación visual previa del operador
se conserva. Las pruebas DOM y la revisión de CSS no sustituyen esas capturas.

## Decisiones UX

### Plan y reportes

- Un único título de página. Tarjeta inicial con nombre, estado en español, fechas
  de vigencia y precio de referencia en CLP cuando Django lo entrega. Se aclara que
  no hay cobro automático; el valor comercial no se presenta como un cobro realizado.
- Se conserva la consulta automática al entrar, recuperar foco, volver a la pestaña,
  cada 30 segundos y al término de la vigencia. En las consultas automáticas se
  conserva el resumen mientras responde el servidor, evitando desmontajes y saltos
  repetidos. La respuesta con acceso revocado retira los datos restringidos; no se
  restauran respuestas obsoletas. El botón secundario dice “Actualizar información”.
- Básico muestra continuidad de la gestión diaria y acceso a Inicio. Sin plan,
  vencido, futuro o suspendido: explicación de vigencia, ayuda y operaciones según
  el acceso efectivo; no se ofrece contratación ni renovación automática.
- Pro muestra tres tarjetas mensuales: monto de pagos sin anulados, recorridos
  registrados y solicitudes recibidas. Filtro de mes y estado vacío orientado a
  consultar otro período. Los estados y cantidades se abren en cada tarjeta.
- Elite agrega comparación con el mes anterior, diferencia expresada como “más”,
  “menos” o “sin cambio”, y tres botones Excel. No se interpreta una variación
  como buena o mala ni se inventan porcentajes/tendencias sin una base de datos.
- Las descargas preceden al detalle ampliado. Registros del mes, cupos actuales y
  notas metodológicas se consultan bajo demanda. Se mantienen las distinciones
  entre registros manuales, cobros bancarios, capacidad, asistencia y ocupación.
- No se imprimen códigos de capacidades, flags, IDs de rutas/registros ni listas
  repetitivas de restricciones. Las claves siguen utilizándose internamente para
  respetar exactamente los permisos de Django.
- Los beneficios del plan asignado se derivan de las capacidades incluidas e
  implementadas entregadas por el servidor; precio, etiqueta y prioridad vienen
  de esa misma respuesta. La explicación general de Básico/Pro/Elite sigue el
  catálogo actual de `backend/drivers/capabilities.py`. No se duplican precios de
  otros planes ni se consulta el catálogo exclusivo de administración.

### Ayuda y soporte

- Tres destinos con propósito explícito: guías por tema, asistente automático y
  solicitudes/conversación con el equipo. Se conservan los accesos de cada rol.
- Índice compacto por temas; las guías están agrupadas y cerradas inicialmente.
  Los enlaces de origen del asistente abren la guía indicada y trasladan el foco.
- El asistente explica su alcance bajo demanda. La pregunta tiene etiqueta y
  aviso de privacidad. Error, falta de acceso o respuesta insuficiente ofrecen
  recuperación hacia guías o un borrador de soporte revisable.
- Una derivación conserva el formulario vacío: no copia consultas privadas ni
  envía tickets antes de la revisión y confirmación explícitas existentes.
- Las solicitudes muestran asunto, estado legible y última actualización. La
  prioridad y urgencia se explican en contexto; el panel administrativo conserva
  la información necesaria para gestionar la cola.
- El detalle presenta los tres eventos más recientes; todos los anteriores siguen
  disponibles en un desplegable. Se preservan autoría, fechas, cambios de estado
  y motivos. Para el solicitante se muestra “Soporte”/“Solicitante”, sin IDs internos
  de usuarios; el equipo conserva esos identificadores en su panel.
- Cargas y envíos tienen mensajes de progreso; listas vacías ofrecen una acción.
  La paginación se omite si no hay otra página. El botón de consulta del historial
  dice “Actualizar esta solicitud”, evitando sugerir una reapertura de estado.
- Disponibilidad automática y atención humana se explican por separado. Sin
  promesas de respuesta humana inmediata 24/7. La prioridad no equivale a un plazo.

## Componentes, responsive y accesibilidad

Se reutilizan `ProductIcon`, botones, paneles, tokens azules y patrones de foco de
FurgoPlus. Los patrones compartidos de Task 12 están acotados a `.task12-screen`;
no se cambian los estilos de las pantallas operativas antiguas.

Las tarjetas tienen columnas adaptables, con una columna en móvil y cuando el
espacio útil de escritorio es menor. Los formularios, controles y botones se
apilan en móvil; los textos largos pueden partirse. La única tabla se mantiene
bajo demanda, dentro de una región con desplazamiento horizontal y foco propio.

Objetivos mínimos: 48 px en escritorio y 54 px en móvil para botones, selectores,
campos y desplegables. El consentimiento tiene un área de etiqueta de al menos
54 px y casilla visible. Se utilizan controles nativos, etiquetas explícitas,
encabezados, estados `status`/`alert`, foco visible y navegación al contenido.
No se introducen animaciones ni información que dependa solamente del color.

Contraste calculado con los colores declarados:

| Uso | Relación |
| --- | ---: |
| Texto principal / blanco | 14,30:1 |
| Texto secundario / blanco | 6,31:1 |
| Azul / blanco, incluido el botón primario | 7,47:1 |
| Azul / fondo azul suave | 6,67:1 |
| Estado vigente / fondo verde suave | 6,44:1 |
| Aviso / fondo amarillo suave | 6,03:1 |

Esta es una implementación inspirada en WCAG 2.2 AA, sin afirmar certificación.
El comportamiento efectivo con lector de pantalla, zoom y distintos navegadores
requiere la revisión manual pendiente.

## Archivos de esta revisión

| Archivo | Cambio |
| --- | --- |
| `web/src/App.tsx` | Elimina título duplicado de reportes; conecta Inicio y Ayuda. |
| `web/src/DriverReports.tsx` | Jerarquía, tarjetas, beneficios, detalle, descargas y actualización sin desmontajes repetidos. |
| `web/src/task12.css` | Patrones visuales compartidos y responsive, acotados a Task 12. |
| `web/src/style.css` | Retira las reglas previas de reportes, trasladadas al CSS acotado. Queda igual a HEAD; se informa respecto del estado al iniciar esta revisión. |
| `web/src/HelpSupport.tsx` | Temas, destinos, recuperación, historial compacto y estados. |
| `web/src/help-support.css` | Presentación de guías, asistente, formularios y conversaciones. |
| `web/src/DriverReports.test.tsx` | Ajusta microcopy y comprueba datos reales, ausencia de plan, continuidad de actualización y recuperación. |
| `web/src/HelpSupport.test.tsx` | Comprueba guías, historial completo, vacío y recuperación del asistente. |
| `web/src/HelpSupportSession.test.tsx` | Actualiza el nombre del control de consulta; conserva los casos de privacidad. |
| `docs/TASK12_UX_UI_REVIEW.md` | Decisiones, evidencia y aceptación pendiente. |

El árbol de trabajo ya contenía la implementación de Task 12 sin commit. Esta lista
corresponde únicamente a la revisión UX/UI, no a todo el diff acumulado de la rama.
No se editaron contratos, cliente API, backend, reportes/exportaciones del servidor,
catálogo, migraciones, bases existentes, datos de demo r4 ni Flutter. No se ejecutaron
commit, push, merge o deploy.

## Pruebas

Comandos de esta revisión:

```bash
npm run test --prefix web -- --maxWorkers=1
npm run typecheck --prefix web
npm run lint --prefix web
npm run format:check --prefix web
npm run build --prefix web
npm run contract:check --prefix web
git diff --check
```

Los casos específicos de reportes, ayuda y privacidad de sesión pasan: **39/39**.
Se agregaron ocho pruebas de comportamiento, manteniendo las existentes y
actualizando sus expectativas de presentación.

El primer intento completo con dos workers tuvo **282/283**: falló una aserción de
página en `DriverRequests.test.tsx`, sin cambios en ese archivo ni su implementación.
Los **20/20** casos de ese archivo pasaron al ejecutarlos por separado con un worker.
No se amplió ningún timeout ni se alteraron pruebas antiguas para ocultar ese resultado.
La repetición completa final con un worker pasó: **283/283 pruebas en 18 archivos**
(83,21 s). Después del último cambio de presentación también pasaron el build de
producción, typecheck independiente, lint, formato de toda la web y la verificación
de contratos. `git diff --check` pasó. No se ejecutaron pruebas del backend porque
esta revisión no cambió su implementación.

## Checklist de aceptación

Comprobado por implementación y pruebas automatizadas:

- [x] Plan, estado, vigencia y precio informado por Django; sin permisos técnicos visibles.
- [x] Básico sin reportes ficticios; sin plan y vencimiento con recuperación.
- [x] Pro: tres resúmenes, filtro, datos registrados y período vacío.
- [x] Elite: comparación y tres descargas mediante el cliente API existente.
- [x] Revocación por plan/vigencia, respuestas tardías y privacidad al cambiar sesión.
- [x] Guías agrupadas, asistente separado del equipo y derivación sin envío automático.
- [x] Historial íntegro, estados legibles, lista vacía y recuperación de errores.
- [x] Prioridad explicada sin promesa de atención inmediata.

Pendiente de aceptación visual humana, en navegador conectado:

- [ ] Escritorio 1440 × 900 y 1280 × 800: jerarquía, alineaciones, tamaño de tarjetas y un solo título visible.
- [ ] Tablet 768 × 1024 y escritorio con menú lateral: columnas y formularios sin cortes.
- [ ] Móvil 390 × 844 y 320 px de ancho: botones de 54 px, sin desborde de página ni texto recortado.
- [ ] Básico, Pro, Elite, sin plan, vencido, futuro y perfil suspendido: revisar cada presentación con datos sintéticos.
- [ ] Estados de carga, error y éxito; mes vacío, datos abundantes y números grandes.
- [ ] Recorrido completo con Tab/Shift+Tab, Enter y Espacio: filtro, desplegables, guías, asistente, creación y respuestas.
- [ ] Foco visible/restaurado, zoom 200–400 %, contraste efectivo y lector de pantalla.
- [ ] Tres Excel reales en entorno aislado autorizado; confirmación visible y descarga en navegador.
- [ ] Apoderado y administrador: navegación, permisos y comprensión de la atención.
- [ ] Historial largo: últimos tres eventos, anteriores consultables y respuesta sin perder contexto.

Para una revisión posterior: otras pantallas conservan combinaciones de títulos del
contenedor y títulos internos; el icono de navegación de reportes comparte el de pagos;
la paginación de Solicitudes mostró una aserción inestable durante esta ejecución.
Se identifican como puntos de revisión, sin ampliar este rediseño a pantallas antiguas.

Task 12 se detiene antes de Flutter/T12.10.


## Ajustes puntuales tras aprobación visual

- Sin suscripción, “Sin plan asignado” aparece una sola vez. “Conocer los planes”
  es la acción principal: abre el detalle comercial existente y enfoca su título.
  “Ir a Inicio” conserva su navegación real como acción secundaria.
- “Continúa con tu servicio” usa menos espacio, un título menor y texto abreviado.
  No se tocaron las consultas, resúmenes, comparaciones ni descargas de Pro/Elite.
- Se retiró “Actualizar ayuda” de la vista normal. Los fallos mantienen las
  acciones de recuperación existentes.
- El índice de categorías se reemplazó por el selector nativo “Tema de ayuda”.
  Inicialmente muestra el primer tema disponible; elegir otro presenta únicamente
  sus preguntas. “Todos los temas” permite consultar el conjunto completo.
  El cambio es local, sin nuevas consultas, búsqueda ni cambios de API.
- Al volver desde una respuesta del asistente, se selecciona la categoría de la
  guía citada, se abre la pregunta y se enfoca su título.
- El acceso al asistente indica disponibilidad comprobada, desconocida o ausencia
  de acceso según `assistant_modes`. Sin acceso no invita a conversar ni muestra
  formulario; conserva la explicación y las alternativas de guías/soporte.
- Se mantienen los tres destinos separados: guías, asistente y solicitudes al equipo.

Archivos de este ajuste: `web/src/DriverReports.tsx`, `web/src/HelpSupport.tsx`,
`web/src/DriverReports.test.tsx`, `web/src/HelpSupport.test.tsx`,
`web/src/help-support.css`, `web/src/task12.css` y este informe.

Se revisaron las reglas responsive para escritorio (1440/1280 px), tablet
(768 px) y móvil (390 × 844): el selector ocupa el ancho disponible hasta 32 rem,
no agrega una lista vertical de categorías y conserva objetivos de 48 px en
escritorio/tablet y 54 px en móvil. La compactación se limita a la tarjeta de
continuidad, que no forma parte de los reportes disponibles de Pro/Elite.
La revisión de renderizado de estos ajustes sigue pendiente de navegador conectado.

La comparación por contenido confirmó que backend, modelos, contratos, cliente
API, App, demo y archivos Flutter no cambiaron respecto del inicio de este ajuste.
También se compararon las secciones de consulta/descarga y reportes Pro/Elite:
son idénticas a esa referencia. Sin commit, push, merge, deploy ni avance a Flutter.


Validación final de estos ajustes: **285/285 pruebas React**, 18 archivos,
`--maxWorkers=1` (81,82 s); **41/41** casos específicos de Task 12. Typecheck,
lint, formato, build de producción, verificación de contratos y `git diff --check`
aprobados. Las pruebas cubren filtro por categoría/Todos los temas, retorno desde
la guía citada, recuperación de carga, disponibilidad del asistente, prioridad de
la acción comercial y navegación a Inicio, además de las regresiones existentes.
