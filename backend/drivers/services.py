"""Transactional driver validation transitions and private file handling."""

import hashlib
import os
import tempfile
import uuid
import warnings
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from PIL import Image
from pypdf import PdfReader
from rest_framework.exceptions import APIException, ValidationError

from accounts.models import AuthThrottle, DriverProfile
from drivers.models import (
    AdminActionLog,
    DriverDocument,
    DriverValidation,
    ValidationDocument,
)

CHECKLIST = (
    ("demo_identity_document", "Documento de identidad demo", False),
    ("demo_vehicle_document", "Documento de vehículo demo", True),
    ("demo_expiring_credential", "Credencial con vencimiento demo", True),
)
FORMATS = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}
MAX_BYTES = 10 * 1024 * 1024
MAX_DIMENSION = 8000
MAX_PIXELS = 24_000_000


class Conflict(APIException):
    status_code = 409
    default_detail = "La revisión ya no está vigente. Actualiza la pantalla."
    default_code = "stale_validation"


class UploadTooLarge(APIException):
    status_code = 413
    default_detail = "El archivo supera 10 MiB."
    default_code = "upload_too_large"


class UploadThrottled(APIException):
    status_code = 429
    default_detail = "Demasiadas cargas. Intenta más tarde."
    default_code = "throttled"


def local_today():
    return timezone.localdate()


def checklist_payload():
    return {
        "demo_only": True,
        "allowed_content_types": sorted(set(FORMATS.values())),
        "max_bytes": MAX_BYTES,
        "items": [
            {"kind": kind, "label": label, "requires_expiry": expiry}
            for kind, label, expiry in CHECKLIST
        ],
    }


def advance_if_submitted(driver):
    existing = DriverValidation.objects.filter(
        driver=driver, revision=driver.current_validation_revision
    ).first()
    if existing:
        if existing.state == DriverValidation.State.PENDING:
            existing.state = DriverValidation.State.SUPERSEDED
            existing.save(update_fields=["state"])
        driver.current_validation_revision += 1
        driver.validation_state = "draft"
        driver.approved_revision = None
        driver.save(
            update_fields=[
                "current_validation_revision",
                "validation_state",
                "approved_revision",
            ]
        )


def update_profile(user, data):
    with transaction.atomic():
        driver = DriverProfile.objects.select_for_update().get(user=user)
        if "display_name" in data and data["display_name"] != driver.display_name:
            advance_if_submitted(driver)
        for field, value in data.items():
            setattr(driver, field, value)
        driver.save(update_fields=list(data))
        return driver


def upload_rate(user_id, address):
    # 20 attempts per driver/source per hour, serialized by PostgreSQL row lock.
    key = hashlib.sha256(f"upload:{user_id}:{address}".encode()).hexdigest()
    now = timezone.now()
    with transaction.atomic():
        row, _ = AuthThrottle.objects.get_or_create(
            key=key, defaults={"window_started_at": now}
        )
        row = AuthThrottle.objects.select_for_update().get(key=key)
        if now - row.window_started_at >= timedelta(hours=1):
            row.window_started_at = now
            row.attempts = 0
        row.attempts += 1
        row.save(update_fields=["window_started_at", "attempts"])
        exceeded = row.attempts > 20
    if exceeded:
        raise UploadThrottled()


def inspect_file(path, name, declared):
    suffix = Path(name).suffix.lower()
    expected = FORMATS.get(suffix)
    if not expected or declared != expected:
        raise ValidationError({"file": ["Extensión o tipo declarado no permitido."]})
    with open(path, "rb") as stream:
        head = stream.read(12)
    detected = (
        "application/pdf"
        if head.startswith(b"%PDF-")
        else "image/png"
        if head.startswith(b"\x89PNG\r\n\x1a\n")
        else "image/jpeg"
        if head.startswith(b"\xff\xd8\xff")
        else None
    )
    if detected != expected:
        raise ValidationError({"file": ["La firma no coincide con el tipo declarado."]})
    try:
        if expected == "application/pdf":
            with open(path, "rb") as stream:
                reader = PdfReader(stream, strict=True)
                if reader.is_encrypted or not reader.pages:
                    raise ValueError("invalid PDF")
                for page in reader.pages:
                    _ = page.mediabox
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(path) as image:
                    if image.format != ("PNG" if expected == "image/png" else "JPEG"):
                        raise ValueError("invalid image format")
                    width, height = image.size
                    if (
                        width > MAX_DIMENSION
                        or height > MAX_DIMENSION
                        or width * height > MAX_PIXELS
                    ):
                        raise ValueError("image dimensions too large")
                    image.verify()
                with Image.open(path) as image:
                    image.load()
    except Exception as exc:
        raise ValidationError(
            {"file": ["Archivo malformado o imagen demasiado grande."]}
        ) from exc
    return expected, suffix


