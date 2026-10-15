# Architecture

Status: October architecture baseline from 23 September 2026, reconciled 7 October after accepted Task 08.5 / PR #20 (`816dda0`). The modular monolith and core workflows below are implemented. [Release rehearsal](RELEASE_REHEARSAL.md) records verification limits; production deployment remains unresolved. [Product scope](PRODUCT_SCOPE.md) owns feature boundaries and open questions; [data model](DATA_MODEL.md) owns entities/states; ADRs own the decisions linked below.

```text
Flutter mobile (parent + driver)
              \
               REST/JSON over HTTPS -> Django + DRF -> PostgreSQL
              /                              |
React web (driver + admin)                    +-> Private document storage
```

## Structure and responsibilities

Use one repository and a **modular monolith**: one Django deployment, one PostgreSQL database and no broker, microservices or independently deployed domain services. The implemented Django apps are `accounts`, `drivers` and `api`; `drivers` contains validation, publication, capacity, contacts/reviews, operations, manual payments and audit modules. These are code ownership boundaries, not a requirement for a separate Django app per table. Keep state transitions and reusable eligibility/ownership checks in backend domain services; serializers validate inputs and views orchestrate HTTP responses.

| Component | Responsibility |
| --- | --- |
| `mobile/` Flutter + Dart | One app with parent/driver navigation from server identity, typed API adapter, session/CSRF handling, explicit loading/error/empty states, today's driver operation and external maps. No direct database access or background location collection. |
| `web/` React | Driver management and protected administrator screens, typed API adapter, form validation for usability and same-origin session handling. Server validation remains authoritative. |
| `backend/` Python + Django/DRF | Accounts/authentication, role/object authorization, visibility, validation workflow, private files, normalized search, capacity/operations, manual records and audit. Django ORM and migrations own schema changes. |
| PostgreSQL | Relational integrity, transactions, sessions and application records. Not publicly reachable from clients. |
| `infra/`, `.github/workflows/` | Implemented local Compose, synthetic rehearsal tooling and CI. Flutter tooling runs on host/CI runners, not inside the local backend Compose stack. |

React should use TypeScript for its API boundary and important domain types; Flutter uses Dart models. Pin compatible supported framework/runtime/package versions and lockfiles during foundation, not in this documentation task. [ADR 0001](decisions/0001-client-surfaces-and-mobile-roles.md) freezes the surface allocation.

## API boundary

Version the REST API under `/api/v1/`; JSON is the normal payload, with multipart uploads and authorized binary document downloads as explicit exceptions. The backend owns an OpenAPI schema checked into/versioned with implementation. Avoid maintaining a second independent hand-written client contract.

| Resource family | Implemented use / access |
| --- | --- |
| `auth/*` (including `auth/me/`), `parent/profile` | Shared session lifecycle, minimal identity and owner parent-profile basics. Auth lifecycle details in ADR 0002. |
| `discovery/drivers`, detail and published reviews | Authenticated parent search/filter and standardized comparison fields, always restricted to eligible drivers. Comparison can fetch 2–3 current detail responses without a comparison entity. |
| `driver/profile`, documents, validation submissions, publication status | Owner driver onboarding/management and remediation; no administrator fields writable by drivers. |
| `driver/routes`, assignments, dated runs/actions, payment records | Owner driver management/daily operation with narrow serializers; no cross-driver IDs. |
| `contact-requests` | Participant-scoped read; parent create/cancel and driver accept/decline actions. Server checks every state change. |
| `admin/drivers`, validations, subscriptions, action history | Admin-only review/control actions, not unrestricted model CRUD. |

Use enumerated status/filter values, ISO dates/UTC instants and explicit local service dates. Pagination is not uniform: driver Solicitudes receives the full `{ results }` response with local ten-row pages; parent history progressively reveals a full response; admin control history is server-paginated and validation history bounded. General backend pagination remains post-MVP debt. Error envelopes contain a machine-readable code, human message and optional field errors. Use 400 for validation, 404 for hidden/out-of-scope objects, 409 for stale/invalid transitions, 429 for throttling; auth/CSRF 403 distinctions are in [ADR 0002](decisions/0002-authentication-strategy.md). No redirect-to-HTML auth failures in APIs.

