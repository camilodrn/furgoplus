import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("drivers", "0010_student_identity")]

    # Separate transaction from the backfill: PostgreSQL can have pending FK
    # trigger events after the UPDATE in the previous migration.
    operations = [
        migrations.AlterField(
            model_name="passengerassignment",
            name="student",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="assignments",
                to="drivers.student",
            ),
        )
    ]
