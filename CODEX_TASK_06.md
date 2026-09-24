# Task 06 — Driver web roster, interval capacity and manual payments

Implement the October MVP driver web-management slice after Task 05.

Task 05 completed parent discovery/comparison/contact and deliberately left passenger assignments, real seat consumption and transport-payment records out of scope. Task 06 adds those private driver-managed records and makes public route availability truthful before Task 07 consumes the same roster/capacity data on driver Flutter.

## Authoritative project documents

Read and preserve these before changing code:

- `docs/ROADMAP.md` — Task 06 outcome and exit gates.
- `docs/PRODUCT_SCOPE.md` — driver journey and unresolved Q2/Q6/Q7 boundaries.
- `docs/DATA_MODEL.md` — authoritative PassengerAssignment, PaymentRecord and capacity semantics.
- `docs/ARCHITECTURE.md` — modular-monolith/API/privacy boundaries.
- `docs/decisions/0002-authentication-strategy.md` — React session/CSRF behavior.
- `docs/decisions/0004-publication-eligibility.md` — parent discovery/publication policy.
- `docs/decisions/0005-contact-request-snapshot-semantics.md` — contact is not booking and consumes no seats.
- Task 04/05 implementation and tests — accepted route ownership, public allowlists, contact privacy, React design language and America/Santiago handling.

If implementation and planning documents disagree, do not silently invent policy. Preserve accepted authorization/privacy behavior and report the conflict.

## Working rules

- Work autonomously inside the repository with `workspace-write`.
- Do not ask for routine approvals.
- Do **not** commit, push, merge or deploy.
- Preserve Task 02 session/CSRF semantics.
- Preserve Task 03 document/validation/audit privacy.
- Preserve Task 04 publication eligibility and Task 05 public discovery/contact allowlists.
- Use PostgreSQL for interval/concurrency behavior; do not substitute SQLite semantics.
- Keep the single OpenAPI contract current and regenerate web API types with the existing project mechanism.
- Keep Spanish user-facing copy and the existing FurgoPlus React visual language.
- Do not log student, guardian, pickup, payment, message, email, cookie or CSRF sensitive values.
- No new large dependency unless the current stack genuinely cannot satisfy the slice.

---

# 1. Task outcome

By the end of Task 06:

1. The owning driver can manage recurring routes on React and route capacity changes are checked against passenger assignments.
2. The owning driver can manually create and maintain private one-route passenger assignments using the minimum conceptual fields already frozen in `DATA_MODEL.md`.
3. Assignment interval writes cannot overbook any affected scheduled service date, including concurrent final-seat attempts.
4. `used_seats(route, date)` and `available_seats(route, date)` are derived from assignments; no editable used-seat counter exists.
5. Parent discovery/detail/comparison show truthful `available_seats` for each route's explicit `next_service_date` rather than echoing total capacity.
6. The owning driver can create pending manual CLP transport-payment records associated with an owned passenger assignment and transition them to paid/void using the accepted state machine.
7. Another driver cannot read or mutate routes/assignments/payments even with guessed IDs; parent/admin/anonymous roles cannot use roster/payment owner endpoints.
8. Driver React has practical routes, roster/passenger, payments and small operational-summary views.
9. Existing Task 00–05 behavior remains green and private child/guardian/payment data never appears in discovery/contact/admin-general responses.

Task 06 does **not** implement RouteRun/today start-end behavior, driver Flutter roster, GPS, attendance, booking, parent payments, gateway billing or production child intake.

---

# 2. Q2/Q6/Q7 remain explicit

## Q2 — plan commercial differences

Basic/Pro/Elite remain identical for MVP capabilities. Do not add prices, ranked exposure or tier-specific roster/payment entitlements. Transport-payment records are unrelated to the driver's FurgoPlus subscription.

## Q6 — passenger/guardian policy

The implementation baseline permits a minimum private passenger assignment with:

- route;
- student display name;
- pickup instruction/location;
- guardian display name;
- guardian contact;
- `starts_on`;
- nullable `ends_on`.

This is not a claim that the real-data collection/guardian-consent policy is resolved. Acceptance/demo data must use fictional children/guardians/locations. Do not seed or request real child data for acceptance.

No student account/entity. No parent roster API. No automatic creation from ContactRequest. Acceptance of contact neither proves a transport contract nor consumes a seat.

## Q7 — retention

Use restrictive deletion/history behavior consistent with the current planning baseline. Do not claim legal retention/erasure compliance. Product APIs must not hard-delete operational payment/assignment history merely for convenience.

---

# 3. PassengerAssignment model

Implement the conceptual entity from `DATA_MODEL.md` with bounded fields and timestamps consistent with project conventions:

- route FK;
- student display name;
- pickup instruction/location;
- guardian display name;
- guardian contact;
- `starts_on` date;
- nullable `ends_on` date;
- created/updated timestamps where useful.

Rules:

