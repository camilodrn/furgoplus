# Task 08 — Admin/driver control completion

Implementation contract: issue #17 (read from GitHub), PRODUCT_SCOPE, DATA_MODEL,
ARCHITECTURE, ROADMAP, ADR 0002/0004 and Task 03–07 implementations agree.
No expanded administrator operational authority is authorized.

## Existing slices and minimal additions

Task 03 provides immutable validation revisions, retained observations, authorized
submitted-document downloads and decision/read audit. Task 04 provides the single
`publication_state` policy, optimistic/locked audited subscription updates and
Spanish validity controls. Tasks 06/07 provide owner summaries/rosters/payments/runs.
Reuse these; preserve the separate document review workflow.

- Add admin-only driver queue (including draft drivers) with display-name/email
  search, current validation/profile status, plan/subscription status and derived
  eligible/blocked/blocker filtering. Offset/limit pagination is bounded; evaluate
  publication filters before pagination with one request-time instant.
- Add selected driver detail with minimal identity, publication/current profile
  status, optimistic profile version and retained validation summaries.
- Add profile status POST with explicit nonblank reason, expected status and latest
  profile-action audit ID as version (including null before the first change).
  Lock driver and write state plus append-only audit atomically. Allow exactly
  active→suspended/deactivated, suspended→active/deactivated, deactivated→active.
  Never modify validation, subscription, account or publication intent.
- Add bounded/paginated per-driver allowlisted audit GET only. Include the driver's
  profile/subscription changes, validation decisions and submitted-document reads.
  Subscription audit targets retain Task 04's driver-ID convention. Project only
  status for profile/validation and plan/status/validity for subscriptions. No
  operational records, document storage/bytes, contact bodies or generic log CRUD.
- Extend existing subscription UI with confirmation, feedback and integrated
  refresh. Preserve existing state/window semantics (active requires explicit
  ordered dates; eligibility determines whether the interval is current).
- Add functional admin control screen alongside existing validation review; driver
  summary/publication exposes status, validity, intent and blockers, refreshes on
  explicit retry/navigation/focus without copying eligibility rules to React.

## Boundaries and verification

All controls require active admin User plus staff flag and existing session/CSRF.
Private responses/errors are no-store. Owner management remains driver-only and
accessible when profile is hidden; disabled User remains denied. Parents retain
404 hidden-object discovery/contact rules. Admin gets no roster/payment/contact
participant bypass. Test direct IDs, transitions/version conflicts, atomic audit,
all publication gates on restore, participant history and minimal history/schema.
Update OpenAPI and generated React types; preserve Task 00–07 regressions.

No new billing/entitlements, analytics, private operational administration,
architecture, roles, redesign, deployment or git history operations. Changes remain
uncommitted. Use synthetic data only; existing product policy Q1–Q9 remains.

## Implementation and local verification (5 October 2026)

Added `/api/v1/admin/drivers/`, selected-driver detail, status POST, validation
history GET and action history GET. Existing subscription endpoints/services are
reused unchanged. `publication_json` now includes `profile_status` for private
owner/admin/summary responses; no change to the publication predicate or public
allowlist. Profile transitions live beside subscription transitions in
`drivers/publication.py`. No model change or migration is required.

React adds a control queue/detail beside the retained document review workflow,
explicit profile confirmation and plan-hiding confirmation, integrated history
refresh, and owner status/validity/intent/blocker summaries with retry/focus refresh.
New tests: 11 backend controls/concurrency cases, one Task 08 contract case, six
admin React cases, two owner-summary cases and one App navigation case. The
existing App roster regression now pins its fictional service date rather than
changing behavior depending on the wall clock.

Results:

- Web format, generated contract, lint (no warnings), typecheck: passed.
- Web full test suite: 68 tests passed across nine files.
- Default `npm run build`: failed with EACCES unlinking a pre-existing file under
  `web/dist/assets` (owned by nobody). No ownership changes or file deletion made.
  `npm run build -- --outDir /tmp/task08-web-dist`: passed.
- Backend Ruff format (49 files) and lint: passed using cached Ruff 0.13.2.
  Project pins Ruff 0.13.1; repeat with the pinned environment on the host.
