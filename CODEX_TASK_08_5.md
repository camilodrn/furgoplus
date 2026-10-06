# Task 08.5 — Slice 1 implementation contract

Issue #19; approved product-owner direction. Branch: `task/08-5-product-ux-privacy`.
Only shared foundations, authenticated web shell, vocabulary and web/Flutter
authentication are authorized. Source of truth: [UX foundation](docs/UX_FOUNDATION.md).
Task 08.5 as a whole remains pending later slices and human acceptance.

## Scope and review

- Document approved navigation, visual/accessibility rules and privacy boundaries.
- Use existing React/CSS and Material/system typography; no heavyweight framework.
- Establish desktop sidebar and narrow disclosure navigation. Retain all existing
  functional destinations; group driver setup under Mi servicio.
- Improve restore/loading/retry, login, registration, success, expiry and uncertain
  logout presentation. Pending actions must prevent duplicate requests.
- Web registration creates a driver account; mobile creates a family/parent account.
  Approval is separate. Password help follows the actual Django validators.
- No deep driver/admin/parent operational redesign, backend/OpenAPI changes, new
  roles, forgot-password, MFA, verification, child fields or fabricated legal facts.
- Legal content/links await original drafts in a later slice. No consent checkbox
  or claim that a nonexistent document or authorization mechanism exists.

## Protected behavior

Preserve Task 08 AuthApi generations and stale_request rejection, central
not_authenticated handling, same-role replacement, identity-keyed workspace,
CSRF rotation/retry, local cleanup and stale read/write/download rejection.
Preserve the overlapping StrictMode restore fix. Navigation and private forms
must remain inside the keyed workspace; no persistent outer shell state.
Preserve native session storage/cleanup and sessionVersion-keyed role homes.
Tasks 02–08 authorization, publication, validation, contact, capacity, payment and
service operation contracts remain unchanged.

## Validation and manual acceptance

Run web format/contract/lint/typecheck/full tests and build to writable temporary
output. Run Flutter analyze/test/debug APK when permitted. Run git diff --check.
Record exact results and environment limits below after implementation.
Human review: web restore/login/registration/expiry, desktop/narrow shell;
Android login/parent registration/driver login transition, keyboard/text scaling.
No commit, push, merge, deploy, reset, revert, discard, branch switch or history rewrite.

## Implemented Slice 1

Web uses the approved system-font/color/spacing foundation, readable headings and
48px routine targets. Auth includes labeled/autofill fields, password visibility,
backend-aligned password help, registration purpose/demo notice, pending guards,
announced success/errors, expiry recovery and read-only restore retry.
No legal links or consent claims are displayed. The browser title uses product
language rather than technical status language.

The desktop shell has a 240px sidebar, five driver primary destinations and two
admin destinations, icons/text/current-state indication and separate account
controls. Existing driver setup destinations remain under Mi servicio. At 900px
and below it becomes a nonmodal menu disclosure; Escape restores focus to its
trigger and selection moves focus to main. Private screens/drafts and navigation
stay inside the ID/role-keyed workspace. Existing operational screens are retained.
A late obsolete logout error is ignored so it cannot clear a new account's CSRF.

Flutter adds a shared Material/system theme, scrollable SafeArea auth, text-scaling
support, persistent labels, autofill/input actions, password visibility, local
validation, duplicate-submit guards, clear family registration/success and session
errors. Native cookie/CSRF behavior and keyed role homes remain unchanged; local
credential fields clear on sessionVersion changes. No role switch is added.

Tests retain Task 08 privacy/API/StrictMode assertions while adopting approved
labels. New web cases cover pending login/registration, password visibility,
restore retry, menu keyboard semantics and an obsolete logout after new login.
New Flutter widget cases cover registration purpose/pending/success, large text
with keyboard insets/password visibility and restore retry/expiry cleanup.
One existing admin test now waits for asynchronous plan data before asserting it;
its previous immediate assertion was intermittent under the full suite.

## Final validation results — Slice 1

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched web files formatted |
| `npm run contract:check` | Exit 0; generated contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 100 tests across 11 files |
| `npm run build -- --outDir /tmp/furgoplus-slice1-web-dist` | Exit 0; 37 modules transformed |
| `flutter analyze --no-pub` | Exit 0; no issues, including new widget tests |
| `dart format --output=none --set-exit-if-changed` on the five changed Dart files | Exit 0 |
| `flutter test --no-pub` | Exit 1; runner could not load any of four test files because local socket creation is denied (EPERM). No mobile test pass is claimed |
| `git diff --check` | Exit 0 |

Flutter verification uses an unchanged SDK copy at
`/tmp/furgoplus-slice1-flutter-sdk`, with `DASH__SUPPRESS_ANALYTICS=true` and
`FLUTTER_SUPPRESS_ANALYTICS=true`. The installed SDK is read-only; its initial
normal invocation failed writing cache stamps, and Dart analytics writes also
failed until disabled. Existing resolved dependencies were reused with `--no-pub`.

`flutter build apk --debug --no-pub` with a writable temporary Gradle cache first
failed (exit 1) because downloading the Gradle distribution requires a denied
network socket. A cached-distribution attempt is recorded below.

Browser visual/zoom verification was not executed: `npm run dev -- --host
127.0.0.1` failed (exit 1) binding 127.0.0.1:5173 with EPERM. Browser inventory
provided no enabled browser. Responsive disclosure semantics are covered by web
tests; actual layout and Android acceptance must be reviewed on the host.
No accessibility certification or mobile/browser acceptance is claimed.

## Changed files and git state

| Area | Files |
| --- | --- |
| Approved contract/design | `CODEX_TASK_08_5.md`, `docs/UX_FOUNDATION.md` |
| Web foundation/shell/auth | `web/index.html`, `web/src/App.tsx`, `web/src/style.css`, `web/src/ValidationScreens.tsx` (only shell navigation opt-out) |
| Web behavior/regressions | `web/src/App.test.tsx`, `web/src/AuthRestore.test.tsx`, `web/src/SessionPrivacy.test.tsx`, `web/src/ValidationScreens.test.tsx` |
| Flutter foundation/auth | `mobile/lib/furgo_theme.dart`, `mobile/lib/auth_app.dart`, `mobile/lib/auth_controller.dart` (session/auth message text only) |
| Flutter behavior/regressions | `mobile/test/session_test.dart`, `mobile/test/driver_home_test.dart` |

Git status: 12 modified tracked files and three new untracked files. All changes
remain uncommitted on `task/08-5-product-ux-privacy`. No backend/OpenAPI change,
commit, push, merge, deploy, reset, revert, discard or branch switch occurred.
Only Slice 1 is implemented; Task 08.5 is not complete.

Cached APK attempt: copied the existing Gradle 9.3.1 distribution into
`/tmp/furgoplus-slice1-gradle/wrapper/dists` and repeated the same debug build.
Exit 1 before compilation: Gradle could not create FileLockContentionHandler
because it could not determine a usable wildcard IP. APK generation remains
blocked by the environment even with the distribution available offline.
No APK was produced or installed. Repeat `flutter analyze`, `flutter test` and
`flutter build apk --debug` in the normal writable host/network environment.

## Manual acceptance refinement pass — Slice 1

Presentation-only auth refinements preserve the existing uncommitted work and
protected behavior. Web auth now has a 520px outer card / about 454px usable form,
a 204px logo with a 12px card gap, centered secondary/footer text and full-width
secondary buttons. Registration gives the demo notice a 24px top margin and the
secondary block a 32px top margin. Existing narrow padding, 18px body text, form
field gaps and pale danger login errors are retained. At 390px viewport width,
the CSS yields a 358px card / 324px content area; this is code inspection, not a
browser-rendered no-overflow assertion.

