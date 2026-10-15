"""Single-origin, synthetic-only homelab configuration; never used by development."""

# ruff: noqa: F403, F405
import os
from ipaddress import ip_address
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


def read_secret(name, minimum_length):
    path = os.getenv(f"{name}_FILE", "")
    if not path or not Path(path).is_absolute():
        raise ImproperlyConfigured(f"Set {name}_FILE to an absolute secret-file path")
    try:
        value = Path(path).read_text().strip()
    except OSError:
        raise ImproperlyConfigured(f"Cannot read {name}_FILE") from None
    if (
        len(value) < minimum_length
        or value.startswith("replace-")
        or any(character.isspace() for character in value)
    ):
        raise ImproperlyConfigured(
            f"{name}_FILE needs a unique, strong single-line value"
        )
    os.environ[name] = value


if os.getenv("DEMO_SYNTHETIC_ONLY") != "true":
    raise ImproperlyConfigured("Acknowledge synthetic-only operation explicitly")

# Fixed deployment boundary; the public host is deliberately not configurable here.
DEMO_HOST = "demo.furgoplus.cl"
os.environ.update(
    FURGOPLUS_DEMO_MODE="true",
    DJANGO_DEBUG="false",
    DJANGO_ALLOWED_HOSTS=DEMO_HOST,
    DJANGO_TRUST_PROXY_SSL_HEADER="true",
    API_PUBLIC_ORIGIN=f"https://{DEMO_HOST}",
    WEB_PUBLIC_ORIGIN=f"https://{DEMO_HOST}",
    PRIVATE_UPLOAD_ROOT="/var/lib/furgoplus/private",
)
read_secret("DJANGO_SECRET_KEY", 50)
read_secret("DB_PASSWORD", 20)

from .settings import *  # noqa: E402

# This deployment never permits public account creation, regardless of caller/role.
DEMO_MODE = True

try:
    DEMO_TRUSTED_PROXY_IP = str(ip_address(os.environ["DEMO_CADDY_IP"]))
except (KeyError, ValueError):
    raise ImproperlyConfigured(
        "Set DEMO_CADDY_IP to Caddy's exact internal IP"
    ) from None

MIDDLEWARE = ["config.demo_proxy.DemoProxyMiddleware", *MIDDLEWARE]
CSRF_TRUSTED_ORIGINS = [f"https://{DEMO_HOST}"]
USE_X_FORWARDED_HOST = False
SESSION_COOKIE_DOMAIN = None
CSRF_COOKIE_DOMAIN = None
SECURE_REFERRER_POLICY = "same-origin"
# Deliberate security.W005 / security.W021: do not extend this demo's HSTS to
# child subdomains or request preload registration.
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
# No Django email delivery, SMTP credentials or external integration for this demo.
EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"
# Existing custom throttles use PostgreSQL; any future DRF IP throttle must use
# the normalized REMOTE_ADDR, never a caller-supplied forwarding chain.
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": 0}
