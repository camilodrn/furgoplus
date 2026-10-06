# FurgoPlus approved UX foundation — Slice 1

A person comfortable with WhatsApp, basic banking or ordinary mobile apps should
understand FurgoPlus without knowing its architecture. Prioritize readability,
clear next actions, recovery, trust and privacy. The visual character is calm,
modern and friendly for adults using school transport.

## Information architecture and vocabulary

| Surface | Approved primary destinations |
| --- | --- |
| Driver web | Inicio, Mi servicio, Pasajeros, Solicitudes, Pagos |
| Administrator web | Validaciones, Conductores |
| Parent mobile | Buscar, Solicitudes, Mi cuenta |
| Driver mobile | Hoy, the primary daily surface |

Slice 1 establishes the web shell only. Inicio uses the existing summary;
Mi servicio groups existing Perfil, Documentos, Validación, Publicación and Rutas.
Keep all functional screens reachable and preserve drafts while navigating.
Administrator document review and driver controls remain separate. Mobile
operational destinations are future work; do not redesign them here.

Use **ruta** for a recurring configuration and **servicio** for a dated daily
operation. Use familiar verbs and objects, explain consequences and recovery,
and avoid raw roles, status codes and architectural terms in new user content.
Do not rewrite deep operational copy in this slice.

## Visual tokens and component rules

System font stack, no remote font. Web body 18px with 1.55 line height;
support 16px; nonessential metadata at least 14px. Dense admin data may be 16px.
Titles: page 32px, section 24px, card 20px. Use rem and wrapping; never shrink text
to make it fit. Flutter Material/system text: body 18, support 16, metadata 14,
page title 28 logical px; preserve system text scaling.

Spacing tokens: 4, 8, 12, 16, 24, 32, 48. Web auth card width 520px (about 454px
usable on desktop); Flutter auth max width 480px; focused forms 720px;
legal/readable content 720px; driver workspace 1120px; admin 1320px; sidebar 240px.

| Meaning | Token |
| --- | --- |
| Primary / hover / subtle | #0752AC / #06458F / #EAF3FF |
| Background / surface | #F5F7FB / #FFFFFF |
| Decorative / interactive border | #D8E0EB / #68788D |
| Main / supporting text | #202B3A / #526176 |
| Success / surface | #16643F / #E9F6ED |
| Warning / surface | #835313 / #FFF5DF |
| Danger / surface | #A32735 / #FFF0F1 |

Test foreground/background contrast. State always includes descriptive text;
color is supplemental. Decorative borders do not identify controls.

Buttons: one dominant primary action per task, explicit verb/object. Secondary
uses an outlined surface; tertiary uses text styling with a full target. Danger
uses explicit consequences and separate placement from ordinary Save. Routine
web controls are at least 48px high; mobile primary actions at least 56 logical
px. Disabled/pending actions cannot submit again and retain understandable text.

Fields: persistent visible labels, useful help via accessible descriptions,
field errors nearby and a clear error announcement. Placeholders supplement
labels only. Password visibility is an explicit accessible control. Password
registration help matches backend: at least eight characters, not entirely
numeric, common or too similar to account details. Backend remains authoritative.

Cards/lists: modest rounded borders, restrained shadows, simple spacing and
hierarchy. Avoid repeated nested containers. Preserve existing operational
structure until its slice. Loading explains the wait; empty states explain what
is absent and a useful next action; errors explain recovery without exposing
private/server detail; success states confirm the result and next step. Use
status/alert announcements, avoiding needless repetition.

## Shell and accessibility

Stable left sidebar on desktop: brand, icons plus text, visibly selected primary
destination and account/logout separated below. Narrow web uses a labeled menu
disclosure in document flow, not tiny compressed desktop controls. Announce
expanded/current state; Escape closes and returns focus, selection closes and
moves focus to main. No modal focus trap needed for a nonmodal disclosure.
Main content must wrap without horizontal core-flow scrolling.

Use header/nav/main landmarks, meaningful nav names, one principal h1 in the
visible page context, skip link, keyboard controls and a visible focus ring.
Use 200% zoom and mobile text scaling without truncating essential text;
respect SafeArea, keyboard insets, autofill and appropriate input types. Support
reduced motion; avoid unnecessary animation. Target WCAG 2.2 AA-oriented behavior
without a certification badge or claim. Manual browser/device verification is
required in addition to automated semantics tests.