Flutter uses the existing web PNG through `mobile/assets/furgoplus-logo.png`, a
relative symbolic link, declared in pubspec. No new or duplicate image is created.
The auth image is 204px wide and labeled “FurgoPlus Transporte Escolar”. Android
asset-bundle verification passed: the manifest contains the normal in-bundle key
`assets/furgoplus-logo.png` and all 845429 image bytes match the web original.
Password visibility is a trailing 48px-minimum icon button with dynamic Spanish
tooltip/accessibility labels. The existing visibility test uses those tooltips.
Login gaps before fields and before the divider change from 32px to 24px; the
header gap is 24px. Replacing the separate password action leaves a 24px gap.
Registration remains scrollable with its larger field gaps, guidance and counter;
body text, SafeArea/keyboard scrolling and 56px primary actions are retained.

| Check | Refinement result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched files formatted |
| `npm run contract:check` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 100 tests in 11 files passed |
| `npm run build -- --outDir /tmp/furgoplus-slice1-refinement-web-dist` | Exit 0; 37 modules transformed |
| `dart format --output=none --set-exit-if-changed lib/auth_app.dart test/session_test.dart` | Exit 0; two files, zero formatting changes |
| `flutter analyze --no-pub` | Exit 0; no issues |
| `flutter test --no-pub` | Exit 1; all four files blocked during loading by socket EPERM; zero tests executed |
| Android asset-bundle smoke check using installed Flutter tooling | Exit 0; logo/manifest verified |
| `git diff --check` | Exit 0 |

Flutter checks used the existing writable temporary SDK with analytics disabled
and resolved dependencies reused. The web dev server failed with exit 1 binding
127.0.0.1:5173 (EPERM); browser inventory is empty. Actual 390×844, desktop and
Android visual/text-scale/keyboard acceptance remain pending. Slice 1 is not
claimed complete. No operational, functional auth, backend or API changes were
made by this pass. No commits, pushes, merges, deployments or branch changes.

This pass changes `web/src/App.tsx`, `web/src/style.css`, `mobile/lib/auth_app.dart`,
`mobile/pubspec.yaml`, `mobile/test/session_test.dart`, the new logo symbolic link,
and these two existing untracked task/design documents. Final git status has 13
modified tracked files and four untracked entries on
`task/08-5-product-ux-privacy`; prior Slice 1 changes remain uncommitted.

## Slice 2 — driver onboarding and administrative validation UX

Slice 1 is complete and preserved in commit `7850e45`. This section records the
separately authorized Slice 2 on `task/08-5-product-ux-privacy`; all Slice 2 work
remains uncommitted. Task 08.5 is not complete. Human visual and synthetic journey
acceptance is pending.

### Implemented behavior

1. **Driver onboarding:** Mi servicio contains three task steps: Datos del
   servicio, Documentos and Revisión. The existing desktop/narrow shell is retained.
   Publication and routes remain reachable from the sidebar. Inicio shows the
   server-backed onboarding next action. Navigation preserves unsaved profile
   information; private content remains inside the identity-keyed workspace.
2. **Profile:** Nombre del servicio, concise examples and accessible help explain
   future discovery display and the service email's consented contact boundary.
   Approved/pending name edits explain revalidation before saving. Description and
   email edits explicitly do not restart review. Mutation responses and a refreshed
   server state supply the resulting status; no local approval is invented.
3. **Checklist/upload:** Stacked document cards use only the API checklist, formats
   and byte limit. Missing/current uploads, submitted snapshot membership, expiry
   dates, selected filenames, pending upload, success/error, private downloads and
   replacements are explicit. Required date controls appear for a selected file.
   Previous submitted documents remain accessible in history. There is one visible
   synthetic-information/document warning in the onboarding/review page.
4. **Submission/review states:** Before sending, a compact summary lists the saved
   name, uploaded/missing checklist files and provided dates. Explicit confirmation
   describes this version's review. A synchronous pending guard prevents duplicate
   writes; success follows a confirmed API response. Draft, pending, rejected and
   approved use plain Spanish. Rejection observations remain visible after editing
   and resubmitting, without fabricated field mapping or notification promises.
5. **History:** Dated events lead with Información enviada, Revisión aprobada,
   Se solicitaron cambios or Información reemplazada por cambios. Expandable
   details retain submitted name, original files/versions/dates and observations.
   Revision numbers are subordinate traceability information.
6. **Admin queue:** Snapshot service name, state, submission date and Revisar lead
   each row. Existing state filters remain; loading, retry, empty queue, refresh
   and back-to-queue actions are available. Outdated filter reads cannot overwrite
   a newer queue. General Conductores controls are not redesigned.
7. **Admin workspace:** A focused selected review shows submitted identity and
   context, document snapshot downloads, observations and separate approval/change
   actions. A changed current name is labeled separately from the submitted name.
   Existing revision comparisons and plan/publication access are retained.
8. **Decisions/concurrency:** Both actions require observations and explicit
   confirmation. Confirmation captures immutable submission ID, revision, pending
   state, action and observations. Refresh reads that same ID and never retargets
   it to a newer submission. Changed expected state cancels the decision; server
   409 closes confirmation, clears the decision note and refreshes the original
   submission without selecting a newer one. The API still accepts only submission
   ID plus observations; row locking/current-revision checks remain server-owned.
9. **Privacy:** Owner/admin private binary endpoints, administrative access audit,
   role/cross-driver isolation, no-store responses and immutable snapshot versions
   are untouched. No storage key/public URL/passenger data is displayed. Account
   replacement/session expiry clears local review/upload/confirmation state; an
   obsolete binary response cannot create a browser object URL. Cross-driver denial
   remains covered in unchanged Task 03 backend tests; they were inspected, not run.
10. **Responsive/accessibility:** Three-step task navigation and cards stack on
    narrow web; forms cap at 720px and admin review at 960px. New admin styles are
    scoped to validation only. Slice 1's 18px body/48px targets/focus ring remain;
    dense admin text is at least 16px. Persistent labels, help/error associations,
    text plus icon state, status/alert announcements, native disclosure history,
    review-heading focus and confirmation Escape/cancel focus recovery are covered.
    Confirmations are nonmodal, in the normal keyboard/document flow.

### Contract limitations handled without backend expansion

The checklist endpoint returns configuration, not an authoritative readiness
result or a per-document expiry/review verdict. Uploaded counts describe metadata,
not validated completeness. The frontend no longer recreates the submission
predicate or gates submission with a local date/completeness calculation.
The server's submission errors explain exact missing/expired items and display
“No puedes enviar todavía”. Expiration dates are displayed; the publication
API's aggregate expired-document blocker is shown without inventing an item
mapping. The UI never labels a date as server-verified before submission.
Historical admin profile data includes the submitted name only; no description
or contact snapshot is fabricated. No backend/API/OpenAPI change was necessary.

### Tests and final validation results

Existing behavioral, auth-generation, publication, operations and download tests
remain. Layout tests now exercise three semantic task steps and preserved drafts
instead of duplicate tabs/mobile section selectors. New cases cover server-only
submission errors, full uploaded checklist, confirmation/cancellation, duplicate
submission/decision prevention, pending snapshot membership, rejection correction
and resubmission, name revalidation, description/contact approval preservation,
field errors, replacement/history, home next action, refresh after a confirmed
submission, immutable admin confirmation targets, changed expected state, filters,
owner download denial, account replacement, expiry and late private binary data.
All fixtures and selected files are synthetic.

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched web files formatted |
| `npm run contract:check` | Exit 0; generated contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 122 tests in 11 files passed |
| `npm run build -- --outDir /tmp/furgoplus-slice2-web-dist-final` | Exit 0; 37 modules transformed |
| `git diff --check` | Exit 0 |

