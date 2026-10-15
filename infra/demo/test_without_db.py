"""Run only proxy/settings/CSRF tests; no DB setup, secrets, sockets or migrations."""

import sys
import unittest
from pathlib import Path

import django
from django.conf import settings

runner_directory = Path(__file__).resolve().parent
backend_directory = (
    runner_directory
    if (runner_directory / "manage.py").is_file()
    else runner_directory.parents[1] / "backend"
)
sys.path.insert(0, str(backend_directory))
settings.configure(
    SECRET_KEY="nonsecret-placeholder-for-database-free-tests-only",
    ALLOWED_HOSTS=["testserver", "demo.furgoplus.cl"],
    INSTALLED_APPS=[],
    DATABASES={},
    USE_TZ=True,
)
django.setup()
suite = unittest.defaultTestLoader.loadTestsFromName("config.test_demo_proxy")
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())