## Authentication and legal boundary

Web: “Inicia sesión”, “Coordina tu transporte escolar con FurgoPlus.”,
“Correo electrónico”, “Contraseña”, “Iniciar sesión”, “Crear cuenta de conductor”.
Explain that parents use the mobile app. Registration uses “Cómo te llamas”,
explains account creation before approval, and asks for synthetic/demo data only.
Mobile supports parent and driver login; registration creates a parent/family
account. No role switch. Handle loading, registration success, session expiry,
restore retry and uncertain server logout in plain Spanish.

Reserve a legal footer component area, but render no fake links, document claims,
consent checkbox or company details before actual original drafts exist. Terms,
privacy and authorization are later-slice work.

## Privacy and protected functional boundaries

Minimize data and private display. Clear local private UI immediately on logout,
expiry or account replacement. Shell navigation/private drafts must not survive
identity changes. Preserve AuthApi request generations, stale_request rejection,
central not_authenticated, CSRF handling, keyed workspaces, stale reads/writes/
downloads and overlapping StrictMode restore behavior. Unrelated 403 failures
must not log the user out. Preserve native secure cookie storage and keyed homes.

Future child-data policy (no new intake in Slice 1): student_display_name is the
commonly used name plus enough surname information for safe distinction. Do not
require full legal identity or initials only. No child RUT, birth date, medical
profile or school records. Limit pickup details to the agreed point and guardian
identity/contact to what is necessary. No public/admin operational child
exposure. Real intake requires an approved authorization process; never invent
consent evidence.

Tasks 02–08 boundaries remain binding: session/role authorization; immutable
validation revisions and document access/audit; backend-derived publication
eligibility; hidden-object/participant contact rules; interval capacity and
assignment consistency; payment state/audit; dated runs and attendance/location
limits; bounded admin controls without operational access. No policy, endpoint,
backend schema, billing, tracking, administrative authority or legal expansion.

## Implemented contrast evidence

Calculated WCAG sRGB contrast ratios for the actual token pairs: white on primary
7.47:1, white on primary hover 9.31:1, main text on white 14.30:1, supporting text on
white 6.31:1, success on pale green 6.44:1, warning on pale amber 6.03:1, danger on
pale red 6.55:1. Interactive border on white is 4.51:1; the web focus ring on white
is 4.97:1. These are token calculations, not a claim of full accessibility
conformance. Browser zoom/device/screen-reader acceptance remains a manual gate.

## Slice 2 audit and approved implementation boundary

Read issue #19, Task 08.5, this foundation, scope/data/architecture, ADRs 0001,
0002 and 0004, Task 03 services/API/tests and Task 04 publication policy/tests.
The user authorizes only driver onboarding and administrative validation UX.

| Existing surface | Finding | Slice 2 direction |
| --- | --- | --- |
| Mi servicio / profile | Five equal setup links; name semantics and contact boundary unclear | Three task steps in content; publication/routes remain reachable; concise field help |
| Driver documents | Raw controls across three columns; hardcoded limits; versions dominate | Stacked checklist, server-provided kinds/formats/limit, selected filename, private download, replacement consequence |
| Driver review | React duplicates submission predicate/date checks; promises an unimplemented notification | Server states and submission errors only; explicit send milestone without a notification promise |
| Driver history | Revision-led logs | Dated events with retained observations, snapshot documents and subordinate traceability |
| Admin queue/detail | Side-by-side cramped workspace; snapshot name subordinate to current name; direct decisions | Focused review workspace, snapshot-first identity, private document actions and captured decision confirmation |
| Privacy | Existing identity-keyed workspace and AuthApi generation checks | Preserve account/expiry cleanup, stale binary rejection and audited authorized server access |

Contract limits: checklist returns configuration, not submission readiness or
per-document review/expiry verdicts. Display uploaded/missing metadata and dates;
do not claim they are validated or recreate the submission predicate. Submission
errors identify exact impediments. Publication may report an aggregate expired
required-document blocker; do not infer which document from it. Admin profile
snapshot includes the name only, not historical summary/contact; show only data
actually supplied. No backend/API/OpenAPI change is needed for this presentation.
Only name/current required document edits invalidate validation; description and
contact edits do not. Admin decisions take immutable submission ID plus required
observations, not expected_revision/state fields; the server locks the driver
and submission and checks current revision and pending state. Preserve this exact
contract and freeze ID/revision/state/observations in each pending confirmation.

