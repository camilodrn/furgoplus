"""Supplemental SQLite HTTP tests only; never a deployment or locking proof.

No external env file, secret file, persistent database or Docker socket is used.
The normal auth/CSRF/URL configuration is retained with deterministic test inputs.
"""

import os

os.environ.update(
    {
        "FURGOPLUS_DEMO_MODE": "false",
        "DJANGO_SECRET_KEY": "nonsecret-placeholder-for-local-security-tests-only",
        "DJANGO_DEBUG": "false",
        "DJANGO_ALLOWED_HOSTS": "testserver,demo.furgoplus.cl",
        "API_PUBLIC_ORIGIN": "https://testserver",
        "WEB_PUBLIC_ORIGIN": "https://testserver",
        "DJANGO_TRUST_PROXY_SSL_HEADER": "false",
        "DB_PASSWORD": "nonsecret-placeholder-not-used-by-sqlite",
        "PRIVATE_UPLOAD_ROOT": "/tmp/furgoplus-security-tests-unused-private-root",
    }
)

from config import settings as base  # noqa: E402

globals().update({name: getattr(base, name) for name in dir(base) if name.isupper()})
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
