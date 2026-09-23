# Task 04 — Publication eligibility, plans and route skeleton

Implement the October MVP publication vertical slice after Task 03.

This task makes publication eligibility a real backend policy and gives the driver/admin enough web UI to exercise it. It also adds the minimum route/coverage/schedule/capacity model needed for publication. It does **not** implement the full parent discovery experience, contact flow, roster management, payments or driver mobile operation.

## Authoritative project documents

Read and preserve these before changing code:

- `docs/ROADMAP.md` — Task 04 outcome and exit gates.
- `docs/PRODUCT_SCOPE.md` — October MVP boundaries and Q1/Q2 assumptions.
- `docs/DATA_MODEL.md` — entity/state/ownership meanings.
- `docs/ARCHITECTURE.md` — modular-monolith/API/privacy boundaries.
- `docs/decisions/0004-publication-eligibility.md` — authoritative publication predicate.
- Task 03 implementation and tests — validation state, immutable documents, admin audit and React branding/UX are already accepted behavior.

If code and planning docs disagree, do not silently invent new product policy. Preserve the accepted decisions and report the conflict.

## Working rules

- Work autonomously inside the repository with `workspace-write`.
- Do not ask for routine approvals.
- Do **not** commit, push, merge or deploy.
- Do not weaken Task 02 authentication/session/CSRF behavior.
- Do not weaken Task 03 document privacy, immutable validation history, stale-review protection or audit.
- Use PostgreSQL for domain/concurrency tests that depend on real database behavior.
- Keep OpenAPI and generated React types current.
- Keep the existing FurgoPlus visual language and Spanish user-facing copy.
- Keep dates/times Chile-friendly in visible UI; API/database contracts remain explicit ISO/UTC/local-time values as appropriate.
- No large UI/date/state-management dependency unless the existing stack genuinely cannot support the requirement.

---

# 1. Task outcome

By the end of Task 04:

1. Basic / Pro / Elite exist as a seeded plan catalog with identical MVP capabilities.
2. An administrator can manually assign/change/activate/suspend the current driver subscription with explicit validity and a reason.
3. Subscription mutations are atomic and audited.
4. A driver can see publication intent, eligibility state and precise blockers, and can request/unrequest publication.
5. A driver can create/manage the minimum recurring route data needed for publication: standardized coverage, weekdays, local time window, positive capacity and a destination.
6. One authoritative backend eligibility policy derives whether the driver is currently discoverable.
7. Authenticated parent discovery list/detail endpoints apply exactly that policy, including direct-ID lookups.
8. A failed gate hides the driver immediately; there is no stored authoritative `is_public` boolean and no scheduler required for expiry.

Task 04 is a backend + React publication slice. Flutter discovery UI belongs to Task 05.

---

# 2. Authoritative publication predicate

Implement ADR 0004 as one reusable backend service/policy.

A driver is eligible if and only if all of these are true:

```text
user.is_active
AND driver.status == active
AND driver.publication_requested
AND driver.validation_state == approved
AND approved_revision == current_validation_revision
AND required current documents are present and not expired
AND subscription.status == active
AND subscription.starts_at <= now < subscription.ends_at
AND required public profile fields and private service-contact email are complete
AND at least one active, valid route exists
```

Required public/profile conditions for this task:

- nonblank driver display name;
- nonblank service summary;
- nonblank private service-contact email;
- coverage derived from at least one valid active route.

A required document with an expiration date remains valid through the end of that **local calendar date in `America/Santiago`**. Do not rewrite historical validation state merely because a document expires; eligibility simply becomes false until remediation/revalidation restores the gates.

Subscription validity is the half-open instant interval:

```text
starts_at <= now < ends_at
```

Store instants in UTC. Do not add an `expired` status that needs a scheduled job.

Do not store a separate authoritative `is_public`/`is_eligible` field.

Provide private blocker codes plus Spanish labels/messages for the owning driver/admin. Prefer stable machine-readable blocker codes such as the equivalent of:

