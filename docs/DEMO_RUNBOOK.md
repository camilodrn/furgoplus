# FurgoPlus — 14 October academic demo

Target: **12 minutes + 2 minutes recovery buffer**. Demonstrate the synthetic
parent → driver → admin journey on the accepted MVP. Say **“MVP demo/academic
freeze”**. Legal documents are drafts; this is not production readiness or proof
of legal transport eligibility. Use no real child, guardian or driver data.

Task 11 current operator evidence: **r4 is deployed and tested on Debian at
https://demo.furgoplus.cl with Tunnel**. React, Django, PostgreSQL and Android APK
work with synthetic data; the automatic scenario is prepared and backed up. Public
signup remains closed. Preserve all existing accounts, service data and communes.
Task 09/10 documentation is integrated in the Task 11 worktree, uncommitted.
See [DEMO_SCENARIO](DEMO_SCENARIO.md) for guarded preparation, not a reset, and
[the final review](TASK11_FINAL_REVIEW.md) for evidence limits. Do not recreate
existing accounts or apply the fresh-database procedure to the populated r4 DB.
For **Debian homelab preparation**, use the exact fresh-database preflight, interactive
credentials and commands in [DEMO_SECURITY_REVIEW](DEMO_SECURITY_REVIEW.md), with
`infra/demo/compose.yaml`; the development/ADB commands below are a separate local
rehearsal, not homelab startup or HTTPS acceptance. Public exposure is gated there.
The dates below describe the original 14 October scenario: for a later rehearsal,
the operator must record its actual Chilean date/weekday and future validity dates.

Product decision: the homelab URL is public without visitor IP restrictions.
Public signup is **illustrative**, not account creation; follow [DEMO_MODE](DEMO_MODE.md)
for private interactive provisioning and server/UI acceptance. Signup through UIs
below applies only to normal environments with demo mode disabled.

## Before demo day: prepare once, rehearse, snapshot

Use [BACKUP_RESTORE](BACKUP_RESTORE.md) to create an isolated synthetic source and
verified restored target. This is an isolated rehearsal, never a restore over
Debian. `prepare_demo_scenario --dry-run/--apply` is the guarded preparation used
for r4 according to the operator; it is not a general reset. Its isolated
exact-pin PostgreSQL test log has not been supplied to this audit.
`seed_demo_communes` and explicit `seed_demo_reviews` remain separate existing
commands. Tests create their own fixtures and are not a demo database.
Normal environments use real registration. Homelab creates accounts through the
private demo CLI/scenario command, with admin/driver screens for further domain setup;
do not insert domain rows or edit daily-run states through SQL/shell.

Keep a restricted local account note/password manager: actual emails, role, driver
IDs, passwords, prepared target project/env/ports, source SHA, snapshot path and
which route is the spare. No passwords are tracked here. Suggested **fictional**
emails below are examples, not pre-provisioned credentials.

| Account | Required prepared state |
| --- | --- |
| `admin-demo@example.test` | Interactive `createsuperuser`; active admin + staff. Can review/control, no unrelated roster/payment browser. |
| `parent-demo@example.test` | Privately provisioned in homelab (Flutter signup in normal environments); name “Familia Demo A”; can find two services after login. No pending request to the main driver at start. Optional accepted/declined history clearly synthetic. |
| `parent-backup@example.test` | Second fictional parent, spare login/contact journey; never reuse another family's private state. |
| `driver-demo-a@example.test` | Privately provisioned in homelab (web signup in normal environments), display name “Conductor Demo A”; current revision approved, active profile, service email `servicio-demo-a@example.test`, bounded active Basic plan valid through 14 October, publication requested and eligible. Main and spare routes below. |
| `driver-demo-b@example.test` | “Conductor Demo B”; also approved, eligible, valid plan and discoverable in same commune; different valid route/capacity, **no reviews** for comparison. |
| `driver-control@example.test` | “Conductor Demo Control”; complete synthetic documents and pending current submission; not discoverable. Optional previous rejected revision with observations for history. |

