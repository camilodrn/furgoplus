# Implementation roadmap to 14 October 2026

Planning baseline: 23 September 2026. **Technical freeze: 13 October 2026. Delivery/demo: 14 October 2026.** Dates are a target sequence with acceptance gates, not a claim of staffing capacity or completed implementation. No application work, dependency installation, commit or deployment is performed by Task 00.

## Sequence and exit criteria

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

1. Start from an empty migrated PostgreSQL database with labeled fictional fixtures: admin, two parents and multiple drivers spanning pending/rejected/approved and plan/status combinations. Include one eligible driver with no reviews and one with synthetic published reviews.
2. Register a new driver in React, upload synthetic documents, submit; admin rejects with observations, driver resubmits, admin approves the current revision. Confirm only the reviewed revision was approved and audit is present.
3. Create a valid route; activate a bounded plan; request publication. Log in as parent in Flutter, search by commune, inspect the approved badge/reviews and compare with another eligible driver. Verify pending/expired/suspended profiles are absent even by direct ID.
4. Send a consented request, accept it as the driver in React, verify the two permitted contact disclosures. Add a fictional passenger and manual payment record. Try cross-driver IDs and duplicate contact writes.
5. Log in as the driver in the **same Flutter app**, inspect today's roster/capacity, start the run, open a synthetic destination externally, and end the run. Verify role-specific navigation, repeat behavior and logout/cache cleanup.
6. Suspend the profile/plan in React admin; repeat parent search/detail/comparison and new contact attempts. Existing participants retain only their private request history. Parent/other driver cannot download documents or fetch rosters/payments.
7. Verify expiry/CSRF failures and a network-error retry on the delivery devices. Rehearse database-plus-private-file restore and record the result, along with any platform checks that were not performed.

Task 00 checks only these documents. Future CI, security tests, builds, device tests and restore rehearsals remain implementation work; their inclusion here does not imply a passing result today.
