# Conceptual data model

Status: implementation contract for planning; Task 01 adds only the custom User migration. PostgreSQL is the only application database. Use relational foreign keys, server-generated identifiers and timestamps. IDs are not authorization. Store instants in UTC; recurring service times/dates and document-expiration interpretation use America/Santiago. This model is the source of truth for field meaning, states and ownership; [ADR 0004](decisions/0004-publication-eligibility.md) defines discovery eligibility.

## Identity, validation and plans

| Entity | Relationships and minimum fields | Constraints / exposure |
| --- | --- | --- |
| User | Unique normalized email, Django password hash, role `parent / driver / admin`, `is_active`, timestamps. | Custom Django user from the first migration. Role chosen only from parent/driver on signup and immutable through normal APIs. No public email, password fields or account flags. |
| ParentProfile | One-to-one parent User; display name. | Required for parent role; account email serves consented contact. No home address or child fields at registration. Owner-only profile. |
| DriverProfile | One-to-one driver User; public display name, service summary; private service-contact email; status `active / suspended / deactivated`; publication_requested (default false); validation_state `draft / pending / approved / rejected`; current_validation_revision; nullable approved_revision. | Required for driver role. New profile: active but draft/unpublished, not approved. Only admin changes status; only validation services change validation fields. Public allowlist below. |
| DriverDocument | Many-to-one driver; kind from checklist; generated private storage key; content type, size, hash, upload timestamp; optional expires_on where applicable; is_current selection flag. | File contents/metadata are immutable; replacements are new rows. Only selection flags change, with at most one current file per driver/kind. Selecting a replacement invalidates the submitted revision. Storage key/file metadata are owner/admin-only. Never public URLs. |
| DriverValidation | Many-to-one driver; unique `(driver, revision)`; submitted identity snapshot; document references through ValidationDocument; state `pending / approved / rejected / superseded`; submitted_at; nullable reviewer, reviewed_at, observations. | Immutable submission contents; reviewer is an admin. Terminal outcomes/history are retained. Decision fields are written once. Pending may become superseded on withdrawal/edit; an already decided revision is not overwritten. |
| ValidationDocument | Foreign keys to validation and document; kind. | Unique `(validation, kind)` for a single required file per kind in the MVP; document must belong to the same driver. An upload may be referenced in successive revisions. This join preserves exactly what was reviewed. |
| Plan | Unique code `basic / pro / elite`, display label. | Seeded catalog, no MVP prices/entitlements. Not a subscription or payment record. |
| DriverSubscription | One-to-one driver; plan FK; status `inactive / active / suspended`; starts_at and ends_at. | One current assignment only; end strictly after start when set; active requires both. Admin updates current row with audit before/after. Expiration is derived from time, not a separate state requiring a scheduler. |
| AdminActionLog | Actor admin FK, action, target type/id, timestamp, request/correlation ID, reason, minimal before/after state. | Append-only through application APIs. Covers decisions, status changes, plan changes and admin document access; reads record target/time without a fabricated state change. No document bytes, password hashes or contact message bodies. Admin-readable, not public. Not represented as tamper-proof against database operators. |

Profile fields requiring validation are the submitted identity information and required documents. Until the checklist is confirmed, changing driver display name or a current required document invalidates approval conservatively. Service summary, service-contact email, routes and publication intent do not silently change historical validation snapshots. The checklist/identity boundary is Q3 in [scope](PRODUCT_SCOPE.md).

## Services, contact and records

