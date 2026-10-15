"""Shared database limits for authenticated contact creation, independent of workers."""

import hashlib
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.models import AuthThrottle
from api.auth import Throttled

ACCOUNT_LIMIT = 10
IP_LIMIT = 20
WINDOW = timedelta(hours=1)


def contact_create_rate(user_id, address):
    buckets = {
        hashlib.sha256(f"contact-create:account:{user_id}".encode()).hexdigest(): (
            ACCOUNT_LIMIT
        ),
        hashlib.sha256(f"contact-create:ip:{address}".encode()).hexdigest(): IP_LIMIT,
    }
    exceeded = False
    # Stable acquisition order covers concurrent first inserts and existing rows.
    # This transaction finishes before payload validation or domain writes; even
    # rejected attempts consume both buckets. Never raise 429 inside the atomic block.
    with transaction.atomic():
        for key, limit in sorted(buckets.items()):
            AuthThrottle.objects.get_or_create(
                key=key, defaults={"window_started_at": timezone.now()}
            )
            row = AuthThrottle.objects.select_for_update().get(key=key)
            now = timezone.now()
            if now - row.window_started_at >= WINDOW:
                row.window_started_at = now
                row.attempts = 0
            row.attempts = min(row.attempts + 1, limit + 1)
            row.save(update_fields=["window_started_at", "attempts"])
            exceeded = exceeded or row.attempts > limit
    if exceeded:
        raise Throttled()
