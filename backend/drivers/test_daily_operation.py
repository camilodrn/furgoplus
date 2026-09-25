import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, time, timedelta
from threading import Barrier
from unittest.mock import patch

from django.db import IntegrityError, close_old_connections, transaction
from django.test import Client, SimpleTestCase, TestCase, TransactionTestCase

from accounts.models import DriverProfile, User
from drivers.capacity import local_today
from drivers.daily_operation import RouteStartView
from drivers.models import Route, RouteRun
from drivers.test_publication import PublicationTests

BASE = "/api/v1/"
DAY = date(2026, 9, 28)


class ChileDateTests(SimpleTestCase):
    def test_utc_day_boundaries_use_chilean_date(self):
        with patch(
            "drivers.capacity.timezone.now",
            return_value=datetime(2026, 9, 28, 2, 59, tzinfo=UTC),
        ):
            self.assertEqual(local_today(), date(2026, 9, 27))
        with patch(
            "drivers.capacity.timezone.now",
            return_value=datetime(2026, 9, 28, 3, 0, tzinfo=UTC),
        ):
            self.assertEqual(local_today(), DAY)
        with patch(
            "drivers.capacity.timezone.now",
            return_value=datetime(2026, 7, 1, 3, 30, tzinfo=UTC),
        ):
            self.assertEqual(local_today(), date(2026, 6, 30))


