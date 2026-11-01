# T12.10 — Corrección de navegación Flutter para revisión humana

Fecha: 25-10-2026. Rama: `task/12-plan-capabilities`.
Objetivo de revisión del proyecto: 04-11-2026; entrega: 05-11-2026.
Estado: corrección implementada y validada con motor Flutter; pendiente APK nuevo
y aceptación UX en Samsung A54. Detenerse aquí para revisión humana.

## Diagnóstico de solo lectura al retomar

- HEAD `c0854de`: merge de T11. No hay commits de T12; las entregas están en el
  árbol de trabajo. Había 14 archivos versionados modificados, además de archivos
  nuevos de backend, React, Flutter y documentación aún sin seguimiento.
- T12.1–T12.9 y T12.10 estaban implementadas. Se conservaron todos los cambios.
  No había barra inferior del conductor: `DriverHome` abría Mi plan o Ayuda desde
  el menú superior «Plan y ayuda» y reemplazaba el Scaffold completo.
- Mi plan compartía el resumen con guías, soporte y asistente. Hoy vacío solo
  anunciaba que no había rutas. **El rediseño solicitado seguía pendiente.**
- Evidencia histórica en el repositorio: Django/PostgreSQL 180/180 en el informe
  de soporte; React 285/285 en el informe UX; Flutter 143/143 mediante ejecutor
  sin sockets en el informe móvil. Son resultados documentados de otras sesiones,
  no ejecuciones realizadas ahora. Existen sus archivos de pruebas.
- Había un APK debug del 20-10 en `mobile/build/app/outputs/flutter-apk/`, con
  metadatos `com.example.furgoplus.task12`; esto no demuestra que el rediseño
  estuviera hecho. El informe móvil histórico aún declaraba pendiente el APK.
- El usuario confirmó funcionamiento real en Samsung A54 y rechazó su UX por
  navegación oculta y exceso de texto. Esa aceptación funcional proviene del
  usuario: esta sesión no accedió al teléfono ni aporta una nueva prueba real.

## Corrección aplicada

- Un Scaffold del conductor contiene una `NavigationBar` Material 3 con **Hoy**,
  **Mi plan** y **Ayuda**, iconos y etiquetas siempre visibles. Se conserva en
  guías, artículos, asistente, solicitudes, detalle y formularios, incluso mientras
  se consulta el servidor o se muestra un error. La barra se eleva sobre el teclado
  de los formularios; el teclado se descarta al cambiar de destino. Los diálogos
  siguen siendo modales.
- **Cuenta**, con texto e icono en cabecera, ofrece **Mi cuenta** y **Cerrar sesión**.
  La cuenta muestra solo la identidad autenticada existente. Menús antiguos no
  pueden cerrar una sesión de reemplazo; caducar sesión también cierra el diálogo.
- **Mi plan** consulta únicamente capacidades, presenta nombre y estado primero,
  y deja gestión, vigencia/atención y beneficios bajo desplegables. No contiene
  guías, formularios ni asistente, ni depende de cargar Ayuda correctamente.
- **Ayuda** ofrece primero guías, luego solicitudes al equipo y, si los permisos
  efectivos lo permiten, asistente automático. Disponibilidad, alcance y tiempos
  de atención se explican bajo demanda. Se conservan los avisos de privacidad y
  la revisión explícita antes de escribir.
- **Hoy** vacío explica qué aparecerá y ofrece «Ver cómo preparar mi servicio»
  hacia Ayuda. «¿Esperabas un recorrido?» despliega la indicación de revisar rutas
  y horarios en la web y permite actualizar. No se agregan operaciones móviles.
- Al visitar plan/ayuda se conservan datos y recorrido seleccionado de Hoy, sin
  repetir automáticamente una transición ni recargar su endpoint. Al salir de
  plan/ayuda se desmontan sus formularios y contexto. Una nueva cuenta comienza
  en Hoy, sin borradores, tickets ni respuestas de la anterior.
- Se conservan adaptador de sesión/CSRF, permisos efectivos, confirmaciones,
  controles ante respuestas tardías y flujos del apoderado. Android debug mantiene
  `applicationIdSuffix = ".task12"`, sin editar su configuración en esta sesión.

Archivos editados en esta continuación: `mobile/lib/driver_home.dart`,
`mobile/lib/plan_help_screen.dart`, `mobile/test/driver_home_test.dart`,
`mobile/test/plan_help_test.dart`, `mobile/test/session_test.dart`, `mobile/README.md`,
`docs/PLAN_CAPABILITIES_SPEC.md`, el encabezado del informe Flutter histórico y
este informe con su directorio de evidencias.

## Validación actual

