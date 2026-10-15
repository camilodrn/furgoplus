"""Check real Gunicorn config parsing without Django, secrets, sockets or DB."""

import os
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path


def main():
    config = Path(__file__).resolve().with_name("gunicorn.conf.py")
    # A standard-library WSGI callable avoids importing config.settings_demo.
    # Do not inherit GUNICORN_CMD_ARGS, DJANGO_SETTINGS_MODULE or secret paths.
    environment = {
        "PATH": os.defpath,
        "DEMO_CADDY_IP": "172.30.81.2",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONNOUSERSITE": "1",
    }
    subprocess.run(
        [
            sys.executable,
            "-m",
            "gunicorn",
            "--check-config",
            "--config",
            str(config),
            "wsgiref.simple_server:demo_app",
        ],
        env=environment,
        cwd=config.parent,
        check=True,
    )
    print(f"Gunicorn {version('gunicorn')} --check-config: OK (no Django/secrets/DB)")


if __name__ == "__main__":
    main()
