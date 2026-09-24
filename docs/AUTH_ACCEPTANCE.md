# Task 02 authentication operations and acceptance

ADR 0002 remains binding. Both clients use Django database sessions. The API owns role and identity; neither client sends a role during login. Public registration accepts `parent` and `driver` only, creates the matching minimal profile, and requires a separate login. Administrator accounts are provisioned only through restricted Django management/admin access.

## API protocol

| Endpoint | Access | Result |
| --- | --- | --- |
| `GET /api/v1/auth/csrf/` | Public | Sets host-only `csrftoken`; returns `{ "csrf_token": "<masked>" }` with `Cache-Control: no-store`. |
| `POST /api/v1/auth/register/` | Public with CSRF cookie and `X-CSRFToken` | Required JSON: `email`, `password`, `role`, `display_name`; returns minimal identity, HTTP 201, without a login session. |
| `POST /api/v1/auth/login/` | Public with CSRF cookie and `X-CSRFToken` | Required JSON: `email`, `password`; returns minimal identity and a new masked CSRF token. Session and CSRF secret rotate. |
| `GET /api/v1/auth/me/` | Session | Returns `id`, normalized `email`, server role and nullable `display_name`. |
| `POST /api/v1/auth/logout/` | Session and CSRF | Flushes the current session; returns `{ "ok": true }`. |

All failures use `{ "code", "message", "fields" }`. In particular, `not_authenticated`, `permission_denied` and `csrf_failed` are distinct. After an explicit `csrf_failed` response, React refreshes the CSRF token and retries the rejected write once; a second failure is shown to the user. Flutter refreshes the token and asks the user to retry. Neither client replays writes after timeouts or ambiguous network failures. Invalid login details use the same generic response whether the email exists or not. Identity responses and auth lifecycle responses are non-cacheable. No account flag or password hash is serialized.

In HTTPS environments, session and CSRF cookies are host-only, path `/`, `Secure`, `HttpOnly`, `SameSite=Lax`. The session expires at an absolute instant 12 hours after login. `SESSION_ENGINE` is Django's database backend. Django's session authentication hash invalidates a session after a password change. Local debug HTTP is the existing Task 01 exception; do not use it for acceptance evidence. The same HTTPS origin must serve React and proxy `/api/` to Django. Flutter sends an `Origin` header with unsafe requests, validates TLS normally, rejects redirects, and sends stored cookies only to the configured API origin.

Login is limited to **10 attempts per source IP per 15 minutes** and registration to **5 attempts per source IP per hour**. Counters live in PostgreSQL (`AuthThrottle`) and updates serialize on each source/action row, so they apply across workers on the single database host. There is no proxy-aware IP override: configure and validate trusted proxy forwarding before exposing a deployment, or the reverse proxy's address will become the shared limit. Expired counters can be deleted operationally after their windows. The database session cleanup command is `python manage.py clearsessions` on a schedule; expiry does not rely on this cleanup.

## Administrator provisioning

From a restricted backend shell with the production environment already configured, run `python manage.py createsuperuser`. Enter the administrator email and a unique password at its interactive prompts. The custom user manager creates an active account with `role=admin`, `is_staff=True`, and `is_superuser=True`. Do not put the password in an environment file, script, repository or command argument. There is no admin signup API. Verify in the Django admin or restricted shell that those flags are set, then use the React login form. Remove/restrict operator shell access separately from the public application.

## Host and device acceptance gate

Use a staging HTTPS origin with a certificate trusted by the browser and Android system trust store. Keep `DJANGO_DEBUG=false`, matching `API_PUBLIC_ORIGIN` and `WEB_PUBLIC_ORIGIN`, explicit allowed hosts and the normal secure-cookie settings. If TLS terminates at a reverse proxy, set `DJANGO_TRUST_PROXY_SSL_HEADER=true` only after that proxy strips inbound `X-Forwarded-Proto` and sets its own value; Django must see HTTPS for correct CSRF Origin checks. Do not bypass certificate or Origin validation. Apply PostgreSQL migrations and create a synthetic administrator with the procedure above. Run:

```bash
cd web && npm ci && npm run dev
# In another terminal, from mobile/:
flutter pub get
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://app.example.test
flutter devices
flutter run -d <android-device-id> --dart-define=API_BASE_URL=https://app.example.test
```

