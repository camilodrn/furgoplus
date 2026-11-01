# FurgoPlus mobile

One Flutter app serves parent and driver accounts. It uses Django database sessions through `NativeSessionApi`; the session cookie is persisted only with `flutter_secure_storage` 11.2.0. The CSRF token and CSRF cookie stay in memory and are refreshed on restart. Android backup is disabled in the manifest. See [Task 02 acceptance](../docs/AUTH_ACCEPTANCE.md) for the HTTPS/device gate.

The main Android manifest must declare `android.permission.INTERNET` for normal APKs; the profile manifest alone is insufficient. Native JSON requests set the UTF-8 byte `Content-Length` for compatibility with Django's development WSGI server behind the acceptance proxy.

For local health and auth development, configure `API_BASE_URL` for an API origin reachable from the emulator/device. `10.0.2.2` is the Android emulator alias for the host; a physical device needs its own reachable URL. HTTP requires both a debug build and `ALLOW_HTTP_API=true`. Use HTTPS with a trusted certificate for acceptance and release builds. The app sends cookies only to its configured API origin and rejects API redirects.

```bash
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=https://app.example.test
```

Parent signup, discovery and contact requests are on mobile. Drivers register on React and can log in on mobile to inspect the server-derived Chilean service date, today's private roster and capacity, start or complete a run, recover an unfinished earlier run, and open the destination in an external maps application. The map action shares only the destination with that provider and requests no device location permission. Admin accounts receive an unsupported mobile shell with logout. All role navigation comes from server identity; logout disposes private role-specific screen state.

On the homelab demo, registration is illustrative and makes no registration
request; the team provisions fictional accounts privately. Normal environments
retain signup. Use [DEMO_MODE](../docs/DEMO_MODE.md) for build flags and acceptance.
The operator confirms the Android APK works against r4 HTTPS; detailed native
security evidence remains separate in [final review](../docs/TASK11_FINAL_REVIEW.md).

For the local Samsung academic demo, use the [demo runbook](../docs/DEMO_RUNBOOK.md):
`adb -s <serial> reverse tcp:8000 tcp:8000` plus a debug build configured with
`API_BASE_URL=http://127.0.0.1:8000` and `ALLOW_HTTP_API=true`. A restored isolated
target uses its own port (normally 18001) on both sides of reverse and in the build.
Reverse must be re-established after USB reconnect/reboot. This local HTTP path is
not the HTTPS/secure-storage acceptance gate; never bypass certificate validation.

Task 12.10 now provides a persistent Material 3 driver bottom bar: **Hoy**, **Mi plan**,
and **Ayuda**, with labels always shown. **Cuenta** in the header opens the account view, which includes
**Cerrar sesión**. Plan benefits and help are separate screens; guides, support
and the effective assistant remain under Ayuda. An empty Hoy explains the next step.
The current parent navigation is described below; earlier header-only Help is superseded. Role guides, own support history,
confirmed creation/replies, and the effective Pro/Elite assistant reuse the native
session/CSRF adapter. Monthly reports and Excel remain on React. Plan changes,
payments and automated renewals are not mobile actions. Nothing from these screens
is persisted. Dates use the device timezone, explicitly labelled. See
[Task 12 mobile validation](../docs/TASK12_FLUTTER_VALIDATION.md) for test evidence,
the restricted-environment test runner, known limits and the mobile acceptance script.
The [navigation review](../docs/TASK12_FLUTTER_NAVIGATION_REVIEW.md) supersedes the
original driver header navigation and records the Samsung UX rejection, correction,
current evidence and short phone inspection. Android debug retains the separate
`com.example.furgoplus.task12` application ID.

The comprehensive Flutter visual revision keeps Task 12 acceptance pending on the
real Samsung A54. It replaces the driver account dialog with an integrated view,
shares design tokens across roles, simplifies login/plan/help and keeps the parent
bottom bar in Help and above the keyboard. See the [visual review and five-screen
acceptance script](../docs/TASK12_FLUTTER_VISUAL_REVIEW.md), the [design guide](../docs/TASK12_FLUTTER_DESIGN_SYSTEM.md)
and [current evidence](../docs/evidence/task12-flutter-visual/README.md). Earlier
validation documents are historical; automated tests do not grant UX acceptance.


The [integral Android review (29 October)](../docs/TASK12_FLUTTER_INTEGRAL.md)
is the current acceptance matrix for both roles. Driver navigation remains
**Hoy / Mi plan / Ayuda**; parent navigation is **Buscar / Solicitudes / Ayuda**.
Both expose **Cuenta** in the header and preserve the active help draft while
consulting the account. Guides support text search and topic disclosure. Capacity
has the same occupied/available meaning in both roles, and small lists do not
show redundant page controls. Plan expiry appears once, with extra benefits and
conditions under disclosure.

Reserved `.test` account emails, existing demo mode, and the build flag
`--dart-define=FURGOPLUS_SYNTHETIC_DATA=true` identify synthetic data and disable
external maps. Set that flag when a synthetic environment uses other email
domains. This marker grants no permissions and does not alter API operations.
Normal real-data accounts retain the existing external maps action.

See the [new widget evidence](../docs/evidence/task12-flutter-integral/README.md)
and the Samsung script in the matrix. Acceptance is read-only: do not start/end
runs, recover services, send/reply/cancel requests or save profile changes. A fresh
APK and physical accessibility review remain required; historical APKs and HTML
prototype screenshots do not validate this implementation.