No backend code changed, so backend regression tests were not run. No Flutter
files changed, so Flutter validation was not required. Vite's informational
warning about an outDir outside the project is expected; the build succeeded.

Environment blockers: `npm run dev -- --host 127.0.0.1` exited 1 with
`listen EPERM` on 127.0.0.1:5173. Computer-use inventory returned no enabled apps
or browsers. No real browser visual/zoom test or end-to-end journey is claimed.

### Pending human acceptance — synthetic data only

Use the normal host environment and synthetic accounts/files with future expiry
dates for the configured demo documents. Do not request or use real documents.

1. Driver login: see Mi servicio and its next action; inspect Inicio as well.
2. Complete/save Datos del servicio; inspect name/description/contact help.
3. Upload the synthetic checklist files and required dates; inspect filenames,
   success, download and replacement actions.
4. Inspect Antes de enviar; send and confirm the review.
5. Verify En revisión and absence of a duplicate submission action.
6. Admin login: open Validaciones, filter and review the exact submitted version.
7. Download the authorized snapshot documents; request changes with a useful note
   and confirm. Verify the retained administrative document-access audit.
8. Driver login: see the requested changes; correct information or replace a
   synthetic file; resubmit and verify the retained previous observations/history.
9. Admin login: inspect and approve the exact corrected submission with a note.
10. Driver login: verify the approved state and the revalidation explanation.
11. Repeat the visual inspection at desktop and approximately 390px, including
    menu, stacked cards, long filenames/observations, dates and confirmation text.
12. Check keyboard navigation, visible focus, Escape/cancel recovery and 200% zoom.
13. With another synthetic driver/parent, confirm direct private-document denial.
14. Keep an old admin confirmation open while the driver changes/resubmits;
    refresh/attempt the old decision and verify it never approves the newer send.

### Changed files and git state

- `CODEX_TASK_08_5.md`: Slice 2 implementation, validation and acceptance record.
- `docs/UX_FOUNDATION.md`: pre-edit Slice 2 audit and existing-contract boundaries.
- `web/src/App.tsx`: onboarding navigation grouping and home context mounting.
- `web/src/ValidationScreens.tsx`: driver onboarding/history and admin review UX.
- `web/src/style.css`: scoped responsive task/checklist/review presentation.
- `web/src/ValidationScreens.test.tsx`: adapted behavior and new Slice 2 coverage.
- `web/src/SessionPrivacy.test.tsx`: validation/download/upload cleanup coverage.
- `web/src/App.test.tsx`: new labels with existing shell/refresh assertions retained.

Git status: eight modified tracked files, no untracked project files. HEAD remains
`7850e45` on `task/08-5-product-ux-privacy`. No commit, push, merge, deployment,
reset, revert, discarded changes, branch switch or history rewrite occurred.
Slice 2 remains pending human visual and synthetic journey acceptance.

## Slice 3 — driver web operational experience

Prepared for human review on `task/08-5-product-ux-privacy`. The earlier Slice 2
working-tree notes above are historical: Slice 1 and Slice 2 are preserved in
commits `7850e45` and `7b69bb0`. This slice changes React UX and documentation
only, without changing backend, API, OpenAPI, administrator controls, Flutter,
legal documents or child-consent persistence. No backend blocker was found.
Task 08.5 is not complete. Slice 3 remains pending human visual and workflow
acceptance; all of its changes are uncommitted.

### Implementation and protected behavior

1. **Inicio:** one service-visibility card answers whether parents can find the
   driver. Approval and visibility remain separate. The first authoritative
   blocker supplies the next action; other blockers appear in a disclosure in
   their original server order, without a newly invented business priority.
   Navigation opens the matching existing service task. The onboarding panel
   stays mounted for profile drafts but is hidden on Inicio, so approved drivers
   see operational content there. Greeting uses the authenticated display name.
   Route snapshots, today's active-assignment count and payment counts come from
   the summary endpoint. A separate complete contact-list read supplies pending
   request count; failure never becomes a false zero. No cross-route capacity sum.
2. **Publication:** `eligible` alone supplies Visible/No visible para apoderados.
   Request intent, blockers, validation and plan are distinct. Known server codes
   become plain Spanish, including stale approval, documents, plan and profile
   requirements. Requested-but-blocked is explicit. Solicitar que mi servicio sea
   visible and Dejar de mostrar mi servicio explain consequences; a request never
   promises instant visibility. Successful intent writes re-read authoritative
   state. Focus, returning to the section and relevant profile/assignment changes
   also refresh existing reads. No publication predicate is implemented in React.
3. **Routes:** recurring configuration cards show label/status, Spanish weekdays,
   local time range, destination, catalog commune labels and dated server capacity.
   Create/edit groups are Datos de la ruta, Horario, Capacidad and Destino y
   cobertura. Capacity means total passenger seats. Activate/deactivate uses the
   same owner API and expected revision; no raw route IDs are displayed. Empty
   state links to the existing form. Server validation stays visible near fields.
   `run_conflict` explains today's started/frozen operation, including completed
   runs; no client bypass. Assignment `operation_conflict` has more than one cause,
   so its copy does not falsely assert that every such conflict is a started day.
4. **Passengers:** cards prioritize student, route, current/future/end status,
   pickup instructions and guardian contact. Nombre del estudiante has the help
   “Usa el nombre habitual y el apellido necesario para distinguirlo.” One privacy
   notice says “Esta información es privada y solo debe usarse para coordinar el
   traslado.” Synthetic data remains required for tests/demo. Future starts and
   inclusive end dates are explained. Edit keeps the route immutable. Finalizar
   asignación opens an inline dated confirmation instead of a browser prompt;
   it calls the same end-date endpoint and preserves the record. Current route
   capacity is date-labeled, with an explanation that other assignment dates are
   checked when saving. Capacity rejection is translated without reproducing
   interval-overlap logic. No identity/medical fields or consent claims were added.
5. **Contacts:** readable private list/detail, plain lifecycle labels, pending
   guards, empty/error/retry and restrained success. The parent-email snapshot is
   shown only in participant detail, as already authorized at request creation.
   Accept explicitly shares the service-email snapshot with the parent; decline
   closes without that disclosure. Neither action reserves capacity or creates a
   passenger. Existing eligibility/conflict/terminal semantics are preserved.
6. **Payments:** Registro de pagos explains that records are informative and
   FurgoPlus does not process the payment. Existing integer `amount_clp` establishes
   CLP formatting; Chilean service-period/due/payment dates remain. Create pending,
   mark paid and void are the same APIs. Void confirmation explains terminal
   record status and that it does not refund money; the record and paid timestamp
   remain server-owned. No gateway, subscription billing or automation is added.
7. **Accessibility/responsive:** driver cards wrap, action groups stack, forms cap
   at 720px and use one column at narrow widths. Routine buttons retain 48px
   targets, visible focus and labeled native inputs. Loading/success use status;
   failures use alert/retry; field errors retain control names and accessible
   descriptions. Date popovers use the existing Chilean controls with a viewport
   width limit. Color supplements text. Browser overflow/zoom is not claimed tested.
8. **Session/privacy:** new resource state, drafts, selection and confirmations
   live inside the original identity-keyed workspace. Local lifetime/read ordering
   rejects obsolete results after unmount/expiry; confirmed standalone expiry also
   clears draft/data state. Mutations have synchronous duplicate guards; outdated
   writes cannot invoke saved callbacks or restore private state. Success messages
   expire after five seconds. AuthApi, central not_authenticated, CSRF, download
   guards, logout cleanup and same-role replacement are unchanged.
