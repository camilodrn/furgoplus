"""Monthly owner-only cohorts. Current states are never historical balances."""

import re
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta

from django.db import connection, transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from drivers.capacity import capacity_snapshot, local_today
from drivers.models import ContactRequest, PaymentRecord, Route, RouteRun
from drivers.publication import CHILE

LIMIT = 10000
NOTES = [
    "Pagos manuales seleccionados por vencimiento; no acreditan cobros bancarios.",
    "Servicios seleccionados por fecha de servicio; capacidad snapshot, "
    "sin asistencia ni ocupación histórica.",
    "Contactos seleccionados por recepción; estados actuales, no estados al cierre "
    "del mes. Aceptación no acredita contratación.",
    "Cupos disponibles: proyección del próximo servicio con asignaciones actuales, "
    "independiente del mes consultado.",
]


def month_window(params):
    if set(params) - {"month"} or any(len(params.getlist(k)) != 1 for k in params):
        raise ValidationError({"month": ["Indica solo un mes YYYY-MM."]})
    value = params.get("month", local_today().strftime("%Y-%m"))
    if not re.fullmatch(r"20[0-9]{2}-(0[1-9]|1[0-2])", value):
        raise ValidationError({"month": ["Usa YYYY-MM entre 2000-01 y 2099-12."]})
    start = date.fromisoformat(value + "-01")
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, end


def period_json(start, end):
    return {
        "month": start.strftime("%Y-%m"),
        "start": str(start),
        "end_exclusive": str(end),
        "timezone": "America/Santiago",
    }


def queries(driver, start, end):
    return {
        "payments": PaymentRecord.objects.filter(
            driver=driver,
            assignment__route__driver=driver,
            due_on__gte=start,
            due_on__lt=end,
        ),
        "runs": RouteRun.objects.filter(
            route__driver=driver, service_date__gte=start, service_date__lt=end
        ),
        "contacts": ContactRequest.objects.filter(
            driver=driver,
            created_at__gte=datetime.combine(start, time.min, CHILE),
            created_at__lt=datetime.combine(end, time.min, CHILE),
        ),
    }


def summarize(qs):
    payments = {s: {"count": 0, "amount_clp": 0} for s in PaymentRecord.Status.values}
    for row in (
        qs["payments"]
        .values("status")
        .annotate(count=Count("id"), amount=Sum("amount_clp"))
    ):
        payments[row["status"]] = {"count": row["count"], "amount_clp": row["amount"]}
    runs = {s: 0 for s in RouteRun.State.values}
    runs.update(
        {
            r["state"]: r["count"]
            for r in qs["runs"].values("state").annotate(count=Count("id"))
        }
    )
    contacts = {s: 0 for s in ContactRequest.Status.values}
    contacts.update(
        {
            r["status"]: r["count"]
            for r in qs["contacts"].values("status").annotate(count=Count("id"))
        }
    )
    return {
        "payments": payments,
        "payment_count": sum(r["count"] for r in payments.values()),
        "non_void_amount_clp": sum(
            payments[s]["amount_clp"] for s in ("pending", "paid")
        ),
        "runs": runs,
        "run_count": sum(runs.values()),
        "recorded_capacity_total": qs["runs"].aggregate(
            n=Sum("seat_capacity_snapshot")
        )["n"]
        or 0,
        "contacts": contacts,
        "contact_count": sum(contacts.values()),
    }


def monthly_report(driver, start, end):
    today = local_today()
    return {
        "period": period_json(start, end),
        "generated_at": timezone.localtime(timezone.now(), CHILE).isoformat(),
        "summary": summarize(queries(driver, start, end)),
        "current_capacity": {
            "as_of": str(today),
            "routes": [
                {
                    "route_id": r.pk,
                    "status": r.status,
                    "seat_capacity": r.seat_capacity,
                    **capacity_snapshot(r, today),
                }
                for r in Route.objects.filter(driver=driver).order_by("id")
            ],
        },
        "notes": NOTES,
    }


@contextmanager
def report_snapshot():
    # PostgreSQL keeps aggregates, detail and comparisons on one database snapshot.
    nested = connection.in_atomic_block
    with transaction.atomic():
        if connection.vendor == "postgresql" and not nested:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
                )
        yield


DETAIL_FIELDS = {
    "payments": (
        "id",
        "service_period_start",
        "service_period_end",
        "due_on",
        "status",
        "amount_clp",
    ),
    "runs": (
        "id",
        "route_id",
        "service_date",
        "state",
        "seat_capacity_snapshot",
        "start_time_snapshot",
        "end_time_snapshot",
    ),
    "contacts": ("id", "created_at", "status", "resolved_at"),
}


def detail_rows(qs, kind):
    rows = list(qs[kind].order_by("id").values(*DETAIL_FIELDS[kind])[: LIMIT + 1])
    if len(rows) > LIMIT:
        raise ValidationError(
            {
                "month": [
                    "El reporte supera 10.000 registros; solicita revisión del período."
                ]
            }
        )
    return [
        {
            k: timezone.localtime(v, CHILE).isoformat()
            if isinstance(v, datetime)
            else v.isoformat()
            if isinstance(v, (date, time))
            else v
            for k, v in row.items()
        }
        for row in rows
    ]


def comparison(driver, start):
    previous = (start - timedelta(days=1)).replace(day=1)
    return {
        "period": period_json(previous, start),
        "summary": summarize(queries(driver, previous, start)),
    }


def advanced_report(driver, start, end):
    body = monthly_report(driver, start, end)
    body["previous"] = comparison(driver, start)
    qs = queries(driver, start, end)
    body["details"] = {kind: detail_rows(qs, kind) for kind in DETAIL_FIELDS}
    return body
