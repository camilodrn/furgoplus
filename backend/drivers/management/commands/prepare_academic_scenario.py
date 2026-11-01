from django.core.management.base import BaseCommand, CommandError

from academic_boundary import DATABASE, PROJECT


def add_destination(parser):
    parser.add_argument("--expect-project", required=True, choices=[PROJECT])
    parser.add_argument("--expect-database", required=True, choices=[DATABASE])


class Command(BaseCommand):
    help = "Prepare exclusively the isolated synthetic Task 12 academic database."
    requires_system_checks = []

    def add_arguments(self, parser):
        add_destination(parser)
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument("--dry-run", action="store_true")
        mode.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        from drivers.academic_scenario import prepare

        self.stdout.write(f"Destino solicitado: {PROJECT} / {DATABASE} · db:5432")
        try:
            result = prepare(
                options["expect_project"],
                options["expect_database"],
                apply=options["apply"],
            )
        except CommandError:
            raise
        except Exception:
            raise CommandError(
                "Preparación detenida; revise identidad, esquema y validaciones."
            ) from None
        self.stdout.write(result)
