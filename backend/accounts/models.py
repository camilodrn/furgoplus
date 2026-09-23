from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def normalize_email(self, email):
        if not email or not email.strip():
            raise ValueError("An email address is required")
        return super().normalize_email(email.strip()).lower()

    def create_user(self, email, password=None, **extra_fields):
        email = self.normalize_email(email)
        if extra_fields.get("role") not in User.Role.values:
            raise ValueError("A valid role is required")
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields["role"] != User.Role.ADMIN:
            raise ValueError("Superuser role must be admin")
        if (
            extra_fields["is_staff"] is not True
            or extra_fields["is_superuser"] is not True
        ):
            raise ValueError("Superuser must have staff and superuser flags")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        PARENT = "parent", "Parent"
        DRIVER = "driver", "Driver"
        ADMIN = "admin", "Administrator"

    email = models.EmailField(unique=True, max_length=254)
    role = models.CharField(max_length=6, choices=Role.choices)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_email_lower_unique"),
            models.CheckConstraint(
                condition=models.Q(role__in=["parent", "driver", "admin"]),
                name="accounts_user_role_valid",
            ),
        ]

    def clean(self):
        super().clean()
        self.email = type(self).objects.normalize_email(self.email)

    def save(self, *args, **kwargs):
        self.email = type(self).objects.normalize_email(self.email)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class ParentProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.PROTECT, related_name="parent_profile"
    )
    display_name = models.CharField(max_length=100)


class DriverProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.PROTECT, related_name="driver_profile"
    )
    display_name = models.CharField(max_length=100)
    service_summary = models.TextField(blank=True)
    service_contact_email = models.EmailField(blank=True)
    status = models.CharField(max_length=11, default="active")
    publication_requested = models.BooleanField(default=False)
    validation_state = models.CharField(max_length=8, default="draft")
    current_validation_revision = models.PositiveIntegerField(default=1)
    approved_revision = models.PositiveIntegerField(null=True, blank=True)


class AuthThrottle(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    window_started_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
