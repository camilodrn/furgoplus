"""Private Task 12 orchestrator; existing API views enforce domain transitions."""

import getpass
import hashlib
import io
import re
import sys
import uuid
import warnings
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import CommandError
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
from PIL import Image, ImageDraw
from rest_framework.test import APIRequestFactory, force_authenticate

from academic_boundary import (
    DATABASE,
    PROJECT,
    VERSION,
    verify_configuration,
    verify_server,
)
from accounts.models import DriverProfile, ParentProfile, User
from drivers import api, contact_api, operations_api, publication_api, support_api
from drivers.capabilities import driver_capabilities
from drivers.models import AdminActionLog, Commune, DriverDocument, Plan
from drivers.publication import WEEKDAYS, publication_state
from drivers.services import CHECKLIST

ACCOUNTS = (
    ("t12-admin@example.test", "admin", "Administrador ficticio T12"),
    ("t12-basic@example.test", "driver", "Conductor ficticio Básico T12"),
    ("t12-pro@example.test", "driver", "Conductor ficticio Pro T12"),
    ("t12-elite@example.test", "driver", "Conductor ficticio Elite T12"),
    ("t12-parent@example.test", "parent", "Apoderado ficticio T12"),
)
REASON = "Escenario académico T12 exclusivamente sintético."
ACTION = "academic_scenario_prepared"
BASELINE_TABLES = {
    "django_migrations",
    "django_content_type",
    "auth_permission",
    "drivers_plan",
}


def identity(expected_project, expected_database):
    db = settings.DATABASES["default"]
    config = {
        "module": settings.SETTINGS_MODULE,
        "environment": getattr(settings, "FURGOPLUS_ENVIRONMENT", None),
        "project": getattr(settings, "ACADEMIC_PROJECT", None),
        "debug": settings.DEBUG,
        "demo": settings.DEMO_MODE,
        "engine": db["ENGINE"],
        "database": db["NAME"],
        "user": db.get("USER"),
        "host": db.get("HOST"),
        "port": str(db.get("PORT")),
        "api_origin": settings.API_PUBLIC_ORIGIN,
        "web_origin": settings.WEB_PUBLIC_ORIGIN,
    }
    try:
        # This check runs before any database connection.
        verify_configuration(config, expected_project, expected_database)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT current_database(), session_user, current_user, "
                "pg_get_userbyid(datdba), inet_server_port(), "
                "shobj_description(oid, 'pg_database') FROM pg_database "
                "WHERE datname = current_database()"
            )
            verify_server(cursor.fetchone(), settings.ACADEMIC_IDENTITY)
    except (ValueError, AttributeError):
        raise CommandError("Identidad académica rechazada; sin escrituras.") from None


def table_models():
    return {
        m._meta.db_table: m
        for m in apps.get_models(include_auto_created=True)
        if m._meta.managed and not m._meta.proxy
    }


def check_schema(*, migrated):
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' "
                "AND nspname <> 'information_schema'"
            )
            if {row[0] for row in cursor.fetchall()} != {"public"}:
                raise CommandError("Esquemas desconocidos o compartidos.")
    tables = set(connection.introspection.table_names(include_views=True))
    if tables - (set(table_models()) | {"django_migrations"}):
        raise CommandError("Tablas desconocidas o compartidas; operación rechazada.")
    if migrated:
        executor = MigrationExecutor(connection)
        if executor.migration_plan(executor.loader.graph.leaf_nodes()):
            raise CommandError("Faltan migraciones académicas; ejecutar fase migrate.")
    manifest = None
    if AdminActionLog._meta.db_table in tables:
        rows = AdminActionLog.objects.filter(action=ACTION)
        if rows.count() > 1:
            raise CommandError("Manifiesto académico ambiguo.")
        manifest = rows.first()
    if manifest:
        verify_manifest(manifest)
        return manifest
    # A new destination can contain ONLY standard migration metadata and plans.
    with connection.cursor() as cursor:
        for table in sorted(tables - BASELINE_TABLES):
            cursor.execute(
                f"SELECT EXISTS (SELECT 1 FROM {connection.ops.quote_name(table)})"
            )
            if cursor.fetchone()[0]:
                raise CommandError(
                    "Base no vacía sin manifiesto; no se adopta ni modifica."
                )
    if "drivers_plan" in tables and set(
        Plan.objects.values_list("code", "display_label")
    ) != {("basic", "Basic"), ("pro", "Pro"), ("elite", "Elite")}:
        raise CommandError("Catálogo ajeno a las migraciones revisadas.")
    return None


