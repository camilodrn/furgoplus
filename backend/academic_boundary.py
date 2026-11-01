"""Pure, fail-closed academic identity policy. No Django or database imports."""

PROJECT = "furgoplus-task12-academic"
DATABASE = "furgoplus_task12_academic"
ROLE = "furgoplus_task12_academic"
SETTINGS = "config.settings_academic"
VERSION = "task12-academic-v1"
API_ORIGIN = "http://127.0.0.1:18082"
WEB_ORIGIN = "http://127.0.0.1:15173"


def verify_configuration(config, expected_project, expected_database):
    expected = {
        "module": SETTINGS,
        "environment": "academic",
        "project": PROJECT,
        "debug": True,
        "demo": True,
        "engine": "django.db.backends.postgresql",
        "database": DATABASE,
        "user": ROLE,
        "host": "db",
        "port": "5432",
        "api_origin": API_ORIGIN,
        "web_origin": WEB_ORIGIN,
    }
    if (
        expected_project != PROJECT
        or expected_database != DATABASE
        or config != expected
    ):
        raise ValueError(
            "Destino académico no autorizado; ninguna escritura permitida."
        )


def verify_server(row, identity):
    import re

    if not re.fullmatch(r"[a-f0-9]{64}", identity):
        raise ValueError("Identidad académica inválida.")
    # Database name, login role, effective role, owner, TCP port and bootstrap mark.
    if tuple(row) != (DATABASE, ROLE, ROLE, ROLE, 5432, f"{VERSION}:{identity}"):
        raise ValueError("PostgreSQL no pertenece al escenario académico autorizado.")