- `account_inactive`
- `driver_suspended`
- `driver_deactivated`
- `publication_not_requested`
- `validation_not_approved`
- `approved_revision_stale`
- `required_document_missing`
- `required_document_expired`
- `subscription_missing`
- `subscription_inactive`
- `subscription_suspended`
- `subscription_not_started`
- `subscription_expired`
- `profile_display_name_missing`
- `profile_summary_missing`
- `service_contact_email_missing`
- `active_route_missing`

Exact naming may follow the existing project style, but keep it typed and tested.

Return all useful current blockers privately rather than stopping after the first one. The public discovery API must not reveal why another driver is hidden.

---

# 3. Plans and current subscription

Implement the conceptual model from `DATA_MODEL.md`.

## Plan

Seed exactly these stable codes:

- `basic`
- `pro`
- `elite`

Each has a display label.

For the October MVP all three have identical capabilities.

Do **not** add:

- price;
- billing state;
- payment gateway fields;
- ranking weight;
- feature entitlements;
- automatic renewal;
- automatically active free plan.

Q2 remains product policy. Do not invent commercial differentiation.

Use an idempotent migration/data-migration or another deterministic project-standard seed mechanism appropriate for a required catalog. Fresh database migrations must produce the three plans.

## DriverSubscription

Implement one current subscription per driver with at least:

- driver FK / one-to-one ownership;
- plan FK;
- status: `inactive / active / suspended`;
- `starts_at`;
- `ends_at`.

Rules:

- an active subscription requires both bounds;
- `ends_at > starts_at`;
- elapsed validity makes an `active` row ineffective without rewriting status;
- no subscription means publication fails closed;
- admin is the only product actor allowed to assign/change/activate/suspend;
- signup does not create an active subscription;
- plan activation is independent from validation approval.

Every admin mutation requires a nonblank reason and writes an `AdminActionLog` entry in the same transaction with safe before/after state. Do not put secrets/contact data in audit text.

Reuse the Task 03 admin-audit infrastructure rather than creating a competing audit system.

---

# 4. Commune and route skeleton

Task 04 needs enough real route data for publication, but full roster/capacity management belongs to Task 06.

Implement the conceptual `Commune`, `Route` and `RouteCoverage` model from `DATA_MODEL.md`.

## Commune

Use:

- stable unique code;
- display name;
- optional active/catalog flag if useful.

Q1 has not yet confirmed the final Greater Concepción production catalog. Therefore:

- do not silently claim a final real-world commune catalog in code or documentation;
- model standardized communes now;
- backend tests may create deterministic synthetic commune rows;
- if local/browser acceptance needs sample catalog data, provide an explicitly demo/synthetic seeding mechanism rather than presenting it as confirmed production policy;
- report Q1 as unresolved at the end of the task.

A later Q1 decision must be able to replace/extend catalog data without redesigning routes.

## Route

Implement a one-way recurring route owned by one driver with at least:

- label;
- status `active / inactive`;
- nonempty bounded weekdays;
- local start time;
- local end time;
- positive seat capacity;
- destination label;
- destination address or equivalent static destination representation sufficient for the later external-map action.

No cross-midnight schedule in the MVP:

```text
start_time < end_time
```

A return service is another route.

No GPS observations, optimization, polylines or live tracking.

## RouteCoverage

Many-to-many through an explicit join:

- route FK;
- commune FK;
- unique route/commune pair.

An **active** route is publication-valid only when it has:

- at least one standardized coverage commune;
- nonempty valid weekdays;
- `start_time < end_time`;
- positive capacity;
- nonblank destination data.

Driver coverage is always derived from active valid routes, not copied into another profile field.

Do not hard-delete routes that may later be referenced. Use active/inactive state.

## Minimal owner API/UI

Implement only enough driver route management to satisfy Task 04 publication setup and future Task 06 extension.

At minimum the owning driver can:

