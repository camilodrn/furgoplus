from concurrent.futures import ThreadPoolExecutor
from datetime import time, timedelta
from threading import Barrier, Event
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import DriverProfile, User
from api.contracts import openapi_document
from drivers.capacity import local_today
from drivers.models import DriverSubscription, PassengerAssignment, Plan, Route, Student
from drivers.operations_api import lock_roster_driver
from drivers.publication import WEEKDAYS, change_subscription

ASSIGNMENTS = "/api/v1/driver/passenger-assignments/"
CAPABILITIES = "/api/v1/driver/capabilities/"


def make_driver(label, plan_code):
    user = User.objects.create_user(f"{label}@example.test", role="driver")
    driver = DriverProfile.objects.create(user=user, display_name=label)
    if plan_code:
        plan, _ = Plan.objects.get_or_create(
            code=plan_code, defaults={"display_label": plan_code.title()}
        )
        now = timezone.now()
        DriverSubscription.objects.create(
            driver=driver,
            plan=plan,
            status="active",
            starts_at=now - timedelta(days=1),
            ends_at=now + timedelta(days=10),
        )
    return driver


def make_route(driver, seats=200):
    return Route.objects.create(
        driver=driver,
        label="Ruta ficticia",
        status="active",
        weekdays=list(WEEKDAYS),
        start_time=time(7),
        end_time=time(8),
        seat_capacity=seats,
        destination_label="Escuela ficticia",
        destination_address="Punto ficticio",
    )


def payload(route, starts_on=None, ends_on=None):
    return {
        "route_id": route.pk,
        "student_display_name": "Estudiante ficticio",
        "guardian_display_name": "Responsable ficticio",
        "guardian_contact": "000000000",
        "pickup_instruction": "Parada ficticia",
        "starts_on": str(starts_on or local_today()),
        "ends_on": str(ends_on) if ends_on else None,
    }


def fill(route, size, starts_on=None):
    fields = payload(route, starts_on)
    students = Student.objects.bulk_create(
        [Student(driver=route.driver) for _ in range(size)]
    )
    PassengerAssignment.objects.bulk_create(
        [PassengerAssignment(student=student, **fields) for student in students]
    )
    return students


def driver_client(driver):
    client = APIClient()
    client.force_authenticate(user=driver.user)
    return client


def downgrade(driver, admin):
    Plan.objects.get_or_create(code="basic", defaults={"display_label": "Basic"})
    change_subscription(
        driver.pk,
        admin,
        plan_code="basic",
        status="active",
        starts_at=timezone.now() - timedelta(days=1),
        ends_at=timezone.now() + timedelta(days=10),
        reason="Descenso sintético",
        expected_version=None,
    )