Do not assume device state is authoritative. Re-fetch after transitions and before contact acceptance. Critical writes use transactions and constraints; state transitions have defined repeat behavior. The MVP has online operation with visible retry failures, not an offline queue that might silently duplicate actions. Avoid response caching of discovery so plan expiry and suspension take effect on the next request.

## Security and privacy

Authentication is shared **database-backed Django sessions** with a native cookie/CSRF adapter that must pass the early implementation gate. [ADR 0002](decisions/0002-authentication-strategy.md) is the complete lifecycle/storage/expiry specification. It includes Django password hashing, explicit pre-login CSRF, secure cookies, native secret storage, session revocation behavior and same-origin deployment. No client-selected role is trusted as authorization.

Filter querysets by actor/ownership before object retrieval and enforce permissions again for mutations/related-object references. Deny by default; allow only specific anonymous auth bootstrap/registration/login endpoints and a non-sensitive health endpoint. Admin authority is limited to documented validation/control operations, not every person's private operational data. Throttle contact creation per account and source in addition to enforcing the pending-request uniqueness constraint; set and test bounded limits during that slice. Test direct IDs and nested relationships, not only hidden buttons.

Discovery uses an allowlisted public-profile representation; “public” here means shareable with authenticated parents, not an anonymous web directory. [ADR 0004](decisions/0004-publication-eligibility.md) defines the single eligibility predicate. Validation badges reveal the result, never document contents, legal identifiers or private rejection observations. Contact, child, guardian, pickup, payment and document records use separate private responses. Avoid personal data in URLs, metrics, exceptions and logs. Log correlation IDs and state/error codes rather than request bodies or credentials.

Use environment-injected secrets/configuration, ignored local secret files and CI secret stores; later check in only placeholder examples. Require HTTPS and trusted proxy/host configuration in deployed environments; disable debug and use explicit allowed hosts. Browser rendering must escape untrusted strings; no raw rendering of messages/reviews or uploaded HTML. These controls do not constitute a claim of regulatory compliance. Real-data consent/retention/recovery questions remain in scope Q3–Q9.

### Driver documents

Store bytes outside public/static/media roots in a private persistent volume for the single-host MVP. Keep only opaque storage keys and metadata in PostgreSQL. A storage adapter can later use a private object bucket without changing authorization; no public or presigned document URLs are part of this MVP.

The owning driver and authorized administrator retrieve files through a backend endpoint that checks permission on every request and streams an attachment with a safe filename, explicit content type, `nosniff` and `Cache-Control: no-store`. Administrators review via authorized download in a local viewer; an embedded preview subsystem is not required. Record admin document access by ID without logging content. Parents get neither files nor download metadata, even for approved drivers.

Initial technical limits: one PDF/JPEG/PNG per checklist kind, maximum 10 MiB per file, bounded upload counts/rate and matching reverse-proxy request limits (including multipart overhead). Verify extension, detected signature/type and successful structural parsing; enforce image dimension limits. Reject executables, archives, SVG/HTML, mismatches and malformed files. Generate storage names, never trust supplied paths, and never execute uploaded content. Do not claim these checks detect every malicious file. Production malware scanning/quarantine capability is unresolved before real-document intake; the October demo uses synthetic known-safe files.

Stage validated uploads privately; attach metadata only after successful storage, and remove orphaned staged files on failure/cleanup. Submissions reference immutable document versions, not a replaceable filename. Preserve reviewed versions pending an agreed retention policy. Persist and restore both database and private files together; database-only backups are insufficient. [The isolated restore procedure](BACKUP_RESTORE.md) identifies current storage, pauses only synthetic rehearsal writers and verifies restored tables, bytes and authorized access.