9. **Business boundaries:** Task 04 publication truth/direct-ID hiding and public
   allowlists, Task 05 consented participant snapshots, Task 06 owner isolation,
   dated inclusive assignments, interval capacity and manual-payment summaries,
   and Task 07 started-day guards remain authoritative on the backend. Inspected
   backend tests were not rerun because no backend/model/contract code changed.
10. **Tests:** five existing web test files were adapted. There are 21 additional
    cases: approved-blocked/visible home and next action, request/stop/refresh and
    blocker translation, route server validation/frozen conflict, future passenger
    wording/capacity errors, read loading/error/retry/empty states, manual payment
    wording, contact disclosure and duplicate decisions, and per-screen account
    replacement/expiry/late-read/late-write cleanup. Existing API, restore,
    download, admin and privacy regressions remain in the full passing suite.

### Exact final validation

Commands run from `web/`, except the repository-wide diff check.

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched files use Prettier style |
| `npm run contract:check` | Exit 0; generated contract unchanged |
| `npm run lint` | Exit 0; no warnings reported |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 156 tests in 11 files passed |
| `npm run build -- --outDir /tmp/furgoplus-slice3-web-dist` | Exit 0; 38 modules transformed; temporary build produced |
| `git diff --check` | Exit 0 |

Vite's build notice states that the temporary output is outside the project and
will not be emptied; this is expected and is not a failure. No Flutter validation
was required or run; there are no Flutter changes.

Environment blockers: `npm run dev -- --host 127.0.0.1` exited 1 because binding
127.0.0.1:5173 is denied (`listen EPERM`). Computer-use inventory reported no apps
or browsers. Desktop, 390px, keyboard/zoom and synthetic workflow acceptance must
therefore run on the host; no visual acceptance or accessibility certification
is claimed. Issue #19 was successfully inspected using the GitHub read connector.

### Human acceptance checklist — pending

Use synthetic accounts, students, contact requests and payment amounts only.

1. Approved driver: open Inicio and verify visible and approved-but-blocked cases;
   follow the next action and inspect the other server requirements.
2. Request visibility while blocked, resolve existing requirements in the normal
   product workflow, refresh, then stop showing the service. Verify the parent
   visibility result follows the server response.
3. Create, edit, deactivate and activate a recurring route. Check days, local
   times, destination, commune labels, total capacity and dated used/free seats.
   For an existing synthetic started-day run, verify the route conflict explanation.
4. Create/edit/end a synthetic passenger, including future starts and inclusive
   end dates; trigger capacity rejection and check that the draft remains editable.
5. Open a contact request, check consented disclosure explanation, accept/decline
   existing pending requests and inspect terminal history and ineligible feedback.
6. Create a manual pending CLP record, mark it paid, then confirm void. Inspect
   dates, retained record, manual-only explanation and empty states.
7. Repeat Inicio, route list/form, passenger list/form and requests at about 390px;
   inspect stacking, long content, date popovers and absence of core horizontal
   scrolling. Check keyboard order, focus, labels, 48px targets and 200% zoom.
8. Log out, replace an account and expire a session with private forms/details
   open; ensure old content and pending responses do not reappear.

### Files and git state

| Area | Files |
| --- | --- |
| Contract/audit/report | `CODEX_TASK_08_5.md`, `docs/UX_FOUNDATION.md` |
| Driver shell/home/management | `web/src/App.tsx`, `web/src/DriverOperations.tsx`, `web/src/PublicationScreens.tsx`, `web/src/DriverRequests.tsx` |
| Shared driver presentation/read lifecycle (new) | `web/src/DriverExperience.tsx` |
| Driver responsive presentation | `web/src/style.css` |
| Behavior/privacy tests | `web/src/App.test.tsx`, `web/src/DriverOperations.test.tsx`, `web/src/PublicationScreens.test.tsx`, `web/src/DriverRequests.test.tsx`, `web/src/SessionPrivacy.test.tsx` |

Final git state: 12 modified tracked files and one new untracked file on
`task/08-5-product-ux-privacy`; HEAD is `7b69bb0`, with `7850e45` preserved below it.
All Slice 3 work is uncommitted. No commit, push, merge, deployment, reset, revert,
discard, branch switch or history rewrite occurred. Slice 3 remains pending human
visual and workflow acceptance; Task 08.5 is not complete.

## Slice 3 visual redesign after manual rejection — 2026-10-06

The earlier Slice 3 implementation/report above is historical. The product owner
rejected its visual/interaction layer despite correct behavior. This new pass
remains **uncommitted and pending visual approval**; Task 08.5 is not complete.

1. **Home:** large visible/blocked hero answers “¿Está visible mi servicio?”,
   explains parent discoverability and offers “Ver qué me falta”. Raw backend
   summaries and revision numbers are absent.
2. **Activation:** shared visual checklist for information approval, current
   plan, complete active route and publication request, with grouped server
   blockers, separate account/service restrictions, and contextual navigation.
   `eligible` remains the server's decision; presentation never grants eligibility.
3. **Operational overview:** four cards only: active routes, passengers assigned
   today, requests awaiting response, pending payments. Dated route meters show
   actual capacity. The summary contract does not supply route days/times;
   these appear only in Mis rutas. No today-route inference or numbered seats.
4. **Routes:** list-first header, create action, icon/explanation/action when empty,
   route cards with Spanish days, times, capacity, commune labels and edit/status
   actions. No IDs are displayed.
5. **Route form:** a focused three-stage create/edit panel: days/time,
   capacity/coverage, review. Back retains values; Close/Escape clears the draft.
   Required controls, exact payload and optimistic revision remain unchanged;
   field errors return to the relevant stage, and started-day conflicts persist.
6. **Passengers:** list-first filter/cards/empty state; create/edit opens only
   after action. Private cards retain route, pickup, guardian contact, current/
   future/finalized state and inclusive dates. Approved student-name wording/help
   and the short contextual privacy notice remain.
7. **Contacts:** inbox cards, actual-lifecycle chips/counts, useful empty/filter
   states, “Ver solicitud”, focused detail and existing accept/reject actions.
   Consent/disclosure rules and the absence of automatic seat/roster creation
   remain unchanged.
8. **Payments:** truthful pending/paid/void counts, named CLP cards with due date,
   native “Ver registro” disclosures for dates/actions, and Registrar interaction
   opening a focused manual form. Exact fields/transitions and retained paid-at
   audit information are preserved. No processing/charging is introduced.
9. **Interaction:** semantic inline icons, activation path, native capacity
   meters, route stepper, focused nonmodal panels, inbox filters and expandable
   records. No dependency/framework/illustration was added.
10. **Accessibility/responsive:** text accompanies meaningful icons/states;
    semantic lists/meter/regions and current-step/pressed attributes; panel heading
    focus, Escape and return focus; 48px targets; wrapping/single-column mobile
    layouts; existing visible focus and reduced-motion styles. Real browser,
    390px and zoom verification remain pending because no browser/app is enabled.
11. **Protected semantics:** no backend/API/OpenAPI or session-service changes.
    Publication blockers, ownership, capacity intervals, dates, optimistic
    route revisions, started-day guards, contact consent and payment state/audit
    stay server-owned. Account replacement and session expiry clear focused
    drafts/details; late private reads/writes cannot repopulate them.
12. **Tests:** all prior behavior/privacy coverage is retained with explicit UI
    opening/stage/disclosure actions. Added seven cases for route disclosure/
    back/review/Escape/focus, home task path/four cards/dated meter, passenger and
    payment default-list/focus/draft clearing, inbox lifecycle/disclosure, and
    live passenger/payment draft expiry. Full suite: **163 passing tests in 11 files**.

