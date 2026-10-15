# Task 08.5 — Slice 8: MVP demo/academic freeze

Audit date: **07-10-2026 (America/Santiago)**. Task 08.5 is complete: Slice 8
was committed as `a708364`, human acceptance completed, issue **#19 completed**,
and Task 08.5 merged through **PR #20**. The main candidate baseline is merge
commit **`816dda0`**. No Task 08.5 working-tree changes remain.

This is an **MVP demo/academic freeze** record, not production approval. Final HOST
evidence includes the backend/smoke matrix, normal Flutter tests, a debug APK and
`npm audit --omit=dev` with **0 vulnerabilities**. Historical sandbox evidence below
is retained with its original limits. Task 09/10 changes are a new, uncommitted
release-rehearsal candidate awaiting human review; see [the rehearsal record](RELEASE_REHEARSAL.md),
[demo runbook](DEMO_RUNBOOK.md) and [isolated restore procedure](BACKUP_RESTORE.md).

## Findings and exact stabilization scope

One acceptance defect was found: driver profile, route stages, passenger and payment
forms still allowed browser constraint-validation bubbles to intercept submission.
That bypassed FurgoPlus's Spanish feedback and depended on browser language.
The four new regression cases failed before the fix. These forms now suppress native
messages while retaining the same HTML constraints through `checkValidity()`, show
Spanish product feedback, preserve drafts, focus the invalid control and prevent
invalid writes/stage advancement. Delayed focus ignores detached/hidden controls.
Existing date/phone checks and all server business rules remain unchanged.

An existing Solicitudes test also exposed a render-timing race under full-suite
load. It now waits for the second page to appear before inspecting its rows; all
row, privacy, detail, pagination and mutation assertions remain. No product inbox
code, timeout, worker setting or test coverage was weakened.

No other acceptance-blocking product regression was found in source, available
tests or inspected Flutter renders. This is bounded evidence: unavailable
physical/browser checks cannot be inferred to pass. The two-pin dependency
security patch below follows UX stabilization; its host validation is complete,
while remaining security findings are still open. No backend/API/OpenAPI application
code, legal wording or mobile source was changed.

## Completed implementation and accepted information architecture

| Work reviewed | Baseline commit / preserved outcome |
| --- | --- |
| Slice 1 | `7850e45`: design tokens, auth, shells, account/session cleanup |
| Slice 2 | `7b69bb0`: driver onboarding, documents, versioned validation context |
| Slice 3 | `83ea564`: publication, routes, passengers, requests, manual payments, contextual ActionFeedback |
| Slice 4 | `d595e2d`: admin validation/control context, history, bounded profile/plan controls |
| Slice 5 | `58d5d04`: parent discovery/filter/detail/compare, scoped contact consent, lifecycle and account |
| Post-Slice-5 fix | `df61914`: driver request rows, inline detail and local ten-row pages |
| Slice 6 | `b850354`: driver Hoy, server daily states/roster/capacity, external maps, start/end |
| Slice 7 | `c07d6c4`: original shared draft legal documents, legal access and privacy inventory |
| Slice 8 | `a708364`: stabilization and acceptance record; human acceptance complete; merged in PR #20 (`816dda0`) |

Driver web: **Inicio · Mi servicio · Pasajeros · Solicitudes · Pagos**.
Mi servicio retains Datos del servicio, Documentos, Revisión, Publicación and Rutas.
Admin web: **Validaciones · Conductores**. Parent Flutter:
**Buscar · Solicitudes · Mi cuenta**. Driver Flutter: **Hoy**.
Product principle: **Resumen primero -> acción -> detalle bajo demanda**.

## Role and contract audit

| Role | Source and automated acceptance reviewed |
| --- | --- |
| Parent | Login/restore; commune discovery/filter; eligible detail and 2–3-service comparison; own-email permission unchecked by default; creation and duplicate-pending protection; pending/declined/accepted/cancelled history; accepted-only service-email snapshot; name-only account edit; legal access; logout/expiry/replacement. Accepted contact does not reserve capacity or assign a passenger. |
| Driver | Login/onboarding; synthetic document upload/private download/review; server publication blockers and intent; recurring route revision/conflict; owner assignments and interval capacity; request decisions; manual CLP ledger; Hoy planned/in-progress/completed/empty versus read failure; owner roster; destination-only external maps; confirmed start/end and uncertain-result refresh; legal/session cleanup. |
| Admin | Role plus staff boundary; validation queue and immutable submission/document context; required observations/decisions; profile and plan suspend/restore; optimistic versions and conflicts; progressively revealed history; legal access and account cleanup. No operational passenger/payment/contact browser. |

