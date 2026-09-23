import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import (
    NotAcceptable,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.utils.mediatypes import media_type_matches
from rest_framework.views import APIView

from accounts.models import DriverProfile, User
from api.auth import JsonSessionAuthentication, no_store
from drivers.models import AdminActionLog, DriverDocument, DriverValidation
from drivers.services import (
    checklist_payload,
    decide,
    save_upload,
    submit,
    update_profile,
)


class PrivateView(APIView):
    authentication_classes = [JsonSessionAuthentication]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_authenticated or not request.user.is_active:
            raise NotAuthenticated()
        role = (
            User.Role.ADMIN
            if self.__class__.__name__.startswith("Admin")
            else User.Role.DRIVER
        )
        if request.user.role != role or (
            role == User.Role.ADMIN and not request.user.is_staff
        ):
            raise PermissionDenied()


class PrivateFileRenderer(BaseRenderer):
    """Advertise a supported download media type during DRF negotiation."""

    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Downloads use Django FileResponse. API errors are switched to JSON below.
        return JSONRenderer().render(data, renderer_context=renderer_context)


class PdfFileRenderer(PrivateFileRenderer):
    media_type = "application/pdf"
    format = "pdf"


class JpegFileRenderer(PrivateFileRenderer):
    media_type = "image/jpeg"
    format = "jpeg"


class PngFileRenderer(PrivateFileRenderer):
    media_type = "image/png"
    format = "png"


class OctetFileRenderer(PrivateFileRenderer):
    media_type = "application/octet-stream"
    format = "binary"


class PrivateDownloadView(PrivateView):
    renderer_classes = [
        JSONRenderer,
        PdfFileRenderer,
        JpegFileRenderer,
        PngFileRenderer,
        OctetFileRenderer,
    ]

    def ensure_acceptable_file(self, request, document):
        accept = request.META.get("HTTP_ACCEPT", "*/*")
        accepted = (part.split(";", 1)[0].strip() for part in accept.split(","))
        if not any(
            media_type_matches(part, document.content_type)
            or part == "application/octet-stream"
            for part in accepted
        ):
            raise NotAcceptable("El formato solicitado no está disponible.")

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if isinstance(response, Response):
            # Permission and missing-object errors retain their JSON wire format.
            response.accepted_renderer = JSONRenderer()
            response.accepted_media_type = "application/json"
        return response


def driver_profile(user):
    return get_object_or_404(DriverProfile, user=user)


def profile_json(profile):
    return {
        "display_name": profile.display_name,
        "service_summary": profile.service_summary,
        "service_contact_email": profile.service_contact_email,
        "validation_state": profile.validation_state,
        "current_validation_revision": profile.current_validation_revision,
        "approved_revision": profile.approved_revision,
    }


def document_json(document):
    return {
        "id": document.pk,
        "version": DriverDocument.objects.filter(
            driver_id=document.driver_id, kind=document.kind, pk__lte=document.pk
        ).count(),
        "kind": document.kind,
        "content_type": document.content_type,
        "byte_size": document.byte_size,
        "uploaded_at": document.uploaded_at.isoformat(),
        "expires_on": document.expires_on.isoformat() if document.expires_on else None,
        "is_current": document.is_current,
    }


def validation_comparison(validation):
    previous = (
        DriverValidation.objects.filter(
            driver_id=validation.driver_id, revision__lt=validation.revision
        )
        .order_by("-revision")
        .first()
    )
    result = {
        "previous_revision": previous.revision if previous else None,
        "changed_document_count": 0,
        "unchanged_document_count": 0,
        "changed_identity_field_count": 0,
        "has_material_changes": False,
        "document_changes": [],
        "identity_changes": [],
    }
    if previous is None:
        return result

    def snapshot_documents(item):
        return {
            link.kind: link.document
            for link in item.snapshot_documents.select_related("document")
        }

    before = snapshot_documents(previous)
    after = snapshot_documents(validation)
    versions = {}
    kind_counts = {}
    for document_id, kind in (
        DriverDocument.objects.filter(driver_id=validation.driver_id)
        .order_by("id")
        .values_list("id", "kind")
    ):
        kind_counts[kind] = kind_counts.get(kind, 0) + 1
        versions[document_id] = kind_counts[kind]
    for kind in sorted(before.keys() | after.keys()):
        old = before.get(kind)
        new = after.get(kind)
        status = (
            "added"
            if old is None
            else "removed"
            if new is None
            else "unchanged"
            if old.pk == new.pk
            else "replaced"
        )
        result["document_changes"].append(
            {
                "kind": kind,
                "status": status,
                "previous_version": versions[old.pk] if old else None,
                "current_version": versions[new.pk] if new else None,
                "previous_content_type": old.content_type if old else None,
                "current_content_type": new.content_type if new else None,
                "previous_expires_on": old.expires_on.isoformat()
                if old and old.expires_on
                else None,
                "current_expires_on": new.expires_on.isoformat()
                if new and new.expires_on
                else None,
            }
        )
        result[
            "unchanged_document_count"
            if status == "unchanged"
            else "changed_document_count"
        ] += 1

    if previous.display_name_snapshot != validation.display_name_snapshot:
        result["identity_changes"].append(
            {
                "field": "display_name",
                "previous_value": previous.display_name_snapshot,
                "current_value": validation.display_name_snapshot,
            }
        )
    result["changed_identity_field_count"] = len(result["identity_changes"])
    result["has_material_changes"] = bool(
        result["changed_document_count"] or result["changed_identity_field_count"]
    )
    return result


def validation_json(validation, *, admin=False, detail=False):
    body = {
        "id": validation.pk,
        "revision": validation.revision,
        "state": validation.state,
        "submitted_at": validation.submitted_at.isoformat(),
        "reviewed_at": validation.reviewed_at.isoformat()
        if validation.reviewed_at
        else None,
        "observations": validation.observations,
        "display_name_snapshot": validation.display_name_snapshot,
    }
    if admin:
        body["driver"] = {
            "id": validation.driver_id,
            "display_name": validation.driver.display_name,
            "email": validation.driver.user.email,
        }
        body["comparison"] = validation_comparison(validation)
    if detail:
        body["documents"] = [
            {
                key: value
                for key, value in document_json(link.document).items()
                if key != "is_current"
            }
            for link in validation.snapshot_documents.select_related(
                "document"
            ).order_by("kind")
        ]
    return body


class ProfileInput(serializers.Serializer):
    display_name = serializers.CharField(
        max_length=100, allow_blank=False, trim_whitespace=True, required=False
    )
    service_summary = serializers.CharField(
        max_length=2000, allow_blank=True, trim_whitespace=True, required=False
    )
    service_contact_email = serializers.EmailField(allow_blank=True, required=False)


class DriverProfileView(PrivateView):
    def get(self, request):
        return no_store(Response(profile_json(driver_profile(request.user))))

    def patch(self, request):
        if not isinstance(request.data, dict) or not set(request.data).issubset(
            ProfileInput().fields
        ):
            raise ValidationError({"profile": ["Campos no permitidos."]})
        serializer = ProfileInput(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            raise ValidationError({"profile": ["No hay cambios."]})
        profile = update_profile(request.user, serializer.validated_data)
        return no_store(Response(profile_json(profile)))


class DriverChecklistView(PrivateView):
    def get(self, request):
        return no_store(Response(checklist_payload()))


class DriverDocumentsView(PrivateView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        items = DriverDocument.objects.filter(
            driver=driver_profile(request.user)
        ).order_by("kind", "-uploaded_at", "-id")
        return no_store(
            Response({"documents": [document_json(item) for item in items]})
        )

    def post(self, request):
        if set(request.data.keys()) != {"kind", "expires_on", "file"} and set(
            request.data.keys()
        ) != {"kind", "file"}:
            raise ValidationError(
                {"upload": ["Se requiere un solo archivo, tipo y fecha opcional."]}
            )
        if len(request.FILES) != 1 or len(request.FILES.getlist("file")) != 1:
            raise ValidationError({"file": ["Se permite un archivo por solicitud."]})
        date = request.data.get("expires_on") or None
        if date:
            try:
                date = serializers.DateField().run_validation(date)
            except serializers.ValidationError as exc:
                raise ValidationError({"expires_on": ["Fecha inválida."]}) from exc
        item = save_upload(
            request.user,
            request.data.get("kind"),
            date,
            request.FILES.get("file"),
            request.META.get("REMOTE_ADDR", "unknown"),
        )
        return no_store(Response(document_json(item), status=201))


def attachment(document):
    path = Path(settings.PRIVATE_UPLOAD_ROOT) / document.storage_key
    try:
        stream = path.open("rb")
    except OSError:
        raise Http404() from None
    suffix = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}[
        document.content_type
    ]
    response = FileResponse(
        stream,
        as_attachment=True,
        filename=f"documento-{document.pk}{suffix}",
        content_type=document.content_type,
    )
    response["Cache-Control"] = "no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


class DriverDocumentDownloadView(PrivateDownloadView):
    def get(self, request, id):
        document = get_object_or_404(
            DriverDocument, pk=id, driver=driver_profile(request.user)
        )
        self.ensure_acceptable_file(request, document)
        return attachment(document)


class DriverValidationsView(PrivateView):
    def get(self, request):
        profile = driver_profile(request.user)
        history = DriverValidation.objects.filter(driver=profile).order_by("-revision")[
            :100
        ]
        return no_store(
            Response(
                {
                    "validation_state": profile.validation_state,
                    "current_validation_revision": profile.current_validation_revision,
                    "approved_revision": profile.approved_revision,
                    "validations": [
                        validation_json(item, detail=True) for item in history
                    ],
                }
            )
        )


class DriverSubmitView(PrivateView):
    def post(self, request):
        if request.data:
            raise ValidationError({"submission": ["No se aceptan campos."]})
        validation = submit(request.user)
        return no_store(Response(validation_json(validation, detail=True)))


class AdminValidationsView(PrivateView):
    def get(self, request):
        state = request.query_params.get("state", "pending")
        if state not in {"pending", "approved", "rejected", "superseded", "all"}:
            raise ValidationError({"state": ["Estado inválido."]})
        rows = DriverValidation.objects.select_related(
            "driver", "driver__user"
        ).order_by("-submitted_at", "-id")
        if state != "all":
            rows = rows.filter(state=state)
        return no_store(
            Response(
                {"results": [validation_json(item, admin=True) for item in rows[:50]]}
            )
        )


class AdminValidationDetailView(PrivateView):
    def get(self, request, id):
        item = get_object_or_404(
            DriverValidation.objects.select_related("driver", "driver__user"), pk=id
        )
        return no_store(Response(validation_json(item, admin=True, detail=True)))


class AdminDocumentDownloadView(PrivateDownloadView):
    def get(self, request, id):
        document = get_object_or_404(
            DriverDocument.objects.filter(validation_uses__isnull=False).distinct(),
            pk=id,
        )
        self.ensure_acceptable_file(request, document)
        with transaction.atomic():
            response = attachment(document)
            AdminActionLog.objects.create(
                actor=request.user,
                action="document_read",
                target_type="document",
                target_id=document.pk,
                correlation_id=str(uuid.uuid4()),
            )
        return response


class ObservationInput(serializers.Serializer):
    observations = serializers.CharField(
        max_length=1000, allow_blank=False, trim_whitespace=True
    )


class AdminDecisionView(PrivateView):
    approve = False

    def post(self, request, id):
        if not isinstance(request.data, dict) or set(request.data) != {"observations"}:
            raise ValidationError({"decision": ["Solo se aceptan observaciones."]})
        serializer = ObservationInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not DriverValidation.objects.filter(pk=id).exists():
            raise Http404()
        item = decide(
            id, request.user, self.approve, serializer.validated_data["observations"]
        )
        return no_store(Response(validation_json(item, admin=True, detail=True)))


class AdminApproveView(AdminDecisionView):
    approve = True


class AdminRejectView(AdminDecisionView):
    approve = False