This file-handling baseline follows the principles in [Django's uploaded-content guidance](https://docs.djangoproject.com/en/5.2/topics/security/#user-uploaded-content) and [OWASP's File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Limits, delivery mechanism and the synthetic-data gate above are project choices.

## Environments and deployment assumptions

| Environment | Setup / scope |
| --- | --- |
| Local | Docker Compose: PostgreSQL, Django and React development server/proxy; persistent database/private-file volumes. Host Flutter emulator/device targets a configured reachable API URL. Synthetic seeds only. Local HTTP cookie exceptions are isolated to development; never disable production TLS validation. |
| CI | Fresh PostgreSQL service, temporary private storage, deterministic fixtures, independent web/backend/Flutter jobs and contract checks. No real documents or production credentials. |
| Demo/staging | One HTTPS origin serves React assets and proxies `/api/` to Django; PostgreSQL/private files on isolated persistent storage. Synthetic data clearly labeled; secure cookies and native CSRF tested here. |
| Homelab demo r4 | Operator confirms Debian 13, host Cloudflare Tunnel, loopback-only Caddy/compiled React, Gunicorn and PostgreSQL functioning with Android and synthetic scenario prepared/backed up. Registration is closed/illustrative; separate internal proxy/database networks. [ADR 0007](decisions/0007-homelab-demo-deployment.md) defines trust; [final review](TASK11_FINAL_REVIEW.md) records evidence gaps. |
| Future production | Same logical topology initially. Hosting, TLS termination, backup/restore ownership, privacy/retention, document safety and account-recovery procedures must be settled before real-user intake. No Task 00 deployment or automatic CI deployment. |

Choose the actual host and mobile test hardware during foundation (scope Q8). Provide health/readiness checks, structured redacted logs, a migration procedure, database/file backup and restore rehearsal, and scheduled expired-session cleanup in implementation operations docs. Compose is the reproducible local tool, not a promise about a hosting vendor. No high-availability or scale claims are made.

## Testing and CI coverage

- **Backend:** PostgreSQL model/service/API tests for publication truth table, validation revisions/audit atomicity, document privacy, role/object boundaries, consented contact transitions, expiry and concurrent capacity/run actions. Include real CSRF enforcement and native-compatible HTTPS headers in auth tests.
- **React:** component/integration tests for login/expiry, driver onboarding/request/payment management, admin approve/reject and plan/suspension actions, including failure and unauthorized states.
- **Flutter:** unit tests for API models/cookie adapter and URL construction; widget tests for restored role navigation, search/comparison/contact, today's route details and transition errors. Use native integration tests for secure storage and HTTPS session behavior where unit mocks cannot prove it.
- **Contract:** schema validation and representative sanitized response fixtures consumed by both clients; assert public fields exclude secrets and that enums/date/nullability/error codes agree. Require a schema update when API behavior changes.
- **End-to-end smoke:** run the synthetic cross-surface journey in scope acceptance, then suspend the driver and attempt direct hidden-profile/document access as a parent. Automate a narrow API/integration spine and record device/browser evidence for external navigation and the complete cross-client path; no claim that an API-only smoke proves the UIs.
- **GitHub Actions (implemented):** backend Ruff, Django checks, fresh PostgreSQL migrations, migration drift, OpenAPI and tests; React formatting/contract/lint/TypeScript/tests/build; Dart format/analyze/tests/debug APK; Compose health/migration/proxy smoke. Exact pins and lockfiles are used. The workflow has no dedicated Python type checker, secret scanner, backup/restore job, npm audit, prior-schema migration upgrade job or native HTTPS/device acceptance. Those are not implied by green CI. iOS build/device checks require macOS/signing and are not claimed.

Keep checks proportional to the small product. No arbitrary coverage percentage substitutes for the critical business/security cases. The [roadmap](ROADMAP.md) turns these requirements into acceptance gates.

## Future live-location boundary

Stable route/run IDs and centralized ownership checks allow a later tracking module. October stores only static destinations and explicit operational timestamps; it does not collect coordinates from the vehicle. [ADR 0003](decisions/0003-live-location-boundary.md) controls that extension and the additional consent/entitlement decisions required.