- list own routes;
- create a complete route;
- edit its Task-04 route fields;
- activate/deactivate it.

All route object access must be owner-scoped before lookup. Another driver cannot read or mutate it by ID.

Do not implement passengers, assignments, payment records, runs, attendance or historical route analytics in this task.

The React driver UI should make this small route setup understandable without becoming the full Task 06 management product.

---

# 5. Publication intent and private status

The existing `DriverProfile.publication_requested` is owner-controlled publication intent.

Add an owner endpoint/action to request/unrequest publication.

Changing intent:

- does not bypass any gate;
- does not mutate validation history;
- does not activate a plan;
- does not create an authoritative public flag.

Expose a private publication-status response to the owning driver containing at least:

- `publication_requested`;
- derived `eligible` boolean;
- current blocker codes/messages;
- validation summary needed to understand blockers;
- current plan/subscription summary, if any;
- route/coverage summary needed to understand blockers.

Do not expose private document paths/hashes or unrelated audit data.

React driver UI should show a clear publication card/state, for example conceptually:

```text
Estado de publicación
No visible para apoderados

Faltan:
- Plan activo
- Al menos una ruta activa

[Solicitar publicación]
```

or when all conditions pass:

```text
Estado de publicación
Visible para apoderados
Plan Basic · vigente
Validación aprobada
1 ruta activa
```

Use text plus status styling; do not rely on color alone.

Publication intent should remain visible/remediable even while blockers exist.

---

# 6. Minimal administrator controls

Extend the protected React admin surface with a focused plan/publication control area.

The admin should be able to inspect a driver and see:

- validation state;
- publication intent;
- derived eligibility and blockers;
- current plan/subscription;
- plan validity;
- active-route count/coverage summary sufficient to explain publication state.

Provide admin controls to:

- assign/change Basic, Pro or Elite;
- set explicit start/end validity;
- activate a valid subscription;
- suspend an existing subscription;
- reactivate/update it through an explicit action that still rechecks validity;
- require a reason for each mutation.

Do not add payment-gateway language or imply that a plan was purchased.

## Chilean date/time UX

Do not regress the date-format issue fixed in Task 03.

User-facing subscription validity controls must not show US `MM/DD/YYYY` merely because the browser/OS locale is English.

If date and time are entered separately, use clear Chilean visible date (`DD/MM/YYYY`) plus 24-hour time (`HH:mm`) and convert to explicit ISO/UTC instants for the API.

Reuse or carefully extend the existing date utilities/components rather than introducing a large date framework.

The UI must make end-boundary semantics understandable; do not silently reinterpret a user-entered end instant as an unrelated date.

---

# 7. Minimal authenticated parent discovery API

Task 05 owns the Flutter discovery UI, comparison and contact flow. Task 04 nevertheless must prove the publication boundary through backend list/detail/direct-ID endpoints.

Implement authenticated parent-only endpoints equivalent to:

- `GET /api/v1/discovery/drivers/?commune=<code>`
- `GET /api/v1/discovery/drivers/{id}/`

Use one centralized eligibility query/service for both.

Requirements:

- hidden/ineligible drivers never appear in list/search;
- direct detail lookup for an ineligible driver returns 404 to a parent;
- plan expiry/suspension takes effect on the next request without a background job;
- driver status/account deactivation takes effect immediately;
- publication intent false hides immediately;
- expired required document hides immediately;
- stale approval hides immediately;
- incomplete route/profile hides;
- no response caching in the MVP.

The public/parent allowlist should contain only Task-04-safe fields required for later discovery, such as:

- driver public ID;
- display name;
- service summary;
- approved/validated label;
- derived coverage commune code/name;
- active route public IDs/labels and schedule summaries;
- route capacity/availability information that is truthful for the currently implemented data model.

At Task 04 there are no passenger assignments yet, so any availability representation must be derived truthfully from existing route data and designed so Task 06 can replace the zero-assignment assumption without changing authorization semantics.

