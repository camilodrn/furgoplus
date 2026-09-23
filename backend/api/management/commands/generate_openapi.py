import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from api.contracts import openapi_document


class Command(BaseCommand):
    help = "Generate or verify the checked-in OpenAPI contract."

    def add_arguments(self, parser):
        parser.add_argument("--check", action="store_true")

    def handle(self, *args, **options):
        target = Path(__file__).resolve().parents[3] / "openapi.json"
        generated = json.dumps(openapi_document(), indent=2, ensure_ascii=False) + "\n"
        if options["check"]:
            if not target.exists() or target.read_text() != generated:
                raise CommandError("OpenAPI contract has drifted; run generate_openapi")
            self.stdout.write("OpenAPI contract is current")
        else:
            target.write_text(generated)
            self.stdout.write(f"Wrote {target}")