- assignment owner is derived from `route.driver`; do not add a separately client-controlled driver owner if unnecessary;
- one assignment consumes one seat;
- active on local date `d` iff `starts_on <= d` and (`ends_on` is null or `d <= ends_on`);
- `ends_on` cannot precede `starts_on`;
- route must belong to the authenticated driver;
- route change is not a casual editable field in this task: end the old assignment and create a new assignment for another route rather than silently rewriting route history;
- no hard-delete product endpoint; ending/changing the service keeps a record;
- no student RUT, birthdate, photo, medical, school-account or attendance fields;
- no link from a contact request is required or implied by the frozen conceptual model.

Owner/private responses are `Cache-Control: no-store`.

---

# 4. Capacity semantics

Use America/Santiago service dates.

```text
used_seats(route, d) = number of PassengerAssignment rows active on d
available_seats(route, d) = route.seat_capacity - used_seats(route, d)
```

Only dates on which the recurring route actually runs matter for overbooking. A date is a route service date when its weekday is in the route's recurring weekday set.

## Assignment writes

For create or interval changes:

- use a transaction;
- lock the route row before capacity validation;
- re-read the relevant assignments inside that transaction;
- reject if the proposed interval would make active assignment count exceed `seat_capacity` on any affected scheduled service date;
- concurrent attempts for the final seat must serialize through the route lock so only capacity-respecting writes commit;
- return the project-standard stable conflict/validation error rather than silently accepting an overbooking.

Do not validate only today's date. Do not use an editable used-seat field.

A bounded/sweep/boundary algorithm is acceptable, but it must be correct for finite and open-ended assignment intervals and route weekday schedules. Avoid arbitrary future horizons that could accept a later overbooking.

## Route capacity edits

Existing route update locking/revision semantics remain authoritative. Before lowering `seat_capacity`, validate all existing assignment intervals against the proposed capacity. Reject a reduction that would create overbooking on any scheduled service date.

Preserve existing route owner checks, optimistic revision conflict and private destination behavior.

Do not sum seats across different routes for parent discovery/comparison.

---

# 5. Dated capacity API/data helpers

Create one reusable server helper/service for assignment activity and dated capacity. Reuse it from owner APIs and public discovery rather than implementing separate seat logic in React/Flutter/publication code.

At minimum it must support:

- `used_seats(route, date)`;
- `available_seats(route, date)`;
- capacity validation for a proposed assignment interval;
- capacity validation for a proposed route capacity reduction.

For owner route responses, expose useful dated capacity without leaking roster data. A route detail/list may include a clearly labeled capacity snapshot such as today's local date or an explicit requested date if that best matches existing API conventions. Keep exact behavior documented in OpenAPI.

For parent discovery, preserve the existing normalized schema:

- compute the route's `next_service_date` on/after current America/Santiago date;
- set `available_seats` to the derived value for that exact date;
- preserve `seat_capacity` if already part of the accepted public schema;
- do not expose assignment identities/count details beyond the derived availability number.

Search, detail and comparison must continue sharing the same public summary semantics and Task 04 eligibility predicate.

---

# 6. Passenger-assignment owner APIs

Use project-standard paths/naming. The slice needs equivalents of:

```text
GET  /api/v1/driver/passenger-assignments/
POST /api/v1/driver/passenger-assignments/
GET  /api/v1/driver/passenger-assignments/{id}/
PATCH /api/v1/driver/passenger-assignments/{id}/
POST /api/v1/driver/passenger-assignments/{id}/end/
```

If a smaller API shape fits the existing project better, preserve all invariants above.

Requirements:

- driver role only;
- object ownership from route/assignment, not client-provided driver ID;
- cross-driver IDs fail closed (404 preferred where consistent with existing owner APIs);
- list supports the practical React need to group/filter by own route without exposing another driver;
- create accepts only the minimum assignment fields;
- patch may edit bounded private text/date fields but must not silently move ownership/route;
- every interval-changing write repeats capacity validation under route lock;
- ending is idempotent only if doing so preserves clear semantics; otherwise use the project-standard conflict behavior and test it;
- no parent/admin roster endpoint.

---

# 7. PaymentRecord model and state machine

Implement `PaymentRecord` from `DATA_MODEL.md`:

- driver FK;
- PassengerAssignment FK;
- service-period start date;
- service-period end date;
- positive integer `amount_clp`;
- `due_on` date;
- status `pending / paid / void`;
- nullable `paid_at` instant;
- created/updated timestamps where useful.

Database/service rules:

- assignment must belong to the same driver;
- period end cannot precede period start;
- amount must be a positive integer CLP value;
- new product-API records are created `pending` with no `paid_at`;
- `pending -> paid`: server sets `paid_at` to current instant atomically;
- `pending -> void` allowed;
- `paid -> void` allowed and preserves historical `paid_at`;
- `void` terminal;
- repeated/stale competing transitions must not overwrite another terminal decision;
- no hard delete;
- payment writes must not modify subscription/plan/publication state.

No card numbers, bank accounts, transfer credentials, gateway tokens, Webpay, invoices, refunds, partial payments, parent payment API or automatic subscription billing.

