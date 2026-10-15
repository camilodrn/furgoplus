"""Small, private scenario orchestrator. Domain writes use the existing API views.

No HTTP endpoint imports this module. A trusted console operator selects the audit
administrator; force_authenticate is only the internal adapter, not a public bypass.
"""

import getpass
import hashlib
import json
import re
import sys
import uuid
from datetime import datetime, time, timedelta
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import CommandError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import DriverProfile, ParentProfile, User
from drivers import api, contact_api, operations_api, publication_api
from drivers.models import (
    AdminActionLog,
    Commune,
    ContactRequest,
    DriverDocument,
    DriverSubscription,
    DriverValidation,
    PassengerAssignment,
    PaymentRecord,
    Plan,
    Route,
    RouteCoverage,
    RouteRun,
    ValidationDocument,
)
from drivers.publication import CHILE, WEEKDAYS, publication_state
from drivers.services import CHECKLIST

VERSION = "task11-scenario-v1"
LABEL = "DOCUMENTO SINTÉTICO — NO VÁLIDO"
ACCOUNTS = (
    ("driver-demo-a@example.test", "driver", "Conductor Demo A"),
    ("driver-demo-b@example.test", "driver", "Conductor Demo B"),
    ("driver-control@example.test", "driver", "Conductor Demo Control"),
    ("parent-demo@example.test", "parent", "Familia Demo A"),
    ("parent-backup@example.test", "parent", "Familia Demo B"),
)
REASON = "Escenario académico Task 11: datos y documentos sintéticos, sin validez real."


def png_document(name, kind):
    image = Image.new("RGB", (960, 280), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=28)
    # Pillow's bundled font lacks these Unicode glyphs in the slim image. Draw
    # Latin bases plus acute strokes and an em dash so the exact visible warning
    # survives without OS font packages or replacement squares.
    x = 24.0
    for character in LABEL:
        if character == "—":
            draw.line((x + 2, 53, x + 26, 53), fill="black", width=2)
            x += 28
            continue
        base = {"É": "E", "Á": "A"}.get(character, character)
        width = draw.textlength(base, font=font)
        draw.text((x, 35), base, fill="black", font=font)
        if character in ("É", "Á"):
            draw.line((x + width * 0.4, 38, x + width * 0.7, 34), fill="black", width=2)
        x += width
    draw.text((24, 110), name, fill="black", font=font)
    draw.text((24, 175), kind, fill="black", font=ImageFont.load_default(size=20))
    meta = PngImagePlugin.PngInfo()
    meta.add_text("Description", LABEL)
    meta.add_text("Scenario", VERSION)
    stream = BytesIO()
    image.save(stream, "PNG", pnginfo=meta)
    return stream.getvalue()


def invoke(view, actor, method, data=None, *, id=None, multipart=False):
    factory = APIRequestFactory()
    request = getattr(factory, method)(
        "/api/v1/", data or {}, format="multipart" if multipart else "json"
    )
    force_authenticate(request, user=actor)
    response = view.as_view()(request, **({"id": id} if id is not None else {}))
    if response.status_code not in (200, 201):
        code = (
            response.data.get("code", "rechazo")
            if isinstance(response.data, dict)
            else "rechazo"
        )
        raise CommandError(
            f"{view.__name__}: {response.status_code}/{code}; operación detenida."
        )
    return response.data


def fingerprint(obj):
    # Never serialize password hashes, login timestamps or arbitrary account groups.
    ignored = {"password", "last_login", "created_at", "updated_at", "date_joined"}
    fields = {
        f.attname: getattr(obj, f.attname)
        for f in obj._meta.concrete_fields
        if f.name not in ignored
    }
    return hashlib.sha256(
        json.dumps(fields, sort_keys=True, cls=DjangoJSONEncoder).encode()
    ).hexdigest()


