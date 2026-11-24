from collections import Counter, defaultdict

from django.db.models import Q
from rest_framework.exceptions import APIException

from drivers.models import PassengerAssignment


class StudentLimitReached(APIException):
    status_code = 409
    default_code = "student_limit_reached"


def student_usage(driver, plan, day):
    active = (
        PassengerAssignment.objects.filter(route__driver=driver, starts_on__lte=day)
        .filter(Q(ends_on__isnull=True) | Q(ends_on__gte=day))
        .values("student_id")
        .distinct()
        .count()
    )
    limit = plan.student_limit if plan else None
    return {
        "active": active,
        "limit": limit,
        "available": max(0, limit - active) if limit is not None else None,
        "plan_label": plan.label if plan else None,
    }


def validate_student_quota(driver, plan, student_id, starts_on, ends_on, today):
    """Check only dates on which the proposed assignment adds a unique student.

    The caller holds the driver's row lock across this check and the write.
    Existing excess after a downgrade can stay or decrease on each date.
    """
    start = max(starts_on, today)
    if plan is None or (ends_on is not None and ends_on < start):
        return

    overlap = PassengerAssignment.objects.filter(route__driver=driver).filter(
        Q(ends_on__isnull=True) | Q(ends_on__gte=start)
    )
    if ends_on is not None:
        overlap = overlap.filter(starts_on__lte=ends_on)

    # Counts change only at the first day and the day after an inclusive end.
    # Group deltas by identity to count a student once, even on several routes.
    events = defaultdict(Counter)
    events[start.toordinal()]  # Also check an interval with no existing rows.
    for identity, first, last in overlap.values_list(
        "student_id", "starts_on", "ends_on"
    ):
        events[max(first, start).toordinal()][identity] += 1
        if last is not None and (ends_on is None or last < ends_on):
            events[last.toordinal() + 1][identity] -= 1

    active = Counter()
    for day in sorted(events):
        for identity, delta in events[day].items():
            active[identity] += delta
            if not active[identity]:
                del active[identity]
        if student_id not in active and len(active) >= plan.student_limit:
            raise StudentLimitReached(
                f"Has alcanzado el máximo de estudiantes de tu plan {plan.label} "
                "para las fechas indicadas."
            )
