import django.db.models.deletion
from django.db import migrations, models


def backfill(apps, schema_editor):
    Assignment = apps.get_model("drivers", "PassengerAssignment")
    Student = apps.get_model("drivers", "Student")
    database = schema_editor.connection.alias
    assignments = Assignment.objects.using(database)
    # Use verified ownership only. Identical names and phones may belong to
    # different students, so each legacy assignment gets its own identity.
    last_pk = 0
    while batch := list(
        assignments.filter(pk__gt=last_pk).select_related("route").order_by("pk")[:500]
    ):
        students = Student.objects.using(database).bulk_create(
            [Student(driver_id=row.route.driver_id) for row in batch]
        )
        for row, student in zip(batch, students, strict=True):
            row.student_id = student.pk
        assignments.bulk_update(batch, ["student"])
        last_pk = batch[-1].pk


class Migration(migrations.Migration):
    dependencies = [
        ("drivers", "0009_supportticket_supportevent_supportusage_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Student",
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
                (
                    "driver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="students",
                        to="accounts.driverprofile",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="passengerassignment",
            name="student",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="assignments",
                to="drivers.student",
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
