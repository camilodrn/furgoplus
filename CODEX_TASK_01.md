# Task 01 — Repository foundation and first health request

Build the runnable technical foundation for FurgoPlus without implementing product workflows yet.

Read the repository documentation first, especially:

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/DATA_MODEL.md`
- `docs/ROADMAP.md`
- `docs/decisions/0001-client-surfaces-and-mobile-roles.md`
- `docs/decisions/0002-authentication-strategy.md`
- `docs/decisions/0003-live-location-boundary.md`
- `docs/decisions/0004-publication-eligibility.md`

Task 00 is authoritative for scope. Do not silently expand the MVP.

## Product goal

After this task, a new developer should be able to clone the repository, configure documented local environment values, start PostgreSQL + Django + React through the supported local workflow, run the Flutter project separately on the host, and verify the first end-to-end health request against the Django API.

The repository must also have an initial CI baseline covering backend, web and mobile quality checks.

This task establishes infrastructure and contracts only. Authentication flows, driver onboarding, validation, discovery, contact, routes, passengers, payments and administrative workflows remain later tasks.

## Required repository shape

Create the implementation layout documented by Task 00:

```text
backend/
web/
mobile/
infra/
.github/workflows/
docs/
```

Keep the existing documentation intact unless an implementation detail discovered during Task 01 requires a small consistency correction. Explain any documentation change in the completion report.

## Versioning and dependency policy

Choose currently supported compatible versions for the implementation stack and pin them reproducibly.

Requirements:

- Python + Django + Django REST Framework;
- PostgreSQL;
- React + TypeScript + Vite;
- Flutter + Dart;
- Docker Compose v2 for local PostgreSQL/Django/React;
- lockfiles or exact dependency pins appropriate to each ecosystem;
- no floating `latest` application dependencies where a reproducible version can be pinned;
- document required host versions/toolchains in `README.md` or a concise development document.

Prefer boring, supported dependencies over novelty. Do not introduce microservices, Redis, message brokers, Celery, Kubernetes or a JavaScript state-management framework in this task.

## Backend foundation

Create a Django project under `backend/` with Django REST Framework and PostgreSQL configuration.

### Custom user model from migration 0001

The custom user model must exist before domain migrations accumulate.

Implement a minimal email-based user model suitable for later Task 02 authentication:

- unique normalized email as the login identifier;
- no required username identity;
- role with finite values `parent`, `driver`, `admin`;
- active/staff/superuser behavior compatible with Django administration and management commands;
- timestamps where useful;
- role is a server-side field and must not imply authorization by itself.

Do **not** implement public registration/login/logout endpoints yet. Do not implement ParentProfile or DriverProfile yet unless Django structure absolutely requires it; Task 02/03 own those product models.

Add tests for the custom user manager/model invariants that are already meaningful at foundation time.

### Configuration

Use environment-based configuration with safe development defaults where appropriate and an `.env.example` containing placeholders only.

At minimum separate/configure:

- Django secret key;
- debug mode;
- allowed hosts;
- database connection settings;
- API/public origin values needed by clients;
- private upload root placeholder for later tasks.

No real secret may be committed.

Production-like settings must not silently enable debug or insecure cookies. Authentication cookie details are implemented in Task 02, but Task 01 must not make ADR 0002 impossible.

### API versioning and health endpoint

Establish `/api/v1/` as the API prefix.

Implement a small unauthenticated health endpoint such as:

```text
GET /api/v1/health/
```

It should return a small stable JSON response sufficient to prove Django is serving requests. Do not expose environment variables, database credentials, host details, package inventories or other sensitive diagnostics.

Add a backend API test for the endpoint.

### Error envelope

Establish the documented API error shape now so later slices do not invent incompatible responses. Use a DRF exception handler or equivalent centralized mechanism with a stable shape equivalent to:

```json
{
  "code": "machine_readable_code",
  "message": "Human-readable message",
  "fields": {}
}
```

`fields` may be absent/null/empty when not applicable, but keep the contract intentional and tested. Cover at least a representative 404/validation-style error without overbuilding product endpoints.

### OpenAPI baseline

Provide a generated OpenAPI schema for the implemented API surface and a reproducible command/check to regenerate it.

The repository must contain a checked-in schema artifact (for example `backend/openapi.yaml`) or another documented generated-contract path that CI can compare for drift. Use one source of truth; do not hand-maintain a second divergent contract.

## React web foundation

Create `web/` as a React + TypeScript + Vite application.

Requirements:

- TypeScript strict mode;
- minimal routing/layout structure ready for driver/admin areas later, without fake product screens;
- a small typed API client boundary;
- health/status screen or development landing surface that calls `/api/v1/health/` and renders loading/success/error states;
- Vite development proxy for `/api` to Django so browser development remains same-origin from the application's perspective and does not require permissive CORS;
- no authentication implementation yet;
- no UI framework unless a concrete foundation need justifies it.

Keep styling small and coherent. This is not the design-polish task.

Add frontend tests for the health request state handling and any small shared behavior introduced.

## Flutter mobile foundation

Create `mobile/` as the single Flutter application defined by ADR 0001.

Requirements:

- one application only, intended for both parent and driver roles later;
- simple neutral startup/development screen, not fake role navigation before authentication exists;
- centralized API base URL configuration suitable for emulator/device builds (for example via compile-time environment/dart-define or another explicit documented approach);
- a small API client abstraction that can call `/api/v1/health/`;
- loading/success/error states for the health request;
- no GPS/location permission;
- no cookie/session persistence implementation yet beyond interfaces that are genuinely needed for foundation; ADR 0002's real adapter belongs to Task 02;
- no platform secrets embedded in source.

Document the Android-emulator/device networking caveat clearly: localhost on the development computer is not automatically localhost from every emulator/device. Do not hardcode a single developer machine IP into committed source.

Add Flutter unit/widget tests for configuration and health-state behavior where practical.

## Local development and Docker Compose

Provide a reproducible local workflow using Docker Compose v2 for:

- PostgreSQL;
- Django backend;
- React/Vite web development server.

Flutter runs on the host/emulator/device rather than inside Compose.

Requirements:

- persistent PostgreSQL development volume;
- health checks where useful;
- service dependency/startup behavior that does not rely on arbitrary sleeps;
- backend migrations can be run explicitly and documented;
- Vite proxies API calls to the backend service;
- bind mounts/hot reload are acceptable for development but must be documented;
- no production deployment claim from the Compose file.

A clean checkout with example environment configuration should have a documented command sequence for setup/start/test/stop/reset.

Avoid destructive reset commands as the normal startup path. If a reset command is documented, label it clearly as destructive to local development data.

## CI baseline

Create GitHub Actions workflows appropriate to the monorepo.

At minimum CI must exercise:

### Backend

- dependency installation from pinned inputs;
- formatting/lint/static checks selected for the project;
- tests against PostgreSQL, not SQLite;
- migrations apply cleanly to an empty database;
- check for model changes missing migrations;
- OpenAPI generation/contract drift check.

### Web

- dependency installation from lockfile;
- formatting/linting as configured;
- TypeScript type-check;
- tests;
- production build.

### Flutter

- deterministic Flutter SDK setup;
- `dart format` check;
- `flutter analyze`;
- tests;
- Android debug/build check if the selected runner/toolchain can support it reliably.

Do not claim iOS CI unless a macOS/signing path is actually configured and tested.

Use dependency caches where they are straightforward, but do not sacrifice correctness for cache complexity.

## Integration smoke

Add a small real integration path proving the stack boundaries rather than only isolated unit tests.

At minimum, when the local stack is running:

1. PostgreSQL is reachable by Django;
2. migrations are applied;
3. Django responds to `/api/v1/health/`;
4. the React development path reaches that endpoint through its normal `/api` proxy.

If the execution environment cannot launch a real Flutter emulator/device, provide a deterministic Flutter test of the configured API client and document the exact manual/device health check. Do not fake a device result.

Where practical, add a scripted smoke command that fails non-zero on integration failure.

## Repository hygiene and developer guidance

Add or update as appropriate:

- root `.gitignore`;
- root `README.md` setup/run/test instructions;
- `.env.example` files/placeholders as needed;
- concise `AGENTS.md` guidance for future Codex tasks if useful;
- standard formatting/editor config only if it provides real consistency;
- no generated build directories, local databases, secrets, IDE junk or private files committed.

Keep commands Linux/Fedora-friendly while remaining portable where practical.

## Security/privacy boundaries for Task 01

- no committed secrets;
- no real personal data or real driver documents in fixtures;
- no public upload directory introduced as a shortcut;
- database is not exposed publicly beyond what is needed for local Compose networking;
- health/schema endpoints expose no secrets;
- do not disable CSRF globally in preparation for Task 02;
- do not add wildcard production CORS;
- do not add GPS/location permissions;
- do not add authentication tokens to localStorage or other placeholder mechanisms.

## Tests / completion checks

Before reporting completion, run every check available in the environment and report exact results.

Expected checks include, as applicable:

- backend formatting/lint/static checks;
- backend tests on PostgreSQL;
- Django migration creation/status/check and empty-database migration;
- OpenAPI generation/drift check;
- React lint/type-check/tests/build;
- Flutter format/analyze/tests and Android build when supported;
- Docker Compose config validation;
- local stack startup/health/integration smoke;
- `git diff --check`;
- repository status review for accidentally generated or secret files.

If Docker, Flutter, Android SDK or another tool is blocked by the sandbox/environment, complete everything else. Do not weaken implementation or tests merely to make the blocked check disappear. Report the blocked command, error/cause and the exact host-side command the developer should run.

## Important boundaries

- Do not implement registration/login/logout/session persistence yet; Task 02 owns the authentication protocol and native cookie/CSRF acceptance gate.
- Do not implement driver validation, documents, plans, routes, discovery, reviews, contact requests, passengers, payments, run tracking or admin workflows.
- Do not add GPS/location tracking, WebSockets, push notifications or background jobs.
- Do not create duplicate mobile applications.
- Do not use SQLite as a substitute for PostgreSQL application tests.
- Do not create fake completed product screens to make the repository look further along than it is.
- Do not commit, push, merge or deploy.

## Completion criteria

Task 01 is complete when:

- backend/web/mobile/infra/CI foundations exist and are documented;
- the custom email/role user model exists from the first application migration;
- PostgreSQL is the tested application database;
- `/api/v1/health/` works with a stable non-sensitive contract;
- centralized API error handling and an OpenAPI baseline exist;
- React can reach health through the intended development proxy;
- Flutter has one configurable API client and health-state path without role/product overreach;
- local Compose is reproducible for PostgreSQL + Django + React;
- CI provides real backend/web/mobile quality gates;
- no authentication/product workflows or deferred features have leaked into foundation;
- available checks are green and blocked environment-specific checks are reported precisely;
- no commits, pushes, merges or deployments are performed by Codex.
