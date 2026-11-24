# Sourced by the PostgreSQL entrypoint only when initializing an empty volume.
case "$TASK16_SLOT" in
    rehearsal|presentation) ;;
    *) exit 1 ;;
esac

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v mark="task16-2026-11-v1:$TASK16_SLOT" <<'SQL'
COMMENT ON DATABASE furgoplus_task16 IS :'mark';
SQL
