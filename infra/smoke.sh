#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose --env-file .env -f infra/compose.yaml)
"${compose[@]}" exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
"${compose[@]}" exec -T backend python manage.py migrate --check
"${compose[@]}" exec -T backend python manage.py check --database default
backend_response=$(curl --fail --silent --show-error http://127.0.0.1:8000/api/v1/health/)
web_response=$(curl --fail --silent --show-error http://127.0.0.1:5173/api/v1/health/)
test "$backend_response" = '{"status":"ok"}'
test "$web_response" = "$backend_response"
printf 'PostgreSQL, migrations, Django health, and Vite proxy: OK\n'

