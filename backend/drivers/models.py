from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.models import DriverProfile


class DriverDocument(models.Model):
    driver = models.ForeignKey(
        DriverProfile, on_delete=models.PROTECT, related_name="documents"
    )
    kind = models.CharField(max_length=48)
    storage_key = models.CharField(max_length=64, unique=True)
    content_type = models.CharField(max_length=32)
    byte_size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    uploaded_at = models.DateTimeField(default=timezone.now)
    expires_on = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if self.pk:
            original = type(self).objects.get(pk=self.pk)
            immutable = (
                "driver_id",
                "kind",
                "storage_key",
                "content_type",
                "byte_size",
                "sha256",
                "uploaded_at",
                "expires_on",
            )
            if any(
                getattr(self, field) != getattr(original, field) for field in immutable
            ):
                raise ValidationError("Document versions are immutable")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Document versions are retained")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["driver", "kind"],
                condition=Q(is_current=True),
                name="one_current_driver_document",
            )
        ]
        indexes = [
            models.Index(
                fields=["driver", "kind"], name="drivers_dri_driver__51a93d_idx"
            )
        ]


class DriverValidation(models.Model):
    class State(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"
        SUPERSEDED = "superseded"

    driver = models.ForeignKey(
        DriverProfile, on_delete=models.PROTECT, related_name="validations"
    )
    revision = models.PositiveIntegerField()
    display_name_snapshot = models.CharField(max_length=100)
    state = models.CharField(
        max_length=10, choices=State.choices, default=State.PENDING
    )
    submitted_at = models.DateTimeField(default=timezone.now)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    observations = models.CharField(max_length=1000, null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.reviewer_id and (
            self.reviewer.role != "admin" or not self.reviewer.is_staff
        ):
            raise ValidationError("Reviewer must be an administrator")
        if self.pk:
            original = type(self).objects.get(pk=self.pk)
            immutable = (
                "driver_id",
                "revision",
                "display_name_snapshot",
                "submitted_at",
            )
            if any(
                getattr(self, field) != getattr(original, field) for field in immutable
            ):
                raise ValidationError("Validation snapshot is immutable")
            if original.state != "pending" or original.reviewed_at:
                if any(
                    getattr(self, field) != getattr(original, field)
                    for field in ("state", "reviewer_id", "reviewed_at", "observations")
                ):
                    raise ValidationError("Validation decision is immutable")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Validation history is retained")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["driver", "revision"], name="unique_driver_revision"
            )
        ]
        indexes = [
            models.Index(
                fields=["state", "submitted_at"], name="drivers_dri_state_a_5f2c24_idx"
            )
        ]


class ValidationDocument(models.Model):
    validation = models.ForeignKey(
        DriverValidation, on_delete=models.PROTECT, related_name="snapshot_documents"
    )
    document = models.ForeignKey(
        DriverDocument, on_delete=models.PROTECT, related_name="validation_uses"
    )
    kind = models.CharField(max_length=48)

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Validation document links are immutable")
        if (
            self.validation.driver_id != self.document.driver_id
            or self.kind != self.document.kind
        ):
            raise ValidationError("Document and validation drivers/kinds must match")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Validation document links are retained")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["validation", "kind"], name="unique_validation_kind"
            )
        ]


class AdminActionLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=32)
    target_type = models.CharField(max_length=32)
    target_id = models.PositiveBigIntegerField()
    occurred_at = models.DateTimeField(default=timezone.now)
    correlation_id = models.CharField(max_length=36)
    reason = models.CharField(max_length=1000, blank=True)
    before_state = models.CharField(max_length=16, blank=True)
    after_state = models.CharField(max_length=16, blank=True)

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Admin audit entries are append-only")
        if self.actor.role != "admin" or not self.actor.is_staff:
            raise ValidationError("Audit actor must be an administrator")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Admin audit entries are retained")