The web command presumes the normal same-origin HTTPS reverse proxy in front of React and Django; `npm run dev` alone is HTTP and cannot provide HTTPS acceptance evidence. Replace `app.example.test` with the actual HTTPS origin and `<android-device-id>` with the device ID. Do not pass `ALLOW_HTTP_API` for this gate. On Android, the API host must resolve and its certificate chain must be trusted. The debug build uses Java 21 and the configured Android SDK.

The Android **main** manifest declares `android.permission.INTERNET`; the profile-only manifest permission does not grant network access in a normal APK. It also keeps `android:allowBackup="false"`. Check the installed package with `adb shell dumpsys package com.example.furgoplus` when diagnosing socket permission errors. Native JSON POSTs send UTF-8 bytes with an explicit byte `Content-Length`, which Django's development WSGI server needs to read the request body; a chunked POST can appear as empty request data and produce `validation_error` for both registration and login.

For this Compose development stack behind an HTTPS reverse proxy, the backend healthcheck sends `X-Forwarded-Proto: https` to its loopback HTTP listener and requires HTTP 200 plus the health JSON body. `infra/smoke.sh` sends the same header. With `DJANGO_DEBUG=false`, this succeeds only when `DJANGO_TRUST_PROXY_SSL_HEADER=true` is configured for a proxy that strips inbound client copies of that header and supplies its own. The check does not follow redirects, so an untrusted or missing proxy setting fails health rather than trying HTTPS against Django `runserver`.

1. In the HTTPS browser, register a synthetic driver, then explicitly log in. In Network tools verify `csrf/` sets `csrftoken`, login includes cookie plus `X-CSRFToken`, login rotates both cookie values, `me/` returns driver identity, and logout includes the new token. Confirm `me/` is rejected afterward and browser reload stays signed out. Repeat with a provisioned admin. A parent login must show the mobile-use shell, not driver/admin controls.
2. On Android, register a synthetic parent and explicitly log in. Inspect `me/` and the parent shell; then log out. Log in with a synthetic driver on the same app and confirm the driver shell. Log in with the provisioned admin and confirm the unsupported mobile shell. Use the device network inspector or an HTTPS server trace that redacts cookie/token values to verify `Origin` and CSRF headers. Do not log raw auth payloads.
3. While logged in on Android, run `adb shell am force-stop com.example.furgoplus` and relaunch with `adb shell monkey -p com.example.furgoplus 1`. Confirm the app restores the same server identity after a fresh `csrf/` then `me/`. The real plugin must access Android Keystore-backed storage during this path. The Android manifest disables backup. Log out, force-stop/relaunch, and confirm no restoration; verify the previous server session row is gone and `me/` with that old cookie returns `not_authenticated` in a private test harness.
4. Repeat with a server-expired session and a disabled account. Send a missing/wrong CSRF token and a foreign `Origin` with a private test client; expect JSON `csrf_failed`, not HTML. Verify the pre-login token fails on a protected POST after login rotation. Interrupt network access before native logout; the app must clear local access and show an unconfirmed server logout message. Restore network and verify the server session eventually expires or is explicitly invalidated; local clearing alone is not server revocation.
5. Inspect cookie attributes on HTTPS: host-only, path `/`, `Secure`, `HttpOnly`, `SameSite=Lax`. Do not use browser JavaScript to read the CSRF cookie. Verify cookie values, passwords and masked tokens do not appear in ordinary device preferences, backup data, logs or browser storage. Record the browser/device identity, build, origin and result for this gate without recording secrets.

The native HTTPS/secure-storage result must come from a real Android emulator or device. Unit tests with fake transport/storage establish deterministic behavior but are not native evidence. If a substantive platform or protocol failure prevents this sequence, stop and explicitly supersede ADR 0002 before changing the authentication mechanism.

Real host progress through 23 September 2026: PostgreSQL migrations, backend and web suites, HTTPS health/CSRF and browser driver signup/login passed. Android 15 confirmed the main-manifest INTERNET permission after rebuild and successfully reached `csrf/` and `me/`. Native register/login then returned HTTP 400 with `validation_error`; the transport's missing `Content-Length` was corrected. Repeat the entire Android sequence above with a rebuilt APK before marking the native gate passed.
