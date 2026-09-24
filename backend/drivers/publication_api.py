import re
from datetime import UTC

from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import (
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import DriverProfile, User
from api.auth import JsonSessionAuthentication, no_store
from drivers.models import (
    AdminActionLog,
    Commune,
    DriverSubscription,
    Plan,
    Route,
    RouteCoverage,
)
from drivers.publication import (
    CHILE,
    WEEKDAYS,
    StateConflict,
    change_subscription,
    discovery_json,
    publication_json,
    publication_state,
)


class RoleView(APIView):
    authentication_classes = [JsonSessionAuthentication]
    role = None

    def finalize_response(self, request, response, *args, **kwargs):
        return no_store(super().finalize_response(request, response, *args, **kwargs))

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_authenticated or not request.user.is_active:
            raise NotAuthenticated()
        if request.user.role != self.role or (
            self.role == User.Role.ADMIN and not request.user.is_staff
        ):
            raise PermissionDenied()


class DriverView(RoleView):
    role = User.Role.DRIVER

    def driver(self, request):
        return get_object_or_404(DriverProfile, user=request.user)


class AdminView(RoleView):
    role = User.Role.ADMIN


class ParentView(RoleView):
    role = User.Role.PARENT


class PublicationInput(serializers.Serializer):
    publication_requested = serializers.BooleanField()


class DriverPublicationView(DriverView):
    def get(self, request):
        return no_store(Response(publication_json(self.driver(request))))

    def patch(self, request):
        input_data = PublicationInput(data=request.data)
        input_data.is_valid(raise_exception=True)
        if set(request.data) != {"publication_requested"}:
            raise ValidationError(
                {
                    "publication_requested": [
                        "Solo se acepta la solicitud de publicación."
                    ]
                }
            )
        with transaction.atomic():
            driver = DriverProfile.objects.select_for_update().get(user=request.user)
            driver.publication_requested = input_data.validated_data[
                "publication_requested"
            ]
            driver.save(update_fields=["publication_requested"])
        return no_store(Response(publication_json(driver)))


class RouteInput(serializers.Serializer):
    label = serializers.CharField(max_length=100, trim_whitespace=True)
    status = serializers.ChoiceField(choices=Route.Status.choices)
    weekdays = serializers.ListField(
        child=serializers.ChoiceField(choices=[(day, day) for day in WEEKDAYS]),
        min_length=1,
        max_length=7,
    )
    start_time = serializers.TimeField(format="%H:%M", input_formats=["%H:%M"])
    end_time = serializers.TimeField(format="%H:%M", input_formats=["%H:%M"])
    seat_capacity = serializers.IntegerField(min_value=1)
    destination_label = serializers.CharField(max_length=120, trim_whitespace=True)
    destination_address = serializers.CharField(max_length=255, trim_whitespace=True)
    coverage_codes = serializers.ListField(child=serializers.CharField(), min_length=1)

    def validate(self, attrs):
        if attrs["start_time"] >= attrs["end_time"]:
            raise ValidationError(
                {"end_time": ["El horario final debe ser posterior al inicial."]}
            )
        if len(set(attrs["weekdays"])) != len(attrs["weekdays"]):
            raise ValidationError({"weekdays": ["No repitas días."]})
        codes = attrs["coverage_codes"]
        if len(set(codes)) != len(codes):
            raise ValidationError({"coverage_codes": ["No repitas comunas."]})
        if Commune.objects.filter(code__in=codes, is_active=True).count() != len(codes):
            raise ValidationError(
                {"coverage_codes": ["Selecciona comunas vigentes del catálogo."]}
            )
        return attrs


def route_json(route):
    return {
        "id": route.pk,
        "label": route.label,
        "status": route.status,
        "weekdays": route.weekdays,
        "start_time": route.start_time.strftime("%H:%M"),
        "end_time": route.end_time.strftime("%H:%M"),
        "seat_capacity": route.seat_capacity,
        "destination_label": route.destination_label,
        "destination_address": route.destination_address,
        "revision": route.revision,
        "coverage_codes": sorted(route.communes.values_list("code", flat=True)),
    }


def save_route(driver, data, route=None):
    codes = data.pop("coverage_codes")
    if route is None:
        route = Route(driver=driver)
    for key, value in data.items():
        setattr(route, key, value)
    route.save()
    RouteCoverage.objects.filter(route=route).delete()
    RouteCoverage.objects.bulk_create(
        [
            RouteCoverage(route=route, commune=commune)
            for commune in Commune.objects.filter(code__in=codes, is_active=True)
        ]
    )
    return route


class CommunesView(DriverView):
    def get(self, request):
        return no_store(
            Response(
                {
                    "communes": list(
                        Commune.objects.filter(is_active=True)
                        .order_by("display_name")
                        .values("code", "display_name")
                    )
                }
            )
        )


class RoutesView(DriverView):
    def get(self, request):
        rows = Route.objects.filter(driver=self.driver(request)).order_by("id")
        return no_store(Response({"routes": [route_json(row) for row in rows]}))

    def post(self, request):
        form = RouteInput(data=request.data)
        form.is_valid(raise_exception=True)
        if set(request.data) != set(form.fields):
            raise ValidationError({"route": ["Indica todos los campos de la ruta."]})
        with transaction.atomic():
            driver = DriverProfile.objects.select_for_update().get(user=request.user)
            route = save_route(driver, dict(form.validated_data))
        return no_store(Response(route_json(route), status=201))


class RouteDetailView(DriverView):
    def get(self, request, id):
        route = get_object_or_404(Route, pk=id, driver=self.driver(request))
        return no_store(Response(route_json(route)))

    def patch(self, request, id):
        get_object_or_404(Route, pk=id, driver=self.driver(request))
        form = RouteInput(
            data={
                key: value
                for key, value in request.data.items()
                if key != "expected_revision"
            }
        )
        form.is_valid(raise_exception=True)
        if set(request.data) != {*form.fields, "expected_revision"} or not isinstance(
            request.data.get("expected_revision"), int
        ):
            raise ValidationError({"route": ["Indica todos los campos de la ruta."]})
        with transaction.atomic():
            driver = DriverProfile.objects.select_for_update().get(user=request.user)
            route = get_object_or_404(
                Route.objects.select_for_update(), pk=id, driver=driver
            )
            if route.revision != request.data["expected_revision"]:
                raise StateConflict()
            route.revision += 1
            route = save_route(driver, dict(form.validated_data), route)
        return no_store(Response(route_json(route)))


class PlansView(AdminView):
    def get(self, request):
        return no_store(
            Response(
                {
                    "plans": list(
                        Plan.objects.order_by("id").values("code", "display_label")
                    )
                }
            )
        )


class AdminPublicationView(AdminView):
    def get(self, request, id):
        driver = get_object_or_404(DriverProfile.objects.select_related("user"), pk=id)
        return no_store(Response(publication_json(driver)))


class UtcInstantField(serializers.DateTimeField):
    def to_internal_value(self, value):
        if value is not None and (
            not isinstance(value, str)
            or not re.search(r"(?:Z|[+-]\d{2}:\d{2})$", value)
        ):
            raise ValidationError("Indica un instante ISO con zona horaria.")
        parsed = super().to_internal_value(value)
        return parsed.astimezone(UTC) if parsed is not None else None


class SubscriptionInput(serializers.Serializer):
    plan_code = serializers.ChoiceField(
        choices=[("basic", "basic"), ("pro", "pro"), ("elite", "elite")]
    )
    status = serializers.ChoiceField(choices=DriverSubscription.Status.choices)
    starts_at = UtcInstantField(allow_null=True)
    ends_at = UtcInstantField(allow_null=True)
    reason = serializers.CharField(max_length=1000, trim_whitespace=True)
    expected_version = serializers.IntegerField(allow_null=True)


class AdminSubscriptionView(AdminView):
    def post(self, request, id):
        form = SubscriptionInput(data=request.data)
        form.is_valid(raise_exception=True)
        if set(request.data) != set(form.fields):
            raise ValidationError(
                {"subscription": ["Indica plan, vigencia, estado, motivo y versión."]}
            )
        if not DriverProfile.objects.filter(pk=id).exists():
            raise Http404()
        try:
            current, version = change_subscription(
                id, request.user, **form.validated_data
            )
        except Plan.DoesNotExist as exc:
            raise ValidationError({"plan_code": ["Plan desconocido."]}) from exc
        return no_store(
            Response(
                {"publication": publication_json(current.driver), "version": version}
            )
        )

    def get(self, request, id):
        driver = get_object_or_404(DriverProfile, pk=id)
        log = (
            AdminActionLog.objects.filter(target_type="subscription", target_id=id)
            .order_by("-id")
            .first()
        )
        return no_store(
            Response(
                {
                    "publication": publication_json(driver),
                    "version": log.pk if log else None,
                }
            )
        )


class DiscoveryListView(ParentView):
    def get(self, request):
        now = timezone.now()
        code = request.query_params.get("commune")
        if code and not Commune.objects.filter(code=code, is_active=True).exists():
            raise ValidationError({"commune": ["Comuna desconocida."]})
        results = []
        for driver in DriverProfile.objects.select_related("user").order_by("id"):
            state = publication_state(driver, now)
            if not state.eligible:
                continue
            body = discovery_json(driver, state, timezone.localtime(now, CHILE).date())
            if code and code not in {item["code"] for item in body["coverage"]}:
                continue
            results.append(body)
        return no_store(Response({"results": results}))


class DiscoveryDetailView(ParentView):
    def get(self, request, id):
        from drivers.contact_api import ReviewDetailMixin

        now = timezone.now()
        driver = get_object_or_404(DriverProfile.objects.select_related("user"), pk=id)
        state = publication_state(driver, now)
        if not state.eligible:
            raise Http404()
        return no_store(
            Response(
                ReviewDetailMixin.with_reviews(
                    discovery_json(
                        driver, state, timezone.localtime(now, CHILE).date()
                    ),
                    driver,
                )
            )
        )
