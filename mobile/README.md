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
