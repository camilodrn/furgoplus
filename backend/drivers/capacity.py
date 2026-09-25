"""Dated capacity for recurring routes, validated under a route lock."""

from datetime import date, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from drivers.models import PassengerAssignment
from drivers.publication import CHILE, WEEKDAYS


def local_today():
    return timezone.localtime(timezone.now(), CHILE).date()


def next_service_date(weekdays, on_or_after):
    return on_or_after + timedelta(
        days=min((WEEKDAYS.index(day) - on_or_after.weekday()) % 7 for day in weekdays)
    )


def used_seats(route, service_date):
    return (
        PassengerAssignment.objects.filter(route=route, starts_on__lte=service_date)
        .filter(Q(ends_on__isnull=True) | Q(ends_on__gte=service_date))
        .count()
    )


def capacity_snapshot(route, today=None):
    service_date = next_service_date(route.weekdays, today or local_today())
    used = used_seats(route, service_date)
    return {
        "next_service_date": service_date.isoformat(),
        "used_seats": used,
        "available_seats": route.seat_capacity - used,
    }


def validate_capacity(route, *, weekdays=None, capacity=None, replacement=None):
    """Check every constant-demand segment, including an unbounded last segment.

    Every assignment contributes at start and stops the day after its inclusive end.
    The first scheduled date in a segment has the same demand as all its dates.
    """
    weekdays = weekdays if weekdays is not None else route.weekdays
    capacity = capacity if capacity is not None else route.seat_capacity
    rows = list(
        PassengerAssignment.objects.filter(route=route).values_list(
            "id", "starts_on", "ends_on"
        )
    )
    if replacement is not None:
        replaced_id, starts_on, ends_on = replacement
        rows = [row for row in rows if row[0] != replaced_id]
        rows.append((replaced_id, starts_on, ends_on))
    events = {}
    for _, start, end in rows:
        events[start] = events.get(start, 0) + 1
        if end is not None and end < date.max:
            stop = end + timedelta(days=1)
            events[stop] = events.get(stop, 0) - 1
    demand = 0
    boundaries = sorted(events)
    for index, boundary in enumerate(boundaries):
        demand += events[boundary]
        if demand <= capacity:
            continue
        segment_end = boundaries[index + 1] if index + 1 < len(boundaries) else None
        candidate = next_service_date(weekdays, boundary)
        if segment_end is None or candidate < segment_end:
            raise ValidationError(
                {
                    "seat_capacity": [
                        "Los cupos no alcanzan para las asignaciones "
                        "en fechas de servicio."
                    ]
                }
            )
