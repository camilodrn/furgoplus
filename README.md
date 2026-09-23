# FurgoPlus

FurgoPlus connects parents and guardians with school transport drivers in Greater Concepción. The October MVP has three actors: parent on mobile, driver on mobile and web, and administrator on web. [Task 00](CODEX_TASK_00.md) defines product scope; [Task 01](CODEX_TASK_01.md) builds only the runnable foundation and health request.

## Repository and toolchains

| Path | Purpose |
| --- | --- |
| `backend/` | Django 5.2 + DRF API, custom email user, PostgreSQL migrations and tests |
| `web/` | React 19 + TypeScript + Vite health surface |
| `mobile/` | One Flutter app for later parent and driver roles; neutral health surface now |
| `infra/` | Local PostgreSQL/backend/web Compose and smoke script |
| `.github/workflows/` | Backend, web and mobile CI checks |
| `docs/` | Architecture, product, model, roadmap and ADR decisions |

Docker Engine with Compose v2 runs the local stack. Images pin PostgreSQL 17.6, Python 3.13.8 and Node 22.19.0. For host work use Python 3.13.8 with `venv`/`pip`, Node 22.19.0 with npm 10, and Flutter 3.47.2 with its bundled Dart SDK. Android builds use Android SDK 36, build-tools 36.0.0 and Java 21 LTS to run Gradle. Backend packages have exact pins in `backend/requirements.txt`; web uses `web/package-lock.json`; mobile has SDK-only packages and an exact Flutter SDK version.

## Local stack

From the repository root:

```bash
cp .env.example .env
# Replace both replace-with-* placeholders in .env with local values.
docker compose --env-file .env -f infra/compose.yaml build
docker compose --env-file .env -f infra/compose.yaml up -d
docker compose --env-file .env -f infra/compose.yaml exec backend python manage.py migrate
bash infra/smoke.sh
```

Open `http://127.0.0.1:5173/`. The page calls `/api/v1/health/` through Vite's `/api` proxy, which points at Django in Compose. The backend is bound locally at `http://127.0.0.1:8000/`. PostgreSQL is reachable only inside Compose. Database and private-upload placeholder volumes persist across `down`. Source bind mounts enable hot reload. This Compose file is for development, not deployment.

Stop with `docker compose --env-file .env -f infra/compose.yaml down`. To **destroy local development data**, run `docker compose --env-file .env -f infra/compose.yaml down -v`.

For direct host backend/web development, set `.env` values in your shell, use `DB_HOST=127.0.0.1` with reachable PostgreSQL, install `backend/requirements.txt`, run `python backend/manage.py migrate` and `python backend/manage.py runserver`, then `cd web && npm ci && npm run dev`. Vite defaults to `http://127.0.0.1:8000` on the host; override `VITE_API_PROXY_TARGET` when needed.

## Flutter on host

The repository contains one SDK-only Flutter app. With Flutter 3.47.2 installed:

```bash
cd mobile
flutter create --platforms=android --project-name=furgoplus .
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000 --dart-define=ALLOW_HTTP_API=true
```

Set Flutter's Android JDK to a locally installed Java 21 LTS JDK before building (`flutter config --jdk-dir="$JAVA_HOME"` with `JAVA_HOME` pointing to that JDK). The Android shell uses the AGP 9.1.0, Gradle 9.3.1 and Kotlin plugin 2.4.0 versions from the Flutter 3.47.2 template. Its Java 17 source and bytecode targets remain the template defaults; Java 21 is the JDK that runs the build tools.

`flutter create` generates the standard Android platform shell for the pinned SDK without committing machine-specific `local.properties`. For a physical device, set `API_BASE_URL` to an API origin reachable **from that device**; the computer's `localhost` is not the device's localhost. `10.0.2.2` is the Android emulator alias for the host. Compose binds port 8000 to host loopback; use the emulator bridge or adjust the local port binding for a trusted development network. No developer machine IP is committed. HTTP is accepted only with `ALLOW_HTTP_API=true` in non-release builds; release builds require HTTPS.

The mobile screen displays loading, success or failure for the same health contract. It has no role navigation, sessions or location permissions yet. For Task 02's native session adapter, the selected OS-backed storage package is `flutter_secure_storage` 11.2.0; it is not installed or used by the Task 01 health client.

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

# Mobile, after flutter create and pub get
cd ../mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze && flutter test
flutter build apk --debug --dart-define=API_BASE_URL=https://api.example.test
```

The backend test suite uses PostgreSQL, including a fresh Django test database. `backend/openapi.json` is generated by `python backend/manage.py generate_openapi`; CI uses `--check` to reject drift. The web health type is generated from that artifact by `cd web && npm run contract:generate`, and CI checks it too. The current API surface is only `GET /api/v1/health/`. A small JSON error envelope is installed for later DRF endpoints and API 404s.

Read [architecture](docs/ARCHITECTURE.md), [product scope](docs/PRODUCT_SCOPE.md), [data model](docs/DATA_MODEL.md), [roadmap](docs/ROADMAP.md), and the [authentication ADR](docs/decisions/0002-authentication-strategy.md) before implementing product workflows. Task 02 owns native secure cookie/CSRF handling and registration/login/logout. The October technical freeze is 13 October 2026; demo delivery is 14 October.