All payment responses are private/no-store.

---

# 8. Payment owner APIs

Use project-standard naming. The slice needs equivalents of:

```text
GET  /api/v1/driver/payments/
POST /api/v1/driver/payments/
GET  /api/v1/driver/payments/{id}/
POST /api/v1/driver/payments/{id}/mark-paid/
POST /api/v1/driver/payments/{id}/void/
```

Requirements:

- owning driver only;
- cross-driver assignment/payment IDs fail closed;
- stable enum/status responses;
- transitions locked transactionally;
- standard API error envelope;
- CSRF/session behavior unchanged;
- no payment amount/status exposed to parent discovery or contact participants.

---

# 9. Driver operational summary

Add/reuse a small owner-driver summary endpoint/view suitable for React. This is **not analytics**.

It may combine already-authorized facts such as:

- validation state/current approval status;
- current plan/subscription label/status/window;
- publication requested/eligible/blockers using the existing server policy;
- own route count/status;
- useful dated per-route total/used/available seats;
- assignment counts appropriate to the owner view;
- pending/paid/void payment counts and simple CLP totals if derived directly from records.

Do not invent tier-specific benefits, rankings, forecasts or business KPIs.

Do not create a second publication predicate.

---

# 10. React driver experience

Extend the existing authenticated driver React surface without breaking validation/publication/contact flows.

## Routes

- preserve create/edit flow;
- surface total capacity plus useful dated used/available values;
- when a capacity reduction is rejected due to assignments, show a clear Spanish conflict message;
- preserve coverage/schedule/destination editing and optimistic revision handling.

## Pasajeros / roster

- list only the driver's assignments, preferably grouped/filterable by route;
- clear empty/loading/error states;
- create form with the minimum fields from Q6;
- allow safe edit/end flow consistent with API semantics;
- never render another driver's rows;
- acceptance/manual demo uses obviously fictional values in test data and acceptance notes.

## Pagos

- list only owner payment records;
- create a pending CLP record for an owned assignment;
- show service period, due date, amount and status;
- allow mark-paid and void only when the transition is valid;
- use CLP presentation, but send/store integer pesos; no decimal/card UI.

## Dashboard/resumen

- concise status cards/sections for validation, plan/publication, routes/capacity, assignments and payment state;
- summary links may navigate to the detailed existing/new sections;
- do not turn this into advanced analytics or plan-feature differentiation.

Keep the established FurgoPlus design language; broad visual redesign belongs to a later UX pass.

---

# 11. Privacy / authorization regression boundary

Private assignment fields include student name, guardian name/contact and pickup instruction/location. Payment records are also private.

They must never appear in:

- parent discovery/search;
- driver public detail;
- comparison;
- review response;
- parent/driver ContactRequest response beyond the existing consented fields;
- admin general queue/publication/plan endpoints;
- logs, audit detail or error traces deliberately emitted by application code.

Task 06 does not give admin a general roster/payment browser.

IDs are not authorization. Test direct guessed IDs for every new owner endpoint.

---

# 12. Migrations, OpenAPI and tests

Add migrations for PassengerAssignment/PaymentRecord and indexes/constraints required by `DATA_MODEL.md`. Do not add speculative indexes.

Update:

- backend URLs/API contracts;
- `backend/openapi.json` via the project's generator;
- generated React API types/client bindings;
- README/demo instructions only where Task 06 usage genuinely changes them.

Required automated coverage includes:

## Backend

- assignment ownership/role gates;
- date interval validation;
- capacity exact-boundary success;
- one-over-capacity rejection;
- non-service-day overlap behavior;
- open-ended interval behavior;
- concurrent final-seat attempts on PostgreSQL;
- route capacity reduction conflict;
- public discovery next-service availability decreases/increases as assignments change/end;
- contact acceptance/request rows consume no seats;
- payment ownership/cross-driver FK rejection;
- pending->paid, pending->void, paid->void and void-terminal transitions;
- paid_at semantics;
- transport payments have no subscription/publication side effect;
- private-field leak regression for discovery/contact/admin-general APIs;
- existing full backend suite.

## React

- route capacity conflict/error state;
- passenger empty/list/create/edit/end owner flow with API mocks/contracts;
- payments create/mark-paid/void states;
- dashboard summary states;
- existing React suite, typecheck, lint, format, contract check and build.

## CI parity

Remember the Task 05 lesson: tests that exercise production-like HTTPS redirect settings must use secure requests/CI-compatible public HTTPS origins. Do not weaken `SECURE_SSL_REDIRECT` or production settings to make tests pass.

Run the normal backend/web deterministic suites. Flutter production behavior should remain unchanged in Task 06; run the required repository-level mobile regression checks if CI/project scripts require them, but do not build new driver-mobile operation UI here.

At the end report exact test counts/results, migrations, OpenAPI status, changed files, manual acceptance still required, and `git status --short`.

Do not commit, push, merge or deploy.