Validation from `web/`: `npm run format:check`, `npm run contract:check`,
`npm run lint`, `npm run typecheck`, and `npm test` pass. Temporary production
build: `npm run build -- --outDir /tmp/furgoplus-slice3-redesign-final-dist` passes;
its outside-project output notice is expected. Repository `git diff --check`
passes. No backend tests were rerun because only web presentation/tests and
these task/design notes changed.

Files: `CODEX_TASK_08_5.md`, `docs/UX_FOUNDATION.md`, `web/src/App.tsx`,
`web/src/App.test.tsx`, `web/src/DriverExperience.tsx` (new),
`web/src/DriverOperations.tsx`, `web/src/DriverOperations.test.tsx`,
`web/src/DriverRequests.tsx`, `web/src/DriverRequests.test.tsx`,
`web/src/PublicationScreens.tsx`, `web/src/PublicationScreens.test.tsx`,
`web/src/SessionPrivacy.test.tsx`, `web/src/style.css`.

Git remains on `task/08-5-product-ux-privacy`, HEAD `7b69bb0`: 12 modified
tracked files and one untracked new file. No commit, push, merge, deployment,
reset, revert, discarded changes, branch switch or history rewrite occurred.

Manual acceptance must now review the hero/checklist and all four list-first
journeys on desktop and at approximately 390px, including create/edit/back/
review/close, request filters/disclosure, payment expansion/transitions, keyboard
focus/zoom, long content and account/expiry cleanup using synthetic data only.

## Slice 3 manual acceptance correction — action feedback

The backend correctly rejected an assignment beyond a two-seat route's capacity.
The UI put the mutation error at the section's top while the submit viewport was
farther down, so the tester perceived no result. The shared read/error component
also offered a generic retry for this domain failure.

Introduced a React/CSS viewport notice owned by the identity-keyed workspace,
with operation/result-only Spanish text, a status marker and accessible 48px
close control. One notice replaces prior feedback; action errors persist and
success expires after eight seconds (paused for pointer/keyboard reading).
Routes, passengers, publication request/stop, contact decisions and manual
payment create/status/void now confirm their results visibly. Contextual and
field errors remain; passenger/route/payment submit errors sit by the action,
receive focus/nearest instant scrolling and preserve the failed draft.

Capacity errors say exactly “Esta ruta no tiene cupos disponibles para esas
fechas.” and suggest changing the route or dates. Domain/validation errors have
no generic retry. Transient read/network/server errors retain a read-only retry;
confirmed mutation success survives a failed following refresh. Expiry asks for
sign-in instead of retrying an expired session. No API/backend/error-code,
capacity calculation, ownership, payment/contact state or auth-service changes.

The provider and portal unmount on logout/expiry/account replacement. Global
messages never copy arbitrary server fields or passenger/contact/payment data.
Existing stale API generations, local lifetime/read ordering and private draft
cleanup are retained. Error alert/status semantics, polite success, keyboard
close/focus restoration and reduced-motion behavior are covered in tests.

New/updated coverage includes a full two-seat route rejecting a third create,
exact global/contextual capacity copy, no retry, all retained draft fields,
dismissal, representative real mutation success, persistent errors, success
expiry/hover/focus pause, shared feedback across screen navigation, error focus,
post-save read failure/retry without another write, safe global payment-error
copy and already-visible notice cleanup on replacement/expiry/logout. Existing
mutation, session-generation and late private read/write tests remain.

Correction files: `web/src/ActionFeedback.tsx` and
`web/src/ActionFeedback.test.tsx` (new), `web/src/DriverExperience.tsx` (existing
untracked Slice 3 file), `web/src/App.tsx`, `web/src/DriverOperations.tsx`,
`web/src/DriverOperations.test.tsx`, `web/src/DriverRequests.tsx`,
`web/src/DriverRequests.test.tsx`, `web/src/PublicationScreens.tsx`,
`web/src/PublicationScreens.test.tsx`, `web/src/SessionPrivacy.test.tsx`,
`web/src/style.css`, and these task/design notes. Prior Slice 3 changes including
`web/src/App.test.tsx` are preserved.

Validation results are recorded below. No commit or prohibited git/deployment
action is authorized. Slice 3 remains pending final acceptance, including manual
desktop/390px/zoom and screen-reader review. Computer-use inventory for this pass
returned no enabled app or browser, so no rendered visual pass is claimed.

The shared privacy fixture now answers Inicio's contact-request read with an
empty synthetic inbox. Previously that absent fixture response could generate
an unrelated second read alert and make the permission-denied assertion flaky.
The tested session/authorization expectations are unchanged.

| Final correction check (from `web/`) | Result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched files formatted |
| `npm run contract:check` | Exit 0; generated contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 172 tests in 12 files passed |
| `npm run build -- --outDir /tmp/furgoplus-slice3-feedback-dist` | Exit 0; 40 modules transformed; expected outside-project output notice |
| Repository `git diff --check` | Exit 0 |

Final git state: branch `task/08-5-product-ux-privacy`, 12 modified tracked files
and three untracked files (the prior `DriverExperience.tsx` plus the new feedback
component/test). All prior Slice 3 work and the correction remain uncommitted.
No backend/mobile checks were rerun because only web presentation/tests and notes
changed. No commit, push, merge, deployment, reset, revert, discard, branch switch
or history rewrite occurred. **Slice 3 remains pending final acceptance.**

## Slice 4 — administrator driver control, plan and history experience

Only Slice 4 is implemented by this pass. The prior commits `7850e45`, `7b69bb0`
and `83ea564` remain intact on `task/08-5-product-ux-privacy`. All changes below
are uncommitted for human review. Issue #19 and the pre-edit audit in
`docs/UX_FOUNDATION.md` govern this administrative-only scope. Task 08.5 remains
incomplete; Slice 4 is pending human visual/workflow acceptance.

### Implemented behavior

1. **Queue:** Conductores leads with search and management cards. Each card names
   the service and separately labels profile, validation, visibility and plan,
   with text plus a visual marker and one Ver conductor action. Five supported
   filters live in a compact native disclosure with applied-filter chips and
   reset. Search/filter/page requests remain authoritative server queries;
   invalid filters remain server-owned. Loading, empty, transient-read retry and
   bounded previous/next pages are retained. Obsolete filter responses are ignored.
2. **Detail:** Selecting a driver opens a focused workspace with return/refresh
   actions, status badges and Estado del servicio first. Its visibility,
   explanations and compact profile/validation/plan/intent/active-route-count/
   coverage facts come from server publication responses. Every supplied blocker
   has administrator-facing Spanish copy; no client publication predicate is added.
3. **Profile:** Current state and its consequence lead the section. Only the exact
   Task 08 transitions appear as contextual suspend/deactivate/reactivate buttons.
   Choosing an action opens a required-reason panel, followed by a named
   confirmation showing original state, resulting state, visibility consequence
   and captured reason. Destructive actions use explicit wording and danger
   styling. Version/status tokens stay internal. Successful writes refresh the
   queue, detail, plan/visibility and paginated history.
4. **Plan:** Current name/state/Chilean validity dates, or Sin plan asignado,
   precede Administrar plan. The full editor opens on demand and uses only the
   existing plan catalog, status, start/end dates/times, required reason and
   subscription mutation service. Suspending/inactivating requires explicit
   acknowledgment of hiding the service. Chilean timezone/DST and exact UTC
   conversion remain unchanged. No price, benefits, ranking, entitlement or
   automatic billing is introduced.
