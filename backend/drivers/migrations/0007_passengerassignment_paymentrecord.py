import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("drivers", "0006_contactrequest_review")]

    operations = [
        migrations.CreateModel(
            name="PassengerAssignment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("student_display_name", models.CharField(max_length=100)),
                ("pickup_instruction", models.CharField(max_length=255)),
                ("guardian_display_name", models.CharField(max_length=100)),
                ("guardian_contact", models.CharField(max_length=150)),
                ("starts_on", models.DateField()),
                ("ends_on", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "route",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="assignments",
                        to="drivers.route",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["route", "starts_on", "ends_on"],
                        name="assignment_route_dates_idx",
                    )
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(ends_on__isnull=True)
                        | models.Q(ends_on__gte=models.F("starts_on")),
                        name="assignment_interval_valid",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="PaymentRecord",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("service_period_start", models.DateField()),
                ("service_period_end", models.DateField()),
                ("amount_clp", models.PositiveIntegerField()),
                ("due_on", models.DateField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("paid", "Paid"),
                            ("void", "Void"),
                        ],
                        default="pending",
                        max_length=7,
                    ),
                ),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "assignment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payments",
                        to="drivers.passengerassignment",
                    ),
                ),
                (
                    "driver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="transport_payments",
                        to="accounts.driverprofile",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["driver", "status"], name="payment_driver_status_idx"
                    )
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(amount_clp__gt=0),
                        name="payment_amount_positive",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            service_period_end__gte=models.F("service_period_start")
                        ),
                        name="payment_period_valid",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(status__in=["pending", "paid", "void"]),
                        name="payment_status_valid",
                    ),
                    models.CheckConstraint(
                        condition=~models.Q(status="pending")
                        | models.Q(paid_at__isnull=True),
                        name="pending_payment_unpaid",
                    ),
                    models.CheckConstraint(
                        condition=~models.Q(status="paid")
                        | models.Q(paid_at__isnull=False),
                        name="paid_payment_timestamp",
                    ),
                ],
            },
        ),
    ]