After migration and communes, create the admin interactively. In homelab, use
`create_demo_account` with TTY for the other five accounts as in DEMO_MODE, not
public signup or a general seeder. Normal environments retain signup
**5/source IP/hour**. Login remains **10/source IP/15 minutes** everywhere; do not
brute-force or disable throttling. Keep credentials ready before the demo.

Contact-create also limits **10 attempts/account/hour and 20/source IP/hour**
independently, including invalid/duplicate attempts. Do not spend the live demo's
budget rehearsing repeatedly on the same accounts/IP; prepare in advance and allow
the fixed windows to expire. A restored snapshot may retain unexpired counters.

For each approved driver: fill Mi servicio → Datos del servicio; upload the three
synthetic checklist kinds in Documentos, using safe files under 10 MiB and expiry
dates beyond 14 October for the two expiring kinds. Submit in Revisión. Admin
Validaciones approves that exact revision with observations; Conductores assigns
a bounded plan (for example start 7 October, exclusive end 17 October 00:00 Chilean
time). Driver creates valid active routes, then requests Publicación and verifies
the server reports no blockers. Avoid changing approved identity/documents later:
that properly requires revalidation. See [private-upload checklist](DRIVER_VALIDATION_DEMO.md).

To generate one known-safe labeled PNG with installed backend Pillow, from the
repo root and the selected Compose array `demo` (or `src` during preparation):

```bash
umask 077
demo_file=$(mktemp /tmp/furgoplus-documento-sintetico.XXXXXXXX.png)
"${demo[@]}" exec -T backend python - <<'PY' > "$demo_file"
import sys
from PIL import Image, ImageDraw
image = Image.new('RGB', (640, 160), 'white')
ImageDraw.Draw(image).text((20, 60), 'FURGO PLUS - DEMO SINTETICO - SIN DATOS REALES', fill='black')
image.save(sys.stdout.buffer, format='PNG')
PY
```

Upload that generated file to each required kind through the owner screen. The
command writes only a temporary synthetic image, not the DB/private volume.
For historical revision evidence, reject the control driver's first submission
with a fictional observation, replace one demo file, then resubmit and leave it
pending. Never use an identity scan or real document as a placeholder.

Prepare this data through the driver web surfaces:

| Item | Required start state / check |
| --- | --- |
| Main route “Ida Demo” | Active, covers `demo-norte`; Wednesday schedule (14 October is Wednesday), e.g. 07:00–08:00; capacity 4. Include the rehearsal weekday too. Public destination label “Destino Demo”; private destination **“Calle Ficticia 123, Comuna Demo”**, wholly fictional. External Maps may not resolve it; do not substitute a real child's home or personal address. |
| Spare route “Respaldo Demo” | Active Wednesday, non-overlapping time e.g. 14:00–15:00; capacity 4; one fictional assignment. Leave unstarted; use if main run already completed today. |
| Passengers | Two “Pasajero Demo A/B” assignments on main route, valid inclusive of 14 October; fictional guardian names and `.test` emails where supported. Guardian phone field requires nine digits: use synthetic test values (e.g. `900000001`), label them demo and never dial/send messages. Expected main capacity: 2 used, 2 available. No child RUT/DOB/medical data. |
| Manual payment | One pending CLP record linked to an owned synthetic assignment/period; mark paid in the demo. It has no gateway/card data and does not activate the driver's plan. |
| Requests | Main parent/main driver pair has no pending request so the live create works. Optional history can be prepared by create/accept/decline/cancel through participant screens. A contact acceptance never assigns a passenger/reserves a seat. |
| Daily services | Main and spare routes **not started today**; no unfinished earlier run. Hoy uses server America/Santiago date and only that weekday's active routes; assignments must cover it. Do not start/end the main route during the final preflight. |

Optional labeled reviews for A only: retrieve its **driver profile ID** in the admin
detail/API (not user ID), then run `"${demo[@]}" exec -T backend python manage.py
seed_demo_reviews <driver-profile-id> --demo` with the actual ID. Its display name
must contain “Demo”. The command creates inactive fictional reviewers; they are not
login accounts. Leave B without reviews to show the supported empty state.

Make the verified DB-plus-private-files snapshot **before** the live request,
payment-paid change, daily transitions or admin suspension. Keep a private durable
copy before reboot; use BACKUP_RESTORE section 3 for a fresh target after rehearsing.

