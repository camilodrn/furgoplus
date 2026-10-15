# Implementation roadmap to 14 October 2026

Planning baseline: 23 September 2026. **Technical freeze: 13 October 2026. Delivery/demo: 14 October 2026.** Dates are the original target sequence, not current completion status. Task 08.5 is implemented, human-accepted and merged through PR #20 at **`816dda0`**; issue #19 is complete. Task 09/10 prepares a reproducible **MVP demo/academic freeze**, pending operational HOST/device rehearsal and human candidate review. See [the current evidence/candidate record](RELEASE_REHEARSAL.md). Task 00's original documentation-only boundary remains historical.

## Sequence and exit criteria

Task 11 closure: the operator confirms r4 deployed/tested on Debian over HTTPS,
with React/Android and a prepared, backed-up synthetic scenario. The dated Task
09/10 mapping below remains historical; see [final review](TASK11_FINAL_REVIEW.md)
for current evidence limits, uncommitted changes and the proposed Git incorporation.

| Task / target dates | Small vertical outcome | Required exit evidence |
| --- | --- | --- |
| 00 · 23 September | Product/architecture freeze. | Required docs and accepted ADRs; explicit assumptions/questions; documentation consistency check; no application code. |
| 01 · 24–25 September | Repository foundation and first health request. Create backend/web/mobile structure, local Compose, PostgreSQL, config examples, pinned dependencies and CI; initialize the custom role-aware user before first domain migrations. Establish API schema/error envelope and synthetic fixture conventions. | Clean local startup and empty-database migrations; React and Flutter reach health API; initial format/lint/type/analyzer/build checks green. Confirm host/mobile hardware and secrets handling. |
| 02 · 26–27 September | Accounts plus Flutter/React authentication foundations. Implement parent/mobile and driver/web signup, login/logout/me, role navigation, protected API and administrator provisioning. | Native Flutter and React HTTPS session/CSRF gate from ADR 0002 passes, including restart/logout/expiry and forbidden roles. No domain screens built around an unproven authentication adapter. |
| 03 · 28–29 September | Driver onboarding through a minimal React admin validation screen. Immutable uploads/submission revisions, queue, private review, approve/reject, driver observations and atomic audit. | Driver registers before approval; stale review cannot approve changed documents; parent/other-driver file access denied; approved/rejected history retained. Q3 checklist confirmed or synthetic-demo restriction explicit. |
| 04 · 30 September–1 October | Publication slice. Manual Basic/Pro/Elite state and minimal admin controls; driver intent/status/blockers; route/coverage/schedule/capacity skeleton needed for publication. | Eligibility truth table passes on search/detail/direct IDs; plan expiry/suspension hides immediately; incomplete routes cannot publish; transport payments have no plan effect. Confirm commune/contact assumptions. |
| 05 · 2–3 October | Parent Flutter end-to-end discovery and contact; driver web request inbox/accept/decline. Profiles, read-only review display, 2–3 driver comparison and consented contact snapshots. | Parent discovers only eligible drivers; comparison uses identical fields; hidden IDs fail; duplicate pending requests blocked; contact sharing follows consent/status; empty review state and labeled demo reviews work. |
| 06 · 4–5 October | Driver web management completion. Route editing, roster assignments, interval capacity checks, manual payment records and summaries of plan/validation/operation state. | Cross-driver writes fail; concurrent/overlapping assignment capacity checks pass; payment transitions work; no card data or billing integration. Passenger/guardian fields confirmed or synthetic restriction retained. |
| 07 · 6–7 October | Driver Flutter operation. Today's services, private minimum roster, dated used/available capacity, start/end and external maps. | Correct America/Santiago date; repeated actions do not duplicate runs; started-day roster remains stable; no GPS permission/streaming; provider failures handled; same app switches home correctly across parent/driver account logins. |
| 08 · 8–9 October | Admin/driver control completion and integrated dashboards. Queue search/filter, complete observations/history, plan changes, suspend/deactivate/restore and audit inspection. | Full synthetic journey passes across both UIs; admin role cannot access unrelated rosters/payments; suspension and restoration rerun all gates; direct-ID/privacy regression tests pass. |
| 08.5 · complete, 7 October | Product UX, privacy/legal draft foundation and stabilization, merged PR #20 (`816dda0`). | Human acceptance complete; HOST backend/smoke, normal Flutter tests/debug APK and npm production audit (0 vulnerabilities). [Evidence](MVP_DEMO_FREEZE.md). |
| 09 · 10–12 October | Integration, security/error hardening and release-candidate rehearsal. Finish critical cross-client smoke evidence, contract checks, migration/backup restore rehearsal, setup/demo instructions and synthetic seed reset. | Required CI green; HTTPS native/browser smoke passes; private upload tests and log inspection pass; clean setup works; known limitations recorded. Choose a candidate by 12 October. No stretch work in this buffer. |
| 10 · 13 October | Technical freeze. Validate the candidate on delivery hardware; freeze schema/API and rehearse the timed demo. | No open blocker affecting privacy, authorization, data integrity or the core journey. Record candidate identity, check results and remaining nonblocking defects. Only critical fixes may change the candidate and must repeat affected checks plus smoke. |
| Delivery · 14 October | Demonstrate the frozen candidate and hand over documentation. | Demonstrate the accepted parent-driver-admin journey and limitations. No scheduled feature development, app-store launch or deployment requirement added on this date. |

