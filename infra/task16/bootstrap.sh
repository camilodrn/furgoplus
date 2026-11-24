#!/bin/sh
# The frozen private Django settings read variables, not *_FILE.
set -eu
DJANGO_SECRET_KEY=$(cat "${DJANGO_SECRET_KEY_FILE:?}")
DB_PASSWORD=$(cat "${DB_PASSWORD_FILE:?}")
case "$DJANGO_SECRET_KEY:$DB_PASSWORD" in
    *[[:space:]]*|replace-*|*:replace-*)
        printf '%s\n' 'Task 16 secret files must contain one value without spaces.' >&2
        exit 1
        ;;
esac
if [ "${#DJANGO_SECRET_KEY}" -lt 50 ] || [ "${#DB_PASSWORD}" -lt 20 ]; then
    printf '%s\n' 'Task 16 secret files must contain strong values.' >&2
    exit 1
fi
export DJANGO_SECRET_KEY DB_PASSWORD
exec "$@"
