"""Owner-only roster, manual transport payments and operational summary."""

from django.db import models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from accounts.models import DriverProfile
from drivers.capacity import capacity_snapshot, local_today, validate_capacity
from drivers.models import PassengerAssignment, PaymentRecord, Route
from drivers.publication import publication_json, utc_instant
from drivers.publication_api import DriverView


class OperationConflict(APIException):
    status_code = 409
    default_detail = "El registro ya cambió. Actualiza antes de continuar."
    default_code = "operation_conflict"


class AssignmentInput(serializers.Serializer):
    route_id = serializers.IntegerField(min_value=1)
    student_display_name = serializers.CharField(max_length=100)
    pickup_instruction = serializers.CharField(max_length=255)
    guardian_display_name = serializers.CharField(max_length=100)
    guardian_contact = serializers.RegexField(
        regex=r"\A[0-9]{9}\Z",
        min_length=9,
        max_length=9,
        error_messages={"invalid": "Ingresa un teléfono de 9 dígitos."},
    )
    starts_on = serializers.DateField()
    ends_on = serializers.DateField(allow_null=True)

    def validate(self, attrs):
        if attrs["ends_on"] is not None and attrs["ends_on"] < attrs["starts_on"]:
            raise ValidationError(
                {"ends_on": ["El término debe ser igual o posterior al inicio."]}
            )
        return attrs


def assignment_json(row):
    return {
        "id": row.pk,
        "route_id": row.route_id,
        "student_display_name": row.student_display_name,
        "pickup_instruction": row.pickup_instruction,
        "guardian_display_name": row.guardian_display_name,
        "guardian_contact": row.guardian_contact,
        "starts_on": row.starts_on.isoformat(),
        "ends_on": row.ends_on.isoformat() if row.ends_on else None,
        "created_at": utc_instant(row.created_at),
        "updated_at": utc_instant(row.updated_at),
    }


def exact_fields(data, fields):
    if set(data) != set(fields):
        raise ValidationError({"fields": ["Indica solo los campos permitidos."]})


class AssignmentsView(DriverView):
    def get(self, request):
        driver = self.driver(request)
        rows = PassengerAssignment.objects.filter(route__driver=driver).order_by(
            "route_id", "id"
        )
        route_id = request.query_params.get("route_id")
        if route_id is not None:
            if not route_id.isdecimal():
                raise ValidationError({"route_id": ["Ruta inválida."]})
            get_object_or_404(Route, pk=int(route_id), driver=driver)
            rows = rows.filter(route_id=int(route_id))
        return Response({"assignments": [assignment_json(row) for row in rows]})

    def post(self, request):
        form = AssignmentInput(data=request.data)
        form.is_valid(raise_exception=True)
        exact_fields(request.data, form.fields)
        data = form.validated_data
        with transaction.atomic():
            route = get_object_or_404(
                Route.objects.select_for_update(),
                pk=data["route_id"],
                driver=self.driver(request),
            )
            validate_capacity(
                route, replacement=(None, data["starts_on"], data["ends_on"])
            )
            row = PassengerAssignment.objects.create(
                route=route, **{k: v for k, v in data.items() if k != "route_id"}
            )
        return Response(assignment_json(row), status=201)


class AssignmentDetailView(DriverView):
    def get(self, request, id):
        row = get_object_or_404(
            PassengerAssignment, pk=id, route__driver=self.driver(request)
        )
        return Response(assignment_json(row))

    def patch(self, request, id):
        driver = self.driver(request)
        original = get_object_or_404(PassengerAssignment, pk=id, route__driver=driver)
        if "route_id" in request.data and request.data["route_id"] != original.route_id:
            raise ValidationError(
                {
                    "route_id": [
                        "Termina esta asignación y crea otra para cambiar de ruta."
                    ]
                }
            )
        merged = {k: getattr(original, k) for k in AssignmentInput().fields}
        merged.update(request.data)
        form = AssignmentInput(data=merged)
        form.is_valid(raise_exception=True)
        if set(request.data) - set(form.fields):
            raise ValidationError({"fields": ["Campo no permitido."]})
        data = form.validated_data
        with transaction.atomic():
            route = get_object_or_404(
                Route.objects.select_for_update(), pk=original.route_id, driver=driver
            )
            row = get_object_or_404(
                PassengerAssignment.objects.select_for_update(), pk=id, route=route
            )
            validate_capacity(
                route, replacement=(row.pk, data["starts_on"], data["ends_on"])
            )
            for key, value in data.items():
                if key != "route_id":
                    setattr(row, key, value)
            row.save()
        return Response(assignment_json(row))