class DailyOperationTests(TestCase):
    def setUp(self):
        PublicationTests.setUp(self)
        self.clock = patch("drivers.daily_operation.local_today", return_value=DAY)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.ops_clock = patch("drivers.operations_api.local_today", return_value=DAY)
        self.ops_clock.start()
        self.addCleanup(self.ops_clock.stop)
        self.login(self.driver_user)

    def login(self, user):
        self.client.force_login(user)
        self.token = self.client.get(BASE + "auth/csrf/", secure=True).json()[
            "csrf_token"
        ]

    def post(self, path, data=None):
        return self.client.post(
            BASE + path,
            json.dumps(data or {}),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def patch_route(self, values):
        route = self.client.get(
            BASE + f"driver/routes/{self.route.pk}/", secure=True
        ).json()
        data = {
            key: route[key]
            for key in (
                "label",
                "status",
                "weekdays",
                "start_time",
                "end_time",
                "seat_capacity",
                "destination_label",
                "destination_address",
                "coverage_codes",
            )
        }
        data.update(values)
        data["expected_revision"] = route["revision"]
        return self.client.patch(
            BASE + f"driver/routes/{self.route.pk}/",
            json.dumps(data),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def assignment(self, **changes):
        data = {
            "route_id": self.route.pk,
            "student_display_name": "Estudiante ficticio",
            "pickup_instruction": "Parada sintética",
            "guardian_display_name": "Apoderado",
            "guardian_contact": "912345678",
            "starts_on": "2026-09-28",
            "ends_on": None,
        }
        data.update(changes)
        return data

    def test_today_is_private_projection_and_start_end_are_idempotent(self):
        self.assertEqual(
            self.post("driver/passenger-assignments/", self.assignment()).status_code,
            201,
        )
        before = self.client.get(BASE + "driver/today/", secure=True)
        self.assertEqual(before.status_code, 200)
        self.assertIn("no-store", before["Cache-Control"])
        self.assertEqual(before.json()["service_date"], DAY.isoformat())
        card = before.json()["routes"][0]
        self.assertIsNone(card["run"])
        self.assertEqual((card["used_seats"], card["available_seats"]), (1, 2))
        self.assertEqual(card["roster"][0]["pickup_instruction"], "Parada sintética")
        self.assertEqual(RouteRun.objects.count(), 0)

        path = f"driver/routes/{self.route.pk}/start/"
        first = self.post(path)
        self.assertEqual(first.status_code, 200, first.content)
        self.assertIn("no-store", first["Cache-Control"])
        second = self.post(path)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(RouteRun.objects.count(), 1)
        run = RouteRun.objects.get()
        self.assertEqual(run.seat_capacity_snapshot, 3)
        self.assertEqual(run.start_time_snapshot, self.route.start_time)
        end_path = f"driver/runs/{run.pk}/end/"
        completed = self.post(end_path)
        self.assertEqual(completed.status_code, 200)
        self.assertIn("no-store", completed["Cache-Control"])
        self.assertEqual(self.post(end_path).json(), completed.json())
        self.assertEqual(self.post(path).status_code, 409)
        self.assertEqual(RouteRun.objects.count(), 1)

    def test_roles_guessed_ids_and_future_or_planned_transitions(self):
        other_run = RouteRun.objects.create(
            route=self.route,
            service_date=DAY + timedelta(days=7),
            state="planned",
            weekdays_snapshot=self.route.weekdays,
            start_time_snapshot=self.route.start_time,
            end_time_snapshot=self.route.end_time,
            seat_capacity_snapshot=3,
            destination_label_snapshot=self.route.destination_label,
            destination_address_snapshot=self.route.destination_address,
        )
        self.assertEqual(self.post(f"driver/runs/{other_run.pk}/end/").status_code, 409)
        self.assertEqual(
            self.post(
                f"driver/routes/{self.route.pk}/start/", {"service_date": "2026-10-05"}
            ).status_code,
            400,
        )
        for user in (self.other_user, self.parent, self.admin):
            self.login(user)
            expected = 404 if user == self.other_user else 403
            self.assertEqual(
                self.post(f"driver/routes/{self.route.pk}/start/").status_code, expected
            )
            self.assertEqual(
                self.post(f"driver/runs/{other_run.pk}/end/").status_code, expected
            )
            self.assertEqual(
                self.client.get(BASE + "driver/today/", secure=True).status_code,
                200 if user == self.other_user else 403,
            )
        self.client.logout()
        self.assertEqual(
            self.client.get(BASE + "driver/today/", secure=True).status_code, 403
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            RouteRun.objects.create(
                route=self.route,
                service_date=other_run.service_date,
                state="planned",
                weekdays_snapshot=self.route.weekdays,
                start_time_snapshot=self.route.start_time,
                end_time_snapshot=self.route.end_time,
                seat_capacity_snapshot=3,
                destination_label_snapshot=self.route.destination_label,
                destination_address_snapshot=self.route.destination_address,
            )

    def test_planned_row_starts_once_with_server_snapshot(self):
        planned = RouteRun.objects.create(
            route=self.route,
            service_date=DAY,
            state="planned",
            weekdays_snapshot=self.route.weekdays,
            start_time_snapshot=self.route.start_time,
            end_time_snapshot=self.route.end_time,
            seat_capacity_snapshot=3,
            destination_label_snapshot=self.route.destination_label,
            destination_address_snapshot=self.route.destination_address,
        )
        self.assertEqual(self.post(f"driver/runs/{planned.pk}/end/").status_code, 409)
        started = self.post(f"driver/routes/{self.route.pk}/start/")
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.json()["id"], planned.pk)
        self.assertEqual(started.json()["state"], "in_progress")
        self.assertEqual(RouteRun.objects.count(), 1)

    def test_prior_day_recovery_and_started_day_freeze(self):
        current = self.post(
            "driver/passenger-assignments/",
            self.assignment(starts_on="2026-09-21"),
        ).json()
        started = self.post(f"driver/routes/{self.route.pk}/start/").json()
        for change in (
            {"status": "inactive"},
            {"weekdays": ["tuesday"]},
            {"start_time": "06:00"},
            {"seat_capacity": 4},
            {"destination_address": "Otro destino"},
        ):
            self.assertEqual(self.patch_route(change).status_code, 409)
        self.assertEqual(
            self.post(
                "driver/passenger-assignments/",
                self.assignment(guardian_contact="923456789"),
            ).status_code,
            409,
        )
        patch_path = f"driver/passenger-assignments/{current['id']}/"
        changed = self.client.patch(
            BASE + patch_path,
            json.dumps({"pickup_instruction": "Otra parada"}),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )
        self.assertEqual(changed.status_code, 409)
        self.assertEqual(
            self.post(
                "driver/passenger-assignments/",
                self.assignment(starts_on="2026-10-05", guardian_contact="923456789"),
            ).status_code,
            201,
        )
        self.assertEqual(
            self.post(
                f"driver/passenger-assignments/{current['id']}/end/",
                {"ends_on": "2026-09-27"},
            ).status_code,
            409,
        )
        with patch(
            "drivers.daily_operation.local_today", return_value=DAY + timedelta(days=1)
        ):
            previous = self.client.get(BASE + "driver/today/", secure=True).json()[
                "unfinished_runs"
            ]
            self.assertEqual(previous[0]["id"], started["id"])
            self.assertEqual(
                self.post(f"driver/runs/{started['id']}/end/").status_code, 200
            )
            self.assertEqual(
                self.client.get(BASE + "driver/today/", secure=True).json()[
                    "unfinished_runs"
                ],
                [],
            )

    def test_completed_run_keeps_todays_roster_frozen_until_next_local_day(self):
        current = self.post(
            "driver/passenger-assignments/",
            self.assignment(starts_on="2026-09-21"),
        ).json()
        future = self.post(
            "driver/passenger-assignments/",
            self.assignment(starts_on="2026-10-05", guardian_contact="923456789"),
        ).json()
        run = self.post(f"driver/routes/{self.route.pk}/start/").json()
        self.assertEqual(
            self.post(f"driver/runs/{run['id']}/end/").json()["state"],
            RouteRun.State.COMPLETED,
        )

        def edit(assignment_id, changes):
            return self.client.patch(
                BASE + f"driver/passenger-assignments/{assignment_id}/",
                json.dumps(changes),
                content_type="application/json",
                secure=True,
                HTTP_ORIGIN="https://testserver",
                HTTP_X_CSRFTOKEN=self.token,
            )

        today_path = "driver/passenger-assignments/"
        self.assertEqual(
            self.post(
                today_path, self.assignment(guardian_contact="934567890")
            ).status_code,
            409,
        )
        self.assertEqual(
            edit(future["id"], {"starts_on": DAY.isoformat()}).status_code, 409
        )
        self.assertEqual(
            edit(current["id"], {"pickup_instruction": "Parada cambiada"}).status_code,
            409,
        )
        self.assertEqual(
            self.post(
                f"driver/passenger-assignments/{current['id']}/end/",
                {"ends_on": "2026-09-27"},
            ).status_code,
            409,
        )
        card = self.client.get(BASE + "driver/today/", secure=True).json()["routes"][0]
        self.assertEqual(card["run"]["state"], RouteRun.State.COMPLETED)
        self.assertEqual((card["used_seats"], card["available_seats"]), (1, 2))
        self.assertEqual(card["roster"][0]["pickup_instruction"], "Parada sintética")

        self.assertEqual(
            edit(future["id"], {"pickup_instruction": "Parada futura"}).status_code,
            200,
        )
        with patch(
            "drivers.operations_api.local_today", return_value=DAY + timedelta(days=1)
        ):
            self.assertEqual(
                self.post(
                    today_path,
                    self.assignment(
                        starts_on="2026-09-29", guardian_contact="934567890"
                    ),
                ).status_code,
                201,
            )
            self.assertEqual(
                edit(
                    current["id"], {"pickup_instruction": "Parada cambiada"}
                ).status_code,
                200,
            )
            self.assertEqual(
                self.post(
                    f"driver/passenger-assignments/{current['id']}/end/",
                    {"ends_on": DAY.isoformat()},
                ).status_code,
                200,
            )


class ConcurrentStartTests(TransactionTestCase):
    def setUp(self):
        self.driver_user = User.objects.create_user(
            "concurrent@example.test", "Synthetic-Only-Password-781!", role="driver"
        )
        driver = DriverProfile.objects.create(
            user=self.driver_user, display_name="Conductor Ficticio"
        )
        self.route = Route.objects.create(
            driver=driver,
            label="Ruta ficticia",
            status="active",
            weekdays=["monday"],
            start_time=time(7),
            end_time=time(8),
            seat_capacity=3,
            destination_label="Escuela ficticia",
            destination_address="Dirección ficticia",
        )

    def test_two_starts_materialize_one_run(self):
        barrier = Barrier(2, timeout=10)
        original_post = RouteStartView.post

        def concurrent_post(view, request, id):
            # Both requests must enter the start view before either can lock the route.
            barrier.wait()
            return original_post(view, request, id)

        def start():
            close_old_connections()
            try:
                client = Client(enforce_csrf_checks=True)
                client.force_login(User.objects.get(pk=self.driver_user.pk))
                token = client.get(BASE + "auth/csrf/", secure=True).json()[
                    "csrf_token"
                ]
                response = client.post(
                    BASE + f"driver/routes/{self.route.pk}/start/",
                    "{}",
                    content_type="application/json",
                    secure=True,
                    HTTP_ORIGIN="https://testserver",
                    HTTP_X_CSRFTOKEN=token,
                )
                return response.status_code, response.json()
            finally:
                close_old_connections()

        # Keep the date patch active until both requests finish. Per-thread patches
        # of the same module attribute can restore the real date mid-request.
        with (
            patch("drivers.daily_operation.local_today", return_value=DAY),
            patch.object(RouteStartView, "post", concurrent_post),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            futures = [executor.submit(start) for _ in range(2)]
            results = [future.result() for future in futures]

        self.assertEqual([status for status, _ in results], [200, 200])
        self.assertEqual(results[0][1], results[1][1])
        self.assertEqual(results[0][1]["state"], RouteRun.State.IN_PROGRESS)
        self.assertEqual(RouteRun.objects.count(), 1)
        self.assertEqual(
            {body["id"] for _, body in results}, {RouteRun.objects.get().pk}
        )