## Why this order differs from the example list

Flutter foundation is part of accounts so mobile session/CSRF risk is discovered early. A minimal admin validation screen is built alongside onboarding, and plan controls alongside publication, rather than leaving approval prerequisites to the end. Route skeleton precedes discovery because publication and comparable availability need real route data. Web roster/payment management precedes driver mobile operations so the day's passenger/capacity data exists. Final admin polish completes the earlier vertical slices rather than introducing the admin surface late.

## Gates and scope control

- Every slice carries its backend authorization/business tests and the relevant client tests; do not defer permissions or private-file access to hardening.
- Maintain one OpenAPI contract and sanitized fixtures as the API grows. CI checks formatting/lint/static types/analyzer/builds, contract drift, migrations and secret exclusion as described in [architecture](ARCHITECTURE.md).
- Auth/HTTPS failures, public document leakage, overbooking, stale validation approvals and publication bypass are blockers. Do not weaken these checks to meet a demo date.
- If a date slips, drop all stretch work and simplify visual polish first. Preserve the core journeys and 10–13 October verification buffer. Record an explicit delivery-risk decision if the minimum cannot fit; do not silently call incomplete scope complete.
- Product questions Q1–Q9 live only in [scope](PRODUCT_SCOPE.md); assigned decision dates are dependencies. An unresolved real-data policy keeps the demonstration synthetic rather than authorizing real intake.

## Release-candidate smoke script

1. Start from an empty migrated PostgreSQL database in an **isolated rehearsal project**, never reset current development. Prepare through the [runbook](DEMO_RUNBOOK.md) (Task 11 adds guarded [scenario preparation](DEMO_SCENARIO.md), never a reset), then snapshot DB plus private files using [BACKUP_RESTORE](BACKUP_RESTORE.md). Use labeled fictional accounts: admin, two parents and multiple drivers spanning pending/rejected/approved and plan/status combinations. Include one eligible driver with no reviews and one with synthetic published reviews.
2. Register a new driver in React, upload synthetic documents, submit; admin rejects with observations, driver resubmits, admin approves the current revision. Confirm only the reviewed revision was approved and audit is present.
3. Create a valid route for the rehearsal/delivery weekday and dated assignments; activate a bounded plan valid through delivery; request publication. Log in as parent in Flutter, search by commune, inspect the approved badge/reviews and compare with another eligible driver. Verify pending/expired/suspended profiles are absent even by direct ID.
4. Send a consented request, accept it as the driver in React, verify the two permitted contact disclosures. Add a fictional passenger and manual payment record. Cross-driver IDs and duplicate contact writes already have automated security coverage; verify the restored target denies private downloads and retain that evidence.
5. Log in as the driver in the **same Flutter app**, inspect today's roster/capacity, start the run, open a synthetic destination externally, and end the run. Verify role-specific navigation, repeat behavior and logout/cache cleanup.
6. Suspend the profile/plan in React admin; repeat parent search/detail/comparison and new contact attempts. Existing participants retain only their private request history. Parent/other driver cannot download documents or fetch rosters/payments.
7. Verify expiry/CSRF failures and network-error recovery on the delivery devices. After an ambiguous write, refresh/read before an explicit retry; never blindly replay a timeout. Rehearse database-plus-private-file restore and record the result, along with any platform checks that were not performed.

