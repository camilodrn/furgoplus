#!/usr/bin/env bash
# Disposable local Podman only. No production compose, mounts, env files or DB.
set -euo pipefail
cd "$(dirname "$0")/.."
task12_container="furgoplus-task12-tests-$$"
task12_python="${TASK12_PYTHON:-python}"
cleanup() { podman stop "$task12_container" >/dev/null; }
trap cleanup EXIT
podman run -d --rm --name "$task12_container" \
  -p 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data:rw,size=512m \
  -e POSTGRES_USER=task12_test -e POSTGRES_PASSWORD=isolated-task12-only \
  -e POSTGRES_DB=task12_isolated docker.io/library/postgres:17.6-alpine3.22
for task12_attempt in {1..30}; do
  if podman exec "$task12_container" pg_isready -U task12_test -d task12_isolated; then
    export TASK12_TEST_POSTGRES=true
    "$task12_python" manage.py check --database default --settings=config.settings_task12_tests
    "$task12_python" manage.py makemigrations --check --dry-run --settings=config.settings_task12_tests
    "$task12_python" manage.py migrate --noinput --settings=config.settings_task12_tests
    "$task12_python" manage.py migrate --check --settings=config.settings_task12_tests
    TASK12_TEST_POSTGRES=true "$task12_python" manage.py test \
      --settings=config.settings_task12_tests --noinput "$@"
    exit $?
  fi
  sleep 1
done
echo "PostgreSQL temporal no inició a tiempo" >&2
exit 1
