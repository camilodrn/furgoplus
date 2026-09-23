"""Remove old interrupted upload stages and unreferenced opaque files."""

import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from drivers.models import DriverDocument


class Command(BaseCommand):
    help = "Clean old private staged/orphan upload files (default 24 hour grace)."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=24)

    def handle(self, *args, **options):
        if options["hours"] < 1:
            raise ValueError("Grace period must be at least one hour")
        root = Path(settings.PRIVATE_UPLOAD_ROOT)
        if not root.exists():
            return
        known = set(DriverDocument.objects.values_list("storage_key", flat=True))
        cutoff = time.time() - options["hours"] * 3600
        removed = 0
        for item in root.iterdir():
            if (
                not item.is_file()
                or item.is_symlink()
                or item.stat().st_mtime >= cutoff
            ):
                continue
            if item.name.startswith(".stage-") or item.name not in known:
                item.unlink()
                removed += 1
        self.stdout.write(f"Removed {removed} old staged/orphan files")
