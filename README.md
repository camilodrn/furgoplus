# FurgoPlus

FurgoPlus connects parents and guardians with school transport drivers in Greater Concepción. The October MVP has three actors: parent on mobile, driver on mobile and web, and administrator on web. [Task 00](CODEX_TASK_00.md) defines product scope; [Task 01](CODEX_TASK_01.md) built the foundation; [Task 02](CODEX_TASK_02.md) adds accounts and shared session authentication; [Task 03](CODEX_TASK_03.md) adds synthetic driver onboarding and private administrator validation; [Task 04](CODEX_TASK_04.md) adds manual plans, route setup and derived publication eligibility. The [auth operations and acceptance guide](docs/AUTH_ACCEPTANCE.md) covers the protocol and required HTTPS/device gate.

## Repository and toolchains

| Path | Purpose |
| --- | --- |
| `backend/` | Django 5.2 + DRF API, custom email user, PostgreSQL migrations and tests |
| `web/` | React 19 + TypeScript + Vite driver/admin account surface |
| `mobile/` | One Flutter app with parent and driver account shells |
| `infra/` | Local PostgreSQL/backend/web Compose and smoke script |
| `.github/workflows/` | Backend, web and mobile CI checks |
| `docs/` | Architecture, product, model, roadmap and ADR decisions |

Docker Engine with Compose v2 runs the local stack. Images pin PostgreSQL 17.6, Python 3.13.8 and Node 22.19.0. For host work use Python 3.13.8 with `venv`/`pip`, Node 22.19.0 with npm 10, and Flutter 3.47.2 with its bundled Dart SDK. Android builds use Android SDK 36, build-tools 36.0.0 and Java 21 LTS to run Gradle. Backend packages have exact pins in `backend/requirements.txt`; web uses `web/package-lock.json`; mobile pins its secure-storage dependency and Flutter SDK version.

## Local stack

From the repository root:

```bash
# Fresh checkout only: preserve an existing .env.
test -e .env || cp .env.example .env
# Replace both replace-with-* placeholders in .env with unique local values.
# Do not print or track .env. Keep the default debug HTTP setup for local use.
docker compose --env-file .env -f infra/compose.yaml build
docker compose --env-file .env -f infra/compose.yaml up -d
docker compose --env-file .env -f infra/compose.yaml exec backend python manage.py migrate
bash infra/smoke.sh
```

Open `http://localhost:5173/` (or `http://127.0.0.1:5173/`). The page calls `/api/v1/health/` through Vite's `/api` proxy, which points at Django in Compose and preserves the browser Host for Django's CSRF Origin check. The backend is bound locally at `http://127.0.0.1:8000/`. PostgreSQL is reachable only inside Compose. Database and private-document volumes persist across `down`. Source bind mounts enable hot reload. This Compose file is for development, not deployment.

Stop with `docker compose --env-file .env -f infra/compose.yaml down` (volumes retained). Never delete current development volumes or reset its database for a rehearsal. Use the [isolated backup/restore and clean-start procedure](docs/BACKUP_RESTORE.md).

For direct host backend/web development, set `.env` values in your shell, use `DB_HOST=127.0.0.1` with reachable PostgreSQL, install `backend/requirements.txt`, run `python backend/manage.py migrate` and `python backend/manage.py runserver`, then `cd web && npm ci && npm run dev`. Vite defaults to `http://127.0.0.1:8000` on the host; override `VITE_API_PROXY_TARGET` when needed.

## Homelab demo deployment

The independent [demo Compose](infra/demo/compose.yaml) builds React into Caddy,
uses Gunicorn WSGI and PostgreSQL, and publishes only `127.0.0.1:18080` for the
host-managed Cloudflare Tunnel at `https://demo.furgoplus.cl`. It uses a separate
project, networks and persistent database/private-upload volumes. No development
server or source bind mount runs in this deployment.

Follow the [homelab runbook](docs/HOMELAB_DEMO.md) for external secret files,
trusted proxy IPs, synthetic-only operation, validation, backups, fresh-volume
restoration and manual updates. [ADR 0007](docs/decisions/0007-homelab-demo-deployment.md)
records the topology and trust boundary. The operator confirms r4 is deployed on
Debian and working over HTTPS with React and Android, synthetic scenario prepared
and backed up. See [the final review](docs/TASK11_FINAL_REVIEW.md) for evidence
limits and pending acceptance cases; these files do not deploy automatically.

## Flutter on host

