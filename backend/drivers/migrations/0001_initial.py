import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    initial = True
    dependencies = [("accounts", "0002_auth_profiles_throttle"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(name="DriverDocument", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("kind", models.CharField(max_length=48)),
            ("storage_key", models.CharField(max_length=64, unique=True)),
            ("content_type", models.CharField(max_length=32)),
            ("byte_size", models.PositiveIntegerField()),
            ("sha256", models.CharField(max_length=64)),
            ("uploaded_at", models.DateTimeField(default=django.utils.timezone.now)),
            ("expires_on", models.DateField(blank=True, null=True)),
            ("is_current", models.BooleanField(default=True)),
            ("driver", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="documents", to="accounts.driverprofile")),
        ], options={"indexes": [models.Index(fields=["driver", "kind"], name="drivers_dri_driver__51a93d_idx")],
                    "constraints": [models.UniqueConstraint(fields=("driver", "kind"), condition=Q(is_current=True), name="one_current_driver_document")]}),
        migrations.CreateModel(name="DriverValidation", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("revision", models.PositiveIntegerField()),
            ("display_name_snapshot", models.CharField(max_length=100)),
            ("state", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"), ("superseded", "Superseded")], default="pending", max_length=10)),
            ("submitted_at", models.DateTimeField(default=django.utils.timezone.now)),
            ("reviewed_at", models.DateTimeField(blank=True, null=True)),
            ("observations", models.CharField(blank=True, max_length=1000, null=True)),
            ("driver", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="validations", to="accounts.driverprofile")),
            ("reviewer", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
        ], options={"indexes": [models.Index(fields=["state", "submitted_at"], name="drivers_dri_state_a_5f2c24_idx")],
                    "constraints": [models.UniqueConstraint(fields=("driver", "revision"), name="unique_driver_revision")]}),
        migrations.CreateModel(name="ValidationDocument", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("kind", models.CharField(max_length=48)),
            ("document", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="validation_uses", to="drivers.driverdocument")),
            ("validation", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="snapshot_documents", to="drivers.drivervalidation")),
        ], options={"constraints": [models.UniqueConstraint(fields=("validation", "kind"), name="unique_validation_kind")]}),
        migrations.CreateModel(name="AdminActionLog", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("action", models.CharField(max_length=32)),
            ("target_type", models.CharField(max_length=32)),
            ("target_id", models.PositiveBigIntegerField()),
            ("occurred_at", models.DateTimeField(default=django.utils.timezone.now)),
            ("correlation_id", models.CharField(max_length=36)),
            ("reason", models.CharField(blank=True, max_length=1000)),
            ("before_state", models.CharField(blank=True, max_length=16)),
            ("after_state", models.CharField(blank=True, max_length=16)),
            ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
        ]),
    ]