def resources():
    users = User.objects.filter(email__in=[entry[0] for entry in ACCOUNTS])
    drivers = DriverProfile.objects.filter(user__in=users)
    parents = ParentProfile.objects.filter(user__in=users)
    return [
        *users,
        *drivers,
        *parents,
        *Commune.objects.filter(code__in=("demo-norte", "demo-sur")),
        *Plan.objects.filter(code="basic"),
        *DriverDocument.objects.filter(driver__in=drivers),
        *DriverValidation.objects.filter(driver__in=drivers),
        *ValidationDocument.objects.filter(validation__driver__in=drivers),
        *DriverSubscription.objects.filter(driver__in=drivers),
        *Route.objects.filter(driver__in=drivers),
        *RouteCoverage.objects.filter(route__driver__in=drivers),
        *PassengerAssignment.objects.filter(route__driver__in=drivers),
        *PaymentRecord.objects.filter(driver__in=drivers),
        *RouteRun.objects.filter(route__driver__in=drivers),
        *ContactRequest.objects.filter(Q(driver__in=drivers) | Q(parent__in=parents)),
    ]


def snapshot():
    return sorted(
        [
            {"model": row._meta.label, "id": row.pk, "hash": fingerprint(row)}
            for row in resources()
        ],
        key=lambda item: (item["model"], item["id"]),
    )


def inspect(admin):
    if not settings.DEMO_MODE:
        raise CommandError("Solo se permite preparar escenarios en modo demo.")
    if not (
        admin.role == "admin"
        and admin.is_staff
        and admin.is_active
        and admin.email.endswith("@example.test")
    ):
        raise CommandError(
            "Se requiere un administrador activo con staff; no se crea ni modifica."
        )
    if not Plan.objects.filter(code="basic").exists():
        raise CommandError(
            "Falta el catálogo Basic de migración; revisar sin crear planes a mano."
        )
    today = timezone.localtime(timezone.now(), CHILE).date()
    manifest = AdminActionLog.objects.filter(
        action="demo_scenario_prepared", target_type="demo_scenario"
    ).last()
    if manifest:
        meta = manifest.after_detail
        if meta.get("version") != VERSION or meta.get("objects") != snapshot():
            raise CommandError(
                "Conflicto: escenario modificado o versión distinta; no se reinicia "
                "ni sobrescribe."
            )
        if today.isoformat() > meta["valid_until"]:
            raise CommandError(
                "Vigencia del escenario terminada; renovar mediante transiciones "
                "revisadas, no reset."
            )
        for document in DriverDocument.objects.filter(
            driver__user__email__in=[row[0] for row in ACCOUNTS]
        ):
            if not re.fullmatch(r"[a-f0-9]{32}\.png", document.storage_key):
                raise CommandError("Archivo del escenario inesperado.")
            path = Path(settings.PRIVATE_UPLOAD_ROOT) / document.storage_key
            if (
                not path.is_file()
                or path.is_symlink()
                or hashlib.sha256(path.read_bytes()).hexdigest() != document.sha256
            ):
                raise CommandError(
                    "Archivo del escenario ausente o alterado; no se reemplaza."
                )
        return {"complete": True, "day": meta["day"], "state": snapshot()}
    allowed = {
        "accounts.User",
        "accounts.DriverProfile",
        "accounts.ParentProfile",
        "drivers.Commune",
        "drivers.Plan",
    }
    if any(row._meta.label not in allowed for row in resources()):
        raise CommandError(
            "Existen documentos, revisiones u operaciones sin manifiesto; revisión "
            "manual requerida."
        )
    for email, role, _ in ACCOUNTS:
        user = User.objects.filter(email=email).first()
        if not user:
            continue
        if (
            user.role != role
            or not user.is_active
            or user.is_staff
            or user.is_superuser
            or not user.has_usable_password()
        ):
            raise CommandError(
                "Cuenta demo existente incompatible; no se cambia rol, clave ni "
                "actividad."
            )
        model = DriverProfile if role == "driver" else ParentProfile
        profile = model.objects.filter(user=user).first()
        if not profile or (
            profile.display_name and "demo" not in profile.display_name.lower()
        ):
            raise CommandError(
                "Perfil existente incompatible; revisar sin sobrescribir."
            )
        if role == "driver" and (
            profile.status != "active"
            or profile.validation_state != "draft"
            or profile.approved_revision is not None
            or (
                profile.service_contact_email
                and not profile.service_contact_email.endswith("@example.test")
            )
        ):
            raise CommandError(
                "Estado/correo del conductor incompatible con preparación inicial "
                "sintética."
            )
    for commune in Commune.objects.filter(code__in=("demo-norte", "demo-sur")):
        if not commune.is_active or "demo" not in commune.display_name.lower():
            raise CommandError("Comuna demo incompatible; no se activa ni renombra.")
    return {"complete": False, "day": today.isoformat(), "state": snapshot()}