def save_upload(user, kind, expires_on, uploaded, address):
    requirements = {code: required for code, _, required in CHECKLIST}
    if kind not in requirements:
        raise ValidationError({"kind": ["Tipo demo desconocido."]})
    if requirements[kind] and not expires_on:
        raise ValidationError({"expires_on": ["Se requiere fecha de vencimiento."]})
    if expires_on and expires_on < local_today():
        raise ValidationError({"expires_on": ["La fecha ya venció."]})
    if uploaded is None:
        raise ValidationError({"file": ["Selecciona un archivo."]})
    upload_rate(user.pk, address)
    root = Path(settings.PRIVATE_UPLOAD_ROOT)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)
    staged = None
    final = None
    digest = hashlib.sha256()
    size = 0
    try:
        with tempfile.NamedTemporaryFile(
            dir=root, prefix=".stage-", delete=False
        ) as stream:
            staged = Path(stream.name)
            os.chmod(staged, 0o600)
            for chunk in uploaded.chunks():
                size += len(chunk)
                if size > MAX_BYTES:
                    raise UploadTooLarge()
                digest.update(chunk)
                stream.write(chunk)
        if not size:
            raise ValidationError({"file": ["Archivo vacío."]})
        detected, suffix = inspect_file(staged, uploaded.name, uploaded.content_type)
        storage_key = uuid.uuid4().hex + suffix
        final = root / storage_key
        with transaction.atomic():
            driver = DriverProfile.objects.select_for_update().get(user=user)
            old = DriverDocument.objects.filter(
                driver=driver, kind=kind, is_current=True
            ).first()
            if old:
                old.is_current = False
                old.save(update_fields=["is_current"])
            os.link(
                staged, final
            )  # Exclusive name creation; never overwrite a version.
            staged.unlink()
            staged = None
            document = DriverDocument.objects.create(
                driver=driver,
                kind=kind,
                storage_key=storage_key,
                content_type=detected,
                byte_size=size,
                sha256=digest.hexdigest(),
                expires_on=expires_on,
            )
            advance_if_submitted(driver)
        final = None
        return document
    finally:
        if staged is not None:
            staged.unlink(missing_ok=True)
        if final is not None:
            final.unlink(missing_ok=True)


def submission_blockers(driver, documents):
    fields = {}
    if not driver.display_name.strip():
        fields["display_name"] = ["Indica un nombre visible."]
    for kind, _, requires_expiry in CHECKLIST:
        document = documents.get(kind)
        if document is None:
            fields[kind] = ["Falta el documento demo."]
        elif document.driver_id != driver.pk:
            fields[kind] = ["Documento no válido."]
        elif requires_expiry and not document.expires_on:
            fields[kind] = ["Falta fecha de vencimiento."]
        elif document.expires_on and document.expires_on < local_today():
            fields[kind] = ["El documento está vencido."]
    return fields


def submit(user):
    with transaction.atomic():
        driver = DriverProfile.objects.select_for_update().get(user=user)
        existing = DriverValidation.objects.filter(
            driver=driver, revision=driver.current_validation_revision
        ).first()
        if existing and existing.state == DriverValidation.State.PENDING:
            return existing
        documents = {
            item.kind: item
            for item in DriverDocument.objects.filter(driver=driver, is_current=True)
        }
        blockers = submission_blockers(driver, documents)
        if blockers:
            raise ValidationError(blockers)
        if existing:
            driver.current_validation_revision += 1
            driver.save(update_fields=["current_validation_revision"])
        validation = DriverValidation.objects.create(
            driver=driver,
            revision=driver.current_validation_revision,
            display_name_snapshot=driver.display_name,
        )
        for kind, _, _ in CHECKLIST:
            ValidationDocument.objects.create(
                validation=validation, document=documents[kind], kind=kind
            )
        driver.validation_state = "pending"
        driver.approved_revision = None
        driver.save(update_fields=["validation_state", "approved_revision"])
        return validation


def decide(validation_id, actor, approve, observations):
    with transaction.atomic():
        # Lock driver first, matching driver-side transitions. Fetch its ID first.
        probe = DriverValidation.objects.only("driver_id").get(pk=validation_id)
        driver = DriverProfile.objects.select_for_update().get(pk=probe.driver_id)
        validation = DriverValidation.objects.select_for_update().get(pk=validation_id)
        if (
            validation.state != DriverValidation.State.PENDING
            or validation.revision != driver.current_validation_revision
        ):
            raise Conflict()
        if approve:
            snapshot = {
                link.kind: link.document
                for link in validation.snapshot_documents.select_related("document")
            }
            blockers = submission_blockers(driver, snapshot)
            current_ids = dict(
                DriverDocument.objects.filter(
                    driver=driver, is_current=True
                ).values_list("kind", "id")
            )
            if (
                blockers
                or validation.display_name_snapshot != driver.display_name
                or any(
                    current_ids.get(kind) != document.pk
                    for kind, document in snapshot.items()
                )
            ):
                raise Conflict()
        before = driver.validation_state
        state = (
            DriverValidation.State.APPROVED
            if approve
            else DriverValidation.State.REJECTED
        )
        validation.state = state
        validation.reviewer = actor
        validation.reviewed_at = timezone.now()
        validation.observations = observations
        validation.save(
            update_fields=["state", "reviewer", "reviewed_at", "observations"]
        )
        driver.validation_state = state
        driver.approved_revision = validation.revision if approve else None
        driver.save(update_fields=["validation_state", "approved_revision"])
        AdminActionLog.objects.create(
            actor=actor,
            action="validation_approved" if approve else "validation_rejected",
            target_type="validation",
            target_id=validation.pk,
            correlation_id=str(uuid.uuid4()),
            reason=observations,
            before_state=before,
            after_state=state,
        )
        return validation