| Entity | Relationships and minimum fields | Constraints / exposure |
| --- | --- | --- |
| Commune | Stable unique code, display name. | Seeded Greater Concepción catalog after product confirmation; never arbitrary free-text search keys. |
| Route | Many-to-one driver; label, status `active / inactive`, recurring weekdays, local start/end time (same day), positive seat_capacity, destination label plus address or coordinate pair. | One-way recurring service; separate return route. Weekdays are a bounded nonempty set. No cross-midnight schedule in the MVP. Destination is private; public summaries expose schedule and coverage only. Deactivate rather than delete referenced routes. |
| RouteCoverage | Route FK, commune FK. | Unique pair; at least one for an active route. Driver coverage is derived from active routes, not another editable list. |
| PassengerAssignment | Route FK; minimal student display name, pickup instruction/location, guardian display name and contact; starts_on, nullable ends_on. | Contains sensitive child/contact/location data. Active on local date d if starts_on <= d and (ends_on is null or d <= ends_on). End cannot precede start. Driver manually records the agreed service; no global child account/entity or automatic link from a request. Only owning driver can read/write through product APIs. |
| RouteRun | Route FK, service_date; state `planned / in_progress / completed`; started_at, ended_at; snapshot of schedule and capacity at materialization. | Unique `(route, service_date)`. One run per recurring one-way route/day. Created explicitly on first operational write, never by GET; today's API projects a planned run for scheduled routes without a stored run. Stable ID returned on materialization for future references. |
| ContactRequest | Parent FK, driver FK; message up to 500 characters; consent timestamp and shared parent-email snapshot; nullable accepted driver-service-email snapshot; status `pending / accepted / declined / cancelled`, timestamps. | Partial unique constraint on parent/driver where pending. Immutable message/consent; acceptance snapshots driver contact. Participants only. No student/pickup fields or booking/seat FK. |
| Review | Parent FK, driver FK; score integer 1–5; optional bounded text; status `published / hidden`; created_at. | At most one per parent/driver. Display-only in October: no authoring endpoint. Synthetic seeded examples only in demo/test; real environment starts empty until provenance policy is resolved. Public display omits author identity and all parent/contact links. |
| PaymentRecord | Driver FK, PassengerAssignment FK; service period start/end, positive integer amount_clp, due_on, status `pending / paid / void`, nullable paid_at, timestamps. | Manual transport-payment ledger, not subscription billing. Assignment must belong to that driver. No card/bank account data. Owner-driver only; no parent payment API. Void rather than hard-delete; replacement record handles corrections. |

All domain records have created/updated timestamps where meaningful; immutable logs/submissions use event timestamps. Use restrictive foreign-key deletion for referenced operational/audit records until an explicit retention/erasure policy exists. Do not mistake that interim restriction for a perpetual retention policy.

### Capacity and today's operation

`used_seats(route, date)` is the count of assignments active on that date; `available_seats = seat_capacity - used_seats`. Each assignment consumes one seat; contact requests consume none. No separate seat inventory entity or editable used-seat counter.

For new/changed assignments, check all intersecting assignment date intervals, not just today. Within a transaction, lock the route and reject any change that would exceed capacity on any affected service date. Capacity reductions use the same check. A small-MVP implementation may conservatively check every date boundary where assignment counts change; it must not accept an overbooking merely because today's count fits. Concurrent insert tests use PostgreSQL, not SQLite.

Discovery returns availability for the route's next scheduled service date on or after today, and returns that date explicitly; routes are not summed into a single driver seat count. Owner route details can request a particular date. Daily operation uses today's local service date, not device timezone. Rosters list only assignments active on that date. Parent responses never include rosters or run state.

Start/end remain deliberately small: no attendance, per-stop progression or scheduling exceptions. Materialize a run and snapshot schedule/capacity when first started. Once today's run starts, reject changes to that route's status/schedule/capacity/destination and assignments affecting today until the following local day; this keeps the day's operation stable. Future-dated assignments may still be added subject to capacity checks. Existing unfinished runs remain visible to the owner after their service date and may be ended as a recovery action; they are never silently completed at midnight. Historical rosters are not an October feature; later history requirements would need immutable run-passenger snapshots.

## State transitions and transaction rules

