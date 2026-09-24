"""Explicit fictional-only review fixture for a local demonstration."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import DriverProfile, ParentProfile, User
from drivers.models import Review


class Command(BaseCommand):
    help = "Add synthetic reviews to one demo driver; never runs automatically."

    def add_arguments(self, parser):
        parser.add_argument("driver_id", type=int)
        parser.add_argument("--demo", action="store_true")

    def handle(self, *args, **options):
        if not options["demo"]:
            raise CommandError("Pass --demo to acknowledge synthetic fixture creation.")
        driver = DriverProfile.objects.filter(pk=options["driver_id"]).first()
        if driver is None or "demo" not in driver.display_name.lower():
            raise CommandError(
                "Choose an existing fictional driver with Demo in its display name."
            )
        with transaction.atomic():
            for number, score, text in [
                (1, 5, "Servicio de demostración"),
                (2, 4, "Ejemplo sintético"),
            ]:
                email = f"review-demo-{driver.pk}-{number}@example.test"
                user, _ = User.objects.get_or_create(
                    email=email, defaults={"role": User.Role.PARENT, "is_active": False}
                )
                if user.has_usable_password():
                    user.set_unusable_password()
                    user.is_active = False
                    user.save(update_fields=["password", "is_active"])
                parent, _ = ParentProfile.objects.get_or_create(
                    user=user, defaults={"display_name": f"Familia Demo {number}"}
                )
                Review.objects.get_or_create(
                    parent=parent,
                    driver=driver,
                    defaults={
                        "score": score,
                        "text": text,
                        "status": Review.Status.PUBLISHED,
                        "is_demo": True,
                    },
                )
        self.stdout.write(
            self.style.SUCCESS("Reseñas sintéticas creadas para demostración.")
        )
