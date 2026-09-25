"""Private owner-driver daily projection and explicit run transitions."""

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from drivers.capacity import local_today, used_seats
from drivers.models import PassengerAssignment, Route, RouteRun
from drivers.publication import WEEKDAYS, utc_instant
from drivers.publication_api import DriverView


class RunConflict(APIException):
    status_code = 409
    default_detail = "La ruta cambió de estado. Actualiza e intenta de nuevo."
    default_code = "run_conflict"


def active_on(row, day):
    return row.starts_on <= day and (row.ends_on is None or day <= row.ends_on)


def frozen_today(route, day=None):
    return RouteRun.objects.filter(
        route=route,
        service_date=day or local_today(),
        state__in=[RouteRun.State.IN_PROGRESS, RouteRun.State.COMPLETED],
    ).exists()


def roster_json(route, day):
    rows = (
        PassengerAssignment.objects.filter(route=route, starts_on__lte=day)
        .filter(Q(ends_on__isnull=True) | Q(ends_on__gte=day))
        .order_by("id")
    )
    return [
        {
            "student_display_name": row.student_display_name,
            "pickup_instruction": row.pickup_instruction,
            "guardian_display_name": row.guardian_display_name,
            "guardian_contact": row.guardian_contact,
        }
        for row in rows
    ]


def run_json(run):
    return {
        "id": run.pk,
        "route_id": run.route_id,
        "service_date": run.service_date.isoformat(),
        "state": run.state,
        "start_time": run.start_time_snapshot.strftime("%H:%M"),
        "end_time": run.end_time_snapshot.strftime("%H:%M"),
        "seat_capacity": run.seat_capacity_snapshot,
        "destination_label": run.destination_label_snapshot,
        "destination_address": run.destination_address_snapshot,
        "started_at": utc_instant(run.started_at) if run.started_at else None,
        "ended_at": utc_instant(run.ended_at) if run.ended_at else None,
    }


class DriverTodayView(DriverView):
    def get(self, request):
        driver = self.driver(request)
        day = local_today()
        weekday = WEEKDAYS[day.weekday()]
        routes = Route.objects.filter(
            driver=driver, status=Route.Status.ACTIVE
        ).order_by("start_time", "id")
        cards = []
        for route in routes:
            if weekday not in route.weekdays:
                continue
            run = RouteRun.objects.filter(route=route, service_date=day).first()
            used = used_seats(route, day)
            cards.append(
                {
                    "route_id": route.pk,
                    "label": route.label,
                    "start_time": route.start_time.strftime("%H:%M"),
                    "end_time": route.end_time.strftime("%H:%M"),
                    "seat_capacity": route.seat_capacity,
                    "used_seats": used,
                    "available_seats": route.seat_capacity - used,
                    "destination_label": route.destination_label,
                    "destination_address": route.destination_address,
                    "roster": roster_json(route, day),
                    "run": run_json(run) if run else None,
                }
            )
        previous = (
            RouteRun.objects.filter(
                route__driver=driver,
                service_date__lt=day,
                state=RouteRun.State.IN_PROGRESS,
            )
            .select_related("route")
            .order_by("service_date", "id")
        )
        return Response(
            {
                "service_date": day.isoformat(),
                "routes": cards,
                "unfinished_runs": [
                    {"label": run.route.label, **run_json(run)} for run in previous
                ],
            }
        )


class RouteStartView(DriverView):
    def post(self, request, id):
        if request.data:
            raise ValidationError({"fields": ["No se aceptan campos."]})
        driver = self.driver(request)
        with transaction.atomic():
            route = get_object_or_404(
                Route.objects.select_for_update(), pk=id, driver=driver
            )
            day = local_today()
            run = RouteRun.objects.filter(route=route, service_date=day).first()
            if run:
                if run.state == RouteRun.State.IN_PROGRESS:
                    return Response(run_json(run))
                if run.state == RouteRun.State.COMPLETED:
                    raise RunConflict()
            if (
                route.status != Route.Status.ACTIVE
                or WEEKDAYS[day.weekday()] not in route.weekdays
            ):
                raise RunConflict()
            snapshot = {
                "weekdays_snapshot": list(route.weekdays),
                "start_time_snapshot": route.start_time,
                "end_time_snapshot": route.end_time,
                "seat_capacity_snapshot": route.seat_capacity,
                "destination_label_snapshot": route.destination_label,
                "destination_address_snapshot": route.destination_address,
            }
            if run is None:
                run = RouteRun.objects.create(
                    route=route,
                    service_date=day,
                    state=RouteRun.State.IN_PROGRESS,
                    started_at=timezone.now(),
                    **snapshot,
                )
            else:
                run.state = RouteRun.State.IN_PROGRESS
                run.started_at = timezone.now()
                for field, value in snapshot.items():
                    setattr(run, field, value)
                run.save(update_fields=["state", "started_at", *snapshot])
        return Response(run_json(run))


class RunEndView(DriverView):
    def post(self, request, id):
        if request.data:
            raise ValidationError({"fields": ["No se aceptan campos."]})
        driver = self.driver(request)
        # Every run transition and route/roster edit serializes on the route row.
        run = get_object_or_404(RouteRun, pk=id, route__driver=driver)
        with transaction.atomic():
            route = get_object_or_404(
                Route.objects.select_for_update(), pk=run.route_id, driver=driver
            )
            run = get_object_or_404(
                RouteRun.objects.select_for_update(), pk=id, route=route
            )
            if run.state == RouteRun.State.COMPLETED:
                return Response(run_json(run))
            if run.state != RouteRun.State.IN_PROGRESS:
                raise RunConflict()
            run.state = RouteRun.State.COMPLETED
            run.ended_at = timezone.now()
            run.save(update_fields=["state", "ended_at"])
        return Response(run_json(run))
