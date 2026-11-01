"""Exclusive local academic settings; secrets are mounted files, never CLI values."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from academic_boundary import API_ORIGIN, DATABASE, PROJECT, ROLE, WEB_ORIGIN


def secret(name):
    value = Path("/run/secrets", name).read_text().strip()
    if len(value) < 32:
        raise ImproperlyConfigured("Secreto académico ausente o insuficiente.")
    return value


_required = {
    "FURGOPLUS_ENVIRONMENT": "academic",
    "ACADEMIC_PROJECT": PROJECT,
    "DB_NAME": DATABASE,
    "DB_USER": ROLE,
    "DB_HOST": "db",
    "DB_PORT": "5432",
    "DJANGO_DEBUG": "true",
    "FURGOPLUS_DEMO_MODE": "true",
    "DJANGO_ALLOWED_HOSTS": "127.0.0.1,localhost,backend",
    "DJANGO_TRUST_PROXY_SSL_HEADER": "false",
    "API_PUBLIC_ORIGIN": API_ORIGIN,
    "WEB_PUBLIC_ORIGIN": WEB_ORIGIN,
}
if any(os.environ.get(key) != value for key, value in _required.items()):
    raise ImproperlyConfigured("Configuración académica exclusiva requerida.")
if os.environ.get("DJANGO_SECRET_KEY") or os.environ.get("DB_PASSWORD"):
    raise ImproperlyConfigured("Use exclusivamente secretos académicos montados.")
os.environ["DJANGO_SECRET_KEY"] = secret("django_secret_key")
os.environ["DB_PASSWORD"] = secret("db_password")

from config.settings import *  # noqa: E402,F403

# Do not leave plaintext credentials in the process environment after import.
os.environ.pop("DJANGO_SECRET_KEY", None)
os.environ.pop("DB_PASSWORD", None)
FURGOPLUS_ENVIRONMENT = "academic"
ACADEMIC_PROJECT = PROJECT
ACADEMIC_IDENTITY = secret("academic_identity")
