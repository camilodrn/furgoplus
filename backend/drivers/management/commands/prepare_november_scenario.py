from django.core.management.base import BaseCommand

from drivers.november_scenario import SLOTS, prepare


class Command(BaseCommand):
    help = "Prepare the synthetic November scenario on a dedicated Task 16 database."

    def add_arguments(self, parser):
        parser.add_argument("--expect-slot", choices=SLOTS, required=True)
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument("--dry-run", action="store_true")
        mode.add_argument("--apply", action="store_true")

    def handle(self, *args, **options):
        self.stdout.write(prepare(options["expect_slot"], apply=options["apply"]))