The repository contains one Flutter app and its Android platform shell. With Flutter 3.47.2 installed:

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000 --dart-define=ALLOW_HTTP_API=true
```

Set Flutter's Android JDK to a locally installed Java 21 LTS JDK before building (`flutter config --jdk-dir="$JAVA_HOME"` with `JAVA_HOME` pointing to that JDK). The Android shell uses the AGP 9.1.0, Gradle 9.3.1 and Kotlin plugin 2.4.0 versions from the Flutter 3.47.2 template. Its Java 17 source and bytecode targets remain the template defaults; Java 21 is the JDK that runs the build tools.

The Android shell is committed. Do not run `flutter create` as a routine setup step because it can recreate Flutter template files that FurgoPlus intentionally removed or replaced. Regenerate platform files only as an explicit maintenance task, review the resulting diff, and preserve FurgoPlus-specific Android configuration. Machine-specific `local.properties` stays ignored.

For a physical device, set `API_BASE_URL` to an API origin reachable **from that device**; the computer's `localhost` is not the device's localhost. `10.0.2.2` is the Android emulator alias for the host. Compose binds port 8000 to host loopback; use the emulator bridge or adjust the local port binding for a trusted development network. No developer machine IP is committed. HTTP is accepted only with `ALLOW_HTTP_API=true` in non-release builds; release builds require HTTPS.

The mobile app has parent registration, parent/driver login, restored-session startup, parent discovery/comparison/contact/account and driver Hoy/roster/start/end/external maps. The Task 01 health client remains covered by tests. `flutter_secure_storage` 11.2.0 stores only the session cookie and expiry metadata; the CSRF token stays in memory. See [mobile guidance](mobile/README.md) and the [HTTPS acceptance procedure](docs/AUTH_ACCEPTANCE.md).

## Checks

```bash
# Backend, with PostgreSQL configured
cd backend
ruff format --check . && ruff check .
python manage.py check --database default
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py migrate --check
python manage.py generate_openapi --check
python manage.py test

# Web
cd ../web
npm ci
npm run format:check && npm run contract:check && npm run lint && npm run typecheck && npm test && npm run build

# Mobile, after flutter pub get
cd ../mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze && flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test
```

The backend test suite uses PostgreSQL, including a fresh Django test database. `backend/openapi.json` is generated by `python backend/manage.py generate_openapi`; CI uses `--check` to reject drift. The web API types are generated from that artifact by `cd web && npm run contract:generate`, and CI checks it too. The API includes health, authentication, private validation/control, publication, routes/subscriptions, parent discovery/reviews/contact, passenger/capacity/manual payments and driver daily operation. Auth and CSRF failures use the JSON error envelope. Provision an administrator interactively with `python manage.py createsuperuser`; public administrator signup is unavailable. See the [auth guide](docs/AUTH_ACCEPTANCE.md) for contract, throttle rates, cookie policy and expiry.

Read [architecture](docs/ARCHITECTURE.md), [product scope](docs/PRODUCT_SCOPE.md), [data model](docs/DATA_MODEL.md), [roadmap](docs/ROADMAP.md), and the [authentication ADR](docs/decisions/0002-authentication-strategy.md) before implementing product workflows. Task 02 owns native secure cookie/CSRF handling and registration/login/logout. The October technical freeze is 13 October 2026; demo delivery is 14 October.

Task 03 uses only the [synthetic validation demo checklist and private upload procedure](docs/DRIVER_VALIDATION_DEMO.md). Real document intake remains blocked pending Q3, malware/quarantine and Q7 decisions.

Task 04 migrations seed Basic, Pro and Elite with the same MVP capabilities; registration does not assign a plan. An administrator enters a reason and an explicit start and exclusive end instant for each subscription change. A driver can request publication and maintain recurring one-way routes. Parent discovery returns only drivers that pass every current eligibility gate. For local synthetic acceptance, run `python backend/manage.py seed_demo_communes` after migrating, then use the `demo-norte` and `demo-sur` codes. These names are demo fixtures, not a confirmed Greater Concepción production catalog; Q1 and Q2 remain product decisions.

Task 05 adds authenticated parent discovery/compare and participant-only consented contact requests. The driver web **Solicitudes** inbox can accept or decline pending requests; the parent Flutter **Solicitudes** tab shows status and the service email only after acceptance. For fictional review examples, explicitly run `python backend/manage.py seed_demo_reviews <demo-driver-id> --demo` after creating an eligible driver whose display name contains “Demo”. This command uses inactive fictional parent accounts with unusable passwords and labels the public review rows as demonstration data. It never runs during migration or normal startup. Real environments may have no reviews; Q1 (production communes), Q4 (contact wording/channel) and Q5 (review provenance/moderation) remain unresolved.

## Academic demonstration / release rehearsal

Task 08.5 is accepted and merged through PR #20 at `816dda0`; issue #19 is complete.
Use the [14 October demo runbook](docs/DEMO_RUNBOOK.md) for startup, synthetic
account preparation, the timed journey, Samsung/ADB setup and recovery.
[Backup/restore](docs/BACKUP_RESTORE.md) uses separate temporary Compose projects;
[Task 09/10 evidence and candidate record](docs/RELEASE_REHEARSAL.md) distinguishes
executed checks from pending HOST/device gates. This is an **MVP demo/academic freeze**,
not a production readiness claim. Task 11 adds guarded, private, idempotent
[scenario preparation](docs/DEMO_SCENARIO.md); no reset command exists.