## Current smoke mapping after Task 08.5

The long script above is a release checklist, not the on-stage sequence. Use the
[12-minute runbook](DEMO_RUNBOOK.md) on 14 October. Do not repeat already accepted
exhaustive CRUD/privacy work without a change or failure that justifies it.

| Step | Implemented path / existing automated evidence | Remaining proportional rehearsal |
| --- | --- | --- |
| 1 · setup/state | Compose, migrations 0001–0008, `seed_demo_communes`, guarded `seed_demo_reviews`; no full account/domain reset. CI integration migrates an empty database. | HOST fresh isolated build/start, manual synthetic preparation and new-target restore/checkpoint/access evidence. |
| 2 · validation | `drivers/services.py`, `drivers/api.py`, `web/src/ValidationScreens.tsx`; `drivers/tests.py` verifies immutable revisions, stale decisions, private downloads and audit. Web ValidationScreens/AdminControls tests cover observations/conflicts/history. | Accepted Task 08.5 UI evidence stands; on restored target check exact revision, one owner/admin file download and denied cross-role access. A pending control account avoids re-registering an extra account mid-demo. |
| 3 · publication/discovery | `publication.py`, `publication_api.py`, `mobile/lib/parent_home.dart`, `parent_service.dart`; `test_publication.py`, `test_contact.py`, parent widget/service tests verify eligibility, allowlists, comparison/reviews. | Two eligible synthetic services, valid dates, one no-review state; short delivery-device discovery/detail/compare check. |
| 4 · contact/roster/payment | `contact_api.py`, `operations_api.py`, `capacity.py`; DriverRequests/DriverOperations web; `test_contact.py`, `test_operations.py` cover snapshots, owner boundaries, duplicates and concurrent capacity; web tests cover state/form feedback. | One live contact/accept + parent refresh, inspect prepared roster and one manual payment transition. Acceptance does not reserve a seat. |
| 5 · daily mobile | `daily_operation.py`, `mobile/lib/driver_home.dart`; `test_daily_operation.py` and `driver_home_test.dart` cover Chilean date, idempotence, frozen roster and failure states. | Samsung/emulator Hoy/roster, external maps return, explicit start/end and logout/login into the other role. These platform actions cannot be established by mocked widgets. |
| 6 · admin/privacy | `control_api.py`, AdminControls/AdminExperience; `test_controls.py`, publication/contact tests and 41 SessionPrivacy web cases cover suspension, private histories, role boundaries and replacement cleanup. | One reasoned suspension with parent refresh and restored document access/denial. Existing accepted exhaustive UI checks need no blanket rerun. |
| 7 · recovery/restore | `api/test_auth.py`, native `session_test.dart`, web API/AuthRestore/SessionPrivacy tests cover CSRF/expiry, no stale identity and uncertain writes. | Dated native/browser HTTPS/secure-storage result if missing, bounded failure recovery on delivery hardware, actual isolated DB+file restore and redacted local log review. |

**Obsolete pre-08.5 UI assumptions:** there is no generic driver “dashboard + CRUD”
walkthrough. Driver web is **Inicio · Mi servicio · Pasajeros · Solicitudes · Pagos**;
validation/documents/publication/routes are within Mi servicio. Admin uses
**Validaciones · Conductores** with context/history under demand, not an unrestricted
Django-admin roster browser. Parent tabs are **Buscar · Solicitudes · Mi cuenta**;
driver mobile starts at **Hoy**, with destination-only external maps. Driver
Solicitudes pages are **local ten-row pages over a full response**, not server
pagination. No legal acceptance checkbox is part of the draft-document journey.

Required CI **configuration** is present; a passing remote run for the eventual
post-Task-09/10 SHA is still to be recorded. Historical Task 08.5 HOST passes are
separate from this sandbox's blocked reruns. The freeze candidate is not yet
recorded or automatically approved.
