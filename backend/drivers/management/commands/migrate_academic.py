from academic_boundary import DATABASE, PROJECT
from django.core.management.base import BaseCommand, CommandError

from drivers.management.commands.prepare_academic_scenario import add_destination


class Command(BaseCommand):
    help = "Migrate ONLY a verified exclusive academic database. Explicit write phase."
    requires_system_checks = []

    def add_arguments(self, parser):
        add_destination(parser)

    def handle(self, *args, **options):
        from drivers.academic_scenario import migrate

        self.stdout.write(f"Destino solicitado: {PROJECT} / {DATABASE} · db:5432")
        try:
            migrate(options["expect_project"], options["expect_database"])
        except CommandError:
            raise
        except Exception:
            raise CommandError(
                "Migración detenida; destino o esquema no verificado."
            ) from None
