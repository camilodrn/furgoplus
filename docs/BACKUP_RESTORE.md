# Synthetic backup/restore and clean-start rehearsal

Task 09/10, 7 October 2026. **Designed and configuration-checked; not executed in
the sandbox**: Docker socket access is denied. Run the following on HOST from
the repository root, in one Bash session. This is local debug HTTP evidence,
separate from native/browser HTTPS acceptance. Use synthetic data exclusively.

This is the **historical Task 09/10 development rehearsal**, not the recovery
procedure for the populated Debian r4 deployment. For that independent topology
and its static backend IP, use [HOMELAB_DEMO](HOMELAB_DEMO.md); its backup helper
does not use `compose run backend`. The operator has since confirmed real Fedora
recovery and r4's prepared/backed-up scenario; see [final review](TASK11_FINAL_REVIEW.md).

## What persists

Inspected: `infra/compose.yaml`, `backend/config/settings.py`, `config/urls.py`,
`drivers/models.py`, `drivers/services.py`, `drivers/api.py`, cleanup and seed
commands, Dockerfiles and CI.

| State | Actual implementation / backup requirement |
| --- | --- |
| PostgreSQL | Logical `pg_data` volume, `/var/lib/postgresql/data`, PostgreSQL 17.6. All application records, immutable revisions/document metadata, audit, routes/runs/roster/payments/reviews/contact, database sessions and `AuthThrottle` counters. Back up the **whole application database**, including migration records. |
| Private files | Logical `private_uploads` volume mounted at `/var/lib/furgoplus/private`. Runtime `PRIVATE_UPLOAD_ROOT` is configurable in normal Compose; confirm it is inside that mount. `save_upload()` uses opaque keys, `.stage-*` intermediates, root mode 0700 and file mode 0600. Preserve **all versions**, not just current documents, plus modes. DB rows store key, size and SHA-256. |
| Reproducibility/config | Candidate source SHA, exact pins/lockfiles, environment configuration and locally held credentials are needed separately. Keep secrets and backup artifacts outside Git with restricted access. No secrets need to be copied from current development for this rehearsal. |
| Other state | Normal Compose `web_node_modules` is a disposable dependency cache, not business data. Browser state/native Keystore sessions are client-local and need fresh logins, not backup. No object bucket, SQLite, Redis, broker, public media directory or other durable application store is configured. |

Volume **physical names and the running root were not inspectable here**. On HOST,
these read-only commands confirm the existing development configuration without
reading document bytes or credentials:

```bash
dev=(docker compose --env-file .env -f infra/compose.yaml)
"${dev[@]}" exec -T backend python -c 'import os; os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings"); import django; django.setup(); from django.conf import settings; print("Private root:", settings.PRIVATE_UPLOAD_ROOT); print("Session backend:", settings.SESSION_ENGINE)'
docker inspect "$("${dev[@]}" ps -q backend)" --format '{{json .Mounts}}'
docker inspect "$("${dev[@]}" ps -q db)" --format '{{json .Mounts}}'
```

Do not assume a default physical volume name if `-p`/`COMPOSE_PROJECT_NAME` was
used. A custom root outside the mounted volume would be an operational persistence
gap: preserve those files separately and fix configuration before using that stack.
Do not run `cleanup_private_uploads`, `flush`, DB reset or volume deletion here.

## 1. Allocate a fresh isolated source

The standalone `infra/rehearsal.compose.yaml` deliberately does **not** load `.env`,
bind source directories, reuse development volumes, publish PostgreSQL, or publish
private storage. Never combine it with `infra/compose.yaml`. No external/named
shared volumes are declared; unique project names scope volumes and networks.
Docker, Python 3, `curl`, `sha256sum`, `diff` and Bash are HOST prerequisites.
Use the pinned toolchains in README for web/mobile. Ports 18000/15173 and
18001/15174 must be free; change them consistently if needed.

