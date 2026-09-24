# Task 05 — Parent Flutter discovery, comparison and consented contact

Implement the October MVP parent discovery/contact vertical slice after Task 04.

Task 04 established the authoritative publication predicate, safe parent discovery list/detail API, route/coverage summaries, and plan/publication behavior. Task 05 turns that boundary into the first complete parent Flutter product flow and adds the controlled parent↔driver contact-request workflow plus the minimum driver React inbox needed to act on those requests.

This task also adds read-only review display for the October MVP. Reviews remain synthetic/demo-only until Q5 is resolved.

## Authoritative project documents

Read and preserve these before changing code:

- `docs/ROADMAP.md` — Task 05 outcome and exit gates.
- `docs/PRODUCT_SCOPE.md` — parent journey and Q1/Q4/Q5 constraints.
- `docs/DATA_MODEL.md` — ContactRequest/Review semantics, ownership, snapshots and state transitions.
- `docs/ARCHITECTURE.md` — modular-monolith/API/privacy boundaries.
- `docs/decisions/0002-authentication-strategy.md` — shared session/CSRF behavior for Flutter and React.
- `docs/decisions/0004-publication-eligibility.md` — authoritative discovery predicate.
- Task 04 implementation/tests — publication policy, discovery allowlist, route summaries, React design language and Chilean time/date behavior are accepted behavior.

If implementation and planning documents disagree, do not silently invent policy. Preserve accepted security/privacy decisions and report the conflict.

## Working rules

- Work autonomously inside the repository with `workspace-write`.
- Do not ask for routine approvals.
- Do **not** commit, push, merge or deploy.
- Preserve Task 02 session/CSRF semantics; do not add token auth or a second mobile auth system.
- Preserve Task 03 private-document/validation/audit boundaries.
- Preserve Task 04 publication eligibility exactly; do not duplicate or weaken it in Flutter/React.
- Use PostgreSQL for domain/concurrency behavior that depends on real database semantics.
- Keep the single OpenAPI contract current.
- Keep Spanish user-facing copy and the FurgoPlus visual language.
- No large state-management/network/UI dependency unless the current Flutter/React stack genuinely cannot satisfy the slice.
- Do not log contact message bodies, consented email snapshots, session cookies, CSRF tokens or other private fields.

---

# 1. Task outcome

By the end of Task 05:

1. A logged-in parent in the Flutter app can choose a standardized commune and discover only currently eligible drivers.
2. The parent can open a driver detail with the Task-04 public profile/route data plus read-only review summary/display.
3. The parent can select exactly 2–3 eligible drivers and compare the same normalized fields and units.
4. Discovery/detail/comparison all re-evaluate the authoritative Task-04 eligibility policy; hidden direct IDs fail closed.
5. The parent can send one bounded consented contact request to an eligible driver without child/home-address fields.
6. Duplicate pending requests for the same parent/driver pair are rejected atomically.
7. The driver can inspect incoming requests in React and accept or decline a pending request.
8. Acceptance snapshots the driver's current private service-contact email; the parent sees that snapshot only after acceptance.
9. The driver's inbox sees the parent's explicitly consented account-email snapshot associated with the request.
10. The parent can inspect request history/status and cancel a pending request.
11. Existing participant request history remains readable if a driver later becomes hidden, while no new request/acceptance may bypass eligibility.
12. October reviews are display-only. Empty review state works, and any seeded review shown for acceptance is clearly labeled demo/synthetic data.

Task 05 does **not** implement passenger assignments, seat consumption from requests, transport payments, driver mobile operation, review authoring/moderation, chat, push notifications or live GPS.

---

# 2. Unresolved product questions stay explicit

Task 05 must not convert unresolved assumptions into production claims.

## Q1 — commune catalog

The final Greater Concepción production commune catalog is not yet confirmed.

- Reuse the standardized `Commune` model from Task 04.
- Add a parent-safe authenticated way to obtain active commune code/display-name values for search UI.
- Synthetic `demo-*` communes are acceptable for tests/browser/device acceptance and must remain visibly synthetic.
- Do not seed a claimed production commune list merely to complete the UI.

## Q4 — contact channel

The accepted interim scope is **email only**:

- request message maximum 500 characters;
- one pending request per parent/driver pair;
- parent must explicitly consent to share the parent account email with the target driver;
- after driver acceptance, parent receives a snapshot of the driver's designated service-contact email;
- no phone/WhatsApp field, internal chat, child name, pickup/home address or automatic booking.

Do not invent another contact channel.

## Q5 — reviews

October reviews are read-only.

