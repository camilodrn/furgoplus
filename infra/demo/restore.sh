#!/usr/bin/env bash
# Manual rehearsal only: fresh project/volumes; no automatic app start or cleanup.
set -euo pipefail
umask 077
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
exec python3 "$root/infra/demo/recovery.py" restore "$@"
