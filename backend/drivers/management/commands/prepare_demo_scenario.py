"""Explicit console preparation, never startup or a public registration endpoint."""

from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from drivers.demo_scenario import ACCOUNTS, credentials, inspect, prepare


class Command(BaseCommand):
    help = "Prepare the small fictional Task 11 scenario; preserve existing data."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument("--dry-run", action="store_true")
        mode.add_argument("--apply", action="store_true")
        parser.add_argument("--admin-email", default="admin-demo@example.test")

    def handle(self, *args, **options):
        admin = User.objects.filter(email=options["admin_email"]).first()
        if not admin:
            raise CommandError(
                "Administrador existente requerido; no se crea ni cambia."
            )
        plan = inspect(admin)
        self.stdout.write(f"Escenario sintético Task 11 · fecha Chile {plan['day']}")
        if plan["complete"]:
            self.stdout.write(
                "Sin cambios: escenario y archivos verificados. No se reinicia su "
                "historia."
            )
            return
        self.stdout.write(
            "Conservar cuentas, claves y campos de servicio con valor; completar "
            "solo campos vacíos."
        )
        day = date.fromisoformat(plan["day"])
        self.stdout.write(
            f"Pasajeros hasta {day + timedelta(days=60)}; plan hasta "
            f"{day + timedelta(days=90)}; documentos hasta {day + timedelta(days=120)}."
        )
        for email, role, _ in ACCOUNTS:
            action = (
                "conservar"
                if User.objects.filter(email=email).exists()
                else "crear con clave privada única"
            )
            self.stdout.write(f"{email} ({role}): {action}")
        self.stdout.write(
            "Preparar 9 PNG sintéticos/3 revisiones; aprobar A/B y asignar Basic "
            "por las APIs administrativas."
        )
        self.stdout.write(
            "3 rutas, 3 pasajeros ficticios, 1 pago pendiente, 2 contactos "
            "(pendiente y aceptado)."
        )
        self.stdout.write(
            "Control queda pendiente/no publicado. No ejecutar recorridos, pagos ni "
            "contacto principal A/A."
        )
        if options["dry_run"]:
            self.stdout.write(
                "DRY-RUN: sin escrituras, archivos ni solicitud de contraseñas."
            )
            return
        passwords = credentials(admin)
        try:
            prepare(admin, plan, passwords)
        finally:
            passwords.clear()
        self.stdout.write(
            "Escenario preparado y auditado; conservar snapshot antes de la "
            "demostración."
        )