Never expose in discovery:

- service contact email;
- account email;
- document metadata/content/storage keys;
- validation identity snapshots or observations;
- subscription internals/history;
- audit logs;
- exact private destination address/coordinates;
- future passenger/payment/run data.

Search and detail must share explicit allowlisted serializers/typed schemas rather than serializing whole models and hiding fields in React/Flutter.

No anonymous directory in the MVP.

Do not implement parent contact requests, comparison UX or reviews in this task.

---

# 8. Concurrency, transactions and state integrity

Critical writes must be transactional.

At minimum:

- admin subscription mutation locks the relevant driver/subscription state and writes audit atomically;
- publication intent update must not allow an actor to change another driver;
- route mutation locks/updates owner-scoped state appropriately;
- eligibility is derived from current committed state and is re-evaluated per request.

Use consistent 409 conflict behavior when a meaningful state transition becomes stale; do not overwrite another current mutation silently.

IDs are not authorization.

---

# 9. API contract

Update the single OpenAPI contract and generated React types.

Keep the existing API error envelope.

Use explicit enums/types for:

- plan code;
- subscription status;
- driver status already defined by the model contract;
- route status;
- weekdays;
- blocker codes.

Use ISO dates/UTC instants on the wire. Recurring route times are local service times in `America/Santiago` and should not be converted to arbitrary device timezone.

Do not introduce a second hand-maintained client contract.

---

# 10. Required backend tests

Add PostgreSQL-backed model/service/API tests that cover the critical rules rather than a cosmetic coverage target.

## Publication truth table

Test each gate independently and meaningful combinations, including:

- all gates satisfied -> eligible;
- `user.is_active == false` -> hidden;
- driver suspended -> hidden;
- driver deactivated -> hidden;
- publication intent false -> hidden;
- validation pending/rejected -> hidden;
- approved revision differs from current revision -> hidden;
- missing required current document -> hidden;
- expired required document -> hidden;
- document expiring today in America/Santiago remains valid through that local date;
- missing subscription -> hidden;
- inactive subscription -> hidden;
- suspended subscription -> hidden;
- starts in future -> hidden;
- `now == ends_at` -> hidden;
- currently active interval -> eligible if all other gates pass;
- blank display name -> hidden;
- blank service summary -> hidden;
- blank service contact email -> hidden;
- no active route -> hidden;
- inactive-only routes -> hidden;
- invalid/incomplete active route cannot satisfy publication.

## Discovery authorization

Test:

- parent can list eligible drivers;
- parent can filter by standardized commune coverage;
- eligible direct ID returns the allowlisted payload;
- ineligible direct ID returns 404;
- driver/admin cannot use parent discovery merely because they know IDs;
- no private fields leak through list/detail;
- all discovery endpoints reuse the authoritative eligibility semantics.

## Plans/subscriptions

Test:

- Basic/Pro/Elite deterministic seed exists after fresh migration;
- codes are unique;
- no automatic active plan at driver registration;
- invalid windows rejected;
- non-admin plan mutations denied;
- activate/change/suspend produces expected current state;
- each admin mutation requires reason and creates exactly one audit entry atomically;
- failed mutation leaves neither partial subscription state nor audit entry.

## Routes

Test:

- cross-driver direct IDs denied/hidden;
- positive capacity required;
- weekdays nonempty/valid;
- start strictly before end;
- active route requires coverage and destination completeness;
- route/commune uniqueness;
- inactive route does not satisfy publication;
- coverage is derived from active routes;
- deactivation immediately removes its contribution to eligibility/coverage.

Do not implement Task 06 overbooking/assignment concurrency yet because assignments are out of scope here.

---

# 11. Required React tests

Add behavior-oriented tests for:

