"""Private interactive provisioning; never called by an HTTP endpoint or startup."""

import getpass
import sys

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction

from accounts.models import DriverProfile, ParentProfile, User


class Command(BaseCommand):
    help = "Privately create a fictional parent/driver in demo mode (interactive only)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--role", required=True, choices=("parent", "driver"))
        parser.add_argument("--display-name", required=True)

    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError("Este comando solo está disponible en modo demo.")
        if options["role"] not in (User.Role.PARENT, User.Role.DRIVER):
            raise CommandError("Este comando no crea administradores.")
        if not sys.stdin.isatty():
            raise CommandError("Usa un terminal interactivo; no pipes ni exec -T.")
        name = options["display_name"].strip()
        if not name or len(name) > 100 or "demo" not in name.lower():
            raise CommandError(
                "Usa un nombre ficticio de hasta 100 caracteres con Demo."
            )
        try:
            email = User.objects.normalize_email(options["email"])
            user = User(email=email, role=options["role"])
            user.full_clean(exclude=["password"])
        except (ValidationError, ValueError):
            raise CommandError(
                "Correo inválido o cuenta existente; no se modifica."
            ) from None
        if email.split("@")[-1] != "example.test":
            raise CommandError("Solo se permiten correos ficticios @example.test.")
        password = getpass.getpass("Contraseña única de demo (sin eco): ")
        confirmation = getpass.getpass("Repite la contraseña: ")
        if password != confirmation:
            raise CommandError("Las contraseñas no coinciden; no se creó la cuenta.")
        try:
            validate_password(password, user)
        except ValidationError:
            raise CommandError(
                "Contraseña insuficiente según los validadores Django."
            ) from None
        try:
            with transaction.atomic():
                user = User.objects.create_user(email, password, role=options["role"])
                profile = (
                    DriverProfile if user.role == User.Role.DRIVER else ParentProfile
                )
                profile.objects.create(user=user, display_name=name)
        except IntegrityError:
            raise CommandError(
                "La cuenta no se creó; revisar el destino sin sobrescribir."
            ) from None
        self.stdout.write(
            "Cuenta ficticia creada; sin sesión ni aprobación automática."
        )