| Aggregate | Allowed transitions and actor |
| --- | --- |
| Driver validation | `draft → pending` on owner submit of a complete revision; `pending → approved/rejected` by admin; `rejected → pending` on a new owner submission. Editing submitted identity/current required files moves profile to `draft`, increments its revision and clears approved_revision; mark an undecided old submission superseded. Approved/rejected submission history remains intact. A resubmission creates a new numbered snapshot. |
| Driver status | Admin: `active ↔ suspended`, `active/suspended → deactivated`, `deactivated → active`, always with reason/audit. Restoration reruns all publication gates. Publication intent is an independent owner boolean, initially false. |
| Subscription | Admin assigns/changes plan and validity, activates inactive/suspended, or suspends/deactivates active. An elapsed window is ineffective even if stored status is active. Every mutation is audited; no automatic renewal. |
| Contact | Owner parent creates pending; parent `pending → cancelled`; target driver `pending → accepted/declined`. Acceptance requires current driver eligibility. Terminal states cannot be reopened; a later request is a new row subject to limits. |
| Run | Owner driver starts today's scheduled route: `planned → in_progress`; owner ends a started run: `in_progress → completed`, including a prior-day unfinished run. No reverting, future starts or automatic completion. Repeated start on in_progress and end on completed return existing result; ending planned or starting completed returns conflict. |
| Payment | Owner driver creates pending, then `pending → paid/void`, or `paid → void`; paid requires paid_at, pending has none. Void is terminal; preserve paid_at when voiding a paid record. No partial payments/refunds workflow. |

Start revision numbering at 1 for the initial draft. Editing validation material advances the current revision; submitting freezes a snapshot under that revision. Resubmitting an already decided revision without material edits also advances the number. Repeated submission of the same pending revision returns that submission. Gaps in revision numbers are acceptable; two submissions never share a driver/revision key.

Validation decisions lock the driver and submission and reject a stale revision; decision + profile update + audit entry commit together. The current revision's approval and document-expiration checks are independent: an expired file hides a historically approved profile without rewriting the past. The driver replaces/revalidates to restore eligibility. Approval requires observations (a short approval note suffices); rejection requires actionable observations.

Contact acceptance and publication/status changes coordinate on the driver row; new requests recheck eligibility inside the creation transaction. Capacity changes and start operations coordinate on the route row. Return a consistent conflict error when state changed concurrently; do not overwrite another user's decision. Immutable fields such as owner IDs, role, reviewer and computed eligibility are not mass-assignable.

## Privacy and response boundaries

| Response / actor | Allowed data |
| --- | --- |
| Parent discovery (authenticated; no anonymous directory in MVP) | Driver ID, display name, service summary, derived commune coverage, active route public IDs/schedule summaries, dated available-seat count, approved label, published ratings/reviews without reviewer identity. Apply eligibility to every lookup. |
| Owner driver web | Own profile/contact settings, document metadata/content, validation observations/history, subscription and publication blockers, routes/rosters, contact requests and payment records. No other driver's objects. |
| Owner driver mobile | Own daily routes/runs, schedule/capacity, minimum current passenger/guardian/pickup fields and navigation destination. Document/payment administration stays on web. Server ownership checks apply regardless of client. |
| Contact participants | Their own request/status and consented contact snapshots; driver service email only after acceptance. When a driver becomes hidden, this history remains readable to its participants without exposing the driver discovery response. |
| Administrator | Driver validation documents/observations, plan/profile controls and audit. No general passenger roster/payment/contact-body browsing in the admin product; role alone does not grant those unrelated endpoints. |

Never return driver documents/storage keys, identity snapshots, emails/phones, exact destinations/pickup addresses, student records, subscriptions' private history, payment records or audit logs in discovery. Use explicit separate serializers rather than serializing a whole model and hiding fields in UI. All private responses and downloads are non-cacheable. Account/session records, consented contact details and document files are sensitive even where the model does not store children.

## Implementation constraints to carry into migrations/tests

- Database uniqueness/checks for email, role/state enums, subscription dates, run uniqueness, pending request uniqueness, rating bounds, payment amount/period, positive capacity and join uniqueness.
- Derive review average/count from published rows only; return a null average and zero count when none exist. Do not maintain a separately editable driver rating.
- Service-level role, cross-owner FK, completeness, date-interval capacity and transition checks where a database check alone cannot express the rule.
- Index discovery filters/joins, validation queue state, route owner, contact participants/status, and dated runs/assignments. Add further indexes from measured queries, not speculation.
- Include Django's database session table per [ADR 0002](decisions/0002-authentication-strategy.md). No location observation, chat, notification, gateway or invoice entities in Task 01/02.
