"""Create fresh private local secrets. No Docker, network or database operations."""

import getpass
import os
import secrets
import sys
from pathlib import Path


def directory():
    return Path.home() / ".local/share/furgoplus/task12-academic"


def main():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise ValueError("Use una terminal privada, sin pipes ni captura de sesión.")
    if input("Escribe furgoplus-task12-academic para generar secretos NUEVOS: ") != (
        "furgoplus-task12-academic"
    ):
        raise ValueError("Provisión cancelada.")
    root = directory()
    if root.exists() or root.is_symlink():
        raise ValueError(
            "Directorio existente: se conserva; no se regenera ni reemplaza."
        )
    # The acknowledgement is interactive; generated credentials never leave files.
    getpass.getpass("Pulsa Enter para generar secretos sin mostrarlos: ")
    previous_mask = os.umask(0o077)
    try:
        root.mkdir(parents=True, mode=0o700)
        for name in ("db_password", "django_secret_key", "academic_identity"):
            with (root / name).open("x") as stream:
                stream.write(secrets.token_hex(32) + "\n")
        # PostgreSQL's init hook runs as postgres, not root. This non-password marker
        # must be readable inside its mount; the host directory stays strictly 0700.
        (root / "academic_identity").chmod(0o644)
    finally:
        os.umask(previous_mask)
    print(f"Secretos exclusivos creados en {root}; conservar y no versionar.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, EOFError):
        sys.exit(
            "Provisión detenida. Revise terminal y directorio privado; sin reemplazos."
        )
