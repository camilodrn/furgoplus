from django.db import migrations


def seed_plans(apps, schema_editor):
    Plan = apps.get_model("drivers", "Plan")
    for code, label in (("basic", "Basic"), ("pro", "Pro"), ("elite", "Elite")):
        Plan.objects.using(schema_editor.connection.alias).update_or_create(
            code=code, defaults={"display_label": label}
        )


class Migration(migrations.Migration):
    dependencies = [("drivers", "0002_commune_plan_route_routecoverage_route_communes_and_more")]
    operations = [migrations.RunPython(seed_plans, migrations.RunPython.noop)]
