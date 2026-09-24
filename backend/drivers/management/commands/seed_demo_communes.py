"""Synthetic catalog for local acceptance while product question Q1 is unresolved."""

from django.core.management.base import BaseCommand

from drivers.models import Commune


class Command(BaseCommand):
    help = "Seed explicitly synthetic commune names for a local demo only"

    def handle(self, *args, **options):
        for code, name in (
            ("demo-norte", "Comuna Demo Norte"),
            ("demo-sur", "Comuna Demo Sur"),
        ):
            Commune.objects.update_or_create(
                code=code, defaults={"display_name": name, "is_active": True}
            )
        self.stdout.write(
            "Catálogo sintético demo listo; no es política de comunas de producción."
        )