- No review creation/edit/delete endpoint for parent, driver or admin in this task.
- Real environments must work with an empty review set.
- Synthetic review fixtures are allowed only through an explicitly demo/test mechanism.
- Any synthetic review shown in UI must be visibly labeled as demonstration data.
- Do not claim review provenance/moderation is solved.

---

# 3. Public discovery schemas and commune lookup

Task 04 already owns `publication_state()` / equivalent authoritative eligibility behavior. Reuse it for every parent-facing lookup.

## Parent commune lookup

Add an authenticated parent-only endpoint equivalent to:

```text
GET /api/v1/discovery/communes/
```

Response allowlist:

- stable commune code;
- display name.

Only active catalog rows. No driver counts or private data are required.

## Discovery summary schema

Create/reuse one explicit normalized public summary schema for **search and comparison**. It should contain only fields needed by the October parent journey, including:

- driver public ID;
- display name;
- service summary;
- validated/approved label;
- standardized coverage commune code/name;
- active route public ID/label;
- recurring weekdays and local time window;
- next service date;
- truthful available seats for the current Task-04 data model;
- published review average and count.

Review summary rules:

- average is `null` when there are no published reviews;
- count is `0` when empty;
- Flutter displays **“Sin reseñas”**, not zero stars;
- average is derived from published rows, never a separately editable driver field.

Do not expose subscription state, blocker codes, account/service email, destination address, documents, observations, audit, parent identities or future roster/payment/run data.

## Detail schema

Driver detail may extend the same normalized summary with a bounded/read-only list of published reviews for display:

- score 1–5;
- bounded optional text;
- created date/instant suitable for display;
- explicit demo marker/label for synthetic rows.

Never expose review-author identity or parent/contact linkage.

The detail endpoint must still return 404 to a parent as soon as the driver becomes ineligible.

---

# 4. Comparison

Implement a parent-only comparison endpoint equivalent to:

```text
GET /api/v1/discovery/compare/?ids=<id1>,<id2>[,<id3>]
```

Requirements:

- exactly 2 or 3 **unique** driver IDs;
- preserve requested order unless the existing API style has an explicit alternative;
- every item uses the exact discovery-summary schema used by search;
- re-evaluate publication eligibility for every requested ID at request time;
- if any requested driver is missing/ineligible, fail the comparison rather than returning a misleading partial comparison;
- reject malformed, duplicate, fewer-than-2 or more-than-3 IDs with the standard API error envelope;
- parent-only; driver/admin/anonymous cannot use it;
- `Cache-Control: no-store`.

Flutter comparison must use these normalized fields only:

- coverage communes;
- service summary;
- route day/time windows;
- available seats **per route/date**;
- validation label;
- review average/count.

Do not sum seats across routes. Do not add price/ranking because Q2 does not define them.

---

# 5. Review model and demo data

Implement the conceptual `Review` entity from `DATA_MODEL.md` if it does not already exist:

- parent FK;
- driver FK;
- integer score 1–5;
- optional bounded text;
- status `published / hidden`;
- created timestamp;
- at most one review per parent/driver.

Because Q5 requires synthetic examples to be visibly labeled, add the minimum technical mechanism needed to identify demo fixture rows in the public response/UI (for example an `is_demo` boolean defaulting false). Do not use author names to signal demo data.

Database/service rules:

- rating bounds enforced;
- parent/driver uniqueness enforced;
- only `published` contributes to public average/count/list;
- hidden rows never contribute;
- no authoring mutation API in Task 05.

Provide an explicit deterministic **demo-only** seed/management mechanism for acceptance if useful. It must create fictional data only, must not silently run as production policy, and should not require storing a reusable real credential in source. Real/empty environments must remain valid with zero reviews.

---

# 6. ContactRequest model and invariants

Implement the conceptual `ContactRequest` from `DATA_MODEL.md`:

- parent FK;
- driver FK;
- immutable message, maximum 500 characters;
- explicit consent timestamp;
- immutable parent account-email snapshot captured at creation;
- nullable driver service-email snapshot captured only on acceptance;
- status `pending / accepted / declined / cancelled`;
- created/updated/resolution timestamps as useful.

Database/integrity requirements:

- partial unique constraint: at most one `pending` request for a parent/driver pair;
- message length bounded;
- immutable owner/message/consent/snapshot fields through product APIs;
- restrictive deletion consistent with the interim retention policy;
- useful participant/status indexes without speculative indexing.

A contact request is **not** a booking, seat reservation, passenger assignment or payment record. Creating/accepting it does not decrement route capacity.

---

# 7. Contact state transitions and privacy

