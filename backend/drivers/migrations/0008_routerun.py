import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("drivers", "0007_passengerassignment_paymentrecord")]

    operations = [
        migrations.CreateModel(
            name="RouteRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("service_date", models.DateField()),
                ("state", models.CharField(choices=[("planned", "Planned"), ("in_progress", "In Progress"), ("completed", "Completed")], max_length=11)),
                ("weekdays_snapshot", models.JSONField()),
                ("start_time_snapshot", models.TimeField()),
                ("end_time_snapshot", models.TimeField()),
                ("seat_capacity_snapshot", models.PositiveIntegerField()),
                ("destination_label_snapshot", models.CharField(max_length=120)),
                ("destination_address_snapshot", models.CharField(max_length=255)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("route", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="runs", to="drivers.route")),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=("route", "service_date"), name="unique_route_service_date"),
                    models.CheckConstraint(condition=models.Q(state__in=["planned", "in_progress", "completed"]), name="route_run_state_valid"),
                    models.CheckConstraint(condition=(
                        models.Q(state="planned", started_at__isnull=True, ended_at__isnull=True)
                        | models.Q(state="in_progress", started_at__isnull=False, ended_at__isnull=True)
                        | models.Q(state="completed", started_at__isnull=False, ended_at__isnull=False)
                    ), name="route_run_timestamps_valid"),
                    models.CheckConstraint(condition=models.Q(seat_capacity_snapshot__gt=0), name="route_run_capacity_positive"),
                    models.CheckConstraint(condition=models.Q(ended_at__isnull=True) | models.Q(ended_at__gte=models.F("started_at")), name="route_run_end_after_start"),
                ],
            },
        ),
    ]
