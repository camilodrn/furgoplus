"""Task 16 fixtures for a dedicated, marked PostgreSQL volume."""

import os
from datetime import date, datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import CommandError
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from accounts.models import DriverProfile, ParentProfile, User
from drivers import api, operations_api, publication_api
from drivers.academic_scenario import (
    check_schema,
    document,
    invoke,
    lock_tables,
    passwords,
    readonly,
)
from drivers.capabilities import driver_capabilities
from drivers.models import (
    AdminActionLog,
    Commune,
    ContactRequest,
    DriverDocument,
    Route,
    RouteRun,
)
from drivers.publication import CHILE, WEEKDAYS, publication_state
from drivers.services import CHECKLIST

VERSION = "task16-2026-11-v1"
ACTION = "task16_scenario_prepared"
DB = "furgoplus_task16"
SLOTS = ("rehearsal", "presentation")
ACCOUNTS = (
    ("t16-admin@example.test", "admin", "Administración ficticia Noviembre"),
    ("t16-basic@example.test", "driver", "Conductor ficticio Básico Noviembre"),
    ("t16-pro@example.test", "driver", "Conductor ficticio Pro Noviembre"),
    ("t16-elite@example.test", "driver", "Conductor ficticio Elite Noviembre"),
    ("t16-familia-a@example.test", "parent", "Familia ficticia A"),
    ("t16-familia-b@example.test", "parent", "Familia ficticia B"),
)
COMPARISON_PERIODS = (
    (
        10,
        (("pending", 24000), ("paid", 30000), ("paid", 32000), ("void", 10000)),
        (8, 14, 22),
        ("accepted", "declined", "cancelled"),
    ),
    (
        11,
        (
            ("pending", 32000),
            ("pending", 34000),
            ("paid", 35000),
            ("paid", 36000),
            ("paid", 38000),
            ("void", 12000),
        ),
        (4, 8, 12, 17, 21),
        ("accepted", "declined", "cancelled", "pending", "pending"),
    ),
)
REASON = "Carga sintética para la presentación académica Task 16."


def mobile_email(slot):
    return f"t16-movil-{slot}@example.test"


def verify_destination(slot):
    database = settings.DATABASES["default"]
    if (
        slot not in SLOTS
        or os.environ.get("FURGOPLUS_TASK16_SLOT") != slot
        or settings.SETTINGS_MODULE != "config.settings"
        or not settings.DEMO_MODE
        or not settings.DEMO_REGISTRATION_ENABLED
        or database["ENGINE"] != "django.db.backends.postgresql"
        or database["NAME"] != DB
        or database["USER"] != DB
        or database["HOST"] != "task16-db"
        or str(database["PORT"]) != "5432"
    ):
        raise CommandError("Destino Task 16 no autorizado; sin escrituras.")
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT current_database(), session_user, current_user, "
            "pg_get_userbyid(datdba), inet_server_port(), "
            "shobj_description(oid, 'pg_database') FROM pg_database "
            "WHERE datname = current_database()"
        )
        if cursor.fetchone() != (DB, DB, DB, DB, 5432, f"{VERSION}:{slot}"):
            raise CommandError("PostgreSQL no tiene la marca del escenario solicitado.")


def verify_manifest(manifest, slot):
    meta = manifest.after_detail
    users = meta.get("users", {})
    if (
        meta.get("version") != VERSION
        or meta.get("slot") != slot
        or set(users) != {email for email, _, _ in ACCOUNTS}
        or manifest.actor_id != users[ACCOUNTS[0][0]]
    ):
        raise CommandError("El manifiesto pertenece a otro escenario.")
    for email, role, _ in ACCOUNTS:
        if not User.objects.filter(pk=users[email], email=email, role=role).exists():
            raise CommandError("Falta una cuenta del escenario; no se vuelve a crear.")


def create_accounts(credentials):
    users = []
    for email, role, display_name in ACCOUNTS:
        user = User.objects.create_user(
            email,
            credentials[email],
            role=role,
            is_staff=role == "admin",
            is_superuser=role == "admin",
        )
        if role == "driver":
            DriverProfile.objects.create(user=user, display_name=display_name)
        elif role == "parent":
            ParentProfile.objects.create(user=user, display_name=display_name)
        users.append(user)
    return users


