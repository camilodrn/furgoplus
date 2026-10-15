"""Exclusive PostgreSQL validation stack; never settings for Debian/provisioning."""

# ruff: noqa: F403
from security_test_settings import *

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "furgoplus_scenario_validation",
        "USER": "scenario_test",
        "HOST": "db",
        "PORT": "5432",
    }
}