Flutter **3.47.2**, Dart **3.13.2**. SDK y Pub cache copiados a `/tmp`, dependencias
resueltas sin conexión y sin cambiar `pubspec.yaml` ni `pubspec.lock`. Sin paquetes
nuevos. Ninguna prueba usa un backend o una base existente.

| Comprobación | Resultado |
| --- | --- |
| `flutter analyze --no-pub` | Aprobado, sin observaciones |
| Formato Dart de `lib test tool` | Aprobado, 23 archivos, sin cambios pendientes |
| Regresión con `flutter_tester` y ejecutor existente sin sockets | **152/152**, siete archivos de pruebas, cero fallos |
| Bundle debug `lib/main.dart`, API de ejemplo | Aprobado: Dart y recursos de la aplicación |
| `flutter test --no-pub --concurrency=1` | Bloqueado al iniciar: socket `127.0.0.1`, `Operation not permitted`; no se declara aprobado |
| `flutter build apk --debug --no-pub`, API de ejemplo | Bloqueado antes de compilar por `FileLockContentionHandler`: `Could not determine a usable wildcard IP for this machine` |
| `git diff --check` | Aprobado |

Se añadieron nueve casos: persistencia de los tres destinos a través de guías y
formularios; conservación del recorrido seleccionado; navegación durante carga y
error; cierre del diálogo de cuenta al caducar sesión; cierre desde Ayuda y cambio
conductor → otro conductor → apoderado; respuesta tardía de la cuenta anterior;
y tres anchos **320/360/390 px con texto al doble**, también con teclado simulado
de 300 px, barra por encima y cambio de destino que cierra el teclado. Se actualizaron expectativas
anteriores para los accesos visibles. Se mantiene la cobertura previa de permisos,
CSRF, sesiones, confirmación de escrituras y operación diaria.

Las primeras verificaciones detectaron un `const` incorrecto, expectativas de la
navegación anterior y una colisión de PageStorage al intentar conservar el scroll.
Se corrigieron; se retiró esa clave de scroll y la regresión final completa pasó.
No se ampliaron timeouts ni se omitieron casos. Las 152 pruebas finales incluyen
las 143 anteriores; no se suman repeticiones como pruebas distintas.

Logs actuales: [evidencias](evidence/task12-flutter-navigation/README.md).
El ejecutor alternativo usa el motor Flutter y aserciones reales, pero interfaces
internas de `test_api`. No sustituye ejecutar `flutter test` convencional en un
entorno que permita sockets. El bundle aprobado no valida Gradle, plugins Android,
instalación, TalkBack, teclado nativo ni aceptación táctil.

No se produjo un APK actualizado ni se instaló nada. El APK anterior se conservó
sin cambios y no debe utilizarse como evidencia de esta corrección. Para compilar
la revisión fuera del entorno restringido, usar una URL de pruebas acordada:

```bash
cd mobile
flutter pub get --offline
flutter analyze --no-pub
flutter test --no-pub --concurrency=1
# Definir TASK12_API_BASE_URL con el origen del entorno de revisión aislado.
flutter build apk --debug --no-pub --dart-define=API_BASE_URL="$TASK12_API_BASE_URL"
```

La variante debug resultante debe identificarse como `com.example.furgoplus.task12`.
No sustituir el APK de r4. No se autoriza aquí instalación ni cambios de backend.

## Guion breve Samsung A54 — pendiente

Usar la nueva compilación `.task12` y cuentas sintéticas del entorno aislado.

1. **Hoy:** ver Hoy / Mi plan / Ayuda abajo sin abrir menús. Sin recorridos,
   entender el siguiente paso y abrir la ayuda con la acción principal.
2. **Mi plan:** ver nombre/estado; desplegar beneficios. Cambiar a Ayuda: guías,
   soporte y asistente autorizado deben estar allí, separados del plan.
3. **Ayuda:** abrir una guía y un formulario; comprobar barra persistente y Volver
   de Android. Volver a Hoy y comprobar el recorrido seleccionado y sus acciones.
4. **Cuenta → Cerrar sesión:** iniciar con otro conductor y luego apoderado.
   No deben quedar textos, tickets ni datos de la cuenta anterior.
5. **Legibilidad:** repetir con texto grande y teclado; verificar etiquetas,
   controles alcanzables, ausencia de recortes y lectura con TalkBack.

Registrar resultado UX **aprobado/rechazado**, cuenta de ensayo, versión/APK y
observaciones. No hay aceptación humana de este rediseño todavía.

## Límites de alcance

Comparación de contenido antes/después: se conservaron backend, React, configuración
Android, adaptador de sesión, servicios Flutter y todos los demás archivos previos,
salvo los enumerados arriba. No se tocaron Django, PostgreSQL, bases existentes,
homelab, Cloudflare ni r4. Sin commit, push, merge, deploy, T12.11 ni landing.
