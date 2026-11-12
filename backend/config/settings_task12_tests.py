"""Explicitly isolated test settings; never resolve a deployed DB from DB_* env."""

import os

os.environ["DJANGO_SECRET_KEY"] = "isolated-task12-test-only-not-a-deployed-secret"
os.environ["DJANGO_ALLOWED_HOSTS"] = "testserver,localhost,127.0.0.1"
os.environ["DJANGO_DEBUG"] = "true"
os.environ["FURGOPLUS_DEMO_MODE"] = "false"
os.environ["DJANGO_TRUST_PROXY_SSL_HEADER"] = "false"

from config.settings import *  # noqa: E402,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
if os.environ.get("TASK12_TEST_POSTGRES") == "true":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "task12_isolated",
            "USER": "task12_test",
            "PASSWORD": "isolated-task12-only",
            "HOST": "127.0.0.1",
            "PORT": "55432",
            "TEST": {"NAME": "test_task12_isolated"},
        }
    }
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
PRIVATE_UPLOAD_ROOT = "/tmp/furgoplus-task12-private"