- Four backend schema tests passed through unittest with locally cached Django
  5.2.12; this is supplemental, not a PostgreSQL/application regression result.
- Python syntax and exact registry/OpenAPI comparison: passed.
- `generate_openapi --check --skip-checks`: passed in the cached environment.
- `makemigrations --check --dry-run --skip-checks`: no changes detected, with a
  PostgreSQL connection warning. This does not verify applied migrations.
- Required normal `check --database default`, `makemigrations --check --dry-run`,
  `migrate --check`, `generate_openapi --check` and focused Task 08 Django test
  commands could not pass application startup: the temporary cached environment
  lacks Pillow/PyPDF. The full Django test command could not connect to PostgreSQL.
- Installation of exact `backend/requirements.txt` failed because DNS/network
  access is unavailable. Cached Django/asgiref/sqlparse/Ruff versions differ from
  project pins; repository requirements were not changed. Docker Compose is
  denied access to `/home/duran/.docker/desktop/docker.sock`.
- `git diff --check`: passed. All changes remain uncommitted on the requested branch.

Host verification still required in the pinned backend/PostgreSQL environment:

```sh
cd backend
python manage.py check --database default
python manage.py makemigrations --check --dry-run
python manage.py migrate --check
python manage.py generate_openapi --check
ruff format --check .
ruff check .
python manage.py test drivers.test_controls api.test_contracts.Task08ContractTests
python manage.py test
```

Repeat the normal web build in a writable output directory. Rehearse the full
synthetic admin/driver/parent journey: approve the current revision, assign a
bounded plan, request publication with valid documents/profile/route, inspect
parent discovery/detail/comparison, suspend profile and subscription, attempt
new contacts/direct IDs, inspect existing participant history, then restore each
gate. Verify owner management remains usable while hidden and admin cannot open
rosters/payments/contact bodies. Browser/device journey and PostgreSQL concurrent
write tests are not locally verified; Task 08 acceptance remains pending those
checks. Existing Q1–Q9 policy assumptions remain unchanged; no source ambiguity
with issue #17 was found.

## Changed files for review

| Area | Files |
| --- | --- |
| Contract/documentation | `CODEX_TASK_08.md`, `backend/api/contracts.py`, `backend/api/test_contracts.py`, `backend/api/urls.py`, `backend/openapi.json` |
| Backend controls | `backend/drivers/control_api.py`, `backend/drivers/publication.py`, `backend/drivers/test_controls.py` |
| React/API | `web/src/AdminControls.tsx`, `web/src/api.ts`, `web/src/api-types.ts`, `web/src/App.tsx`, `web/src/DriverOperations.tsx`, `web/src/PublicationScreens.tsx`, `web/scripts/generate-api-types.mjs` |
| React regressions | `web/src/AdminControls.test.tsx`, `web/src/App.test.tsx`, `web/src/DriverOperations.test.tsx`, `web/src/PublicationScreens.test.tsx`, `web/src/ValidationScreens.test.tsx` |

## Astra pre-commit corrections — B1/B2/B3/N1 (5 October 2026)

This pass fixes only the confirmed React lifecycle/confirmation/refresh blockers
and the nullable profile-version contract. Backend authorization, profile
transitions, locking/conflicts, atomic audit and publication policy are unchanged.
Task 08 acceptance is still pending the host/PostgreSQL and cross-surface checks.

- **B1:** Updating `auth/me` identity reused the same role component tree and kept
  parent publication/navigation state. Private endpoint expiry was handled only
  locally; other mounted private data survived, and in-flight reads could restore
  old data. All authenticated state now lives under a workspace keyed by user ID
  and role. Account changes/logout invalidate the API request generation;
  `not_authenticated` centrally clears CSRF, invalidates that generation and
  removes the authenticated workspace. Guarded reads, writes, CSRF retry/bootstrap
  and document downloads reject obsolete completions. Identity verification has
  disposal/order guards; summary and publication reloads also guard request
  generations. `permission_denied` and `csrf_failed` do not expire the session.