Reviewed implementation and existing backend assertions in `api/test_auth.py`,
`api/test_contracts.py`, `drivers/tests.py`, `test_publication.py`, `test_contact.py`,
`test_operations.py`, `test_daily_operation.py` and `test_controls.py`. Backend
assertions were inspected, **not executed** in this sandbox; subsequent human-run
host validation passed **all 90 backend tests** in the rebuilt Docker backend.
Web `contract:check` still matches the existing OpenAPI artifact.

Publication remains derived by the server; UI intent never implies visibility.
Capacity remains interval-based, transaction/route-lock protected on the server.
Contact decisions and route runs remain server-owned; concurrency conflicts require
explicit review. Confirmed mutation responses survive failed refreshes; uncertain
writes are not blindly replayed. The existing web retry after explicit CSRF rejection
is distinct from retrying an ambiguous network write. Native CSRF failure refreshes
the token without automatically replaying the write. No new acceptance step or
business capability was invented.

## Session and privacy freeze

Reviewed `web/src/api.ts`, `App.tsx`, `ActionFeedback.tsx`, SessionPrivacy/API tests,
native `session_api.dart`, `auth_controller.dart`, keyed auth/role/legal scopes and
parent/driver lifecycle guards. The **41 SessionPrivacy tests** passed in the full
and repeated focused runs. Coverage retains identity-keyed workspace/state,
same-role A→B cleanup, unsupported replacement without stale workspace, central
`not_authenticated`, CSRF clearing/rotation, stale identity/read/write/download
rejection, late mutations, logout, expiry, document bytes and filenames, filters,
drafts, confirmations and private errors/ActionFeedback cleanup. Unrelated permission
errors do not expire an otherwise valid session. Native storage work is serialized
and generations reject obsolete cookie/CSRF results. Offline local logout does not
claim server revocation.

Minor/privacy audit: discovery/detail/compare use public allowlists with no roster,
guardian contacts, account/service email or private destination address. Passenger,
payment and daily APIs filter by the driver owner; guessed cross-driver IDs are
denied. Admin has no general child roster API or registered Django passenger model.
Private document reads remain role/ownership-bound and administrative reads audited.
No child RUT, DOB, medical data, school records or sensitive categories were added.
Parent permission shares only their own email with the selected driver at submission;
the service email remains an accepted-request snapshot.

Free text/files can still receive real/excessive information; there is no synthetic
data detector, verified guardian authority or general deletion/retention system.
The real-minor-data restriction is **prototype policy**, not automatic backend
enforcement. Follow the [privacy inventory](PRIVACY_BY_DESIGN.md); use only synthetic
accounts, documents, passengers, guardian contacts and destinations in this freeze.

## Legal, synthetic data, UX and accessibility review

Both canonical drafts remain **v0.1 — 07-10-2026**, explicitly requiring Chilean
legal review. Law 19.628 is the current framing on the audit date; Law 21.719's
01-12-2026 effect remains future, consistent with [BCN's law and first transitional
article](https://www.bcn.cl/leychile/navegar?idNorma=1209272) and the [earlier Law 19.628
text](https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2023-05-09).
No operator, RUT/company address, legal contact, insurance, regulator endorsement,
compliance certification or production approval is fabricated. Demo review does
not establish legal transport eligibility. Contact permission is not legal,
child-data, sensitive-data or marketing consent. No acceptance checkbox/gating or
unsupported server evidence is introduced. [Legal source/version index](legal/README.md).

