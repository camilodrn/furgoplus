# Task 09/10 — release rehearsal and candidate record

Audit: **7 October 2026, America/Santiago**. Branch:
`task/09-10-release-rehearsal-freeze`. Baseline HEAD/main merge: **`816dda0`**
(PR #20, accepted Task 08.5; issue #19 complete). Working tree was clean at start.
This work is **uncommitted for human review**, not an automatically frozen release.
Target remains **MVP demo/academic freeze**, delivery 14 October, not production.

This dated Task 09/10 record retains its original results and pending fields.
Task 11 subsequently integrated it without commit. The operator now confirms r4
deployed/tested on Debian over HTTPS with React/Android and a prepared, backed-up
synthetic scenario. See [final review](TASK11_FINAL_REVIEW.md) for current evidence
limits and the commit plan. No final SHA, tag or remote CI result has been supplied.

## Gaps and resolution

| Finding | Result / remaining gate |
| --- | --- |
| Slice 8 freeze record described uncommitted work, pending acceptance, Flutter/APK and npm audit gates already completed on HOST. | Reconciled `MVP_DEMO_FREEZE.md`: stabilization `a708364`, PR #20, `816dda0`, issue #19 and final HOST passes. Historical sandbox failures retained and explicitly separated. |
| README, architecture and scope still described foundation-only/planned workflows; architecture implied CI checks not implemented. | Current surfaces and CI coverage/debt corrected; unsafe current-data destruction example removed; linked operational guides. No product behavior or dependencies changed. |
| No DB-plus-private-file restore tooling/rehearsal record. Actual running volume names/root inaccessible in sandbox. | Inspected logical volumes, settings, opaque-file implementation, permissions/metadata and sessions. Added a standalone isolated Compose configuration and read-only checkpoint, with exact HOST capture/new-target restore/access checks in `BACKUP_RESTORE.md`. **Actual restore not executed.** |
| No whole-demo seed/reset. Communes/reviews commands cover only those records. | Documented UI-based synthetic preparation and restore-to-new-target reset; no destructive seeder, SQL state edits or current DB cleanup. |
| Original smoke script mixed exhaustive regression checks with on-stage work and stale UI assumptions. | Roadmap maps each step to implemented modules/tests and remaining delivery-hardware evidence. Twelve-minute practical journey and recovery in `DEMO_RUNBOOK.md`. |
| Fresh setup / delivery-device rehearsal cannot be established by unit tests or Compose parsing. | Safe HOST sequence supplied; isolated fresh migrations, account preparation, restored access, actual timed run and dated native/browser acceptance remain human gates. |

## Persistence / clean setup result

PostgreSQL plus the private-upload volume are the joint application backup unit;
whole DB includes session/throttle and audit history. All retained private versions
are needed. Node dependencies are reconstructible; there is no other configured
durable application store. Confirm current runtime root/mounts using the read-only
HOST commands in BACKUP_RESTORE; do not infer actual volume names from defaults.

Clean-start **audit complete; runtime rehearsal blocked here by Docker permission**.
README creation/configuration → Compose build/start → migrate → smoke is supported.
Plans are migration-seeded; communes and optional reviews are explicit commands;
accounts/validation/route/roster/payments/contact are prepared through existing UIs.
The standalone rehearsal has separate random project names, fresh database/private
volumes, temporary randomized secrets and loopback port pairs. It never reads
current `.env` or mounts current development state. Checkpoint comparisons happen
with source writers stopped and target clients unopened, then human downloads
verify restored authorization/headers/audit. No real child/person data is permitted.

## Task 09/10 automated validation (this execution)

These are fresh results from this sandbox against the unchanged application at
`816dda0`, distinct from accepted Task 08.5 HOST evidence.

| Check | Result |
| --- | --- |
| Normal Compose `config --quiet` | Passed; parsing only, not a running stack. |
| Requested backend Docker matrix | Blocked before execution: permission denied on `/var/run/docker.sock`. No Ruff/Django/tests/runtime-version success claimed in this execution. |
| `bash infra/smoke.sh` | Blocked at its first Docker command by the same socket permission. |
| Web format / contract / lint / typecheck | All passed. |
| `npm test` | **236/236 passed, 13 files**, default full runner. Includes all 41 SessionPrivacy cases. |
| Temporary production web build | Passed, 46 modules; `/tmp/furgoplus-task09-web.5v0uFY`. No tracked build output. |
| `npm audit --omit=dev` | Failed to query registry: `EAI_AGAIN registry.npmjs.org`; no fresh vulnerability result. Final Task 08.5 HOST audit was **0 vulnerabilities**. |
| Dart format | Passed, 19 files, zero changes. |
| `flutter analyze` | Passed, no issues; 15 constrained newer packages reported, no updates made. |
| Normal `flutter test` | Runner failed all six loaders on local socket bind `127.0.0.1:0`, EPERM; **zero tests executed**. Prior normal HOST pass stands; no new pass inferred. |
| Debug APK with `API_BASE_URL=https://api.example.test` | Attempted; Gradle failed before compilation: FileLockContentionHandler cannot determine a usable wildcard IP. No new APK produced. Prior HOST debug APK pass stands. |
| Rehearsal Compose/checkpoint/docs static checks | Passed: both source/target configs parse; distinct scoped volumes/loopback ports, no bind/DB/private-file publication; checkpoint Python syntax, all new Bash examples and relative doc links valid. Synthetic local tar bytes/modes round trip passed. No DB/application restore implied. |
| `git diff --check` | Passed after final edits. |

Flutter used the existing writable, unchanged SDK at
`mobile/.build/slice5/flutter-sdk` and existing Gradle cache
`mobile/.build/validation/gradle`, with analytics suppressed. No SDK, dependency,
test harness or Gradle patch was made. The ignored historical direct harness was
not rerun: prior HOST normal tests and the unchanged product make another custom
runner unnecessary. No browser/device acceptance or new production claim follows.

Pinned requirements are still **Django 5.2.18** and **sqlparse 0.6.0**;
Dockerfile and CI install `backend/requirements.txt`. These are source-verified
here and runtime-verified in the previous human HOST validation, not freshly
resolved in a container here. No mass upgrade or lock/schema/API change.

## Exact HOST validation commands

Run from the repository root. The backend matrix uses Django's separate test
database, not a reset of the existing application database. Migration commands
below only check. Builds write disposable outputs/caches; smoke reads state.
Do not seed/clean/reset the current development environment for these checks.

```bash
docker compose --env-file .env -f infra/compose.yaml exec -T backend sh -ec '
  ruff format --check .
  ruff check .
  python manage.py check --database default
  python manage.py makemigrations --check --dry-run
  python manage.py migrate --check
  python manage.py generate_openapi --check
  python manage.py test
'
docker compose --env-file .env -f infra/compose.yaml exec -T backend python -c 'import django, sqlparse; print(django.get_version(), sqlparse.__version__); assert django.get_version() == "5.2.18"; assert sqlparse.__version__ == "0.6.0"'
# Check the small operations helper with the same pinned Ruff, via stdin.
docker compose --env-file .env -f infra/compose.yaml exec -T backend ruff format --check --stdin-filename rehearsal_checkpoint.py - < infra/rehearsal_checkpoint.py
docker compose --env-file .env -f infra/compose.yaml exec -T backend ruff check --stdin-filename rehearsal_checkpoint.py - < infra/rehearsal_checkpoint.py
(
  set -e
  cd web
  npm run format:check
  npm run contract:check
  npm run lint
  npm run typecheck
  npm test
  npm audit --omit=dev
  task09_build_dir=$(mktemp -d /tmp/furgoplus-task09-host-web.XXXXXXXX)
  npm run build -- --outDir "$task09_build_dir"
)
(
  set -e
  cd mobile
  dart format --output=none --set-exit-if-changed lib test
  flutter analyze
  flutter test
  flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test
)
bash infra/smoke.sh
git diff --check
```

Use pinned HOST toolchains/JDK/Android SDK from README. A real demo APK must instead
use its actual API origin per DEMO_RUNBOOK. Do not overwrite a working installed
demo build with the placeholder-origin compile-check APK just before presenting.

## Remaining human gates and recording sheet

Task 08.5 acceptance is already complete; do not reopen its entire checklist.
Before approving the **new** candidate, record operational evidence with synthetic
data. Never infer completed native HTTPS acceptance from an unspecified human
acceptance statement or an ADB debug HTTP demo.

| Gate | Result / date / evidence to enter locally and summarize without secrets |
| --- | --- |
| Fresh isolated setup | Pending: HOST build/start, empty DB migrations, communes, manual synthetic account/domain preparation, both health/proxy checks. |
| Backup + restore | Pending: source/target project names; private runtime root/mount confirmation; SHA256SUMS pass; before/after checkpoint match; DB check; owner/admin current/historical file reads and unauthorized denial/no public serving. |
| Remaining blocked automated reruns | Pending: HOST backend/smoke; fresh online npm audit, normal Flutter tests/APK if requested for this candidate. Existing Task 08.5 passes are recorded, not erased. |
| Native/browser HTTPS gate | Locate prior dated evidence or complete the narrow AUTH_ACCEPTANCE sequence on an existing approved trusted HTTPS setup. Record actual origin, browser, Samsung/emulator model/OS, app/API candidate, secure storage/restart/logout/expiry/CSRF results and redacted log inspection. No deployment is performed by Task 09/10. |
| Delivery hardware + timed journey | Pending: 12-minute run on laptop/Samsung, parent → driver web → driver Hoy/maps/start/end → admin → draft legal; actual elapsed time, ADB reverse/reconnect and fallback verified. |
| Remote required CI | Pending: record successful backend/web/mobile/integration run URL for the eventual human-created post-Task-09/10 commit. Workflow presence is not a result. |
| Human review / candidate identity | Pending: accept docs/tooling, no open core authorization/privacy/integrity blocker, record remaining nonblocking limitations and final SHA below. |

## Candidate identity — human fills after commit and acceptance

| Field | Value |
| --- | --- |
| Status | **Prepared for review; not declared frozen** |
| Accepted Task 08.5 baseline | `816dda0` (PR #20) |
| Post-Task-09/10 commit SHA | **PENDING — human has not committed these changes** |
| Human reviewer / acceptance date | PENDING |
| Candidate validation / CI evidence | PENDING |
| Verified prepared snapshot / restore evidence | PENDING (local private artifact reference only) |
| Demo device / build / actual API origin / rehearsal time | PENDING |
| Known nonblocking issues accepted | PENDING |
| Tag | None created; separate later human decision |

After the human commits, `git rev-parse HEAD` supplies the SHA; do not invent it
from the baseline or automatically approve/tag. Record the SHA in a later review
record or an external acceptance note (a commit cannot contain its own resulting
SHA). Freeze schema/API then; only a reproduced critical fix may alter that
candidate and must repeat affected checks plus smoke. This task changes neither.

## Non-production blockers and deferred scope

All [MVP_DEMO_FREEZE production blockers](MVP_DEMO_FREEZE.md#production-blockers)
remain: Chilean legal review and legal operator/controller; real rights/support
channel; lawful child/guardian authorization; retention/deletion including files,
history/backups; incident response; remaining targeted backend security findings
(asgiref/DRF and request-size handling); real hosting/processors/regions/transfers;
production secrets/HTTPS/server/proxy; malware/quarantine and real document review;
proven backup ownership/recovery; commercial/payment rules if activated; private
address/provider policy if introduced. A synthetic local restore does not settle
production backup/retention/consent. Free text/uploads cannot enforce synthetic
content automatically. Do not collect real child data.

Preserved post-MVP: **address autocomplete, geocoding, exact child-home coordinates,
route optimization, live GPS, payment gateway, realtime chat, advanced push,
app-store release, production consent/legal infrastructure, and every feature
unnecessary for this frozen academic demonstration**. Existing full-response/local
pagination debt remains. No feature work, application code fix, production
deployment, commit, push, merge, tag, branch switch, reset or history rewrite.
