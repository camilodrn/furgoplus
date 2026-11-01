"""Read-only comparison of the original tree; writes evidence only beside this file."""

import datetime
import hashlib
import json
import subprocess
from pathlib import Path

prototype = Path(__file__).resolve().parents[1]
root = prototype.parents[2]
baseline = json.loads((prototype / "baseline.json").read_text())
changed = []
missing = []
for name, digest in baseline["files"].items():
    path = root / name
    if not path.is_file():
        missing.append(name)
    elif hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        changed.append(name)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=root).decode().strip()


current_files = set(
    git("ls-files", "-c", "-o", "--exclude-standard", "-z").split("\0")
)
additions = sorted(current_files - set(baseline["files"]) - {""})
prefix = str(prototype.relative_to(root)) + "/"
unexpected = [name for name in additions if not name.startswith(prefix)]
head = git("rev-parse", "HEAD")
branch = git("branch", "--show-current")
report = {
    "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "original_files": len(baseline["files"]),
    "original_files_unchanged": len(baseline["files"]) - len(changed) - len(missing),
    "changed_original_files": changed,
    "missing_original_files": missing,
    "unexpected_additions": unexpected,
    "new_prototype_files": additions,
    "same_head": head == baseline["head"],
    "same_branch": branch == baseline["branch"],
    "head": head,
    "branch": branch,
}
report["passed"] = (
    not changed
    and not missing
    and not unexpected
    and report["same_head"]
    and report["same_branch"]
)
(prototype / "evidence/preservation.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
(prototype / "evidence/git-status-after.txt").write_text(git("status", "--short") + "\n")
print(
    json.dumps(
        {key: value for key, value in report.items() if key != "new_prototype_files"},
        indent=2,
    )
)
raise SystemExit(0 if report["passed"] else 1)