## Day-of preflight and exact startup

Choose the **prepared** stack. Do not create an empty environment on stage or
overwrite `.env`. These are normal development commands from the repo root:

```bash
demo=(docker compose --env-file .env -f infra/compose.yaml)
"${demo[@]}" config --quiet
"${demo[@]}" up -d --no-build db backend web
"${demo[@]}" ps
"${demo[@]}" exec -T backend python manage.py migrate --check
"${demo[@]}" exec -T backend python manage.py check --database default
bash infra/smoke.sh
```

Open `http://localhost:5173/`. Fresh-machine build/migrate/setup is in README;
the isolated fresh-start/restore commands are in BACKUP_RESTORE. **For a prepared
isolated target instead**, use its locally recorded absolute `REHEARSAL_ENV_FILE`,
project name and port exports, define `demo` with `-p "$REHEARSAL_TARGET" --env-file
"$REHEARSAL_ENV_FILE" -f infra/rehearsal.compose.yaml`, and use the same `up`/checks
above. Check the two target health URLs as in BACKUP_RESTORE, replacing
`bash infra/smoke.sh`; that script only addresses normal development. Never combine
the Compose files. Standard target ports are API 18001/web 15174.

On the Samsung, enable USB debugging, unlock it and accept the computer's RSA
prompt. Keep USB cable/power and a prepared Android emulator/second device available.
For the **local debug HTTP demo** (normal API 8000; restored target 18001):

```bash
adb devices -l
export ANDROID_DEVICE_ID='<serial from adb devices>'
export DEMO_API_PORT=8000 # use 18001 for the restored target
adb -s "$ANDROID_DEVICE_ID" get-state
adb -s "$ANDROID_DEVICE_ID" reverse "tcp:$DEMO_API_PORT" "tcp:$DEMO_API_PORT"
adb -s "$ANDROID_DEVICE_ID" reverse --list
cd mobile
flutter pub get
flutter devices
flutter run -d "$ANDROID_DEVICE_ID" --dart-define="API_BASE_URL=http://127.0.0.1:$DEMO_API_PORT" --dart-define=ALLOW_HTTP_API=true
```

Run/install with these defines **before** entering the room; keep the app available
and log in freshly. The placeholder HTTPS build used in CI is a compile check and
cannot authenticate to `api.example.test`. Local ADB reverse is not HTTPS acceptance.
For an already available trusted HTTPS environment, use its actual origin without
`ALLOW_HTTP_API`; follow [AUTH_ACCEPTANCE](AUTH_ACCEPTANCE.md). No deployment or
TLS/certificate bypass is part of this runbook.

Check laptop power, network for external Maps, screen mirroring if available,
browser zoom/legibility and device text size. Use separate browser profiles for
admin and driver. Re-authenticate to avoid 12-hour session expiry. In Flutter,
start as the parent and later log out before driver login. Verify **without
transitions**: two discoverable services; parent request can be created; driver
Hoy/roster/capacity ready; pending payment; control submission and admin history.
Record the dated device/browser/HTTPS and restore gates in RELEASE_REHEARSAL.

## Ordered journey (12 minutes)

| Clock | Action | Expected visible result / explanation |
| --- | --- | --- |
| 00:00–00:30 | Introduce the three roles and synthetic scope. | Online academic MVP; no real child data, GPS tracking or production claim. |
| 00:30–03:00 · Parent Flutter | Buscar → demo commune → detail → compare A/B → request to A with brief synthetic message and explicit own-email permission → Solicitudes. | Only eligible services; common comparison fields, badge, labeled demo reviews vs no reviews; request **Pendiente**, no driver's service email yet. |
| 03:00–05:00 · Driver web | Inicio readiness → Solicitudes → open row/detail → accept → parent refresh. Briefly show prepared Pasajeros and mark the pending Pagos record paid. | Accepted status; only the permitted email snapshots. Passenger capacity exists from separate assignment; payment is a manual CLP ledger, no transaction gateway. Do not traverse every CRUD screen. |
| 05:00–08:00 · Driver Flutter | Parent logout → driver A login → Hoy → main route roster/capacity → external Maps and return → confirm start → confirm end. | Correct date, 2/4 seats, private fictional roster; destination only to external provider; **Programado → En curso → Finalizado**. No live GPS/parent tracking. |
| 08:00–10:00 · Admin web | Validaciones → pending control revision/document → show observations and decide with a reason. Conductores → A history → suspend profile with reason → mobile logout/parent login → search refresh. | Exact revision/decision + audited history; A disappears, B remains. Existing participant request history remains private. Restore A afterwards through normal admin controls if keeping this target. |
| 10:00–11:00 · Privacy/legal | Open Privacidad and Términos from account/auth access. | Both **v0.1, 07-10-2026, drafts requiring legal review**, no acceptance gate or legal compliance claim. Mention owner/admin document access. |
| 11:00–12:00 | State limitations and take one question. | Local synthetic prototype, online operation, manual plans/payments, external maps; production legal/consent/retention/security work remains. |