class StudentQuotaTests(TestCase):
    def test_each_plan_allows_the_last_student_then_rejects_the_next(self):
        for plan, maximum in (("basic", 20), ("pro", 50), ("elite", 150)):
            with self.subTest(plan=plan):
                driver = make_driver(plan, plan)
                route = make_route(driver)
                client = driver_client(driver)
                fill(route, maximum - 1)
                usage = client.get(CAPABILITIES).json()["student_usage"]
                self.assertEqual(
                    (usage["active"], usage["limit"], usage["available"]),
                    (maximum - 1, maximum, 1),
                )
                self.assertEqual(
                    client.post(ASSIGNMENTS, payload(route), format="json").status_code,
                    201,
                )
                denial = client.post(ASSIGNMENTS, payload(route), format="json")
                self.assertEqual(
                    (denial.status_code, denial.json()["code"]),
                    (409, "student_limit_reached"),
                )
                roster = client.get(ASSIGNMENTS).json()
                self.assertEqual(roster["student_usage"]["active"], maximum)
                self.assertEqual(Student.objects.filter(driver=driver).count(), maximum)

    def test_same_identity_counts_once_but_occupies_each_route(self):
        driver = make_driver("same", "basic")
        first = make_route(driver)
        second = make_route(driver, seats=1)
        student, *_ = fill(first, 20)
        client = driver_client(driver)
        first_ride = client.post(
            ASSIGNMENTS, {**payload(second), "student_id": student.pk}, format="json"
        )
        self.assertEqual(first_ride.status_code, 201)
        self.assertEqual(first_ride.json()["student_id"], student.pk)
        self.assertEqual(client.get(ASSIGNMENTS).json()["student_usage"]["active"], 20)
        second_ride = client.post(
            ASSIGNMENTS, {**payload(second), "student_id": student.pk}, format="json"
        )
        self.assertEqual(second_ride.status_code, 400)
        self.assertIn("seat_capacity", second_ride.json()["fields"])
        scope = client.get(f"{ASSIGNMENTS}?route_id={second.pk}").json()
        self.assertEqual(len(scope["assignments"]), 1)
        self.assertEqual(scope["student_usage"]["active"], 20)

    def test_future_association_reactivation_and_extension(self):
        driver = make_driver("future", "basic")
        route = make_route(driver)
        today = local_today()
        tomorrow = today + timedelta(days=1)
        next_week = today + timedelta(days=7)
        fill(route, 20, starts_on=next_week)
        client = driver_client(driver)
        old = client.post(
            ASSIGNMENTS,
            payload(route, today - timedelta(days=5), today - timedelta(days=1)),
            format="json",
        ).json()
        detail_url = f"{ASSIGNMENTS}{old['id']}/"
        extension = client.patch(detail_url, {"ends_on": None}, format="json")
        self.assertEqual(extension.json()["code"], "student_limit_reached")
        reactivation = client.post(
            ASSIGNMENTS,
            {**payload(route, tomorrow), "student_id": old["student_id"]},
            format="json",
        )
        self.assertEqual(reactivation.json()["code"], "student_limit_reached")
        short = client.patch(detail_url, {"ends_on": str(tomorrow)}, format="json")
        self.assertEqual(short.status_code, 200)
        future = client.post(ASSIGNMENTS, payload(route, next_week), format="json")
        self.assertEqual(future.json()["code"], "student_limit_reached")
        self.assertEqual(client.get(CAPABILITIES).json()["student_usage"]["active"], 1)

    def test_downgrade_preserves_history_and_allows_maintenance(self):
        driver = make_driver("downgrade", "elite")
        route = make_route(driver)
        second = make_route(driver)
        student, *_ = fill(route, 21)
        admin = User.objects.create_user(
            "admin@example.test", role="admin", is_staff=True
        )
        downgrade(driver, admin)
        client = driver_client(driver)
        usage = client.get(ASSIGNMENTS).json()["student_usage"]
        self.assertEqual(
            (usage["active"], usage["limit"], usage["available"]), (21, 20, 0)
        )
        self.assertEqual(
            client.post(ASSIGNMENTS, payload(second), format="json").status_code, 409
        )
        self.assertEqual(
            client.post(
                ASSIGNMENTS,
                {**payload(second), "student_id": student.pk},
                format="json",
            ).status_code,
            201,
        )
        row = route.assignments.exclude(student=student).first()
        detail = f"{ASSIGNMENTS}{row.pk}/"
        self.assertEqual(
            client.patch(
                detail, {"student_display_name": "Nombre corregido"}, format="json"
            ).status_code,
            200,
        )
        result = client.post(
            f"{detail}end/", {"ends_on": str(local_today())}, format="json"
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(Student.objects.filter(driver=driver).count(), 21)
        self.assertEqual(
            PassengerAssignment.objects.filter(route__driver=driver).count(), 22
        )

    def test_isolation_and_no_implicit_deduplication(self):
        driver = make_driver("owner", "basic")
        other = make_driver("other", "basic")
        route = make_route(driver)
        (outsider,) = fill(make_route(other), 1)
        client = driver_client(driver)
        self.assertEqual(
            client.post(
                ASSIGNMENTS,
                {**payload(route), "student_id": outsider.pk},
                format="json",
            ).status_code,
            404,
        )
        first = client.post(ASSIGNMENTS, payload(route), format="json").json()
        second = client.post(ASSIGNMENTS, payload(route), format="json").json()
        self.assertNotEqual(first["student_id"], second["student_id"])
        change = client.patch(
            f"{ASSIGNMENTS}{first['id']}/",
            {"student_id": second["student_id"]},
            format="json",
        )
        self.assertEqual(change.status_code, 400)
        self.assertEqual(client.get(ASSIGNMENTS).json()["student_usage"]["active"], 2)

    def test_roster_policy_without_or_with_expired_subscription(self):
        legacy = make_driver("legacy", None)
        route = make_route(legacy)
        client = driver_client(legacy)
        self.assertIsNone(client.get(CAPABILITIES).json()["student_usage"]["limit"])
        self.assertEqual(
            client.post(ASSIGNMENTS, payload(route), format="json").status_code, 201
        )
        expired = make_driver("expired", "basic")
        DriverSubscription.objects.filter(driver=expired).update(
            starts_at=timezone.now() - timedelta(days=10),
            ends_at=timezone.now() - timedelta(days=1),
        )
        roster = make_route(expired)
        fill(roster, 20)
        expired_client = driver_client(expired)
        self.assertEqual(
            expired_client.get(CAPABILITIES).json()["student_usage"]["limit"], 20
        )
        self.assertEqual(
            expired_client.post(
                ASSIGNMENTS, payload(roster), format="json"
            ).status_code,
            409,
        )

    def test_contract_distinguishes_associating_and_editing(self):
        paths = openapi_document()["paths"]
        create = paths[ASSIGNMENTS]["post"]
        schema = create["requestBody"]["content"]["application/json"]["schema"]
        self.assertIn("student_id", schema["properties"])
        self.assertNotIn("student_id", schema["required"])
        edit = paths[f"{ASSIGNMENTS}{{id}}/"]["patch"]
        self.assertNotIn(
            "student_id",
            edit["requestBody"]["content"]["application/json"]["schema"]["properties"],
        )
        self.assertIn("student_limit_reached", edit["responses"]["409"]["description"])


@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks")
class StudentQuotaConcurrencyTests(TransactionTestCase):
    def test_two_routes_compete_for_one_commercial_slot(self):
        driver = make_driver("race", "basic")
        first, second = make_route(driver), make_route(driver)
        fill(first, 19)
        barrier = Barrier(2, timeout=8)

        def add(route):
            close_old_connections()
            try:
                client = driver_client(driver)
                barrier.wait()
                response = client.post(ASSIGNMENTS, payload(route), format="json")
                return response.status_code, response.json().get("code")
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertCountEqual(
                list(pool.map(add, (first, second))),
                [(201, None), (409, "student_limit_reached")],
            )
        self.assertEqual(Student.objects.filter(driver=driver).count(), 20)

    def test_write_rechecks_plan_after_concurrent_downgrade_commits(self):
        driver = make_driver("race-plan", "elite")
        route, next_route = make_route(driver), make_route(driver)
        fill(route, 20)
        admin = User.objects.create_user(
            "race-admin@example.test", role="admin", is_staff=True
        )
        attempting_lock = Event()

        def mark_lock(request):
            attempting_lock.set()
            return lock_roster_driver(request)

        def add():
            close_old_connections()
            try:
                return driver_client(driver).post(
                    ASSIGNMENTS, payload(next_route), format="json"
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=1) as pool:
            with patch(
                "drivers.operations_api.lock_roster_driver", side_effect=mark_lock
            ):
                with transaction.atomic():
                    downgrade(driver, admin)
                    result = pool.submit(add)
                    self.assertTrue(attempting_lock.wait(8))
                response = result.result(timeout=10)
        self.assertEqual(
            (response.status_code, response.json()["code"]),
            (409, "student_limit_reached"),
        )


class StudentIdentityMigrationTest(TransactionTestCase):
    def test_backfill_keeps_assignments_and_payments_with_distinct_owned_identities(
        self,
    ):
        old = [("drivers", "0009_supportticket_supportevent_supportusage_and_more")]
        latest = [("drivers", "0011_require_student_identity")]
        executor = MigrationExecutor(connection)
        executor.migrate(old)
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(latest))
        apps = executor.loader.project_state(old).apps
        account = apps.get_model("accounts", "User").objects.create(
            email="legacy@example.test", role="driver"
        )
        driver = apps.get_model("accounts", "DriverProfile").objects.create(
            user=account, display_name="Ficticio"
        )
        route = apps.get_model("drivers", "Route").objects.create(
            driver=driver,
            label="Ruta ficticia",
            status="active",
            weekdays=list(WEEKDAYS),
            start_time=time(7),
            end_time=time(8),
            seat_capacity=12,
            destination_label="Escuela ficticia",
        )
        Assignment = apps.get_model("drivers", "PassengerAssignment")
        original = [Assignment.objects.create(**payload(route)) for _ in range(2)]
        today = local_today()
        payment = apps.get_model("drivers", "PaymentRecord").objects.create(
            driver=driver,
            assignment=original[0],
            amount_clp=1000,
            service_period_start=today,
            service_period_end=today,
            due_on=today,
        )
        MigrationExecutor(connection).migrate(latest)
        rows = list(
            PassengerAssignment.objects.order_by("pk").select_related("student")
        )
        self.assertEqual([row.pk for row in rows], [row.pk for row in original])
        self.assertEqual(len({row.student_id for row in rows}), 2)
        self.assertTrue(all(row.student.driver_id == driver.pk for row in rows))
        self.assertEqual(
            payment.__class__.objects.get(pk=payment.pk).assignment_id, rows[0].pk
        )