Allowed transitions:

```text
parent: pending -> cancelled
driver: pending -> accepted
driver: pending -> declined
```

Terminal states cannot be reopened. A later request is a new row if no pending request exists and the driver is eligible again.

## Creation

Parent creates a request using an input equivalent to:

```json
{
  "driver_id": 123,
  "message": "...",
  "consent_share_email": true
}
```

Rules:

- parent-only;
- consent must explicitly be `true`;
- message trimmed and 1–500 characters unless the existing product docs explicitly allow empty (do not silently expand scope);
- server snapshots the authenticated parent's **account email**, never a client-supplied email;
- inside the transaction, lock/recheck the target driver and authoritative publication eligibility;
- hidden/ineligible target cannot receive a new request; fail closed without leaking private blocker reasons;
- enforce the pending-pair uniqueness under concurrent requests;
- duplicate pending request returns a stable conflict error rather than creating two rows.

The UI must state that the parent is sharing their account email with this driver. Do not ask for student names, home addresses or pickup details.

## Driver read/decision

The target driver can list/detail only requests addressed to that driver's own profile.

Driver-private request response may include:

- request ID;
- parent display name;
- immutable message;
- status/timestamps;
- consented parent email snapshot.

Accepting:

- lock request and driver state transactionally;
- recheck that request is still pending;
- re-evaluate current publication eligibility;
- if eligible, snapshot the **current** driver `service_contact_email` and transition to accepted atomically;
- repeated/stale competing decisions must not overwrite a terminal state;
- return consistent conflict semantics.

Declining a still-pending request remains allowed even if the driver later becomes hidden, so a driver can close outstanding requests.

## Parent read/cancel

Parent can list/detail only their own requests.

Parent-private response may include:

- request ID;
- safe driver display identity/snapshot sufficient to recognize the request;
- immutable message;
- status/timestamps;
- driver service-email snapshot **only when accepted**.

Before acceptance, no driver service email leaks. Parent may cancel only their own pending request.

## History after publication changes

If a driver becomes hidden after a request exists:

- participants can still read their existing private request history;
- accepted email snapshots remain the immutable historical snapshots;
- new requests remain blocked;
- a pending request cannot be accepted while the driver is currently ineligible;
- declining/cancelling the pending request remains possible for the appropriate participant.

Admin role does **not** get a general contact-message browsing endpoint in Task 05.

All contact endpoints/responses are `no-store`.

---

# 8. API shape

Use project-standard naming, but the slice needs equivalents of:

```text
GET  /api/v1/discovery/communes/
GET  /api/v1/discovery/drivers/?commune=<code>
GET  /api/v1/discovery/drivers/{id}/
GET  /api/v1/discovery/compare/?ids=1,2[,3]

GET  /api/v1/parent/contact-requests/
POST /api/v1/parent/contact-requests/
GET  /api/v1/parent/contact-requests/{id}/
POST /api/v1/parent/contact-requests/{id}/cancel/

GET  /api/v1/driver/contact-requests/
GET  /api/v1/driver/contact-requests/{id}/
POST /api/v1/driver/contact-requests/{id}/accept/
POST /api/v1/driver/contact-requests/{id}/decline/
```

If parent basic-profile editing is not already implemented, complete the small October requirement with an owner-only parent profile GET/PATCH for `display_name` only. Do not add child/address/contact fields to the parent profile.

Update OpenAPI for every new/changed endpoint and type. Keep explicit enums for contact status and review status where exposed. Preserve the standard error envelope and session/CSRF rules.

No second backend policy for Flutter: the server remains authoritative.

---

# 9. Flutter parent experience

Task 05 is the first real parent mobile product surface. Replace the current parent placeholder without breaking driver login/home, which remains intentionally minimal until Task 07.

A practical parent navigation may use a small bottom navigation or equivalent with:

- **Buscar**
- **Solicitudes**
- **Perfil**

Comparison can be an action/state reachable from Buscar rather than a permanent fourth tab.

## Search

- load active standardized communes from the API;
- use a selector, not arbitrary free-text commune policy;
- search only after a commune is chosen;
- clear loading/error/empty states;
- driver cards show normalized public fields, validation badge, route schedule/dated availability and review summary;
- use Spanish weekday/date/time presentation; recurring service time is America/Santiago local service time, not converted to device timezone;
- “Sin reseñas” for null-average/zero-count.

## Detail

Show:

- display name;
- validated state;
- service summary;
- coverage;
- public route schedule and dated availability;
- review average/count;
- published review list or clear empty state;
- visible “Datos de demostración” treatment for demo reviews.