## Recovery without bypasses

Use the selected `demo` array from the repo root. Stop a failed segment after
roughly 60 seconds and use the prepared fallback; distinguish a fallback from
successful live evidence. Previously captured synthetic screenshots/video may
explain a failed device step if locally available and labeled; none is promised.

| Failure | Safe diagnosis / recovery |
| --- | --- |
| Backend not responding | `"${demo[@]}" ps`; `"${demo[@]}" logs --tail=80 backend db` locally (do not share secrets). Check configured API health URL, DB health, `migrate --check`. Start stopped services with `up -d --no-build db backend`. If a schema mismatch exists, pause and use the verified restored target; do not reset DB/apply unreviewed changes on stage. |
| Web not loading | Check selected web port, `logs --tail=80 web`, backend health and web `/api/v1/health/`; `"${demo[@]}" up -d --no-build web`. Use a fresh browser profile/hard reload. If unresolved, show the prepared mobile journey and mark web segment unavailable. |
| Samsung disappears / unauthorized / offline | Unlock; check cable/USB mode, RSA authorization and `adb devices -l`; reconnect cable, update serial if needed. Do not revoke all device keys or clear app storage routinely. If still unavailable use the prepared emulator/second device; its API configuration and accounts must already be tested. |
| ADB reverse disappeared | Repeat `adb -s "$ANDROID_DEVICE_ID" reverse "tcp:$DEMO_API_PORT" "tcp:$DEMO_API_PORT"`, then `reverse --list`. Reverse often disappears on reconnect/reboot. Verify HOST health too. Emulator alternative is `10.0.2.2:<port>` in a separately configured debug build. |
| App cannot authenticate | Confirm installed build's actual API origin/HTTP defines, reverse, backend health and credentials. A CI `https://api.example.test` APK has no demo endpoint. Log out/relaunch then login; CSRF failure needs explicit retry after refresh, an ambiguous timeout needs read/refresh before retry. Stop repeated wrong-password attempts to respect throttles. Never disable CSRF/TLS/role checks. |
| Service is in wrong daily state | Refresh Hoy; inspect server Chilean date, weekday, active route and assignment interval. End a legitimate unfinished prior run normally if required. A completed run cannot be reset today: use unstarted spare route or restore the prepared snapshot into a **new isolated target**, then reconfigure clients. Never alter run rows/clock or delete history. |
| Maps cannot resolve demo address / provider unavailable | Return to Hoy; show the destination label and explain destination-only handoff. Continue with start/end; use the public landmark verified beforehand when preparing a new route. Do not claim geocoding, child-home accuracy or add coordinates. A started day's route is deliberately frozen. |
| Stale browser/mobile session or wrong account | Explicit logout; fresh login in the correct role/profile and refresh server state. After switching a restored target, close source browser profile and rebuild/reconfigure mobile origin. Force-stop/relaunch only if needed; never manually inject session cookies or share account sessions. Local offline logout does not prove server revocation. |

Exact reset is the **new-target restore**, not `down -v`, `flush`, cleanup fixtures
or forced daily transitions. After demo, stop the selected stack without deleting
volumes. Protect the local snapshot/account note. No real data intake, app-store
release, new features or deployment is authorized by this demonstration.
