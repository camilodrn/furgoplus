#!/bin/sh
# Invoked ONLY by postgres on first initialization of this exclusive volume.
set -eu
test "$POSTGRES_DB" = furgoplus_task12_academic
test "$POSTGRES_USER" = furgoplus_task12_academic
academic_identity=$(cat /run/secrets/academic_identity)
test "${#academic_identity}" -eq 64
case "$academic_identity" in *[!a-f0-9]*) exit 1 ;; esac
if ! psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
COMMENT ON DATABASE furgoplus_task12_academic IS 'task12-academic-v1:$academic_identity';
SQL
then
    echo 'Identidad académica no inicializada; revisar volumen exclusivo.' >&2
    exit 1
fi