5. **Visibility:** Profile and plan mutation responses update the visible state
   immediately, followed by authoritative reads. The overall refresh reaches the
   plan even when profile_version is unchanged. Restoring profile/plan does not
   promise visibility when another server blocker remains. A confirmed save
   stays successful when its following read fails; retry reloads data only.
6. **Validation context:** A closed disclosure retains readable validation state,
   three recent compact entries, observations on demand and progressive reveal
   through server pagination. Ir a Validaciones uses the existing
   top-level destination; Conductores has no document downloads or review
   decisions. Slice 2 review behavior is retained, with the same on-demand plan
   component and the exact service name supplied to that component.
7. **History:** A closed disclosure opens a newest-first event timeline with
   Chilean date/time, human event title, actor, reason and known before/after
   descriptions. Document-read entries show no stored reason/state. Correlation,
   action code and target reference remain under Detalles técnicos. No raw JSON
   or arbitrary dictionary fields are rendered. Ver acciones anteriores and
   Ver acciones más recientes use driver-scoped server offset pagination.
8. **Feedback/conflicts:** Administrative writes reuse the Slice 3 ActionFeedback
   provider and viewport notice. Only static operation/result copy enters notices;
   visibility consequence follows the server response. Contextual errors retain
   useful details in the private screen. A 409 closes the confirmation/editor,
   reloads current state and requires an explicit new action. Profile reasons are
   retained for a newly chosen action. Domain errors offer no generic Reintentar;
   transient read failures offer read-only recovery. Writes are never replayed.
9. **Privacy:** Administrative components are independent of driver operational
   components. Only existing admin control/history/validation/subscription APIs
   and the plan catalog are used. No passenger/student/guardian/pickup/run-roster,
   payment, contact-body, storage-key or parent-private information is added.
   Backend active-staff authorization, transition machine, required reason,
   optimistic versions, row locks, atomic audit, direct-ID privacy and allowlisted
   history remain untouched. N2 queue performance optimization remains deferred.
10. **Responsive/accessibility:** Scoped CSS retains the sidebar, available queue
    width, readable summary and 16px minimum administration text. Cards, facts,
    forms stack and pagination wraps below 680px; routine controls inherit 48px targets.
    Native filter/history disclosures, labels, semantic headings, status/alert
    notices, focus rings and text-plus-marker badges support keyboard use.
    Focused editors/confirmations use centered native modal dialogs. Initial focus,
    Escape/cancel and trigger/fallback-heading focus restoration are tested;
    cancellation is disabled while writes are pending. No animation or new UI
    dependency is added. Actual browser layout/zoom/screen-reader acceptance is
    not claimed by DOM tests.
11. **Task 08 concurrency/session protections:** Profile drafts and confirmations
    capture immutable target, driver name, expected status/version and reason.
    History/background reads cannot rewrite them. Explicit overall refresh
    cancels drafts/confirmation; stale writes still reach the authoritative
    server conflict. Plan versions remain fixed during editing; overall refresh
    cancels the editor. Identity-keyed workspace/provider, AuthApi generations,
    central expiry, obsolete-response rejection and local read/lifetime guards
    retain B1/B2/B3. Admin A→B and expiry remove filters, selected detail, plan
    drafts, confirmations, expanded technical history and notices. Late reads or
    writes cannot restore obsolete private UI. Synchronous guards block duplicate
    profile and plan writes.

### Tests changed

`AdminControls.test.tsx` retains its nine existing cases with the new UI labels
and strengthens summary, confirmation and B2/B3 assertions. Seventeen added cases
cover readable queue/server blockers, all five transitions, required reason,
confirmation consequence, notice privacy, focus/Escape/explicit refresh,
plan suspend/restore with unchanged profile version, server-only restoration
blockers, plan conflict/version review, human allowlisted history/pagination,
late filtered reads/server-invalid filters, frozen plan draft during history
refresh, successful-write/failed-read recovery, duplicate-write prevention and
late previous-driver history isolation.

`SessionPrivacy.test.tsx` retains its 25 existing cases, adapting admin interactions
to the explicit panels/disclosures without removing B1/B2/B3 assertions. Seven
added cases cover admin replacement/expiry with simultaneous plan draft,
confirmation, expanded history and notice; late profile/plan writes; late plan
reads; and the narrow admin endpoint/navigation boundary. Existing admin plan
cases in `PublicationScreens.test.tsx` retain bounded dates, Chilean UTC/time
controls and hiding confirmation while opening the editor explicitly. The
validation test retains separate review/plan visibility and keyboard navigation.
All fixtures and error/late-response payloads are synthetic.

### Exact final validation results

Commands ran from `web/`, except the Git checks at repository root.

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched web files use Prettier formatting |
| `npm run contract:check` | Exit 0; generated API contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 196 tests passed across 12 files |
| `npm run build -- --outDir /tmp/furgoplus-slice4-web-dist` | Exit 0; 42 modules transformed, production assets generated |
| `git diff --check` | Exit 0 |

The final focused session/privacy run passed 32 tests in one file before the
full suite; the full suite also passed all 26 administrator control tests. The build's informational outDir warning is expected because its
output is outside the project. No backend/API/OpenAPI or Flutter files changed;
backend and Flutter validation were not required or run for this slice.

### Files changed and Git state

- `CODEX_TASK_08_5.md`, `docs/UX_FOUNDATION.md`: scope/audit/results/manual gate.
- `web/src/AdminControls.tsx`: queue, selected driver, profile, validation context,
  history, authoritative refresh and concurrency/error handling.
- New `web/src/AdminExperience.tsx`: admin vocabulary, blockers, badges, summary,
  read/error helpers and accessible focused panels.
- New `web/src/AdminPlanControls.tsx`: current plan and on-demand versioned editor.
- `web/src/PublicationScreens.tsx`: re-export the extracted admin plan component;
  driver publication/routes implementation remains unchanged.
- `web/src/App.tsx`: existing Conductores→Validaciones navigation callback.
- `web/src/ValidationScreens.tsx`: supply the service name to existing plan access.
- `web/src/style.css`: scoped responsive administrator presentation.
- `web/src/AdminControls.test.tsx`, `web/src/SessionPrivacy.test.tsx`,
  `web/src/PublicationScreens.test.tsx`, `web/src/ValidationScreens.test.tsx`:
  interaction/privacy/concurrency regressions above.

Git state: 11 modified tracked files and two new untracked files on
`task/08-5-product-ux-privacy`; no changes staged or committed. No commit, push,
merge, deployment, reset, revert, discard, branch switch or history rewrite was
performed. The three prior commits remain the latest commits in the same order.

### Environment blocker and pending human acceptance

`npm run dev -- --host 127.0.0.1` exited 1 with
`listen EPERM: operation not permitted 127.0.0.1:5173`. Computer-use inventory
returned no enabled apps or browsers. No real desktop/390px visual workflow,
zoom or screen-reader acceptance was performed. Repeat these checks in the normal
host environment using synthetic accounts and records only:

1. Open Conductores, search a synthetic service, inspect supported filters/pages,
   open detail and identify profile/validation/plan/visibility within five seconds.
2. Suspend with a reason and explicit confirmation; see authoritative hidden
   state and viewport feedback; open history and understand the event.
3. Restore the profile; verify visibility only returns if all server gates pass.
4. Suspend the plan; verify profile remains active while visibility disappears
   for the plan reason. Restore the plan and check all gates again.
5. At approximately 390px inspect queue, summary, profile confirmation, plan
   editor and history. Verify keyboard focus, Escape/cancel, visible targets,
   wrapping and absence of horizontal core-flow scrolling.
6. Verify no passenger/payment/contact-body information appears. Recheck account
   replacement and expiry while private drafts/confirmations/history are open.

