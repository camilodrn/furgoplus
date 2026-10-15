"""Read-only DB/file checkpoint; pipe into an isolated backend's `python -`.

Use only as documented in docs/BACKUP_RESTORE.md, with clients/writers stopped.
Hashes cover every model table (including sessions, audit and M2M tables) and
every private file. Output contains counts/digests, never credentials or bytes.
This is not a backup, an authorization test, or a production integrity monitor.
"""

import hashlib
import json
import os
import stat
from pathlib import Path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402
from django.conf import settings  # noqa: E402
from django.core.serializers.json import DjangoJSONEncoder  # noqa: E402

from drivers.models import DriverDocument  # noqa: E402


def digest(value):
    return hashlib.sha256(
        json.dumps(value, cls=DjangoJSONEncoder, sort_keys=True).encode()
    ).hexdigest()


tables = {}
for model in sorted(
    apps.get_models(include_auto_created=True), key=lambda item: item._meta.label_lower
):
    rows = list(model._base_manager.order_by(model._meta.pk.name).values())
    tables[model._meta.label_lower] = {"count": len(rows), "sha256": digest(rows)}

root = Path(settings.PRIVATE_UPLOAD_ROOT)
assert root.is_dir() and not root.is_symlink(), "Missing/private root is unsafe"
root_mode = stat.S_IMODE(root.stat().st_mode)
if root_mode != 0o700:
    raise RuntimeError("Private root mode must be exactly 0700")
files = {}
for path in sorted(root.rglob("*")):
    assert not path.is_symlink(), "Unexpected symlink in private storage"
    if path.is_file():
        file_stat = path.stat()
        file_mode = stat.S_IMODE(file_stat.st_mode)
        if file_mode != 0o600:
            raise RuntimeError("Private regular file mode must be exactly 0600")
        files[str(path.relative_to(root))] = {
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "size": file_stat.st_size,
            "mode": file_mode,
        }

documents = list(DriverDocument.objects.all())
assert documents, "Prepare synthetic uploaded documents before taking a checkpoint"
for document in documents:
    item = files.get(document.storage_key)
    assert item is not None, "Referenced private document is missing"
    assert item["size"] == document.byte_size, "Private document size mismatch"
    assert item["sha256"] == document.sha256, "Private document checksum mismatch"

print(
    json.dumps(
        {
            "tables": tables,
            "private_files": {
                "count": len(files),
                "sha256": digest(files),
                "root_mode": root_mode,
            },
        },
        sort_keys=True,
        indent=2,
    )
)