Human acceptance remains required at desktop and approximately 390px, using only
synthetic accounts, profile information and documents. Task 08.5 is not complete.

## Slice 3 pre-edit audit and behavior map

Issue [#19](https://github.com/camilodrn/furgoplus/issues/19), the task contract,
product scope/data model/architecture and ADRs 0002/0004/0005/0006 govern this
React-only slice. Commits 7850e45 and 7b69bb0 are preserved.

| Existing screen / journey | Contract inspected | UX problem / intended change |
| --- | --- | --- |
| Inicio | DriverSummaryView returns publication, all route capacity snapshots, today's active assignments and all payment status counts. Contact list is complete (no pagination). | Duplicate onboarding/status panels, raw states/revision and dense paragraphs. One server-derived visibility card, ordered server blockers with contextual actions, dated capacity per route, separate request read, payment counts. No summed capacity or new eligibility computation. |
| Publicación | publication_json supplies eligible/requested/blockers, validation, subscription, active-route count and coverage; intent POST then refreshed read. Task 04 truth table/direct-ID tests. | Requested is confused with visible; raw profile state and technical blockers. Translate existing codes; explain request/stop consequences and requested-but-blocked. |
| Rutas | Owner list/create/update; required label/status/weekdays/times/capacity/destination/coverage; expected_revision on update. Task 04/06 tests. | Dense rows, coverage codes, no empty/read retry. Recurring cards with Spanish weekdays, catalog labels, grouped form and dated server capacity. |
| Started-day edits | Route changes return run_conflict for frozen fields after today's run starts (including completed). Assignments return operation_conflict for frozen roster changes, but that code also covers end-date conflicts. | Explain route freeze exactly; assignment conflict offers both possible causes without asserting an unknown one. Future-only assignment changes stay server-owned. |
| Pasajeros | Owner assignments list/create/edit/end, inclusive starts_on/ends_on. Route relation immutable on edit. Nine-digit guardian phone. Capacity returns 400 seat_capacity field error; Task 06 interval/owner tests. | Browser prompt, technical label, dense private data and no read states. Cards, minimal student-name help, one privacy notice, future-date explanation, inline dated end confirmation. No deletion/consent claims. |
| Solicitudes | Driver receives consented parent-email snapshot even while pending; driver accept discloses current service-email snapshot to parent; decline and parent cancellation are terminal. driver_ineligible/contact_conflict preserved (Task 05 tests). | Unstructured list/detail, conflated success/error, duplicate actions possible. Explain disclosure and outside-platform coordination, pending actions, empty/retry and plain status. No roster/seat creation. |
| Pagos | Complete owner records in CLP, pending create; paid/void transitions, paid timestamp retained after void. Task 06 payment/summary tests. | Dense rows and missing read/retry/empty hierarchy. Manual records, formatted CLP/dates, same fields/transitions with explicit void consequence. |
| Session | AuthApi rejects obsolete generations; central not_authenticated clears identity-keyed workspace including persisted onboarding/route drafts. Task 08 api/session tests. | All added state remains inside keyed workspace. Read ordering and unmount guards protect local work; expiry clears standalone screen state too. No auth/API changes. |

The shell retains Inicio, Mi servicio, Pasajeros, Solicitudes and Pagos;
Datos/Documentos/Revisión/Publicación/Rutas remain subordinate service tasks.
Forms cap at 720px, cards stack with wrapped actions at 390px, routine targets
remain at least 48px. Browser layout/workflow acceptance is separate from tests.
No administrator controls, Flutter, legal text, consent storage or backend changes.

## Slice 3 redesign after product-owner rejection — pending approval

The first Slice 3 presentation was manually rejected. Functional correctness and
passing tests did not constitute UX approval. This redesign follows
**show state → explain consequence → offer an obvious action** within the Slice 1
tokens and the same Task 04–06 contracts.

Inicio leads with a large visibility hero using `publication.eligible` directly.
The activation path groups the server's blockers into information, plan, route,
and publication intent; account/service restrictions get a separate visible
attention step. Group completion and pending-step counts are presentation only,
never a new eligibility predicate. Every blocker remains available in plain
Spanish with the existing destination where possible. No raw state/revision/code
is primary content. Four operational cards summarize active routes, assignments
active today, requests awaiting response and pending payment records. Route
capacity meters use only server-provided used/total/available seats and the
associated next-service date; Inicio's summary lacks recurring days/times, so it
does not invent these, a today's route, numbered seats or seat selection.

Routes and passengers open as lists with useful empty states. Create/edit opens
a focused nonmodal panel in document flow; the list is hidden during editing.
Route fields are disclosed in three stages: days/time, capacity/coverage, review.
Back preserves the draft; Close/Escape clears it and restores focus when its
trigger still exists. The server still receives the exact existing fields and
expected route revision. Passenger fields are private, use “Nombre del estudiante”
and the approved minimal-name help, and preserve immutable route relation,
assignment dates, phone/capacity checks and dated finalization.

Solicitudes is an inbox filtered by the actual pending/accepted/declined/cancelled
lifecycle. Cards show identity, state and received date; opening a focused detail
shows the existing consented email/message and existing actions. No route context
is fabricated, no contact is disclosed in the list, and acceptance still shares
only the existing service-contact snapshot. Payments open with three truthful
counts and record cards; “Ver registro” expands dates and existing transitions.
“Registrar pago” opens only the existing manual fields and explicitly says:
“FurgoPlus solo registra este pago. No procesa ni cobra dinero.”

Inline semantic SVGs, text-labeled markers/chips, native capacity meters, a route
stepper, inbox chips, record disclosures and focused panels add interaction
without dependencies. Small-screen CSS stacks cards/forms, wraps text/actions,
retains 48px targets, and inherits visible focus and reduced-motion handling.
No backend, API/OpenAPI, administrator workflow, child-data intake or Flutter
changes were introduced. Identity-keyed workspaces, generation guards, stale
read/write rejection and expiry cleanup remain intact.

Automated semantics and interaction tests are required but do not prove layout
acceptance. Desktop, approximately 390px, keyboard/zoom and synthetic end-to-end
visual review remain a product-owner gate. The current environment's computer-use
inventory has no enabled browser or app. **Slice 3 is pending visual approval.**

## Slice 3 action feedback correction — pending final acceptance

Important explicit driver mutations use one shared, viewport-visible FurgoPlus
notice: operation title, text and a visible status marker, using the existing
colors, typography and focus rules. React/CSS only; no browser alert, dependency,
modal, private record content or persistent storage. Routes (create/edit/active
state), passengers (create/edit/end), publication intent, contact decisions and
manual payment creation/status/void share this pattern. Small disclosures and
ordinary reads do not generate success notices.

Errors and warnings persist until dismissed or superseded by the next action.
Success uses polite status semantics and an eight-second timer, paused while
hovered or focused. Errors use assertive alert semantics. The explicit “Cerrar
aviso” control has a 48px target and restores keyboard focus when its originating
control still exists. Success does not move focus. No animation is introduced.

The notice is portaled to the body to escape hidden/clipped panels but owned by
the identity-keyed workspace. Only static operation/result copy is allowed in
it. Logout, confirmed expiry and same-role identity replacement remove notices;
existing API generations and local lifetime/read guards reject obsolete results.
Server details remain in the private screen, never copied arbitrarily to notices.

Separate read errors from action errors. Only transient read/network/server
failures offer “Reintentar”, which performs a read. Validation/domain conflicts
retain their contextual explanation and require corrected data or a fresh read
through the existing update control. Session expiry directs the user to sign in.
A confirmed save remains successful even if the following refresh fails.

The capacity rejection retains the server-owned seat_capacity meaning:
“Esta ruta no tiene cupos disponibles para esas fechas.” The global notice says
“No pudimos agregar al pasajero” (or the edit equivalent); a contextual region
beside the submit action repeats the explanation and suggests another route or
different dates, with no unchanged-data retry. Focus/nearest instant scrolling
locates the contextual region, including repeated failures, without resetting
any draft. Field errors stay associated with their original controls.

The top viewport notice wraps text, uses a bounded width and height and remains
dismissible, away from the usual bottom submit action. Contextual error scrolling
reserves space above the region. Desktop/approximately 390px/zoom and actual
screen-reader acceptance still require human review; DOM tests do not prove
rendered layout. Slice 3 remains pending final acceptance.