Never render private destination address, service email, account email, documents, plan details or admin observations from discovery.

## Comparison

- select minimum 2, maximum 3 drivers;
- prevent duplicate selection;
- comparison request revalidates all selected IDs on the server;
- present the same fields/units side by side or in a mobile-readable repeated comparison layout;
- if one selected driver becomes hidden, show a clear stale/availability message and let the parent remove/reselect; do not continue showing a stale cached profile as currently eligible;
- clear comparison selections on logout/session reset.

## Contact request

From an eligible driver detail:

- bounded 500-character message field with counter;
- explicit consent checkbox explaining that the parent's account email will be shared with that driver;
- no child name/home/pickup inputs;
- successful request enters pending state and is visible in Solicitudes;
- duplicate pending conflict shown as a useful Spanish message rather than a crash;
- if eligibility changes before submit, handle the server failure and remove/refresh stale discovery state.

## Request history

- list parent-owned requests with driver display identity, status and date;
- detail shows message/status;
- pending can be cancelled;
- accepted shows the accepted driver-service-email snapshot and makes clear it is the contact detail shared through the accepted request;
- declined/cancelled do not show service email;
- history remains readable even if the driver no longer appears in discovery.

## Parent profile

If profile editing was missing, allow editing `display_name` only. Keep account email read-only if displayed.

## Mobile engineering constraints

- reuse the accepted Task-02 cookie/CSRF/session adapter;
- unsafe requests use the existing CSRF recovery behavior where applicable;
- no WebView workaround;
- no durable caching of private contact responses;
- network failures preserve the last confirmed local UI state and offer retry without fabricating success;
- logout clears parent discovery/comparison/contact in-memory state and session data according to Task 02 behavior;
- maintain Android build support and iOS-capable Flutter code without requiring an iOS build on Fedora.

---

# 10. React driver request inbox

Extend the existing driver React surface with a focused **Solicitudes** section consistent with the Task-04 responsive navigation.

Driver can:

- list own incoming requests;
- inspect message, parent display name, consented parent-email snapshot, status and timestamps;
- accept a pending request;
- decline a pending request;
- inspect terminal history.

UX requirements:

- blue for ordinary actions/navigation;
- green for accepted/success state;
- red for decline/destructive state;
- do not rely on color alone;
- mobile/narrow navigation remains compact;
- accepting while currently ineligible must show a clear conflict/remediation message and must not fabricate success;
- decline remains available for a pending request even if publication is blocked;
- refresh relevant request state automatically after successful action.

Do not add chat, roster creation, payment, phone/WhatsApp shortcuts or admin contact browsing.

---

# 11. Concurrency and transactional integrity

Critical writes must be transactional.

At minimum test/implement:

- two concurrent parent create attempts for the same pair cannot produce two pending rows;
- request creation locks/rechecks driver eligibility inside the write transaction;
- accept/decline/cancel lock the request row and enforce exactly one legal transition;
- acceptance coordinates with the driver row and rechecks eligibility before snapshotting contact email;
- stale second terminal decision receives conflict and does not alter the first result;
- immutable snapshots do not change if either account/service email changes later.

Use PostgreSQL for partial-unique/concurrency evidence.

---

# 12. Required backend tests

Add focused model/service/API tests covering at least:

## Discovery/reviews

- parent commune catalog returns active rows only;
- driver/admin/anonymous commune discovery denied;
- search still hides every Task-04 ineligible state;
- review average/count derives only from `published` rows;
- no reviews -> null average + zero count;
- hidden reviews do not count/display;
- review score bounds/parent-driver uniqueness enforced;
- detail review payload omits author identity and marks synthetic demo rows;
- discovery responses still omit service email, account email, exact destination, documents, subscription/audit/private validation data.

## Comparison

- 2 eligible IDs succeeds;
- 3 eligible IDs succeeds;
- order is deterministic/request-preserving as specified;
- 1 / 4 / duplicate / malformed IDs rejected;
- any hidden/missing requested ID fails the comparison;
- driver/admin/anonymous denied;
- comparison items use the normalized discovery summary contract.

## Contact creation

- parent creates pending request to eligible driver with explicit consent;
- parent email snapshot comes from authenticated account, not client input;
- consent false/missing rejected;
- message >500 rejected;
- unknown/hidden/ineligible driver fails closed;
- duplicate pending pair rejected;
- concurrent duplicate create produces only one pending row;
- no request consumes route seats or creates assignments.

## Ownership/privacy/transitions