Manual source review completed for branding, tokens, Spanish vocabulary, route versus
dated service, selected contrast, status text/icons, accessible labels, ActionFeedback,
keyboard/escape/focus restoration, hidden controls, valid capacity semantics, empty
versus error states, focused forms and progressive disclosure. Existing tests cover
narrow/large text and legal ends at 320/390px with 2x text. The concrete native-message
defect above was corrected; no approved surface was redesigned.

Fresh existing Flutter visual probes were run and renders inspected for parent
search/detail/contact/history/accepted contact/account/compare selection; driver
planned/in-progress/completed/no-service/error/confirmation/large text; and legal
reading at 320px/2x text. Initial visual probes forced Ahem test glyphs; they were
rerun without `--use-test-fonts`/`--disable-asset-fonts` to inspect readable local
fonts. This was a rendering-harness setting, not a product/SDK change. Routine
targets and primary 56px mobile actions were reviewed in source and tests. No
browser layout, physical Android, TalkBack or WCAG certification is claimed.

## Historical Slice 8 sandbox validation and stability evidence

These are the original sandbox outcomes, not the final HOST gate status. Later
HOST passes are recorded separately below; sandbox limitations are not product failures.

| Check | Result |
| --- | --- |
| Requested Docker backend matrix (commands below) | Human-run HOST validation passed after successful backend rebuild/restart: both Ruff checks, database check, migration checks and OpenAPI check; **90/90 backend tests passed**. Rebuilt runtime resolved **Django 5.2.18** and **sqlparse 0.6.0**. |
| `docker compose --env-file .env -f infra/compose.yaml config --quiet` | Exit 0; configuration parses only |
| `bash infra/smoke.sh` | Human-run HOST integration smoke passed: PostgreSQL, migrations, Django health and Vite proxy all OK. |
| Supplementary Python AST / OpenAPI JSON parse | 61 Python files and JSON parse; syntax-only, not a replacement for backend checks |
| `cd web && npm run format:check` | Exit 0 |
| `npm run contract:check` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm test` | Two final unrestricted full runs: **236/236 each, 13 files**; four added form regressions; 41 SessionPrivacy cases retained |
| Sensitive/timing suites before final edits | SessionPrivacy/API/App/AdminControls: **113/113 twice** with default concurrency |
| Temporary production web build | Exit 0; 45 modules; `/tmp/furgoplus-slice8-final-web-dist` |
| `npm audit --omit=dev` | Exit 1 twice, DNS `EAI_AGAIN registry.npmjs.org`; no vulnerability-free result |
| `cd mobile && dart format --output=none --set-exit-if-changed lib test` | Exit 0; 19 files, no changes |
| `flutter analyze` | Exit 0; no issues; 15 newer packages outside constraints reported |
| `flutter test` | Exit 1; all six suite loaders fail binding `127.0.0.1:0` with EPERM, zero tests executed by the normal runner |
| Existing direct Flutter harness, all six unchanged suite entrypoints | **113/113 twice**, no skips; no normal-runner pass implied |
| `flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test` | Exit 1 before compilation: Gradle FileLockContentionHandler cannot determine a usable wildcard IP. No new APK produced |
| Supplemental `flutter build bundle --debug --no-pub --dart-define=API_BASE_URL=https://api.example.test --asset-dir=/tmp/furgoplus-slice8-mobile-app-assets` | Exit 0; compiled app/assets, both legal assets byte-match canonical originals |
| Existing headless Flutter visual probes | Three fixture probes pass; readable-font rendering reruns pass; not device acceptance |
| `git diff --check` | Exit 0 |

Flutter reused the unchanged writable SDK at `mobile/.build/slice5/flutter-sdk`,
the existing Gradle cache at `mobile/.build/validation/gradle`, and analytics
suppression (`DASH__SUPPRESS_ANALYTICS=true`, `FLUTTER_SUPPRESS_ANALYTICS=true`).
No SDK/dependency/Gradle source patch. Direct fallback:
`cd mobile && bash .build/validation/compile-direct.sh`; imports all six actual
suites, compiles with checked mode, uses real bundled assets and runs
`flutter_tester --disable-vm-service` without a test socket. This ignored local
harness is supplemental evidence and is not a portable CI replacement.

