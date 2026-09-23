# Task 02 — Accounts, roles and shared session authentication

Implement the FurgoPlus account/authentication slice and prove the authentication decision in ADR 0002 before any domain onboarding or discovery work is built on top of it.

Read the repository documentation first, especially:

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/DATA_MODEL.md`
- `docs/ROADMAP.md`
- `docs/decisions/0001-client-surfaces-and-mobile-roles.md`
- `docs/decisions/0002-authentication-strategy.md`
- `CODEX_TASK_01.md`

Task 00 remains authoritative for product scope. Task 01 is the working foundation. Do not silently expand the MVP.

## Product goal

After this task:

- a parent can register from Flutter, then log in/out and restore the authenticated session;
- a driver can register from React, then log in/out on React and log in/out on the same Flutter app;
- a provisioned administrator can log in/out on React;
- both first-party clients derive identity and role from the server rather than trusting client-selected state;
- protected API access, CSRF, expiry and disabled-account behavior are explicit and tested;
- the native Flutter cookie/CSRF adapter from ADR 0002 is implemented, securely persisted and subjected to the early acceptance gate.

This task owns accounts/authentication only. Driver document validation, plans, routes, discovery, contacts, passengers, payments, operational runs and admin domain workflows remain later tasks.

## Authentication protocol: ADR 0002 is binding

Use Django database-backed sessions and DRF session authentication for both React and Flutter. Do not introduce JWTs, permanent DRF tokens, HTTP Basic auth, social login, localStorage bearer tokens, or a second mobile auth mechanism unless the native gate fails and ADR 0002 is explicitly superseded.

Implement these JSON endpoints under `/api/v1/auth/`:

- `GET csrf/`
- `POST register/`
- `POST login/`
- `GET me/`
- `POST logout/`

Keep the existing API error envelope and checked-in OpenAPI contract current.

### CSRF bootstrap

`GET /api/v1/auth/csrf/` must:

- be callable before authentication;
- set/refresh Django's CSRF cookie;
- return a masked CSRF token in JSON;
- send `Cache-Control: no-store`;
- expose no session/cookie internals.

React and Flutter keep the returned masked token in memory. They must not depend on reading the CSRF cookie from browser JavaScript.

### Registration

`POST /api/v1/auth/register/` must:

- require a valid CSRF cookie plus `X-CSRFToken` even while anonymous;
- accept only `parent` or `driver` as public signup roles;
- reject `admin` and unknown roles server-side;
- normalize email exactly as the custom User model/manager expects;
- use Django password validators and never log/echo/persist the submitted password client-side;
- return generic, intentional validation errors through the shared envelope;
- create the account atomically;
- not automatically log the new account in; registration is followed by explicit login.

Parents register from Flutter. Drivers register from React. Do not add administrator self-registration.

Create only the minimum account-adjacent profile data required by the accepted data model. If a `ParentProfile` is introduced here, keep it to the documented owner-only display-name responsibility. If a minimal `DriverProfile` must be created to satisfy the one-to-one invariant, use only the documented safe initial defaults and leave document/validation/publication management to Task 03+. Do not pull driver onboarding into this task.

### Login

`POST /api/v1/auth/login/` must:

- require pre-login CSRF protection;
- use Django authentication and generic invalid-credential responses;
- reject inactive accounts;
- call Django login so the session key and CSRF secret rotate correctly;
- establish a fixed absolute 12-hour session expiry from the login instant, with no sliding extension and no remember-me option;
- return minimal current identity (`id`, normalized account email, role, and only account/profile basics needed for navigation) plus a newly generated masked CSRF token;
- ensure clients process updated `Set-Cookie` values before the next request.

Do not leak whether an arbitrary email exists.

### Current identity

`GET /api/v1/auth/me/` must:

- require a valid authenticated session;
- return the same minimal identity/role contract used for client restoration;
- reject disabled/expired/invalid sessions consistently;
- have no business side effects.

Role is server-owned and immutable through normal account APIs.

### Logout

`POST /api/v1/auth/logout/` must:

- require authentication and CSRF;
- flush the current server session and expire its cookie;
- return a small non-sensitive success response with `Cache-Control: no-store`;
- not claim to revoke other device/browser sessions.

Client behavior must follow ADR 0002. On successful logout or confirmed expiry, clear local identity, CSRF state and private auth caches. Flutter also clears persisted session cookies. If native logout cannot reach the server, clear local access and present an unconfirmed-server-logout state; do not silently keep a reusable local credential. React cannot delete an HttpOnly cookie itself, so preserve only a non-secret signed-out marker when needed to prevent automatic UI restoration until server logout can be retried.

## CSRF and error semantics

Do not rely only on DRF `SessionAuthentication` for anonymous login/register CSRF. Apply real Django CSRF checks there.

All API CSRF failures, including middleware-level failures and authenticated unsafe DRF requests, must return the JSON error envelope with machine code `csrf_failed`, not Django HTML.

Keep these conditions distinguishable in client logic and tests:

- `not_authenticated`
- `permission_denied`
- `csrf_failed`

Do not treat every HTTP 403 as session expiry. On `csrf_failed`, clients may bootstrap a fresh CSRF token, but must not blindly replay an unsafe write after a timeout or ambiguous result.

Test missing token, wrong token, valid token, foreign `Origin`, and post-login CSRF rotation with CSRF enforcement genuinely enabled.

## Session/cookie settings

Preserve the same-origin deployment design and safe local development exceptions already established by Task 01.

For HTTPS environments, session and CSRF cookies must remain host-only, path `/`, `Secure` and `SameSite=Lax`; the session cookie is `HttpOnly`. Do not add wildcard CORS or broad trusted-origin shortcuts.

Use database-backed Django sessions. Do not enable sliding session extension. The 12-hour login lifetime must be represented as a fixed expiry instant.

Password changes must continue to invalidate existing sessions through Django's session-auth-hash behavior even though a password-change UI/API is not part of this task. Add a backend test proving the behavior without inventing a recovery/change-password product flow.

## Flutter native session adapter — acceptance gate

Add the Task 01-selected `flutter_secure_storage` 11.2.0 dependency and implement one native API/session adapter for the Flutter app.

The adapter must:

- send requests only to the configured API origin;
- reject insecure release/production origins according to the existing API origin policy;
- reject cross-origin API redirects and never forward FurgoPlus cookies to external/navigation hosts;
- parse all relevant `Set-Cookie` headers and respect replacement, expiry, host and path rules needed by the FurgoPlus session;
- send only cookies valid for the configured API origin;
- send `Origin` equal to the configured API origin on unsafe native requests;
- send the current masked CSRF token in `X-CSRFToken` on unsafe requests;
- persist only the cookie values/metadata actually required to restore the FurgoPlus session, using OS-backed secure storage;
- never persist passwords, CSRF values, session cookies or auth payloads to ordinary preferences, plain-text files, logs or backups;
- clear secure persisted auth state on logout/confirmed expiry and local sign-out after unreachable logout.

On app restart:

1. restore the persisted session cookie state;
2. fetch a fresh CSRF token through `auth/csrf/`;
3. call `auth/me/`;
4. derive the role home from the returned server identity;
5. clear restored auth state if the session is no longer valid.

Design transport/storage behind testable interfaces. Unit/widget tests may use fakes, but they must not replace the required native HTTPS acceptance evidence.

## React session client

Extend the typed React API boundary rather than creating a second ad-hoc client.

Requirements:

- same-origin requests with credentials included;
- CSRF bootstrap and in-memory masked token handling;
- driver registration screen/form;
- login for driver/admin accounts;
- authenticated restoration through `me/`;
- logout and explicit signed-out state;
- role-aware protected shell/navigation for `driver` and `admin` only;
- no parent domain surface on React;
- clear loading/authenticated/signed-out/expired/error states;
- no bearer/session secret in localStorage/sessionStorage.

Do not implement driver documents, plan controls, validation queues or other later screens. A small authenticated role shell is enough for this task.

## Flutter account UI boundary

Keep one Flutter application.

Implement only the account/navigation surfaces needed to prove Task 02:

- parent registration;
- login for parent and driver accounts;
- restored-session startup state;
- logout;
- minimal parent role home shell;
- minimal driver role home shell;
- unsupported-role handling rather than exposing an admin mobile shell.

Do not implement parent discovery/contact or driver daily-operation content yet.

Navigation must use the role returned by `me/`; a locally selected role never grants authorization.

## Administrator provisioning

Administrators are not publicly registrable.

Document and test one restricted operational provisioning path using Django management/admin tooling. Existing `createsuperuser` behavior is acceptable if it reliably creates an admin-role active/staff/superuser account with the custom user model. Do not place an administrator creation secret or default admin password in the repository.

## Authorization and negative cases

Task 02 does not build domain object permissions, but account/auth endpoints must still deny by default.

At minimum test:

- anonymous access to `me/` and logout;
- public registration cannot create admin or mutate account flags;
- role is not editable through auth/profile payloads;
- inactive account login/session use;
- expired session;
- malformed/invalid credentials with generic response;
- missing/wrong CSRF and foreign Origin;
- React parent-role unsupported shell behavior;
- Flutter admin-role unsupported shell behavior;
- session restoration after restart;
- server logout followed by failed credential/session reuse;
- password-change session invalidation.

No endpoint may serialize password hashes, raw cookies, CSRF secrets, account flags unrelated to the client's own state, or another user's private account/profile fields.

## Throttling and logging

Apply bounded login and registration throttling suitable for this single-host MVP without adding Redis, brokers or a new service. Keep the chosen mechanism/rates documented and test its behavior. Do not present a process-local throttle as a stronger distributed guarantee than it is.

Authentication logs/errors must not contain passwords, cookie values, CSRF tokens or full request bodies. Correlation/error codes are acceptable.

## Contract and CI

Update `backend/openapi.json` through the existing generation command and regenerate/check the typed web API contract. Do not hand-edit generated contract artifacts.

Extend CI only where required by this slice. Keep Task 01's backend, web, mobile and integration gates green.

Add representative sanitized auth contract fixtures/tests where useful. No real email accounts, passwords, people or credentials in fixtures.

## Acceptance gate

The ADR 0002 decision is not considered proven merely because unit tests mock cookie storage.

Required evidence is:

1. React/browser over HTTPS: CSRF bootstrap → driver login → protected `me/` → CSRF-protected unsafe request/logout → session invalid afterward.
2. Native Flutter/Android over HTTPS: bootstrap → login → protected `me/` → app restart → restored identity → CSRF-protected request/logout → stored cookie cleared → session reuse fails.
3. Negative cases include expiry, disabled account, missing/wrong CSRF, foreign Origin, post-login CSRF rotation, unsupported role shell and unreachable logout/local clear behavior.
4. Native secure storage is exercised on a real Android runtime (emulator or device), not only a Dart mock.

If the Codex sandbox cannot run a browser HTTPS environment or Android runtime, implement all deterministic checks and provide the exact host-side commands/manual smoke steps required. Do not fabricate successful native evidence.

If the native shared-session design fails this gate for a substantive platform/protocol reason, stop and report the failure. Do not disable CSRF, TLS verification or cookie protections to force success. The next action must be an explicit ADR 0002 superseding decision for web sessions + scoped mobile tokens, with contract/tests/roadmap updated deliberately.

## Out of scope

Do not implement:

- driver document upload/validation/approval;
- plan/subscription/publication workflows;
- routes/coverage/capacity/passengers/runs;
- discovery/comparison/reviews/contact requests;
- payment records;
- admin validation or plan screens;
- GPS/location, maps, chat, push, background jobs;
- email verification, MFA, self-service password recovery or social login;
- multi-role accounts or role switching;
- iOS signing/release or app-store work.

## Completion checks

Before reporting completion, run every available check and report exact results.

Expected checks include:

- backend format/lint/system checks;
- PostgreSQL migrations and no-missing-migration check;
- backend account/auth/API tests with real CSRF enforcement;
- OpenAPI generation/drift check;
- React formatting/lint/typecheck/tests/build;
- Flutter format/analyze/tests;
- Android debug APK build on Java 21;
- secure-storage/session-adapter deterministic tests;
- Compose integration smoke;
- auth integration checks possible in the environment;
- `git diff --check` and repository status review for secrets/generated junk.

If browser/native HTTPS or Android runtime checks are blocked by the environment, report the exact blocked command/step, cause and host-side verification procedure. Do not weaken implementation to make a blocked check disappear.

## Important boundaries

- no authentication mechanism other than ADR 0002 unless that ADR is explicitly superseded after a failed native gate;
- no CSRF bypass/disable shortcuts;
- no wildcard production CORS;
- no client-trusted authorization role;
- no plaintext native cookie persistence;
- no auth secrets in browser storage;
- no real personal data;
- no later product/domain features;
- no commit, push, merge or deploy by Codex.

## Completion criteria

Task 02 is complete when:

- registration/login/logout/csrf/me contracts exist and are documented in OpenAPI;
- parent and driver public signup rules are server-enforced and admin self-registration is impossible;
- admin provisioning has a restricted documented procedure;
- database sessions use a fixed 12-hour lifetime and preserve Django password/session invalidation behavior;
- CSRF is enforced before and after login with stable `csrf_failed` errors;
- React can restore and route driver/admin sessions without browser-stored credentials;
- the single Flutter app can register a parent, login parent/driver, persist only required session cookie state in OS-backed secure storage, restore through fresh CSRF + `me/`, route by server role and clear auth state on logout/expiry;
- deterministic backend/web/mobile tests are green;
- Task 01 CI/integration foundations remain green;
- the native HTTPS/session/CSRF gate is either proven with real runtime evidence or precisely reported as the only remaining host acceptance step;
- no Task 03+ domain scope has leaked in;
- no commit, push, merge or deploy is performed by Codex.