- another parent cannot read/cancel request by ID;
- another driver cannot read/accept/decline request by ID;
- admin cannot use participant contact endpoints;
- driver sees consented parent-email snapshot only on own requests;
- parent sees no driver service email while pending/declined/cancelled;
- accepted request exposes snapshotted driver service email to parent;
- acceptance snapshots the then-current service email atomically;
- changing service email later does not rewrite accepted history;
- parent account-email change later does not rewrite request snapshot;
- acceptance rejected if driver became ineligible;
- decline still works while hidden;
- cancel still works while hidden;
- terminal state cannot be reopened/overwritten;
- existing participant history remains readable after driver becomes hidden.

---

# 13. Required Flutter tests

Add widget/unit/API-adapter tests for the critical behavior, not just rendering snapshots:

- parent role lands on the real parent home; driver role still lands on driver home;
- commune loading/select/search;
- empty discovery state;
- driver card and detail parsing/rendering;
- “Sin reseñas” empty state;
- demo review label;
- select 2–3 comparison, prevent 4th/duplicate, remove selection;
- stale hidden comparison error recovery;
- contact message counter/limit and explicit consent requirement;
- successful pending request appears in history;
- duplicate pending conflict presentation;
- accepted request shows service email, other states do not;
- pending cancellation;
- logout clears parent slice state;
- network error/retry does not invent success.

Reuse the existing session API/CSRF behavior rather than mocking a second authentication model.

---

# 14. Required React tests

Cover driver inbox behavior:

- own requests list/detail;
- consented parent email visible only in driver-private request response;
- accept pending;
- decline pending;
- accepted/declined terminal state presentation;
- eligibility conflict on accept displayed clearly;
- stale/duplicate decision conflict does not overwrite UI state;
- narrow-screen navigation exposes Solicitudes without recreating the old tall button stack;
- Task 03/04 screens continue to work.

---

# 15. Manual acceptance gate

Use fictional/synthetic data only.

Required real acceptance path before Task 05 is considered done:

1. Have at least two eligible synthetic drivers in one demo commune.
2. One eligible driver has **no reviews**; the other has clearly labeled synthetic published reviews.
3. Parent logs into Flutter and searches that commune.
4. Only eligible drivers appear; direct hidden ID is not accessible.
5. Parent opens both details and sees correct empty/demo review states.
6. Parent compares the two; normalized fields match search/detail facts.
7. Parent sends a request to one driver with explicit email-sharing consent.
8. A second pending request to the same driver is blocked.
9. Driver opens React Solicitudes, sees the consented parent email and message, and accepts.
10. Parent refreshes/request detail and now sees the accepted driver service-email snapshot.
11. Change the driver's current service-contact email after acceptance and prove the historical accepted snapshot does not change.
12. Create another pending synthetic request, make the driver ineligible (for example suspend plan), prove new contact/acceptance is blocked while existing participant history remains readable; decline/cancel remains possible.
13. Restore eligibility and verify discovery is current again.

Record any device/browser step that cannot be performed. Do not substitute unit tests for the required Android/emulator parent journey when the environment can run it.

---

# 16. Deterministic verification

Run all practical checks before reporting completion.

Backend:

```bash
ruff format --check .
ruff check .
python manage.py check --database default
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py migrate --check
python manage.py generate_openapi --check
python manage.py test
```

Integration:

```bash
bash infra/smoke.sh
```

Web:

```bash
npm run format:check
npm run contract:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Flutter:

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test
```

Repository:

```bash
git diff --check
```

Do not weaken tests/checks to make the task pass.

---

# 17. Out of scope

Do **not** implement in Task 05:

- passenger/guardian/pickup records;
- seat assignment/overbooking logic;
- payment records;
- driver mobile routes/runs/maps;
- admin profile suspend/deactivate/restore completion;
- review authoring/moderation;
- anonymous discovery;
- profile photos;
- prices/ranking/plan entitlements;
- phone/WhatsApp contact channel;
- chat;
- email delivery/notifications;
- GPS/live tracking;
- route optimization;
- payment gateway;
- deployment/app-store work.

These belong to later tasks or unresolved product decisions.

---

# 18. Completion report

At the end, report:

1. backend models/migrations/endpoints added;
2. exact public/private response boundaries;
3. Flutter parent screens/flows implemented;
4. React driver inbox implemented;
5. review/demo behavior;
6. contact snapshot and transition behavior;
7. tests/checks and exact counts/results;
8. manual browser/device acceptance actually performed vs blocked;
9. unresolved Q1/Q4/Q5 restrictions still in force;
10. `git status --short` and changed-file summary.

Do not commit, push, merge or deploy.