**Slice 4 remains pending human visual/workflow acceptance.** Parent Flutter,
driver daily Flutter, Terms/Privacy and child consent remain out of scope.

### Focused refinement after manual visual review — 2026-10-06

The approved Slice 4 direction is retained. This pass addresses centered queue
navigation, excess detail scrolling and browser-native validation only.

- Conductores pagination is a separate `nav` labeled Páginas de conductores,
  centered below the result cards. Anterior / Página N de M / Siguiente uses the
  existing server count and offset, with an explicit unchanged 25-row limit.
  Controls retain 48px targets, disabled states and centered wrapping; no extra
  result pages are fetched in advance.
- Estado del servicio keeps authoritative visibility and the first server
  blocker visible. Initially three blockers are shown in server order, alongside
  the total requirement count. An expanded/collapsed button reveals every
  remaining blocker without assigning client-side priority or discarding data.
- Profile reason entry and frozen confirmation now use native modal dialogs.
  Original driver name, current/target state, consequence, reason and expected
  status/version remain captured exactly as before. Background reads do not
  rewrite open confirmations. Profile failures stay readable inside the modal;
  stale conflicts still refresh and require a new explicit action.
- Administrar plan opens the same complete plan form in a modal, retaining plan,
  status, Chilean dates/times, reason, hiding acknowledgment, fixed version,
  concurrency checks and authoritative refresh. Both modal types have a 720px
  maximum width, viewport-bounded height and internal scrolling. They do not
  enlarge the background detail. Native modality makes that background inert;
  body scrolling is locked for the lifetime of the dialog.
- Escape/native cancel and explicit close restore trigger focus or a surviving
  contextual fallback. Tab/Shift+Tab remain inside the dialog, and the nested
  date calendar consumes its own first Escape. Pending writes cannot be canceled.
- Forms use `noValidate` and controlled Spanish field errors. Empty profile
  reasons show “Ingresa el motivo del cambio.” Plan reasons, dates, times and
  invalid periods have contextual Spanish messages. Invalid submit preserves
  every draft value, associates the error with its field through `aria-invalid`
  and `aria-describedby`, and focuses the first invalid field. Required state is
  communicated with `aria-required`; no browser required popup or `alert()` is
  used. Server-side validation remains unchanged. ChileanDateField gained only
  optional error-message/required-semantics props; existing driver defaults remain.
- Validation observations and administrative history remain collapsed by default
  with their existing summary state/count. Detail section/fact spacing is reduced
  modestly; body text stays at least 16px and controls retain 48px targets.

Validation from `web/`:

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0 |
| `npm run contract:check` | Exit 0; contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 202 tests across 12 files |
| `npm run build -- --outDir /tmp/furgoplus-slice4-refinement-web-dist` | Exit 0; temporary production assets, 42 modules |
| `git diff --check` | Exit 0 |

Tests now cover server-page navigation in both directions and its landmark,
complete blocker disclosure, on-demand modal semantics, Spanish validation and
retained drafts, invalid-field focus, keyboard containment, native cancel,
Escape/close restoration and profile failure visibility. Dialog semantics are
tested with 390px and 1280px viewport values. Existing frozen snapshot, stale
conflict, authoritative refresh, session-expiry and account-replacement tests
remain green. The full test log is
`/tmp/furgoplus-slice4-refinement-tests.log`.

DOM viewport tests do not measure rendered geometry. `npm run dev -- --port 5176`
failed with `listen EPERM`; the available local Edge executable also failed to
launch under browser automation. Real desktop/~390px layout, zoom, native modal
focus behavior and screen-reader verification remain part of human acceptance.

Files touched by this refinement: `web/src/AdminControls.tsx`,
`web/src/AdminControls.test.tsx`, `web/src/AdminExperience.tsx`,
`web/src/AdminPlanControls.tsx`, `web/src/ChileanDateField.tsx`,
`web/src/style.css`, `docs/UX_FOUNDATION.md` and this task record. Earlier Slice 4
changes in other files are preserved. The branch remains
`task/08-5-product-ux-privacy`, with 12 modified tracked files and two untracked
files; nothing staged or committed. No push, merge, deployment, reset, revert,
discard, branch switch or history rewrite was performed.

**Slice 4 remains pending human acceptance.**


### Final history density and Conductores navigation refinement — 2026-10-06

The overall Slice 4 visual design is approved. This final uncommitted pass only
refines history presentation, Conductores root navigation and product guidance.
Slice 1–3 behavior and the already approved administrative visual language remain.

- Expanding Historial administrativo initially presents three compact newest-first
  events and preserves the server's total action count in the section summary.
  Each event leads with date/time, readable action, actor and the allowed reason.
  Antes/Después render only after opening Ver cambios. Existing allowlisted state
  descriptions and separately collapsed technical references remain available;
  no private document reason/state or additional audit fields are introduced.
- Ver acciones anteriores reveals up to three further loaded events. At the end
  of a loaded page its remaining one or two events are revealed before requesting
  another page. Only after exhaustion does the existing offset pagination request
  the next 25-event server page; count and ordering remain server-owned. Loaded
  pages stay reachable, duplicate event IDs are shown once, and no complete-history
  fetch or prefetch occurs. Pending loading preserves prior events and disables
  the control; no older-action control remains after the final page is exhausted.
  A polite shown/total status announces the reveal, with focus on the first newly
  revealed event, including when the final control disappears.
- Mobile keeps three compact summaries initially, with changes and technical
  details closed. Timeline spacing is reduced, controls remain 48px, long text
  wraps and expanded state fields stack through the existing narrow rules. History
  uses the main document scroll with no fixed-height nested scroll container.
- The sidebar Conductores action always returns to the queue root. A navigation
  key removes the selected detail in the navigation render and clears selection;
  it does not remount the queue. Search text, applied filters and current queue
  page are preserved, without another queue fetch or browser reload. Limpiar
  filtros remains separate. Volver a conductores also preserves this context.
  Sidebar navigation focuses main; explicit return focuses the queue heading.
  Both scroll the workspace/document to the top.
- Detail unmount removes profile draft/confirmation, plan editor/draft/hiding
  acknowledgment, event technical disclosures, observations and driver-context
  feedback. Feedback still uses the unchanged ActionFeedback component; the
  detail owner clears its notice on unmount. Existing local lifetime/generation
  guards reject late detail/history/plan reads and writes. Task 08 identity-keyed
  account replacement, expiry and AuthApi generation rejection remain unchanged.
  Modal scroll locks now restore the original body overflow after the final
  panel closes, including overlapping-panel cleanup during navigation.
- Product-wide UX rule: **Resumen primero -> acción -> detalle bajo demanda.**
  Minimize unnecessary vertical travel, especially on mobile; prefer lists/state
  first, progressive disclosure, pagination/progressive reveal, focused dialogs,
  collapsed secondary information and genuinely necessary multi-step forms.
  Avoid permanent long forms, giant all-detail pages, unjustified nested scroll
  containers and scrolling back and forth to find action feedback. This guidance
  is documented in docs/UX_FOUNDATION.md for current review and upcoming Task 08.5
  slices, including Flutter; no unrelated screen or Flutter refactor is included.
  For chronological/history-like data product-wide, show a small recent batch,
  compact summaries, details on demand and progressive reveal / authoritative
  pagination. Avoid dumping an entire history into one long page; validation
  observations and future Flutter history views follow the same rule.

