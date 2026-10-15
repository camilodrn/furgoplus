#!/usr/bin/env bash
# Manual operation, delegated to the shared, testable recovery driver.
set -euo pipefail
umask 077
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
exec python3 "$root/infra/demo/recovery.py" backup "$@"