class AssignmentEndView(DriverView):
    def post(self, request, id):
        exact_fields(request.data, {"ends_on"})
        date_field = serializers.DateField()
        end = date_field.run_validation(request.data["ends_on"])
        driver = self.driver(request)
        original = get_object_or_404(PassengerAssignment, pk=id, route__driver=driver)
        with transaction.atomic():
            route = get_object_or_404(
                Route.objects.select_for_update(), pk=original.route_id, driver=driver
            )
            row = get_object_or_404(
                PassengerAssignment.objects.select_for_update(), pk=id, route=route
            )
            if end < row.starts_on:
                raise ValidationError(
                    {"ends_on": ["El término debe ser igual o posterior al inicio."]}
                )
            if row.ends_on is not None and end >= row.ends_on:
                raise OperationConflict()
            validate_capacity(route, replacement=(row.pk, row.starts_on, end))
            row.ends_on = end
            row.save(update_fields=["ends_on", "updated_at"])
        return Response(assignment_json(row))


class PaymentInput(serializers.Serializer):
    assignment_id = serializers.IntegerField(min_value=1)
    service_period_start = serializers.DateField()
    service_period_end = serializers.DateField()
    amount_clp = serializers.IntegerField(min_value=1)
    due_on = serializers.DateField()

    def validate(self, attrs):
        if attrs["service_period_end"] < attrs["service_period_start"]:
            raise ValidationError(
                {"service_period_end": ["El período termina antes de comenzar."]}
            )
        return attrs


def payment_json(row):
    return {
        "id": row.pk,
        "assignment_id": row.assignment_id,
        "service_period_start": row.service_period_start.isoformat(),
        "service_period_end": row.service_period_end.isoformat(),
        "amount_clp": row.amount_clp,
        "due_on": row.due_on.isoformat(),
        "status": row.status,
        "paid_at": utc_instant(row.paid_at) if row.paid_at else None,
        "created_at": utc_instant(row.created_at),
        "updated_at": utc_instant(row.updated_at),
    }


class PaymentsView(DriverView):
    def get(self, request):
        rows = PaymentRecord.objects.filter(driver=self.driver(request)).order_by("-id")
        return Response({"payments": [payment_json(row) for row in rows]})

    def post(self, request):
        form = PaymentInput(data=request.data)
        form.is_valid(raise_exception=True)
        exact_fields(request.data, form.fields)
        data = form.validated_data
        driver = self.driver(request)
        assignment = get_object_or_404(
            PassengerAssignment, pk=data.pop("assignment_id"), route__driver=driver
        )
        with transaction.atomic():
            row = PaymentRecord.objects.create(
                driver=driver, assignment=assignment, **data
            )
        return Response(payment_json(row), status=201)


class PaymentDetailView(DriverView):
    def get(self, request, id):
        row = get_object_or_404(
            PaymentRecord,
            pk=id,
            driver=self.driver(request),
            assignment__route__driver=self.driver(request),
        )
        return Response(payment_json(row))


def transition_payment(request, id, target):
    exact_fields(request.data, set())
    driver = get_object_or_404(DriverProfile, user=request.user)
    with transaction.atomic():
        row = get_object_or_404(
            PaymentRecord.objects.select_for_update(),
            pk=id,
            driver=driver,
            assignment__route__driver=driver,
        )
        if row.status == PaymentRecord.Status.VOID or (
            target == "paid" and row.status != PaymentRecord.Status.PENDING
        ):
            raise OperationConflict()
        row.status = target
        if target == "paid":
            row.paid_at = timezone.now()
        row.save(update_fields=["status", "paid_at", "updated_at"])
    return Response(payment_json(row))


class PaymentPaidView(DriverView):
    def post(self, request, id):
        return transition_payment(request, id, "paid")


class PaymentVoidView(DriverView):
    def post(self, request, id):
        return transition_payment(request, id, "void")


class DriverSummaryView(DriverView):
    def get(self, request):
        driver = self.driver(request)
        today = local_today()
        routes = Route.objects.filter(driver=driver).order_by("id")
        assignments = (
            PassengerAssignment.objects.filter(
                route__driver=driver, starts_on__lte=today
            )
            .filter(models.Q(ends_on__isnull=True) | models.Q(ends_on__gte=today))
            .count()
        )
        payments = {
            status: PaymentRecord.objects.filter(driver=driver, status=status).count()
            for status in PaymentRecord.Status.values
        }
        return Response(
            {
                "publication": publication_json(driver),
                "routes": [
                    {
                        "id": route.id,
                        "label": route.label,
                        "status": route.status,
                        "seat_capacity": route.seat_capacity,
                        **capacity_snapshot(route, today),
                    }
                    for route in routes
                ],
                "active_assignments": assignments,
                "payment_counts": payments,
            }
        )