Tests add exhaustive 28-event traversal at 390px and 1280px: three initial
summaries, total count, absent before/after until disclosure, separate collapsed
technical details, newest-first order, focus/announcements, no page fetch during
local reveals, offset 25 only after the first page and no final misleading action.
Refresh returns to three latest summaries. Existing cross-driver late-history
rejection remains. App-level sidebar/back cases verify preserved search/filter/
page, selected-detail removal, profile confirmation and plan editor cleanup,
cleared notice/private drafts, top scrolling/root focus, no additional queue read
and late detail/history rejection, including reopening the same driver with clean
forms. Existing expiry/replacement/session regression assertions are retained.

No backend/API/OpenAPI, profile/plan semantics, validation workflow, visibility
predicate, audit contents, queue filtering/pagination, ActionFeedback behavior,
privacy boundary or approved Slice 1–3 screen changes are introduced.

Validation results and final Git state are recorded below after the checks.
**Slice 4 remains pending final workflow acceptance.**

#### Final refinement validation and acceptance boundary

All required commands ran from `web/`, with Git checks at repository root.

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0; all matched files formatted |
| `npm run contract:check` | Exit 0; generated contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 206 tests passed across 12 files |
| `npm run build -- --outDir /tmp/furgoplus-slice4-final-web-dist` | Exit 0; 42 modules transformed, temporary production assets generated |
| `git diff --check` | Exit 0 |

Focused administrator/session validation also passed all 68 tests in two files.
Full results: `/tmp/furgoplus-slice4-final-tests.log`; focused results:
`/tmp/furgoplus-slice4-final-focused.log`. The build warning about temporary
output outside the project is informational. No production deployment occurred.

`npm run dev -- --host 127.0.0.1 --port 5176` exited 1 with
`listen EPERM: operation not permitted 127.0.0.1:5176`. Actual desktop/~390px
geometry, no-horizontal-overflow, native keyboard focus and screen-reader review
remain manual acceptance checks; DOM viewport tests do not establish these.
The overall visual design is approved; **Slice 4 remains pending final workflow
acceptance** of this refinement.

Files changed by this final pass:

- `web/src/AdminControls.tsx`: compact/progressive history, root selection cleanup,
  queue return focus/scroll and detail-owned feedback cleanup.
- `web/src/App.tsx`: explicit sidebar Conductores root-navigation signal and top
  scrolling/main focus.
- `web/src/AdminExperience.tsx`: modal scroll-lock restoration on final close.
- `web/src/style.css`: compact timeline spacing and accessible changes disclosures.
- `web/src/AdminControls.test.tsx`: event disclosure, exhaustive loaded-page/server
  pagination, announcement/focus and 390px/1280px regression coverage.
- `web/src/SessionPrivacy.test.tsx`: adapted technical disclosure and sidebar/back
  queue-context, private-detail cleanup and late-response regression coverage.
- `docs/UX_FOUNDATION.md`: product-wide scroll principle and this refinement.
- `CODEX_TASK_08_5.md`: implementation, verification and final acceptance record.

Earlier uncommitted changes in `web/src/ChileanDateField.tsx`,
`web/src/PublicationScreens.tsx`, `web/src/PublicationScreens.test.tsx`,
`web/src/ValidationScreens.tsx`, `web/src/ValidationScreens.test.tsx` and
`web/src/AdminPlanControls.tsx` are preserved and were not edited by this pass.

Final Git state: branch `task/08-5-product-ux-privacy`; 12 modified tracked files
and two untracked files (`web/src/AdminExperience.tsx`,
`web/src/AdminPlanControls.tsx`), with no staged changes. All Slice 4 work remains
uncommitted. No commit, push, merge, deploy, reset, revert, discard, branch switch
or history rewrite was performed.

### Final validation-history density refinement

This pass changes only the remaining scroll density in “Validación y
observaciones”, its tests and product-wide guidance. The approved Slice 4 design
and administrative-history refinement remain intact; approved Slice 1–3 screens
are not refactored.

- The closed summary still shows the current validation state. Opening the
  section keeps “Ir a Validaciones” and shows only three recent entries with
  readable state and Chilean date/time. Entries retain backend revision order;
  the current summary is independent of historical states.
- “Ver observación” is a 48px button with announced expanded state. Retained
  observation text renders only on explicit request and preserves exact text and
  line breaks. “Ocultar observación” closes it; records without observations show
  “Sin observaciones.” Conductores remains context/history only; the dedicated
  Validaciones review workflow remains unchanged.
- “Ver validaciones anteriores” reveals up to three further loaded entries. The
  remaining one or two on a page are revealed before requesting the next existing
  25-entry offset page. Previous entries stay reachable, duplicate IDs appear once,
  and no whole-history request or prefetch is added. The control disappears when
  no older entries remain. Pending requests preserve entries and disable the
  control. A polite shown/total status and first-new-entry focus explain reveals.
- Rows stack naturally at ~390px; spacing is compact, long text wraps, observation
  line breaks remain readable and routine controls retain 48px targets. The list
  uses the main document scroll, without fixed-height or nested scrolling.
- Refresh resets the batch and observations. Changing driver or session/account
  removes opened observations; existing local lifetime/generation guards and the
  identity-keyed workspace reject late validation-history responses.
- **Resumen primero -> acción -> detalle bajo demanda.** applies product-wide,
  including upcoming Flutter slices. Chronological/history-like data should use
  a small recent batch, compact summaries, details on demand and progressive
  reveal / authoritative pagination. Do not dump the entire history into a page.
  This is explicitly recorded here and in `docs/UX_FOUNDATION.md`.

Tests traverse 54 validation records over three authoritative pages at 390px and
1280px, checking three initial entries, readable state/date, current summary,
newest-first order, local reveals without server requests, pending/final controls,
announcement/focus and reachability of all loaded records. Exact retained
observations are checked at both ends of every page; other observations remain
closed. Refresh, cross-driver late-page rejection, session expiry/account
replacement cleanup and the existing “Ir a Validaciones” navigation are covered.

This pass edits only:

- `web/src/AdminControls.tsx`
- `web/src/AdminControls.test.tsx`
- `web/src/SessionPrivacy.test.tsx`
- `web/src/style.css`
- `docs/UX_FOUNDATION.md`
- `CODEX_TASK_08_5.md`

Earlier uncommitted Slice 4 changes remain preserved. Backend/API/OpenAPI,
validation state/authorization/retained data, server pagination authority,
Validaciones review, administrative history, profile/plan controls, visibility
and session/privacy protections remain unchanged.

**Slice 4 remains pending final functional acceptance.** DOM viewport tests verify
behavior, not rendered mobile geometry or screen-reader acceptance. All work
remains uncommitted; no commit, push, merge, deployment, reset, revert, discard,
branch switch or history rewrite is performed.

#### Validation-density verification results

All requested checks ran from `web/` except the repository-root Git check:

| Check | Result |
| --- | --- |
| `npm run format:check` | Exit 0 |
| `npm run contract:check` | Exit 0; generated contract unchanged |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Exit 0; 211 tests passed in 12 files |
| `npm run build -- --outDir /tmp/furgoplus-validation-density-final-web-dist` | Exit 0; 42 modules transformed; temporary production assets only |
| `git diff --check` | Exit 0 |

Full test log: `/tmp/furgoplus-validation-density-tests.log`. The exhaustive
multi-page test has a local 15-second timeout because full-suite contention
exceeded the default five seconds; the production behavior is unchanged.
The temporary output-location warning is informational. No deployment occurred.

Final Git state remains `task/08-5-product-ux-privacy`, with 12 modified tracked
files and two untracked files (`web/src/AdminExperience.tsx` and
`web/src/AdminPlanControls.tsx`), no staged changes and no commit. This includes
the earlier uncommitted work; the six files listed above are this pass's edits.
**Slice 4 remains pending final functional acceptance.**
