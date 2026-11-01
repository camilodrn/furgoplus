"""Local PostgreSQL inventory only; run via stdin in the VERIFIED backend.

Required: TASK12_AUDIT_EXPECT_DB. Never emits credentials, free text, document
paths or password hashes. PostgreSQL enforces a read-only repeatable snapshot.
This script does not start containers, migrate, authenticate users or seed data.
"""

import json
import os
import sys
from datetime import date


def main():
    expected = os.environ.get("TASK12_AUDIT_EXPECT_DB", "")
    if not expected:
        raise RuntimeError("Expected database is required")
    module = os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    if module != "config.settings":
        raise RuntimeError("Only reviewed local settings are allowed")

    import django

    django.setup()
    from django.conf import settings
    from django.db import connection, transaction
    from django.db.migrations.recorder import MigrationRecorder
    from django.db.models import Count

    from accounts.models import DriverProfile, ParentProfile, User
    from drivers import models as m

    config = settings.DATABASES["default"]
    if (
        connection.vendor != "postgresql"
        or config["NAME"] != expected
        or config["HOST"] not in {"db", "127.0.0.1", "localhost"}
        or "demo.furgoplus.cl" in settings.API_PUBLIC_ORIGIN
        or "demo.furgoplus.cl" in settings.WEB_PUBLIC_ORIGIN
    ):
        raise RuntimeError("Destination does not match the reviewed local boundary")

    result = {"mode": "READ ONLY", "max_rows_per_section": 200}
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
            )
            cursor.execute("SET LOCAL statement_timeout = '20s'")
            cursor.execute(
                "SELECT current_database(), inet_server_addr()::text, "
                "inet_server_port(), pg_postmaster_start_time(), "
                "current_setting('transaction_read_only'), CURRENT_TIMESTAMP"
            )
            result["database"] = dict(
                zip(
                    ("name", "address", "port", "server_started_at", "read_only", "at"),
                    cursor.fetchone(),
                )
            )
        result["settings"] = {
            "module": module,
            "debug": settings.DEBUG,
            "demo_mode": settings.DEMO_MODE,
            "api_origin": settings.API_PUBLIC_ORIGIN,
            "web_origin": settings.WEB_PUBLIC_ORIGIN,
        }
        tables = set(connection.introspection.table_names())

        def inventory(label, model, fields):
            if model._meta.db_table not in tables:
                result[label] = {"available": False}
                return
            qs = model.objects.order_by("pk")
            total = qs.count()
            result[label] = {
                "available": True,
                "total": total,
                "truncated": total > 200,
                "rows": list(qs.values(*fields)[:200]),
            }

        if User._meta.db_table not in tables:
            raise RuntimeError("Accounts schema is missing")
        inventory(
            "accounts", User,
            ("id", "role", "is_active", "is_staff", "is_superuser"),
        )
        # Only the reserved fictional domain can be named in shared evidence.
        for row in result["accounts"]["rows"]:
            user = User.objects.get(pk=row["id"])
            row["synthetic_email"] = (
                user.email if user.email.endswith("@example.test") else "<omitted>"
            )
            row["manage_support"] = user.has_perm("drivers.manage_support")
        result["accounts_by_role"] = list(
            User.objects.values("role", "is_active").annotate(count=Count("pk"))
            .order_by("role", "is_active")
        )
        sections = [
            ("driver_profiles", DriverProfile,
             ("id", "user_id", "status", "publication_requested", "validation_state",
              "current_validation_revision", "approved_revision")),
            ("parent_profiles", ParentProfile, ("id", "user_id")),
            ("plans", m.Plan, ("id", "code")),
            ("subscriptions", m.DriverSubscription,
             ("id", "driver_id", "plan_id", "status", "starts_at", "ends_at")),
            ("communes", m.Commune, ("id", "is_active")),
            ("routes", m.Route,
             ("id", "driver_id", "status", "weekdays", "start_time", "end_time",
              "seat_capacity", "revision")),
            ("coverage", m.RouteCoverage, ("id", "route_id", "commune_id")),
            ("assignments", m.PassengerAssignment,
             ("id", "route_id", "starts_on", "ends_on")),
            ("runs", m.RouteRun,
             ("id", "route_id", "service_date", "state", "seat_capacity_snapshot",
              "started_at", "ended_at")),
            ("payments", m.PaymentRecord,
             ("id", "driver_id", "assignment_id", "status", "amount_clp", "due_on",
              "service_period_start", "service_period_end", "paid_at")),
            ("contacts", m.ContactRequest,
             ("id", "parent_id", "driver_id", "status", "created_at", "resolved_at")),
            ("documents", m.DriverDocument,
             ("id", "driver_id", "kind", "expires_on", "is_current")),
            ("validations", m.DriverValidation,
             ("id", "driver_id", "revision", "state", "reviewed_at", "reviewer_id")),
            ("tickets", m.SupportTicket,
             ("id", "owner_id", "severity", "state", "priority_at_creation", "version",
              "created_at", "updated_at")),
            ("support_events", m.SupportEvent,
             ("id", "ticket_id", "author_id", "author_role", "from_state", "to_state",
              "occurred_at")),
            ("support_usage", m.SupportUsage,
             ("id", "user_id", "action", "window_started_at", "attempts")),
            ("audit", m.AdminActionLog,
             ("id", "actor_id", "action", "target_type", "target_id", "occurred_at")),
        ]
        for args in sections:
            inventory(*args)
        migration_model = MigrationRecorder.Migration
        if migration_model._meta.db_table in tables:
            result["migrations"] = list(
                migration_model.objects.filter(app__in=("accounts", "drivers"))
                .order_by("app", "name").values("app", "name", "applied")
            )

        required = (m.DriverSubscription, m.Plan, m.PaymentRecord, m.RouteRun,
                    m.Route, m.ContactRequest, m.PassengerAssignment, DriverProfile)
        if all(model._meta.db_table in tables for model in required):
            from drivers.capabilities import driver_capabilities
            from drivers.capacity import local_today
            from drivers.reports import queries, summarize

            result["driver_summary"] = []
            for driver in DriverProfile.objects.select_related("user").order_by("pk")[:200]:
                row = {"driver_id": driver.pk, "months": {}}
                if driver.user.is_active and driver.user.role == "driver":
                    row["capabilities"] = driver_capabilities(driver.user)
                for month, start, end in (
                    ("2026-10", date(2026, 10, 1), date(2026, 11, 1)),
                    ("2026-11", date(2026, 11, 1), date(2026, 12, 1)),
                ):
                    row["months"][month] = summarize(queries(driver, start, end))
                result["driver_summary"].append(row)
            result["service_date_chile"] = local_today()

        # End even a successful transaction with ROLLBACK; no persistent writes.
        transaction.set_rollback(True)
    print(json.dumps(result, default=str, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Driver exceptions may contain credentials/host DSNs: never print them.
        print(
            json.dumps({"status": "inventory_not_completed", "error_type": type(error).__name__,
                        "action": "Review destination, schema and access locally; no automatic retry."}),
            file=sys.stderr,
        )
        sys.exit(1)