```bash
set -euo pipefail
umask 077
# Prevent inherited development DB variables from overriding --env-file interpolation.
unset DB_NAME DB_USER DB_PASSWORD
export REHEARSAL_DIR=$(mktemp -d /tmp/furgoplus-rehearsal.XXXXXXXX)
export REHEARSAL_ENV_FILE="$REHEARSAL_DIR/rehearsal.env"
export REHEARSAL_SOURCE="fp-rehearsal-source-$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
export REHEARSAL_TARGET="fp-rehearsal-restore-$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
export REHEARSAL_API_PORT=18000 REHEARSAL_WEB_PORT=15173
python3 - <<'PY'
import os, secrets
from pathlib import Path
text = Path('.env.example').read_text()
text = text.replace('replace-with-a-unique-long-random-secret', secrets.token_hex(32))
text = text.replace('replace-with-a-local-database-password', secrets.token_hex(24))
text = text.replace('DB_NAME=furgoplus', 'DB_NAME=furgoplus_rehearsal')
text = text.replace('DB_USER=furgoplus', 'DB_USER=furgoplus_rehearsal')
Path(os.environ['REHEARSAL_ENV_FILE']).write_text(text)
PY
src=(docker compose -p "$REHEARSAL_SOURCE" --env-file "$REHEARSAL_ENV_FILE" -f infra/rehearsal.compose.yaml)
dst=(docker compose -p "$REHEARSAL_TARGET" --env-file "$REHEARSAL_ENV_FILE" -f infra/rehearsal.compose.yaml)
test "$REHEARSAL_SOURCE" != "$REHEARSAL_TARGET"
# Both must be empty. A non-empty result is a stop condition, not permission to clean.
test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$REHEARSAL_SOURCE")"
test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$REHEARSAL_TARGET")"
test -z "$("${src[@]}" ps -aq)"
test -z "$("${dst[@]}" ps -aq)"
"${src[@]}" config --quiet
"${src[@]}" build
"${src[@]}" up -d --wait db backend web
# Inspect before writes: all names must be scoped to REHEARSAL_SOURCE.
docker inspect "$("${src[@]}" ps -q backend)" --format '{{json .Mounts}}'
docker inspect "$("${src[@]}" ps -q db)" --format '{{json .Mounts}}'
docker volume ls --filter "label=com.docker.compose.project=$REHEARSAL_SOURCE"
"${src[@]}" exec -T backend python manage.py migrate --noinput
"${src[@]}" exec -T backend python manage.py seed_demo_communes
"${src[@]}" exec backend python manage.py createsuperuser
```

The health endpoint has no DB/schema query; startup before migrations is expected.
Open `http://127.0.0.1:15173/`. Follow the preparation table in
[DEMO_RUNBOOK](DEMO_RUNBOOK.md), using `"${src[@]}"` instead of the normal `demo`
array. Android uses `adb reverse tcp:18000 tcp:18000` and a debug build with
`API_BASE_URL=http://127.0.0.1:18000`, `ALLOW_HTTP_API=true`. Do not change existing
development accounts to prepare this source. Stop on any setup failure and record it.

The mount inspection in the startup block must confirm this unique source, with
no current-development mount, before continuing to migrate/seed/admin provisioning.

```bash
"${src[@]}" exec -T backend python manage.py migrate --check
"${src[@]}" exec -T backend python manage.py check --database default
"${src[@]}" exec -T backend python manage.py generate_openapi --check
"${src[@]}" exec -T db sh -ec 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
test "$(curl -fsS http://127.0.0.1:18000/api/v1/health/)" = '{"status":"ok"}'
test "$(curl -fsS http://127.0.0.1:15173/api/v1/health/)" = '{"status":"ok"}'
```

These are the isolated equivalents of `infra/smoke.sh`, whose project and ports
are intentionally fixed to normal development. Do not use that script as evidence
for the isolated source/target. Fresh migrations + successful synthetic preparation
are the clean-start gate, not merely a parsed Compose file.

## 2. Capture a consistent prepared snapshot