- driver publication status and blocker list;
- publication request/unrequest action;
- eligibility success state;
- plan/subscription summary;
- minimal route creation/edit/status flow;
- admin plan assignment/change/suspension with reason;
- admin sees publication blockers;
- Chilean date/time entry does not display/assume US MM/DD/YYYY;
- auth/role errors remain correctly handled;
- existing Task 03 validation/document/date/calendar behavior does not regress.

Avoid brittle full-CSS snapshots.

---

# 12. Regressions to preserve

Task 04 must not break:

- Task 02 React/Flutter shared Django sessions and CSRF behavior;
- fixed 12-hour absolute session semantics;
- Flutter restart/logout acceptance behavior;
- Task 03 immutable document versions;
- private authorized document downloads;
- parent/other-driver direct-ID document denial;
- admin document-read audit;
- validation reject/resubmit/approve history;
- stale review 409 protection;
- revision comparison UX;
- Chilean date input/calendar behavior;
- FurgoPlus branding and readable Spanish UI.

Run Flutter regression checks even though Task 04 should not need mobile feature changes.

---

# 13. Explicitly out of scope

Do not implement in Task 04:

- Flutter parent discovery UI;
- driver comparison UI;
- contact requests or contact disclosure;
- reviews/ratings authoring or moderation;
- passenger assignments/rosters;
- capacity interval/overbooking logic for assignments;
- transport payment records;
- route runs/start/end;
- driver mobile operation;
- live GPS/location streaming;
- map rendering or route optimization;
- profile suspension/deactivation admin UI beyond what is strictly needed to test the eligibility predicate; full admin control completion is Task 08;
- billing gateway, prices, automatic plan billing or entitlements;
- real production commune-policy claims while Q1 is unresolved;
- real personal-document intake while Q3/Q7 remain unresolved.

---

# 14. Deterministic checks

Run all checks available in the environment.

Backend:

```text
ruff format --check .
ruff check .
python manage.py check --database default
python manage.py makemigrations --check --dry-run
python manage.py migrate --check
python manage.py generate_openapi --check
python manage.py test
```

Web:

```text
npm run format:check
npm run contract:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Flutter regression:

```text
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test
```

Integration/repository:

```text
bash infra/smoke.sh
git diff --check
```

Inspect status for generated/build artifacts, private uploads, `.env`, test documents, keys, tunnel URLs and credentials.

If Docker/PostgreSQL/device access is blocked by the Codex sandbox, complete everything else and report the exact host/browser checks still required. Do not replace required PostgreSQL tests with SQLite and call them equivalent.

---

# 15. Host/browser acceptance expected after Codex

Prepare the implementation so a human can efficiently verify on the host:

1. migrate/rebuild against the real local PostgreSQL stack;
2. confirm all backend/web/Flutter regressions;
3. use synthetic/demo accounts and files only;
4. have an approved driver from Task 03;
5. fill service summary/contact, create a valid active route and request publication;
6. as admin assign a bounded active Basic/Pro/Elite subscription;
7. verify the driver becomes eligible;
8. verify parent list/detail sees the driver;
9. suspend/expire the plan and verify list + direct detail hide immediately;
10. restore the gate and verify visibility returns only if every other gate still passes;
11. verify an incomplete/inactive route cannot make the driver eligible;
12. verify another driver cannot access/mutate the route/subscription objects by direct ID.

No real documents, children, addresses or contact data are required for acceptance.

---

# 16. Final report required from Codex

At the end report clearly:

1. files/models/migrations added or changed;
2. authoritative eligibility implementation and blocker codes;
3. plan seeding and subscription transition semantics;
4. audit semantics;
5. route/coverage model and owner API;
6. publication intent/status API;
7. parent discovery list/detail boundary;
8. React driver/admin UX implemented;
9. OpenAPI/type changes;
10. tests added;
11. exact check results;
12. checks blocked by sandbox and exact host commands;
13. browser acceptance steps still required;
14. unresolved Q1/Q2/Q3/Q7 implications;
15. any security/privacy or data-integrity risks discovered.

Do not commit, push, merge or deploy.