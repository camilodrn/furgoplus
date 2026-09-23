import hashlib
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import APIException, NotAuthenticated, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AuthThrottle, DriverProfile, ParentProfile

User = get_user_model()


class CsrfFailed(APIException):
    status_code = 403
    default_detail = "CSRF verification failed."
    default_code = "csrf_failed"


class Throttled(APIException):
    status_code = 429
    default_detail = "Too many attempts. Try again later."
    default_code = "throttled"


class JsonSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        from rest_framework.authentication import CSRFCheck

        check = CSRFCheck(lambda _: None)
        check.process_request(request)
        if check.process_view(request, None, (), {}):
            raise CsrfFailed()


def no_store(response):
    response["Cache-Control"] = "no-store"
    return response


def identity(user):
    display_name = None
    if user.role == User.Role.PARENT:
        profile = getattr(user, "parent_profile", None)
        display_name = profile.display_name if profile else None
    elif user.role == User.Role.DRIVER:
        profile = getattr(user, "driver_profile", None)
        display_name = profile.display_name if profile else None
    return {
        "id": user.pk,
        "email": user.email,
        "role": user.role,
        "display_name": display_name,
    }


def throttle(request, action, limit, interval):
    # A single PostgreSQL row serializes attempts from one source across workers.
    address = request.META.get("REMOTE_ADDR", "unknown")
    key = hashlib.sha256(f"{action}:{address}".encode()).hexdigest()
    now = timezone.now()
    with transaction.atomic():
        row, _ = AuthThrottle.objects.get_or_create(
            key=key, defaults={"window_started_at": now}
        )
        row = AuthThrottle.objects.select_for_update().get(key=key)
        if now - row.window_started_at >= interval:
            row.window_started_at = now
            row.attempts = 0
        row.attempts += 1
        row.save(update_fields=["window_started_at", "attempts"])
        exceeded = row.attempts > limit
    if exceeded:
        raise Throttled()


class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return no_store(Response({"csrf_token": get_token(request._request)}))


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        throttle(request, "register", 5, timedelta(hours=1))
        data = request.data
        allowed = {"email", "password", "role", "display_name"}
        if not isinstance(data, dict) or set(data) != allowed:
            raise ValidationError({"account": ["Invalid registration details."]})
        role = data.get("role")
        if role not in (User.Role.PARENT, User.Role.DRIVER):
            raise ValidationError({"role": ["Invalid registration details."]})
        email, password, name = data["email"], data["password"], data["display_name"]
        if (
            not isinstance(email, str)
            or not isinstance(password, str)
            or not isinstance(name, str)
        ):
            raise ValidationError({"account": ["Invalid registration details."]})
        name = name.strip()
        if not name or len(name) > 100:
            raise ValidationError(
                {"display_name": ["Enter a display name of at most 100 characters."]}
            )
        try:
            email = User.objects.normalize_email(email)
            candidate = User(email=email, role=role)
            candidate.full_clean(exclude=["password"], validate_unique=False)
            validate_password(password, candidate)
        except Exception as exc:
            from django.core.exceptions import ValidationError as DjangoValidationError

            if isinstance(exc, (DjangoValidationError, ValueError)):
                raise ValidationError(
                    {"account": ["Invalid registration details."]}
                ) from None
            raise
        try:
            with transaction.atomic():
                user = User.objects.create_user(email, password, role=role)
                if role == User.Role.PARENT:
                    ParentProfile.objects.create(user=user, display_name=name)
                else:
                    DriverProfile.objects.create(user=user, display_name=name)
        except IntegrityError:
            raise ValidationError(
                {"account": ["Invalid registration details."]}
            ) from None
        return no_store(Response(identity(user), status=status.HTTP_201_CREATED))


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        throttle(request, "login", 10, timedelta(minutes=15))
        data = request.data
        if not isinstance(data, dict) or set(data) != {"email", "password"}:
            raise ValidationError({"credentials": ["Invalid credentials."]})
        email, password = data["email"], data["password"]
        if not isinstance(email, str) or not isinstance(password, str):
            raise ValidationError({"credentials": ["Invalid credentials."]})
        user = authenticate(
            request._request, email=email.strip().lower(), password=password
        )
        if user is None or not user.is_active:
            raise ValidationError({"credentials": ["Invalid credentials."]})
        login(request._request, user)
        request._request.session.set_expiry(timezone.now() + timedelta(hours=12))
        return no_store(
            Response({**identity(user), "csrf_token": get_token(request._request)})
        )


class MeView(APIView):
    authentication_classes = [JsonSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_active:
            raise NotAuthenticated()
        return no_store(Response(identity(request.user)))


class LogoutView(APIView):
    authentication_classes = [JsonSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request._request)
        return no_store(Response({"ok": True}))