def credentials(admin):
    missing = [
        row for row in ACCOUNTS if not User.objects.filter(email=row[0]).exists()
    ]
    if missing and not sys.stdin.isatty():
        raise CommandError(
            "Las cuentas nuevas requieren terminal privado (sin -T, pipes ni claves "
            "de entorno)."
        )
    existing = list(
        User.objects.filter(email__in=[row[0] for row in ACCOUNTS] + [admin.email])
    )
    passwords = {}
    for email, role, _ in missing:
        password = getpass.getpass(f"Clave única para {email} (sin eco): ")
        confirmation = getpass.getpass("Repite la clave: ")
        if (
            password != confirmation
            or password in passwords.values()
            or any(check_password(password, user.password) for user in existing)
        ):
            raise CommandError(
                "Claves no coincidentes o reutilizadas; no se escribió ningún dato."
            )
        try:
            validate_password(password, User(email=email, role=role))
        except ValidationError:
            raise CommandError(
                "Clave insuficiente; no se escribió ningún dato."
            ) from None
        passwords[email] = password
    return passwords


def prepare(admin, plan, passwords):
    new_files = []
    try:
        with transaction.atomic():
            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_xact_lock(%s)", [1100110011])
            # NO KEY UPDATE permits audit foreign-key checks while preventing role/
            # account edits. Match the domain's driver-before-parent lock order.
            list(
                User.objects.select_for_update(no_key=True)
                .filter(Q(pk=admin.pk) | Q(email__in=[row[0] for row in ACCOUNTS]))
                .order_by("pk")
            )
            list(
                DriverProfile.objects.select_for_update(of=("self",))
                .filter(user__email__in=[row[0] for row in ACCOUNTS])
                .order_by("pk")
            )
            list(
                ParentProfile.objects.select_for_update(no_key=True, of=("self",))
                .filter(user__email__in=[row[0] for row in ACCOUNTS])
                .order_by("pk")
            )
            admin.refresh_from_db()
            if inspect(admin) != plan:
                raise CommandError(
                    "El estado cambió durante la preparación; repetir dry-run."
                )
            if plan["complete"]:
                return
            from datetime import date

            day = date.fromisoformat(plan["day"])
            for email, role, name in ACCOUNTS:
                if not User.objects.filter(email=email).exists():
                    candidate = User(email=email, role=role)
                    candidate.full_clean(exclude=["password"])
                    user = User.objects.create_user(email, passwords[email], role=role)
                    model = DriverProfile if role == "driver" else ParentProfile
                    model.objects.create(user=user, display_name=name)
                elif role == "parent":
                    user = User.objects.get(email=email)
                    if not user.parent_profile.display_name.strip():
                        invoke(
                            contact_api.ParentProfileView,
                            user,
                            "patch",
                            {"display_name": name},
                        )
            for code, name in (
                ("demo-norte", "Comuna Demo Norte"),
                ("demo-sur", "Comuna Demo Sur"),
            ):
                if not Commune.objects.filter(code=code).exists():
                    Commune.objects.create(code=code, display_name=name)
            drivers = [User.objects.get(email=row[0]) for row in ACCOUNTS[:3]]
            for index, user in enumerate(drivers):
                profile = user.driver_profile
                defaults = {
                    "display_name": ACCOUNTS[index][2],
                    "service_summary": "Servicio ficticio del escenario académico "
                    "Demo.",
                    "service_contact_email": f"servicio-demo-{index + 1}@example.test",
                }
                changes = {
                    key: value
                    for key, value in defaults.items()
                    if not getattr(profile, key).strip()
                }
                if changes:
                    invoke(api.DriverProfileView, user, "patch", changes)
                for kind, _, expires in CHECKLIST:
                    file = SimpleUploadedFile(
                        "documento-demo.png",
                        png_document(ACCOUNTS[index][2], kind),
                        content_type="image/png",
                    )
                    row = invoke(
                        api.DriverDocumentsView,
                        user,
                        "post",
                        {
                            "kind": kind,
                            "file": file,
                            **(
                                {"expires_on": (day + timedelta(days=120)).isoformat()}
                                if expires
                                else {}
                            ),
                        },
                        multipart=True,
                    )
                    new_files.append(
                        DriverDocument.objects.get(pk=row["id"]).storage_key
                    )
                validation = invoke(api.DriverSubmitView, user, "post")
                if index < 2:
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
                            "plan_code": "basic",
                            "status": "active",
                            "reason": REASON,
                            "expected_version": None,
                            "starts_at": datetime.combine(
                                day - timedelta(days=1), time(12), CHILE
                            ).isoformat(),
                            "ends_at": datetime.combine(
                                day + timedelta(days=90), time(12), CHILE
                            ).isoformat(),
                        },
                        id=profile.pk,
                    )
            routes = []
            for user, label, start, end in (
                (drivers[0], "Ida Demo", "07:00", "08:00"),
                (drivers[0], "Respaldo Demo", "14:00", "15:00"),
                (drivers[1], "Ruta Demo B", "08:30", "09:30"),
            ):
                routes.append(
                    invoke(
                        publication_api.RoutesView,
                        user,
                        "post",
                        {
                            "label": label,
                            "status": "active",
                            "weekdays": list(WEEKDAYS),
                            "start_time": start,
                            "end_time": end,
                            "seat_capacity": 4,
                            "destination_label": "Escuela Demo",
                            "destination_address": "Calle Ficticia 123, Comuna Demo",
                            "coverage_codes": ["demo-norte", "demo-sur"],
                        },
                    )
                )
            assignments = []
            for index, route in enumerate((routes[0], routes[0], routes[1])):
                assignments.append(
                    invoke(
                        operations_api.AssignmentsView,
                        drivers[0],
                        "post",
                        {
                            "route_id": route["id"],
                            "student_display_name": f"Pasajero Demo {index + 1}",
                            "pickup_instruction": "Parada ficticia del escenario "
                            "Demo; no es un domicilio real.",
                            "guardian_display_name": "Tutor Demo",
                            "guardian_contact": "900000001",
                            "starts_on": (day - timedelta(days=1)).isoformat(),
                            "ends_on": (day + timedelta(days=60)).isoformat(),
                        },
                    )
                )
            invoke(
                operations_api.PaymentsView,
                drivers[0],
                "post",
                {
                    "assignment_id": assignments[0]["id"],
                    "service_period_start": day.isoformat(),
                    "service_period_end": (day + timedelta(days=30)).isoformat(),
                    "amount_clp": 50000,
                    "due_on": (day + timedelta(days=7)).isoformat(),
                },
            )
            for user in drivers[:2]:
                invoke(
                    publication_api.DriverPublicationView,
                    user,
                    "patch",
                    {"publication_requested": True},
                )
                user.driver_profile.refresh_from_db()
                if not publication_state(user.driver_profile).eligible:
                    raise CommandError(
                        "El dominio no confirma elegibilidad; no se fuerza publicación."
                    )
            parent_a, parent_b = [
                User.objects.get(email=row[0]) for row in ACCOUNTS[3:]
            ]
            invoke(
                contact_api.ParentRequestsView,
                parent_b,
                "post",
                {
                    "driver_id": drivers[0].driver_profile.pk,
                    "message": "Consulta ficticia Demo pendiente.",
                    "consent_share_email": True,
                },
            )
            accepted = invoke(
                contact_api.ParentRequestsView,
                parent_a,
                "post",
                {
                    "driver_id": drivers[1].driver_profile.pk,
                    "message": "Consulta ficticia Demo aceptada.",
                    "consent_share_email": True,
                },
            )
            invoke(contact_api.DriverAcceptView, drivers[1], "post", id=accepted["id"])
            AdminActionLog.objects.create(
                actor=admin,
                action="demo_scenario_prepared",
                target_type="demo_scenario",
                target_id=admin.pk,
                correlation_id=str(uuid.uuid4()),
                reason=REASON,
                after_detail={
                    "version": VERSION,
                    "day": day.isoformat(),
                    "valid_until": (day + timedelta(days=60)).isoformat(),
                    "objects": snapshot(),
                },
            )
    except Exception:
        # Rollback DB plus ONLY files created by this failed attempt. Existing files
        # (including backup canaries) and accounts are never deleted or overwritten.
        try:
            committed = DriverDocument.objects.filter(
                storage_key__in=new_files
            ).exists()
        except Exception:
            raise CommandError(
                "Resultado DB incierto; conservar archivos y revisar manualmente."
            ) from None
        if not committed:
            for key in new_files:
                (Path(settings.PRIVATE_UPLOAD_ROOT) / key).unlink(missing_ok=True)
        raise