Flake record: initial full baseline **232/232 passed**. First full run after form
changes was **235/236**: the existing inline-detail test queried family 11 while
page 1 was still rendered immediately after Next. Its isolated run passed, then
three unchanged full inbox-suite runs passed (**20/20 each**). A state-based wait
for page 2 fixes that premature observation, retaining every assertion and default
timeouts/concurrency. Repeated complete runs are the final gate; no failed test
was dismissed merely because a retry passed. New-test authoring issues (an ambiguous
alert query, a fixture shadowing `document`, query-option typing and formatting)
were deterministic and corrected before acceptance; they were not product flakes.

Local evidence: `/tmp/furgoplus-slice8-*` logs/builds, with final full-suite logs
`web-final-repeat-1.log` and `web-final-repeat-2.log` under that prefix. Flutter
captures remain ignored under `mobile/.build/validation/`. Browser inventory was
empty; Vite startup failed binding `127.0.0.1:5173` with EPERM.

## Scoped dependency security patch and remaining findings

Host validation originally reported **Django 5.2.17** and **sqlparse 0.5.3**.
Before final freeze, `backend/requirements.txt` was patched to exact pins
**Django 5.2.18** (same 5.2 LTS line) and **sqlparse 0.6.0**. This is the canonical
hand-maintained pin file, installed directly by `backend/Dockerfile` and
`.github/workflows/ci.yml`; `backend/pyproject.toml` only configures Ruff. No Python
lock file or dependency-generation workflow was found. sqlparse is a transitive
Django dependency already explicitly pinned in this file, so only its existing
pin was updated. No new constraint mechanism or unrelated dependency change.

Primary-source advisories prompted this scoped patch:

- Django's [06-10-2026 security release
  5.2.18](https://www.djangoproject.com/weblog/2026/oct/06/security-releases/)
  addresses header-parser DoS CVE-2026-84429, language-cache DoS, spatial lookups
  and editable-primary-key formsets. No exploit/reachability test was executed.
- sqlparse **0.5.3** is in the affected range
  of [GHSA-27jp-wm6q-gp25](https://github.com/andialbrecht/sqlparse/security/advisories/GHSA-27jp-wm6q-gp25),
  first fixed in **0.5.4**; the requested target is **0.6.0** ([release notes](https://sqlparse.readthedocs.io/en/latest/changes.html#release-0-6-0-aug-13-2026)).
  No product API accepts raw SQL; this does not justify retaining the affected pin.

**Post-patch validation — completed on HOST:** the human successfully rebuilt and
restarted the Docker backend and verified its installed runtime versions:
**Django 5.2.17 -> 5.2.18** and **sqlparse 0.5.3 -> 0.6.0**. These exact versions
were resolved in the rebuilt container, not merely recorded as target pins.

`ruff format --check .`, `ruff check .`,
`python manage.py check --database default`,
`python manage.py makemigrations --check --dry-run`,
`python manage.py migrate --check` and
`python manage.py generate_openapi --check` all passed.
`python manage.py test` passed **all 90 backend tests**. Integration smoke passed:
**PostgreSQL, migrations, Django health and Vite proxy: OK**.
Final host result codes: **build: 0; up: 0; versions: 0; backend: 0; smoke: 0;
diff: 0**. This host evidence supersedes the earlier sandbox execution blockers.

The scoped security patch is **validated for the MVP demo/academic freeze**.
This **does not make FurgoPlus production-ready**. Task 08.5 human acceptance is
complete; the remaining production blockers still apply.

Other findings remain outside this two-package patch:

- **Conditional:** asgiref **3.9.1** predates the [3.11.1 WsgiToAsgi duplicate-header
  DoS fix, CVE-2025-14550](https://github.com/django/asgiref/blob/main/CHANGELOG.txt).
  No WsgiToAsgi adapter was found in this repository; reassess the production server.
- **Assess request-size handling:** DRF **3.16.1** predates [3.17.2 request-data
  memory-limit and AdminRenderer fixes](https://github.com/encode/django-rest-framework/blob/main/docs/community/release-notes.md).
  Only JSONRenderer is configured, so the AdminRenderer disclosure path is absent.
  Upload byte checks do not replace early parser/proxy limits.

These are targeted primary-source findings, not a complete package advisory scan.
Only the two requested security pins changed; host runtime verification and the
backend/smoke checks passed. Remaining security remediation is required before a
production/external-service decision. The later HOST npm production-dependency
audit passed with 0 vulnerabilities; this is not a full backend/mobile advisory scan.

**Outdated packages, separately:** Flutter reports 15 constrained updates (including
url_launcher/platform implementations and test/tooling packages); newer versions
alone are not evidence of vulnerabilities. No mass upgrades or lock changes.

## Repository/artifact audit and known debt

The original 185 tracked paths contain no `.build`, node_modules, APK/AAB, generated
test output, screenshots, logs or cache artifacts. `.env` and local validation output
remain ignored; only placeholder `.env.example` is tracked. Targeted key/token/private
key scans found no matching secret patterns; this is not an exhaustive secret audit.
Existing synthetic test/CI credentials stay outside production UI. No new credential
is introduced. No TODO/FIXME/HACK/XXX marker was found in audited implementation/tests/docs.
Generated web contract remains current. Legal files have two originals, with valid
canonical Flutter symlinks; the logo symlink is valid too. No legal duplicate, broken
tracked symlink, migration/dependency drift or new dead feature code was identified.
Useful fixtures and ignored local artifacts were preserved; only validation outputs
needed for this audit were generated/refreshed.

**Explicit pagination debt:** Driver Web Solicitudes receives the existing full
**`{ results }`** response and paginates **locally at 10 rows**. This reduces scrolling,
**not server payload size**. Backend pagination is post-MVP work, not a Slice 8 contract
change. Parent request history also progressively reveals an existing full response;
driver validation history has the existing server cap. General retention/deletion,
legal evidence and secure production upload review remain open work.

**Deferred:** live GPS; internal maps/navigation; address autocomplete/geocoding;
child-home coordinates; native app-store release; payment gateway/new commercial
flows; realtime chat; advanced push; microservices; production legal-acceptance/
consent infrastructure; new subscription/admin/parent/driver capabilities. Future
address autocomplete remains future work.

## Production blockers

Before real-world use, resolve and evidence: Chilean legal review; legal
operator/controller; genuine privacy/support/rights channel; lawful minor-data
authorization and guardian-authority evidence; approved real child/guardian data
handling; purpose/access and retention/deletion including history/files/backups;
incident/breach response; production security and dependency findings above; actual
hosting/processors/regions/transfers; production secrets/environment/HTTPS and a
production server/proxy; malware/quarantine and real driver-document/legal-verification
policy; backup/restore rehearsal; payment/commercial rules if activated; and private
address/geolocation/provider design if introduced. None is represented as resolved.

## Task 08.5 human final acceptance — completed

Human acceptance is complete per the post-merge handoff. The checklist below is
retained as the accepted scope; it is not a fresh pending Task 08.5 gate. No new
per-device, browser or accessibility certification evidence is inferred. Task 09/10
still needs the dated delivery-hardware rehearsal in RELEASE_REHEARSAL.md.

Use only prepared synthetic accounts/documents/destinations and the approved test API.

1. **Parent mobile:** filter, inspect/compare two services, send contact with explicit
   own-email permission; check pending versus accepted contact and edit account name.
2. **Driver mobile:** inspect Hoy/roster, open external maps and return, start once,
   cancel then confirm end; inspect an empty day with a prepared fixture.
3. **Driver web:** review service readiness, one route/passenger/payment task, invalid
   form feedback in Spanish, then second-page Solicitudes and inline detail.
4. **Admin web:** inspect a submission/document/observation, decide, check history and
   profile/plan suspend/reactivate consequences using synthetic records.
5. **Legal:** open both drafts from auth and each role's account area; verify version,
   draft banner, close/back/focus and absence of acceptance gating.
6. **Session:** logout/expire with a draft or confirmation open; replace account A
   with same-role B, then an unsupported role; no old contacts/files/errors/dialogs.
7. **Narrow/accessibility:** one 320/390px web pass with keyboard and one Android
   large-text/TalkBack pass; reach primary actions/legal close without critical
   horizontal scrolling, clipping, hidden focus or unreadable selection.

## Completed Task 08.5 HOST validation

The human completed the following from the repository with its existing
synthetic validation environment; results are recorded above:

```sh
docker compose --env-file .env -f infra/compose.yaml build backend
docker compose --env-file .env -f infra/compose.yaml up -d --no-build db backend web
docker compose --env-file .env -f infra/compose.yaml exec -T backend python - <<'PY'
import django
import sqlparse
print("Django:", django.get_version())
print("sqlparse:", sqlparse.__version__)
assert django.get_version() == "5.2.18"
assert sqlparse.__version__ == "0.6.0"
PY
docker compose --env-file .env -f infra/compose.yaml exec -T backend sh -euc '
  ruff format --check .
  ruff check .
  python manage.py check --database default
  python manage.py makemigrations --check --dry-run
  python manage.py migrate --check
  python manage.py generate_openapi --check
  python manage.py test
'
bash infra/smoke.sh
git diff --check
```

## Final Task 08.5 HOST evidence supplement — completed

The human also completed **normal `flutter test`**, a **debug APK build on HOST**,
and **`npm audit --omit=dev`: 0 vulnerabilities**. These supersede the sandbox
execution blockers above; no HOST test count, APK checksum or exact build timestamp
was supplied, so none is invented. The commands are retained for reproducibility:

```sh
cd web
npm audit --omit=dev
cd ../mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test
cd ..
git diff --check
```

## Historical Task 08.5 changes and current Git boundary

Task 08.5 changed `backend/requirements.txt` (two security pins), `CODEX_TASK_08_5.md`,
this record, `web/src/formValidation.ts`, the driver validation/publication/operations
forms and their tests, and `web/src/DriverRequests.test.tsx` (state-based render wait).
The original pre-commit sandbox status was 9 modified tracked files and 2 untracked
files on `task/08-5-product-ux-privacy` at `c07d6c4`; that is **historical evidence**,
not current state. Stabilization was committed, accepted and merged through PR #20.

Task 09/10 began on `task/09-10-release-rehearsal-freeze` at `816dda0` with a clean
working tree. Its operational/documentation changes stay uncommitted for human
review. No new frozen SHA or tag exists. Record the final post-Task-09/10 commit
only after the human commits and accepts the candidate, using RELEASE_REHEARSAL.md.

## Task 11 exposure review — separate acceptance boundary

As of 14 October, Task 09/10 documentation is integrated without commit into
`task/11-homelab-deployment`. The operator confirms healthy Debian 13 deployment,
physical reboot and real Fedora backup/restore (18/18 recovery tests, 16/16 Django
infrastructure tests). At closure the operator confirms **r4 deployed and tested
over HTTPS/Tunnel**, React/backend/PostgreSQL/APK working on synthetic data, automatic
scenario prepared and backed up. This supersedes the earlier inactive-Tunnel state.
See [the final review](TASK11_FINAL_REVIEW.md) for evidence gaps; operational success
does not establish every security acceptance case or production readiness.

Task 11 adds independent PostgreSQL-backed contact-create budgets (10/account/hour,
20/source IP/hour) without schema or auth redesign. Local HTTP/CSRF/ownership tests
are supplemental evidence; PostgreSQL process races, the exact candidate deployed
later, browser auth and native Flutter secure-storage/roles through the final HTTPS
proxy chain remain gates. See [DEMO_SECURITY_REVIEW](DEMO_SECURITY_REVIEW.md) for
results, fictional-only provisioning, residual abuse risks and the operator's
public-access decision. Existing HOST Flutter test/APK build evidence is retained;
it does not establish native HTTPS behavior at `demo.furgoplus.cl`.

Subsequent product decision for Task 11: public visitors without IP restrictions,
controlled account creation. [DEMO_MODE](DEMO_MODE.md) closes public signup in demo
settings and keeps existing React/Flutter forms illustrative without registration
transport/storage. Accounts are privately provisioned with validated credentials;
normal environments retain signup. No discovery or private operational surface is
made anonymous. This configuration/protection is not a new MVP screen or a public
HTTPS/device acceptance pass. r4 is already deployed according to the operator;
future updates remain separate authorized operations preserving existing data.
