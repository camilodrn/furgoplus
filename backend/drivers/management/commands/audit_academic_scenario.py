import json
from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from academic_boundary import DATABASE, PROJECT
from drivers.management.commands.prepare_academic_scenario import add_destination


class Command(BaseCommand):
    help = "Read-only academic audit; no login, assistant calls or counter writes."
    requires_system_checks = []

    def add_arguments(self, parser):
        add_destination(parser)

    def handle(self, *args, **options):
        from accounts.models import DriverProfile, User
        from drivers.academic_scenario import check_schema, identity, table_models
        from drivers.capabilities import driver_capabilities
        from drivers.capacity import capacity_snapshot
        from drivers.models import ContactRequest, PaymentRecord, Route, SupportTicket
        from drivers.publication import publication_state
        from drivers.support import tickets

        try:
            identity(options["expect_project"], options["expect_database"])
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
                    )
                    cursor.execute("SET LOCAL statement_timeout = '20s'")
                manifest = check_schema(migrated=True)
                result = {
                    "mode": "READ ONLY",
                    "project": PROJECT,
                    "database": DATABASE,
                    "chile_date": str(timezone.localdate()),
                    "prepared_on": manifest.after_detail["day"] if manifest else None,
                    "accounts": list(
                        User.objects.order_by("id").values(
                            "id",
                            "email",
                            "role",
                            "is_active",
                            "is_staff",
                            "is_superuser",
                        )
                    ),
                    "admin_support_permission": all(
                        u.has_perm("drivers.manage_support")
                        for u in User.objects.filter(role="admin")
                    ),
                    "counts": {
                        table: model.objects.count()
                        for table, model in table_models().items()
                        if model._meta.app_label in {"accounts", "drivers"}
                    },
                    "drivers": [],
                    "contacts": dict(
                        Counter(ContactRequest.objects.values_list("status", flat=True))
                    ),
                    "tickets": list(
                        tickets()
                        .order_by("id")
                        .values(
                            "id",
                            "owner_id",
                            "state",
                            "severity",
                            "priority_at_creation",
                            "priority_rank",
                        )
                    ),
                }
                for driver in DriverProfile.objects.select_related("user").order_by(
                    "pk"
                ):
                    result["drivers"].append(
                        {
                            "id": driver.pk,
                            "capabilities": driver_capabilities(driver.user),
                            "publication_blockers": publication_state(driver).blockers,
                            "routes": [
                                {"id": route.pk, **capacity_snapshot(route)}
                                for route in Route.objects.filter(driver=driver)
                            ],
                            "payments": dict(
                                Counter(
                                    PaymentRecord.objects.filter(
                                        driver=driver
                                    ).values_list("status", flat=True)
                                )
                            ),
                        }
                    )
                # Report actual creation months. No data or clocks are adjusted.
                from django.db.models import Count
                from django.db.models.functions import TruncMonth

                for model in (PaymentRecord, ContactRequest, SupportTicket):
                    result[model._meta.model_name + "_creation_months"] = list(
                        model.objects.annotate(month=TruncMonth("created_at"))
                        .values("month")
                        .annotate(count=Count("pk"))
                        .order_by("month")
                    )
                transaction.set_rollback(True)
            self.stdout.write(
                json.dumps(result, default=str, ensure_ascii=False, indent=2)
            )
        except CommandError:
            raise
        except Exception:
            raise CommandError(
                "Auditoría detenida; destino o esquema no verificado."
            ) from None
