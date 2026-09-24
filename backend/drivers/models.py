from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.models import DriverProfile, ParentProfile


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
    before_detail = models.JSONField(default=dict)
    after_detail = models.JSONField(default=dict)

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Admin audit entries are append-only")
        if self.actor.role != "admin" or not self.actor.is_staff:
            raise ValidationError("Audit actor must be an administrator")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Admin audit entries are retained")


class Plan(models.Model):
    code = models.CharField(max_length=8, unique=True)
    display_label = models.CharField(max_length=32)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(code__in=["basic", "pro", "elite"]),
                name="plan_code_valid",
            )
        ]

    def __str__(self):
        return self.display_label


class DriverSubscription(models.Model):
    class Status(models.TextChoices):
        INACTIVE = "inactive"
        ACTIVE = "active"
        SUSPENDED = "suspended"

    driver = models.OneToOneField(
        DriverProfile, on_delete=models.PROTECT, related_name="subscription"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=9, choices=Status.choices)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=["inactive", "active", "suspended"]),
                name="subscription_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(starts_at__isnull=True, ends_at__isnull=True)
                    | Q(starts_at__isnull=False, ends_at__gt=models.F("starts_at"))
                ),
                name="subscription_window_valid",
            ),
            models.CheckConstraint(
                condition=~Q(status="active") | Q(starts_at__isnull=False),
                name="active_subscription_has_start",
            ),
        ]


class Commune(models.Model):
    code = models.CharField(max_length=64, unique=True)
    display_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)


class Route(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active"
        INACTIVE = "inactive"

    driver = models.ForeignKey(
        DriverProfile, on_delete=models.PROTECT, related_name="routes"
    )
    label = models.CharField(max_length=100)
    status = models.CharField(max_length=8, choices=Status.choices)
    weekdays = models.JSONField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    seat_capacity = models.PositiveIntegerField()
    destination_label = models.CharField(max_length=120)
    destination_address = models.CharField(max_length=255)
    revision = models.PositiveIntegerField(default=1)
    communes = models.ManyToManyField(Commune, through="RouteCoverage")

    class Meta:
        indexes = [models.Index(fields=["driver", "status"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=["active", "inactive"]),
                name="route_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(seat_capacity__gt=0), name="route_capacity_positive"
            ),
            models.CheckConstraint(
                condition=Q(start_time__lt=models.F("end_time")),
                name="route_same_day_window",
            ),
        ]


class RouteCoverage(models.Model):
    route = models.ForeignKey(Route, on_delete=models.PROTECT)
    commune = models.ForeignKey(Commune, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["route", "commune"], name="unique_route_commune"
            )
        ]


class Review(models.Model):
    class Status(models.TextChoices):
        PUBLISHED = "published"
        HIDDEN = "hidden"

    parent = models.ForeignKey(ParentProfile, on_delete=models.PROTECT)
    driver = models.ForeignKey(DriverProfile, on_delete=models.PROTECT)
    score = models.PositiveSmallIntegerField()
    text = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=9, choices=Status.choices)
    is_demo = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    def delete(self, *args, **kwargs):
        raise ValidationError("Review history is retained")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "driver"], name="one_review_per_pair"
            ),
            models.CheckConstraint(
                condition=Q(score__gte=1, score__lte=5), name="review_score_1_5"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["published", "hidden"]),
                name="review_status_valid",
            ),
        ]
        indexes = [models.Index(fields=["driver", "status"])]


class ContactRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        ACCEPTED = "accepted"
        DECLINED = "declined"
        CANCELLED = "cancelled"

    parent = models.ForeignKey(ParentProfile, on_delete=models.PROTECT)
    driver = models.ForeignKey(DriverProfile, on_delete=models.PROTECT)
    driver_display_name_snapshot = models.CharField(max_length=100)
    message = models.CharField(max_length=500)
    consented_at = models.DateTimeField()
    parent_email_snapshot = models.EmailField()
    driver_email_snapshot = models.EmailField(null=True, blank=True)
    status = models.CharField(
        max_length=9, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def delete(self, *args, **kwargs):
        raise ValidationError("Contact history is retained")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "driver"],
                condition=Q(status="pending"),
                name="one_pending_contact_per_pair",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=["pending", "accepted", "declined", "cancelled"]
                ),
                name="contact_status_valid",
            ),
            models.CheckConstraint(
                condition=~Q(message=""), name="contact_message_nonempty"
            ),
            models.CheckConstraint(
                condition=Q(driver_email_snapshot__isnull=True) | Q(status="accepted"),
                name="contact_driver_email_accepted",
            ),
        ]
        indexes = [
            models.Index(fields=["parent", "status"]),
            models.Index(fields=["driver", "status"]),
        ]