- **B2:** Detail/history reloads rewrote the selected action, while confirmation
  built its payload from the newest mutable driver state. Confirmation now holds
  an immutable status/reason/expected-status/expected-version snapshot. Reloads
  preserve the pending draft; confirming sends the original expected snapshot,
  so a concurrent suspension produces a stale-state conflict rather than a
  restoration. Explicit overall refresh cancels the confirmation. A refresh
  without confirmation still adopts authoritative status/version.
- **B3:** Subscription/publication reload depended only on profile version. The
  overall control refresh generation now reaches the embedded subscription panel,
  which refetches its authoritative subscription/publication response even when
  profile version is unchanged. Existing profile-version remount behavior remains.
  Eligibility/blockers still come exclusively from the backend. Refresh/retry is
  read-only and does not replay writes.
- **N1:** `PROFILE_STATUS_INPUT.expected_version` now has `minimum: 1` and retains
  `type: [integer, null]`; a contract regression pins both. OpenAPI was regenerated.
  Regenerating React types produced no additional type change. Runtime validation
  was already correct and remains unchanged.

Regression evidence: 13 new web cases cover actual loaded driver/admin screens,
same-role identity changes with delayed new-account reads, expiry from a private
endpoint with a loaded queue/detail/forms/summary, obsolete successful private
and identity responses, error-code distinctions, guarded downloads/CSRF writes,
concurrent confirmation, normal refresh and integrated subscription retry without
writes. Existing App/summary expiry and profile-conflict tests now preload private
state or use a genuinely changed version; subscription blocker fixtures update
status/validity consistently.

Validation in this pass:

- Focused web command:
  `npm test -- src/SessionPrivacy.test.tsx src/AdminControls.test.tsx src/DriverOperations.test.tsx src/App.test.tsx src/api.test.ts`
  — exit 0; 45 tests across five files passed.
- `npm run format:check`, `npm run contract:check`, `npm run lint`,
  `npm run typecheck` — each exit 0. `npm test` — exit 0; 81 tests across ten files.
- `npm run build` — exit 1: EACCES unlinking pre-existing
  `web/dist/assets/index-BY9_E1-a.css` (owned by nobody).
  `npm run build -- --outDir /tmp/task08-fixes-web-dist` — exit 0.
- `python manage.py test api.test_contracts.Task08ContractTests --noinput`,
  `python manage.py test drivers.test_controls api.test_contracts.Task08ContractTests --noinput`
  and `python manage.py generate_openapi --check` — each exit 1 during application
  URL checks: `ModuleNotFoundError: No module named 'PIL'`. Task 08 database and
  concurrent-write regressions were not executed.
- `python manage.py generate_openapi --skip-checks` regenerated the contract;
  `python manage.py generate_openapi --check --skip-checks` — exit 0.
- Isolated `unittest` execution of `api.test_contracts`, using configured Django
  settings without database/application URL checks — exit 0; five tests passed,
  including both Task 08 contract assertions. This is supplemental schema evidence.
- `ruff format --cache-dir /tmp/task08-fixes-ruff --check .` — exit 0;
  49 files formatted. `ruff check --cache-dir /tmp/task08-fixes-ruff .` — exit 0.
  The cache override avoids an unwritable repository cache. Available cached
  backend environment is Django 5.2.12/Ruff 0.13.2, rather than pinned
  Django 5.2.17/Ruff 0.13.1; Pillow/PyPDF are absent. Repeat application checks in
  the pinned backend/PostgreSQL environment.
- `git diff --check` — exit 0. Branch remains `task/08-admin-driver-controls`;
  all existing and new changes remain uncommitted.

**N2 remains deferred performance hardening.** Bounded queue responses may still
scan/serialize many matching drivers for derived publication filters. No queue
query optimization or pagination refactor was performed in this pass.

Files edited specifically for these corrections: `CODEX_TASK_08.md`,
`backend/api/contracts.py`, `backend/api/test_contracts.py`, `backend/openapi.json`,
`web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/api.ts`, `web/src/api.test.ts`,
`web/src/AdminControls.tsx`, `web/src/AdminControls.test.tsx`,
`web/src/DriverOperations.tsx`, `web/src/DriverOperations.test.tsx`,
`web/src/PublicationScreens.tsx`, and new `web/src/SessionPrivacy.test.tsx`.
Other pre-existing Task 08 changes were retained.