def publish_service(user, admin, plan, now, new_files):
    invoke(
        api.DriverProfileView,
        user,
        "patch",
        {
            "service_summary": "Servicio de demostración con datos ficticios.",
            "service_contact_email": f"t16-servicio-{plan}@example.test",
        },
    )
    for kind, _, expires in CHECKLIST:
        row = invoke(
            api.DriverDocumentsView,
            user,
            "post",
            {
                "kind": kind,
                "file": SimpleUploadedFile(
                    "sintetico-t16.png",
                    document(user.driver_profile.display_name, kind, "TASK 16"),
                    content_type="image/png",
                ),
                **(
                    {
                        "expires_on": (
                            timezone.localdate(now) + timedelta(days=120)
                        ).isoformat()
                    }
                    if expires
                    else {}
                ),
            },
            multipart=True,
        )
        new_files.append(DriverDocument.objects.get(pk=row["id"]).storage_key)
    review = invoke(api.DriverSubmitView, user, "post")
    invoke(
        api.AdminApproveView, admin, "post", {"observations": REASON}, id=review["id"]
    )
    invoke(
        publication_api.AdminSubscriptionView,
        admin,
        "post",
        {
            "plan_code": plan,
            "status": "active",
            "reason": REASON,
            "expected_version": None,
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=90)).isoformat(),
        },
        id=user.driver_profile.pk,
    )


def create_roster(user, plan, sizes):
    routes = []
    assignments = []
    for index, size in enumerate(sizes):
        route = invoke(
            publication_api.RoutesView,
            user,
            "post",
            {
                "label": f"Ruta ficticia {plan} {'mañana' if index == 0 else 'tarde'}",
                "status": "active",
                "weekdays": list(WEEKDAYS),
                "start_time": "07:00" if index == 0 else "15:00",
                "end_time": "08:00" if index == 0 else "16:00",
                "seat_capacity": 12,
                "destination_label": "Escuela ficticia Noviembre",
                "destination_address": "Punto ficticio sin domicilio real",
                "coverage_codes": [f"t16-{plan}"],
            },
        )
        routes.append(Route.objects.get(pk=route["id"]))
        for _ in range(size):
            number = len(assignments) + 1
            assignment = invoke(
                operations_api.AssignmentsView,
                user,
                "post",
                {
                    "route_id": route["id"],
                    "student_display_name": f"Estudiante ficticio {plan} {number:02}",
                    "pickup_instruction": "Punto ficticio de recogida.",
                    "guardian_display_name": "Responsable ficticio",
                    "guardian_contact": "000000000",
                    "starts_on": "2026-10-01",
                    "ends_on": None,
                },
            )
            assignments.append(assignment["id"])
    invoke(
        publication_api.DriverPublicationView,
        user,
        "patch",
        {"publication_requested": True},
    )
    user.driver_profile.refresh_from_db()
    if not publication_state(user.driver_profile).eligible:
        raise CommandError("Servicio ficticio no elegible; se revierte la carga.")
    return routes, assignments


