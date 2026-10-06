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