def verify_manifest(manifest):
    meta = manifest.after_detail
    if (
        meta.get("version") != VERSION
        or meta.get("project") != PROJECT
        or meta.get("database") != DATABASE
        or meta.get("identity_digest")
        != hashlib.sha256(settings.ACADEMIC_IDENTITY.encode()).hexdigest()
    ):
        raise CommandError("Manifiesto de otro escenario o volumen.")
    expected = meta.get("users", {})
    if set(expected) != {a[0] for a in ACCOUNTS}:
        raise CommandError("Cuentas del manifiesto incompletas.")
    actual = {u.email: u for u in User.objects.all()}
    if set(actual) != set(expected):
        raise CommandError("Base compartida con cuentas ajenas; no se modifica.")
    for email, role, _ in ACCOUNTS:
        if actual[email].pk != expected[email] or actual[email].role != role:
            raise CommandError("Identidad de cuenta alterada; no se restaura.")
    if manifest.actor_id != expected[ACCOUNTS[0][0]]:
        raise CommandError("Autor del manifiesto incompatible.")
    for profile in DriverProfile.objects.select_related("user"):
        if profile.user.role != "driver":
            raise CommandError("Perfil de conductor ajeno al escenario.")
    for profile in ParentProfile.objects.select_related("user"):
        if profile.user.role != "parent":
            raise CommandError("Perfil de apoderado ajeno al escenario.")
    if set(Commune.objects.values_list("code", flat=True)) != {"t12-norte", "t12-sur"}:
        raise CommandError("Catálogo de comunas compartido o alterado.")
    models = table_models()
    baseline = meta.get("baseline", {})
    if set(baseline) != {
        table
        for table, model in models.items()
        if model._meta.app_label in {"accounts", "drivers"}
    }:
        raise CommandError("Manifiesto de recursos incompleto.")
    for table, ids in baseline.items():
        if table not in models or models[table].objects.filter(
            pk__in=ids
        ).count() != len(ids):
            raise CommandError("Faltan recursos del escenario; no se reconstruyen.")
    for row in DriverDocument.objects.all():
        if not re.fullmatch(r"[a-f0-9]{32}\.png", row.storage_key):
            raise CommandError("Documento académico con ruta inesperada.")
        path = Path(settings.PRIVATE_UPLOAD_ROOT) / row.storage_key
        if (
            not path.is_file()
            or path.is_symlink()
            or hashlib.sha256(path.read_bytes()).hexdigest() != row.sha256
        ):
            raise CommandError("Documento ausente o alterado; no se reemplaza.")
    # Account, password, subscription and operational changes are NEVER restored.


def lock_tables():
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [12111211])
    tables = sorted(set(connection.introspection.table_names()))
    if tables:
        with connection.cursor() as cursor:
            cursor.execute(
                "LOCK TABLE "
                + ", ".join(connection.ops.quote_name(t) for t in tables)
                + " IN SHARE ROW EXCLUSIVE MODE"
            )


@contextmanager
def readonly():
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cursor.execute("SET LOCAL statement_timeout = '20s'")
        yield
        transaction.set_rollback(True)


def initial_day():
    day = timezone.localdate()
    if (day.year, day.month) != (2026, 10):
        raise CommandError(
            "La primera carga T12 requiere octubre de 2026 real en Chile; "
            "no se retrofechan datos. Revisar un nuevo escenario fuera de ese mes."
        )
    return day


def passwords():
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        raise CommandError(
            "Use terminal privada interactiva, sin -T, pipes ni registros."
        )
    result = {}
    for email, role, _ in ACCOUNTS:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                password = getpass.getpass(
                    f"Clave NUEVA exclusiva para {email} (sin eco): "
                )
                confirmation = getpass.getpass("Repite la clave: ")
        except (getpass.GetPassWarning, OSError, EOFError):
            raise CommandError(
                "No se puede garantizar entrada sin eco; operación cancelada."
            ) from None
        if password != confirmation or password in result.values():
            raise CommandError(
                "Claves distintas por cuenta y confirmación coincidente requeridas."
            )
        try:
            validate_password(password, User(email=email, role=role))
        except ValidationError:
            raise CommandError("Clave insuficiente; ninguna cuenta creada.") from None
        result[email] = password
    return result


