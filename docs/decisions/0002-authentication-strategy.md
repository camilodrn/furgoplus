# ADR 0002 — Shared server-side sessions for web and Flutter

Status: accepted. Date: 23 September 2026. Must be proven on a native Flutter client in the accounts slice, before domain UI work.

## Context and alternatives

There is one first-party browser client and one first-party native app, not a public third-party API. The design must support logout, expiration, disabled accounts and server authorization without building an identity service.

| Option | Benefits | Actual cost and risk for October |
| --- | --- | --- |
| Django database sessions for both clients | One login/logout/expiry policy; server-side invalidation; browser credentials protected by HttpOnly cookies. | Flutter needs a deliberate cookie adapter, CSRF bootstrap/header handling, post-login rotation, secure persistence and HTTPS Origin handling. Native HTTP libraries do not supply a browser session automatically. |
| Tokens for both clients | Natural Authorization-header transport on mobile; shared API mechanism. | Native secrets still need OS-backed storage. Persistent browser tokens in localStorage expose credentials to script; memory-only tokens lose sessions on reload. Refresh tokens in cookies reintroduce CSRF plus refresh/rotation/revocation work. Basic DRF tokens lack built-in expiry and per-device lifecycle. |
| Web sessions plus mobile expiring tokens | Conventional transport for each surface; no mobile cookie/CSRF adapter. | Two issuance, revocation and error paths and a larger security test matrix; token package/lifecycle decisions still needed. Reasonable later if native requirements outgrow sessions, but unnecessary now. |

## Decision

Use Django's **database-backed sessions** and DRF `SessionAuthentication` for both clients. Do not use JWTs, permanent DRF tokens, HTTP Basic authentication or social login. PostgreSQL stores session records; no cache/session service is needed. Use Django password hashing and validation; never store passwords on clients.

This choice accepts the measurable Flutter integration cost in exchange for a single credential lifecycle. It is specific to a small first-party MVP and depends on the early HTTPS/native acceptance test below; it is not a claim that mobile cookie management is free.

### API and client protocol

All endpoints below are planned under `/api/v1/auth/` and return JSON rather than redirects.

1. `GET csrf/` sets the CSRF cookie and returns a masked CSRF token obtained through Django. Mark response `Cache-Control: no-store`. React and Flutter hold the token in memory.
2. `POST register/` and `POST login/` require the CSRF cookie and `X-CSRFToken`, **even before authentication**. Explicitly apply Django CSRF protection to these views; DRF's authenticated-request CSRF behavior alone is insufficient. Registration creates a parent or driver and then requires login.
3. Login uses Django authentication/login, rotates the session key and CSRF secret, and returns current user/role plus a newly generated masked token. Clients process all updated cookies before the next request. Do not persist the submitted password.
4. `GET me/` validates the restored session and returns minimal identity/role. Protected APIs use session authentication plus role/object permissions. Unsafe methods send the current CSRF token. Reads have no business side effects.
5. `POST logout/` is CSRF-protected and flushes the current server session and expires its cookie. Clear local identity, CSRF token and private caches on successful logout or confirmed expiration; Flutter also clears its stored cookies. If logout cannot reach the server, clear local access and warn that server logout is unconfirmed. React cannot delete an HttpOnly cookie in JavaScript: retain a non-secret signed-out marker to prevent automatic UI restoration, and retry server logout when online before reuse. Flutter can delete its local cookie, but that does not revoke a captured server credential. Both rely on bounded server expiry if remote logout remains unreachable.

React is served from the API origin (development proxy, deployed reverse proxy). Use same-origin credentials; no bearer credentials in browser storage. Session and CSRF cookies are host-only, path `/`, `Secure`, `HttpOnly`, `SameSite=Lax` in HTTPS environments; the CSRF token is read from JSON, so JavaScript need not read the cookie. No wildcard CORS or broad trusted-origin list.

Flutter's single API adapter must parse multiple `Set-Cookie` headers, respect replacement/expiry/path/host rules, and send cookies only to the configured API origin. Persist only the required cookie values and expirations in OS-backed secure storage, never a plain-text cookie file, preferences, logs or backups. Task 01 selects `flutter_secure_storage` 11.2.0 for its Keychain/Keystore-backed adapter; Task 02 adds and validates the package and protocol, with no session persistence in Task 01. On restart, restore cookies, fetch a fresh CSRF token, then call `me/`. Reject insecure production origins and cross-origin redirects; never send API cookies to navigation providers. Native requests must include `Origin` equal to the configured API origin on unsafe methods: Django HTTPS requests otherwise require a valid Referer when Origin is absent. This header is protocol compatibility, not proof of identity. TLS, the session and CSRF token remain required.

### Lifetime, errors and authorization

- Set an absolute **12-hour session lifetime** at login using a fixed expiration instant, with no sliding extension or remember-me option. A new login creates a separate session for that device/browser. Run expired-session cleanup as an operational scheduled command, not a message broker.
- Disabled accounts fail authorization on every request. Password changes invalidate existing authenticated sessions through Django's session-auth-hash mechanism. Product roles are not editable through account APIs. Current-session logout does not promise logout on every device.
- Distinguish `not_authenticated`, `permission_denied` and `csrf_failed` in a documented error envelope. SessionAuthentication may use HTTP 403 for missing authentication, so clients must not treat every 403 as expiry. Out-of-scope object IDs return 404.
- Refresh CSRF bootstrap after `csrf_failed`; do not blindly replay writes after network timeouts. Re-fetch authoritative state and ask the user to retry where appropriate. Route transitions and request duplicate constraints make retries safe.
- Apply login/registration throttling and generic credential errors. Treat request logs as untrusted for secrets: no passwords, cookies, CSRF values or contact bodies. SameSite and HttpOnly do not replace CSRF controls, XSS prevention or server permissions.

## Acceptance gate and consequences

On React and native Flutter over HTTPS, test bootstrap → register/login → protected GET → CSRF-protected write → app/browser restart → restored identity → logout → failed credential reuse. Cover expiry, password change, disabled account, wrong role/object, missing/wrong CSRF, foreign Origin, post-login CSRF rotation and unreachable logout. Use tests with CSRF checks actually enabled. Verify native secure storage clears and cookies never reach another host.

Resolve package compatibility and prove this adapter by 27 September. If it fails the gate, explicitly supersede this ADR with a scoped web-session/mobile-token decision and update the contract/tests/roadmap; do not silently disable CSRF or add a second mechanism.

## Primary references

Design references checked for Task 00; version pinning happens in foundation, not here. DRF documents session CSRF behavior and basic token limitations in its [authentication guide](https://www.django-rest-framework.org/api-guide/authentication/). Django documents [session storage and expiry](https://docs.djangoproject.com/en/5.2/topics/http/sessions/), [AJAX CSRF handling](https://docs.djangoproject.com/en/5.2/howto/csrf/) and [CSRF rotation, Origin and HTTPS Referer checks](https://docs.djangoproject.com/en/5.2/ref/csrf/). The 12-hour policy, shared native adapter and JSON contract above are FurgoPlus decisions.