Prepare the routes for **Wednesday 14 October**, also the current rehearsal weekday
if different. Keep assignment intervals inclusive of 14 October and plan/document
validity beyond delivery. Leave the main and spare routes unstarted. A daily run
is keyed by route and Chilean date; it cannot be rewound through the API.

Close clients/log out, disconnect mobile from this source, and stop **only source**
web/backend to prevent writes between DB and file capture. No workers are configured.
The read-only checkpoint hashes all model rows, M2M tables and private bytes and
checks every `DriverDocument` against its size/SHA-256. An empty document set fails.
Capture **before** taking the snapshot. `run --no-deps` starts no HTTP listener.

```bash
"${src[@]}" stop web backend
"${src[@]}" run --rm -T --no-deps backend python - < infra/rehearsal_checkpoint.py > "$REHEARSAL_DIR/before.json"
"${src[@]}" exec -T db sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' > "$REHEARSAL_DIR/database.dump"
"${src[@]}" run --rm -T --no-deps backend python -c 'import os, sys, tarfile; root = os.environ["PRIVATE_UPLOAD_ROOT"]; archive = tarfile.open(fileobj=sys.stdout.buffer, mode="w|gz"); archive.add(root, arcname="."); archive.close()' > "$REHEARSAL_DIR/private.tar.gz"
(cd "$REHEARSAL_DIR" && sha256sum database.dump private.tar.gz before.json > SHA256SUMS)
git rev-parse HEAD > "$REHEARSAL_DIR/baseline-sha.txt"
git diff --stat > "$REHEARSAL_DIR/uncommitted-summary.txt"
"${src[@]}" start backend web
```

`HEAD` is a baseline until human commit; a snapshot taken with uncommitted changes
does not identify a final frozen source. Keep the private env file, source/target
project names, ports, local account roster and candidate identity in a restricted
local note. A dump contains password hashes, sessions and synthetic contacts; protect
it even though no real data is allowed. `/tmp` may be cleared on reboot: before
delivery copy the entire rehearsal directory to a human-controlled private local
backup directory (mode 0700), preserve file modes, and update `REHEARSAL_DIR` and
`REHEARSAL_ENV_FILE`. Do not commit/upload the directory or put it under web/static.

If any capture command fails, do not restore a partial snapshot. Restart the source
services if necessary and capture into a new directory after resolving the failure.

## 3. Restore into a second empty project

The source and current development remain untouched. A restore attempt must start
with a **new** random target name and no existing project volumes/containers. If an
attempt failed, preserve it for diagnosis and choose another target; never restore
over it. Do not run `migrate` before restoration: the dump already contains schema
and migration records. `pg_restore` has no `--clean` or database-drop option.

```bash
export REHEARSAL_API_PORT=18001 REHEARSAL_WEB_PORT=15174
test "$REHEARSAL_TARGET" != "$REHEARSAL_SOURCE"
test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$REHEARSAL_TARGET")"
test -z "$("${dst[@]}" ps -aq)"
"${dst[@]}" config --quiet
"${dst[@]}" build
"${dst[@]}" up -d --wait db
# Confirm the unique target DB mount before restoration.
docker inspect "$("${dst[@]}" ps -q db)" --format '{{json .Mounts}}'
(cd "$REHEARSAL_DIR" && sha256sum --check SHA256SUMS)
"${dst[@]}" exec -T db sh -ec 'test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = '\''public'\''")" = 0'
"${dst[@]}" exec -T db sh -ec 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --no-owner --no-privileges' < "$REHEARSAL_DIR/database.dump"
"${dst[@]}" run --rm -T --no-deps backend python -c 'import os, pathlib, sys, tarfile; root = pathlib.Path(os.environ["PRIVATE_UPLOAD_ROOT"]); root.mkdir(parents=True, exist_ok=True); assert not any(root.iterdir()), "Target files must be empty"; archive = tarfile.open(fileobj=sys.stdin.buffer, mode="r|gz"); archive.extractall(root, filter="data"); archive.close(); root.chmod(0o700)' < "$REHEARSAL_DIR/private.tar.gz"
"${dst[@]}" run --rm -T --no-deps backend python - < infra/rehearsal_checkpoint.py > "$REHEARSAL_DIR/after.json"
diff -u "$REHEARSAL_DIR/before.json" "$REHEARSAL_DIR/after.json"
"${dst[@]}" up -d --wait backend web
"${dst[@]}" exec -T backend python manage.py migrate --check
"${dst[@]}" exec -T backend python manage.py check --database default
test "$(curl -fsS http://127.0.0.1:18001/api/v1/health/)" = '{"status":"ok"}'
test "$(curl -fsS http://127.0.0.1:15174/api/v1/health/)" = '{"status":"ok"}'
```