def invoke(view, actor, method, data=None, *, id=None, multipart=False):
    request = getattr(APIRequestFactory(), method)(
        "/api/v1/",
        data or {},
        format="multipart" if multipart else "json",
        HTTP_HOST="127.0.0.1:18082",
    )
    force_authenticate(request, user=actor)
    response = view.as_view()(request, **({"id": id} if id is not None else {}))
    if response.status_code not in (200, 201):
        # Never print payloads, hashes, free text or exceptions containing secrets.
        raise CommandError(
            f"Validación {view.__name__} rechazada ({response.status_code})."
        )
    return response.data


def document(name, kind):
    image = Image.new("RGB", (960, 280), "white")
    draw = ImageDraw.Draw(image)
    draw.text((24, 35), "DOCUMENTO SINTETICO - NO VALIDO - TASK 12", fill="black")
    draw.text((24, 100), name, fill="black")
    draw.text((24, 170), kind, fill="black")
    stream = io.BytesIO()
    image.save(stream, "PNG")
    return stream.getvalue()


def seed(day, credentials, new_files):
    users = []
    for email, role, name in ACCOUNTS:
        user = User(
            email=email,
            role=role,
            is_staff=role == "admin",
            is_superuser=role == "admin",
        )
        user.set_password(credentials[email])
        user.full_clean()
        user.save(force_insert=True)
        if role == "driver":
            DriverProfile.objects.create(user=user, display_name=name)
        elif role == "parent":
            ParentProfile.objects.create(user=user, display_name=name)
        users.append(user)
    admin, basic, pro, elite, parent = users
    for code in ("norte", "sur"):
        row = Commune(code=f"t12-{code}", display_name=f"Comuna ficticia T12 {code}")
        row.full_clean()
        row.save(force_insert=True)
    now = timezone.now()
    for index, (user, plan) in enumerate(
        zip((basic, pro, elite), ("basic", "pro", "elite"), strict=True)
    ):
        invoke(
            api.DriverProfileView,
            user,
            "patch",
            {
                "service_summary": (
                    "Servicio académico ficticio T12. Sin transporte real."
                ),
                "service_contact_email": f"t12-servicio-{plan}@example.test",
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
                        "sintetico-t12.png",
                        document(user.driver_profile.display_name, kind),
                        content_type="image/png",
                    ),
                    **(
                        {"expires_on": (day + timedelta(days=120)).isoformat()}
                        if expires
                        else {}
                    ),
                },
                multipart=True,
            )
            new_files.append(DriverDocument.objects.get(pk=row["id"]).storage_key)
        validation = invoke(api.DriverSubmitView, user, "post")
        invoke(
            api.AdminApproveView,
            admin,
            "post",
            {"observations": REASON},
            id=validation["id"],
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
        route = invoke(
            publication_api.RoutesView,
            user,
            "post",
            {
                "label": f"Ruta ficticia T12 {plan}",
                "status": "active",
                "weekdays": list(WEEKDAYS),
                "start_time": "07:00",
                "end_time": "08:00",
                "seat_capacity": 4,
                "destination_label": "Escuela ficticia T12",
                "destination_address": "Parada sintética T12 sin domicilio real",
                "coverage_codes": ["t12-norte", "t12-sur"],
            },
        )
        for number, status in enumerate(("pending", "paid", "void"), start=1):
            assignment = invoke(
                operations_api.AssignmentsView,
                user,
                "post",
                {
                    "route_id": route["id"],
                    "student_display_name": f"Pasajero ficticio {plan} {number}",
                    "pickup_instruction": "Parada ficticia T12 sin domicilio real",
                    "guardian_display_name": ACCOUNTS[4][2],
                    "guardian_contact": "000000000",
                    "starts_on": day.isoformat(),
                    "ends_on": (day + timedelta(days=60)).isoformat(),
                },
            )
            payment = invoke(
                operations_api.PaymentsView,
                user,
                "post",
                {
                    "assignment_id": assignment["id"],
                    "service_period_start": day.isoformat(),
                    "service_period_end": day.isoformat(),
                    "due_on": day.isoformat(),
                    "amount_clp": 10000 * (index + 1),
                },
            )
            if status != "pending":
                invoke(
                    operations_api.PaymentPaidView
                    if status == "paid"
                    else operations_api.PaymentVoidView,
                    user,
                    "post",
                    id=payment["id"],
                )
        invoke(
            publication_api.DriverPublicationView,
            user,
            "patch",
            {"publication_requested": True},
        )
        user.driver_profile.refresh_from_db()
        if not publication_state(user.driver_profile).eligible:
            raise CommandError("Servicio no elegible; se revierte la carga.")
        caps = driver_capabilities(user)
        if caps["blockers"] or caps["plan"]["code"] != plan:
            raise CommandError(
                "Capacidades o vigencia incompatibles; se revierte la carga."
            )
    for user, state in (
        (basic, "pending"),
        (pro, "accepted"),
        (elite, "declined"),
        (elite, "cancelled"),
    ):
        contact = invoke(
            contact_api.ParentRequestsView,
            parent,
            "post",
            {
                "driver_id": user.driver_profile.pk,
                "message": "Consulta ficticia académica T12.",
                "consent_share_email": True,
            },
        )
        if state != "pending":
            view, actor = {
                "accepted": (contact_api.DriverAcceptView, user),
                "declined": (contact_api.DriverDeclineView, user),
                "cancelled": (contact_api.ParentCancelView, parent),
            }[state]
            invoke(view, actor, "post", id=contact["id"])
    for owner, transitions, severity in (
        (basic, (), 3),
        (pro, ("in_progress",), 3),
        (elite, ("waiting_user",), 3),
        (parent, ("resolved",), 2),
        (elite, ("resolved", "closed"), 4),
        (basic, (), 1),
    ):
        ticket = invoke(
            support_api.TicketsView,
            owner,
            "post",
            {
                "subject": "Consulta ficticia académica",
                "body": "Prueba sintética del centro de ayuda.",
                "severity": severity,
                "privacy_confirmed": True,
            },
        )
        for state in transitions:
            ticket = invoke(
                support_api.AdminTicketDetailView,
                admin,
                "post",
                {
                    "body": "Respuesta ficticia administrativa.",
                    "state": state,
                    "reason": "Demostración académica sintética.",
                    "expected_version": ticket["version"],
                },
                id=ticket["id"],
            )
    baseline = {
        table: list(model.objects.values_list("pk", flat=True))
        for table, model in table_models().items()
        if model._meta.app_label in {"accounts", "drivers"}
    }
    AdminActionLog.objects.create(
        actor=admin,
        action=ACTION,
        target_type="academic_scenario",
        target_id=admin.pk,
        correlation_id=str(uuid.uuid4()),
        reason=REASON,
        after_detail={
            "version": VERSION,
            "project": PROJECT,
            "database": DATABASE,
            "identity_digest": hashlib.sha256(
                settings.ACADEMIC_IDENTITY.encode()
            ).hexdigest(),
            "day": day.isoformat(),
            "users": {u.email: u.pk for u in users},
            "baseline": baseline,
        },
    )


def prepare(expected_project, expected_database, *, apply=False):
    identity(expected_project, expected_database)
    with readonly():
        existing = check_schema(migrated=True)
        if existing:
            return (
                "Escenario reconocido; sin cambios. "
                "Auditar vigencias y capacidades actuales."
            )
        day = initial_day()
    if not apply:
        return (
            f"DRY-RUN {day}: destino vacío verificado; 5 cuentas, "
            "3 planes/servicios/rutas, 9 pasajeros/pagos, 4 contactos, 6 tickets. "
            "Sin escrituras ni claves solicitadas."
        )
    credentials = passwords()
    new_files = []
    try:
        with transaction.atomic():
            identity(expected_project, expected_database)
            lock_tables()
            # Prevent a race with another seed or application write during prompts.
            if check_schema(migrated=True):
                return "Escenario reconocido durante espera; sin cambios."
            if initial_day() != day:
                raise CommandError(
                    "Cambió la fecha durante la provisión; repetir dry-run."
                )
            seed(day, credentials, new_files)
            if initial_day() != day:
                raise CommandError("Cambió la fecha durante la carga; se revierte.")
        return "Escenario académico preparado. Ejecutar auditoría de solo lectura."
    except BaseException:
        # Rollback does not undo files. Delete only THIS failed attempt's files.
        # If commit outcome is uncertain, retain files for operator review.
        try:
            committed = DriverDocument.objects.filter(
                storage_key__in=new_files
            ).exists()
        except Exception:
            raise CommandError(
                "Resultado incierto; conservar archivos y revisar manualmente."
            ) from None
        if not committed:
            for key in new_files:
                (Path(settings.PRIVATE_UPLOAD_ROOT) / key).unlink(missing_ok=True)
        raise
    finally:
        credentials.clear()


def migrate(expected_project, expected_database):
    from django.core.management import call_command

    identity(expected_project, expected_database)
    with transaction.atomic():
        lock_tables()
        check_schema(migrated=False)
        call_command("migrate", interactive=False, verbosity=1)