def seed_reports(elite, parents, routes, assignments):
    driver = elite.driver_profile
    for month, payments, runs, contacts in COMPARISON_PERIODS:
        for index, (status, amount) in enumerate(payments):
            payment = invoke(
                operations_api.PaymentsView,
                elite,
                "post",
                {
                    "assignment_id": assignments[index],
                    "service_period_start": date(2026, month, 1).isoformat(),
                    "service_period_end": date(2026, month, 21).isoformat(),
                    "due_on": date(2026, month, 8 + index).isoformat(),
                    "amount_clp": amount,
                },
            )
            if status != "pending":
                invoke(
                    operations_api.PaymentPaidView
                    if status == "paid"
                    else operations_api.PaymentVoidView,
                    elite,
                    "post",
                    id=payment["id"],
                )
        # Deliberate historical fixtures. Regular operation only records real
        # transitions for the current day, so keep these inside the seed.
        for index, day in enumerate(runs):
            route = routes[index % len(routes)]
            service = date(2026, month, day)
            RouteRun.objects.create(
                route=route,
                service_date=service,
                state=RouteRun.State.COMPLETED,
                weekdays_snapshot=route.weekdays,
                start_time_snapshot=route.start_time,
                end_time_snapshot=route.end_time,
                seat_capacity_snapshot=route.seat_capacity,
                destination_label_snapshot=route.destination_label,
                destination_address_snapshot=route.destination_address,
                started_at=datetime.combine(service, route.start_time, CHILE),
                ended_at=datetime.combine(service, route.end_time, CHILE),
            )
        for index, status in enumerate(contacts):
            parent = parents[index % len(parents)]
            received = datetime(2026, month, 4 + index * 3, 10, tzinfo=CHILE)
            ContactRequest.objects.create(
                parent=parent.parent_profile,
                driver=driver,
                driver_display_name_snapshot=driver.display_name,
                message="Consulta ficticia de transporte académico.",
                consented_at=received,
                parent_email_snapshot=parent.email,
                driver_email_snapshot=driver.service_contact_email
                if status == "accepted"
                else None,
                status=status,
                created_at=received,
                resolved_at=received + timedelta(hours=1)
                if status != "pending"
                else None,
            )


def seed(slot, credentials, new_files):
    users = create_accounts(credentials)
    admin, basic, pro, elite, *parents = users
    now = timezone.now()
    for user, plan, sizes in (
        (basic, "basic", (10, 9)),
        (pro, "pro", (3,)),
        (elite, "elite", (4, 3)),
    ):
        Commune.objects.create(
            code=f"t16-{plan}", display_name=f"Comuna ficticia {plan}"
        )
        publish_service(user, admin, plan, now, new_files)
        routes, assignments = create_roster(user, plan, sizes)
    seed_reports(elite, parents, routes, assignments)
    usage = driver_capabilities(basic)["student_usage"]
    if usage["active"] != 19 or usage["available"] != 1:
        raise CommandError(
            "El escenario Básico no cumple 19 de 20; se revierte la carga."
        )
    AdminActionLog.objects.create(
        actor=admin,
        action=ACTION,
        target_type="academic_scenario",
        target_id=admin.pk,
        reason=REASON,
        after_detail={
            "version": VERSION,
            "slot": slot,
            "users": {user.email: user.pk for user in users},
        },
    )


def prepare(slot, *, apply=False):
    verify_destination(slot)

    def manifest():
        return check_schema(
            migrated=True, action=ACTION, verify=lambda row: verify_manifest(row, slot)
        )

    def existing_message():
        status = (
            "ya registrada"
            if User.objects.filter(email=mobile_email(slot)).exists()
            else "sin registrar"
        )
        return f"{VERSION} reconocido en {slot}; sin cambios. Cuenta móvil {status}."

    with readonly():
        if manifest():
            return existing_message()
    if timezone.localdate() < date(2026, 11, 22):
        raise CommandError("La carga se habilita desde el 22 de noviembre de 2026.")
    if not apply:
        return (
            f"DRY-RUN {VERSION} ({slot}): base vacía migrada. "
            "6 cuentas, 29 estudiantes, 5 rutas y dos períodos. Sin escrituras."
        )

    credentials = passwords(ACCOUNTS)
    files = []
    try:
        with transaction.atomic():
            verify_destination(slot)
            lock_tables()
            if manifest():
                return existing_message()
            seed(slot, credentials, files)
    except BaseException:
        # A database rollback cannot undo file writes. Delete only files that
        # this attempt wrote and the database confirms are unreferenced.
        if files:
            try:
                committed = DriverDocument.objects.filter(
                    storage_key__in=files
                ).exists()
            except DatabaseError:
                raise CommandError(
                    "Resultado incierto; conservar archivos y revisar manualmente."
                ) from None
            if not committed:
                for key in files:
                    (Path(settings.PRIVATE_UPLOAD_ROOT) / key).unlink(missing_ok=True)
        raise
    finally:
        credentials.clear()
    return (
        f"{VERSION} preparado en {slot}. "
        f"Cuenta móvil {mobile_email(slot)} sin registrar."
    )