Only extract the archive generated here and checksum-verified, never a foreign
archive. Python 3.13's safe tar filter preserves these regular files' 0600 modes;
the command explicitly restores the private root to 0700 (the filter omits directory
mode restoration). Before backup and after restore, the read-only checkpoint
enforces root mode 0700 and private regular file mode 0600, and compares bytes;
test actual authorized downloads next. If the root/access differs, fail the gate;
do not make the directory world-readable or expose a media alias to fix it.

## 4. Verify restored behavior and record evidence

Before opening clients, the checkpoint diff must be empty. Then use **fresh logins**
against `http://127.0.0.1:15174/` and the target mobile API port 18001 (cookies are
host-scoped, not port-scoped; close source browser sessions, use a separate browser
profile, and explicitly log out/reconfigure the mobile app).

1. Parent: two eligible demo services, compare, expected request status/contact
   snapshot; excluded pending/control driver stays absent. No roster/private files.
2. Driver owner: route, capacity/roster, payment and Hoy state match the prepared
   source. Download a restored current **and historical** document through the owner
   endpoint `/api/v1/driver/documents/<id>/download/`.
3. Admin: exact reviewed revision/observations/history and plan validity match;
   download the same document through `/api/v1/admin/documents/<id>/download/`.
   Response must be an attachment with `Cache-Control: no-store` and
   `X-Content-Type-Options: nosniff`, content type and bytes correct. Record new
   `document_read` entries in admin history (these appropriately change target DB).
4. Parent, second driver and signed-out browser: direct requests to those download
   URLs denied (403/404, no bytes). No `/media/<storage-key>` or
   `/static/<storage-key>` public serving. Do not publish/log the opaque key.
5. Run the short journey on target, including contact accept and daily start/end;
   record result/date, candidate baseline + dirty state, project names, checkpoint
   match, authorized/denied download outcomes and browser/Android identity in
   [RELEASE_REHEARSAL](RELEASE_REHEARSAL.md). Inspect local service logs for unexpected
   exceptions or leaked credentials/private content; do not paste raw logs into Git.

Endpoint privacy regressions already exist in `drivers/tests.py`; these checks
specifically validate the **restored** files and access, not just a fresh test DB.
Restored sessions/throttle counters are included; log out and authenticate again
rather than using old sessions as proof of successful recovery.

## Repeat/reset and stopping

To recover the exact prepared synthetic state, create a **third new target** name
with a fresh port pair, redefine `dst`, and repeat section 3 from the same verified
snapshot. Update the clients to that target. This leaves the used target and all
current development data intact. On a later Chilean day, Hoy derives a new service
date; the snapshot must contain a route scheduled for that weekday, valid assignments
and valid plans/documents. It does not freeze the clock. If both prepared routes
were completed today, restore to a new target rather than edit run rows.

Stop only the rehearsal projects with `"${src[@]}" stop` and `"${dst[@]}" stop`.
Project-scoped `down` without volume deletion may be used later by the human with
the recorded exact project/env; volumes and restricted backup artifacts remain.
No cleanup/deletion command is required by this rehearsal. Source startup after a
target-port selection needs source ports re-exported (18000/15173) before `up`.
