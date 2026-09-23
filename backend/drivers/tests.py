import io
import json
import tempfile
from datetime import timedelta
from pathlib import Path

from django.test import Client, TestCase, override_settings
from django.utils import timezone
from PIL import Image
from pypdf import PdfWriter

from accounts.models import DriverProfile, User
from drivers.models import AdminActionLog, DriverDocument, DriverValidation
from drivers.services import CHECKLIST, MAX_BYTES

BASE = "/api/v1/"
PASSWORD = "Synthetic-Only-Password-781!"


def synthetic_pdf():
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.write(output)
    return output.getvalue()


def synthetic_image(format):
    output = io.BytesIO()
    Image.new("RGB", (3, 3), "white").save(output, format=format)
    return output.getvalue()


class DriverWorkflowTests(TestCase):
    def setUp(self):
        self.private = tempfile.TemporaryDirectory()
        self.addCleanup(self.private.cleanup)
        override = override_settings(PRIVATE_UPLOAD_ROOT=self.private.name)
        override.enable()
        self.addCleanup(override.disable)
        self.driver_a = User.objects.create_user(
            "driver-a@example.test", PASSWORD, role="driver"
        )
        self.driver_b = User.objects.create_user(
            "driver-b@example.test", PASSWORD, role="driver"
        )
        self.parent = User.objects.create_user(
            "parent@example.test", PASSWORD, role="parent"
        )
        self.admin = User.objects.create_superuser("admin@example.test", PASSWORD)
        for user in (self.driver_a, self.driver_b):
            DriverProfile.objects.create(user=user, display_name=f"Synthetic {user.pk}")
        self.client = Client(enforce_csrf_checks=True)
        self.as_user(self.driver_a)

    def as_user(self, user):
        self.client.force_login(user)
        self.token = self.client.get(BASE + "auth/csrf/", secure=True).json()[
            "csrf_token"
        ]

    def post(self, path, data=None, multipart=False):
        kwargs = {
            "secure": True,
            "HTTP_ORIGIN": "https://testserver",
            "HTTP_X_CSRFTOKEN": self.token,
        }
        if multipart:
            return self.client.post(BASE + path, data or {}, **kwargs)
        return self.client.post(
            BASE + path,
            json.dumps(data or {}),
            content_type="application/json",
            **kwargs,
        )

    def patch(self, path, data):
        return self.client.patch(
            BASE + path,
            json.dumps(data),
            content_type="application/json",
            secure=True,
            HTTP_ORIGIN="https://testserver",
            HTTP_X_CSRFTOKEN=self.token,
        )

    def upload(
        self,
        kind,
        content=None,
        name="synthetic.pdf",
        content_type="application/pdf",
        expiry=None,
    ):
        from django.core.files.uploadedfile import SimpleUploadedFile

        data = {
            "kind": kind,
            "file": SimpleUploadedFile(
                name,
                content if content is not None else synthetic_pdf(),
                content_type=content_type,
            ),
        }
        if expiry is not None:
            data["expires_on"] = expiry
        return self.post("driver/documents/", data, multipart=True)

    def complete(self):
        future = (timezone.localdate() + timedelta(days=30)).isoformat()
        for kind, _, required in CHECKLIST:
            response = self.upload(kind, expiry=future if required else None)
            self.assertEqual(response.status_code, 201, response.content)
        return self.post("driver/validations/submit/").json()

    def admin_comparison(self, validation):
        self.as_user(self.admin)
        response = self.client.get(
            BASE + f"admin/validations/{validation['id']}/", secure=True
        )
        self.assertEqual(response.status_code, 200)
        return response.json(), response.content.decode()

    def test_revision_comparison_first_submission_and_safe_queue(self):
        first = self.complete()
        detail, payload = self.admin_comparison(first)
        self.assertEqual(
            detail["comparison"],
            {
                "previous_revision": None,
                "changed_document_count": 0,
                "unchanged_document_count": 0,
                "changed_identity_field_count": 0,
                "has_material_changes": False,
                "document_changes": [],
                "identity_changes": [],
            },
        )
        queue = self.client.get(BASE + "admin/validations/", secure=True).json()
        self.assertEqual(queue["results"][0]["comparison"], detail["comparison"])
        for secret in ("storage_key", "sha256", self.private.name):
            self.assertNotIn(secret, payload)
            self.assertNotIn(secret, json.dumps(queue))

    def test_revision_comparison_replacements_expiry_identity_and_unchanged(self):
        first = self.complete()
        old_expiry = next(
            document["expires_on"]
            for document in first["documents"]
            if document["kind"] == "demo_vehicle_document"
        )
        new_expiry = (timezone.localdate() + timedelta(days=60)).isoformat()
        self.assertEqual(
            self.upload(
                "demo_identity_document",
                content=synthetic_image("PNG"),
                name="synthetic.png",
                content_type="image/png",
            ).status_code,
            201,
        )
        self.assertEqual(
            self.upload("demo_vehicle_document", expiry=new_expiry).status_code, 201
        )
        self.assertEqual(
            self.patch(
                "driver/profile/", {"display_name": "Conductor Principal"}
            ).status_code,
            200,
        )
        second = self.post("driver/validations/submit/").json()
        detail, payload = self.admin_comparison(second)
        comparison = detail["comparison"]
        self.assertEqual(comparison["previous_revision"], first["revision"])
        self.assertEqual(comparison["changed_document_count"], 2)
        self.assertEqual(comparison["unchanged_document_count"], 1)
        self.assertEqual(comparison["changed_identity_field_count"], 1)
        self.assertTrue(comparison["has_material_changes"])
        changes = {item["kind"]: item for item in comparison["document_changes"]}
        identity = changes["demo_identity_document"]
        self.assertEqual(identity["status"], "replaced")
        self.assertEqual(
            (identity["previous_version"], identity["current_version"]), (1, 2)
        )
        self.assertEqual(
            (identity["previous_content_type"], identity["current_content_type"]),
            ("application/pdf", "image/png"),
        )
        vehicle = changes["demo_vehicle_document"]
        self.assertEqual(
            (vehicle["previous_expires_on"], vehicle["current_expires_on"]),
            (old_expiry, new_expiry),
        )
        self.assertEqual(changes["demo_expiring_credential"]["status"], "unchanged")
        self.assertEqual(
            comparison["identity_changes"],
            [
                {
                    "field": "display_name",
                    "previous_value": first["display_name_snapshot"],
                    "current_value": "Conductor Principal",
                }
            ],
        )
        for secret in ("storage_key", "sha256", self.private.name):
            self.assertNotIn(secret, payload)
        self.assertEqual(
            self.post(
                f"admin/validations/{second['id']}/reject/",
                {"observations": "Reenvía la revisión demo"},
            ).status_code,
            200,
        )
        self.as_user(self.driver_a)
        third = self.post("driver/validations/submit/").json()
        third_detail, _ = self.admin_comparison(third)
        self.assertEqual(
            third_detail["comparison"]["previous_revision"], second["revision"]
        )
        self.assertFalse(third_detail["comparison"]["has_material_changes"])

    def test_revision_comparison_one_replaced_document(self):
        first = self.complete()
        self.assertEqual(self.upload("demo_identity_document").status_code, 201)
        second = self.post("driver/validations/submit/").json()
        detail, _ = self.admin_comparison(second)
        comparison = detail["comparison"]
        self.assertEqual(comparison["changed_document_count"], 1)
        self.assertEqual(comparison["unchanged_document_count"], len(CHECKLIST) - 1)
        self.assertEqual(comparison["previous_revision"], first["revision"])

    def test_revision_comparison_uses_previous_submission_for_same_driver(self):
        first = self.complete()
        self.as_user(self.driver_b)
        self.complete()
        self.as_user(self.admin)
        self.assertEqual(
            self.post(
                f"admin/validations/{first['id']}/reject/",
                {"observations": "Vuelve a enviar el ejemplo"},
            ).status_code,
            200,
        )
        self.as_user(self.driver_a)
        second = self.post("driver/validations/submit/").json()
        detail, _ = self.admin_comparison(second)
        comparison = detail["comparison"]
        self.assertEqual(comparison["previous_revision"], first["revision"])
        self.assertEqual(comparison["changed_document_count"], 0)
        self.assertEqual(comparison["unchanged_document_count"], len(CHECKLIST))
        self.assertEqual(comparison["changed_identity_field_count"], 0)
        self.assertFalse(comparison["has_material_changes"])
        self.assertTrue(
            all(
                item["status"] == "unchanged" for item in comparison["document_changes"]
            )
        )

    def test_private_direct_ids_and_admin_audit(self):
        submission = self.complete()
        doc_id = submission["documents"][0]["id"]
        owner = self.client.get(
            BASE + f"driver/documents/{doc_id}/download/", secure=True
        )
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner["Cache-Control"], "no-store")
        self.assertEqual(owner["X-Content-Type-Options"], "nosniff")
        self.assertIn("attachment", owner["Content-Disposition"])
        self.as_user(self.driver_b)
        self.assertEqual(
            self.client.get(
                BASE + f"driver/documents/{doc_id}/download/", secure=True
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(BASE + "driver/validations/", secure=True).json()[
                "validations"
            ],
            [],
        )
        self.assertEqual(
            self.client.get(BASE + "admin/validations/", secure=True).status_code, 403
        )
        self.assertEqual(
            self.post(
                f"admin/validations/{submission['id']}/approve/", {"observations": "No"}
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                BASE + f"admin/documents/{doc_id}/download/", secure=True
            ).status_code,
            403,
        )
        self.as_user(self.parent)
        for path in (
            "driver/profile/",
            "driver/documents/",
            "driver/validations/",
            f"driver/documents/{doc_id}/download/",
        ):
            self.assertEqual(self.client.get(BASE + path, secure=True).status_code, 403)
        self.as_user(self.admin)
        self.assertEqual(
            self.patch("driver/profile/", {"display_name": "No"}).status_code, 403
        )
        self.assertEqual(
            self.client.get(
                BASE + f"admin/documents/{doc_id}/download/", secure=True
            ).status_code,
            200,
        )
        log = AdminActionLog.objects.get(action="document_read")
        self.assertEqual(log.target_id, doc_id)
        self.assertNotIn(".pdf", str(log.__dict__))
        self.assertNotIn("storage_key", str(log.__dict__))
        self.assertEqual(
            self.client.get(
                BASE + f"admin/validations/{submission['id']}/", secure=True
            ).json()["documents"][0]["id"],
            doc_id,
        )

    def test_private_download_formats_headers_accept_and_anonymous_denial(self):
        samples = (
            ("application/pdf", "synthetic.pdf", synthetic_pdf()),
            ("image/jpeg", "synthetic.jpg", synthetic_image("JPEG")),
            ("image/png", "synthetic.png", synthetic_image("PNG")),
        )
        ids = []
        for content_type, name, content in samples:
            uploaded = self.upload(
                "demo_identity_document", content, name, content_type
            )
            self.assertEqual(uploaded.status_code, 201, uploaded.content)
            self.assertEqual(uploaded.json()["version"], len(ids) + 1)
            ids.append(uploaded.json()["id"])
        for (content_type, _, content), doc_id in zip(samples, ids, strict=True):
            path = BASE + f"driver/documents/{doc_id}/download/"
            for accept in ("*/*", content_type, "application/octet-stream"):
                response = self.client.get(path, secure=True, HTTP_ACCEPT=accept)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], content_type)
                self.assertEqual(b"".join(response.streaming_content), content)
                self.assertIn("attachment", response["Content-Disposition"])
                self.assertEqual(response["Cache-Control"], "no-store")
                self.assertEqual(response["X-Content-Type-Options"], "nosniff")
                self.assertNotIn("storage_key", str(response.headers))
                self.assertNotIn(self.private.name, str(response.headers))
            for unacceptable in ("application/json", "text/html"):
                response = self.client.get(path, secure=True, HTTP_ACCEPT=unacceptable)
                self.assertEqual(response.status_code, 406)
                self.assertEqual(response["Content-Type"], "application/json")
            other_type = "image/jpeg" if content_type != "image/jpeg" else "image/png"
            self.assertEqual(
                self.client.get(path, secure=True, HTTP_ACCEPT=other_type).status_code,
                406,
            )
        self.client.logout()
        denied = self.client.get(
            BASE + f"driver/documents/{ids[0]}/download/",
            secure=True,
            HTTP_ACCEPT="*/*",
        )
        self.assertIn(denied.status_code, (401, 403))
        self.assertEqual(denied["Content-Type"], "application/json")

    def test_admin_download_audit_and_cross_role_denials_with_browser_accept(self):
        submission = self.complete()
        doc_id = submission["documents"][0]["id"]
        path = BASE + f"admin/documents/{doc_id}/download/"
        self.as_user(self.driver_b)
        self.assertEqual(
            self.client.get(
                BASE + f"driver/documents/{doc_id}/download/",
                secure=True,
                HTTP_ACCEPT="*/*",
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(path, secure=True, HTTP_ACCEPT="*/*").status_code,
            403,
        )
        self.as_user(self.parent)
        self.assertEqual(
            self.client.get(
                BASE + f"driver/documents/{doc_id}/download/",
                secure=True,
                HTTP_ACCEPT="*/*",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(path, secure=True, HTTP_ACCEPT="*/*").status_code,
            403,
        )
        self.as_user(self.admin)
        self.assertEqual(
            self.client.get(path, secure=True, HTTP_ACCEPT="image/png").status_code,
            406,
        )
        self.assertFalse(AdminActionLog.objects.filter(action="document_read").exists())
        response = self.client.get(path, secure=True, HTTP_ACCEPT="*/*")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(
            AdminActionLog.objects.filter(
                action="document_read", target_id=doc_id
            ).count(),
            1,
        )
        self.assertNotIn(self.private.name, str(response.headers))
        self.assertNotIn(
            DriverDocument.objects.get(pk=doc_id).storage_key, str(response.headers)
        )

    def test_pending_stale_review_and_rejected_resubmission(self):
        first = self.complete()
        self.assertEqual(
            self.post("driver/validations/submit/").json()["id"], first["id"]
        )
        old_document = DriverDocument.objects.get(
            pk=next(
                item["id"]
                for item in first["documents"]
                if item["kind"] == "demo_identity_document"
            )
        )
        self.as_user(self.admin)
        self.assertEqual(
            self.client.get(
                BASE + f"admin/validations/{first['id']}/", secure=True
            ).status_code,
            200,
        )
        self.as_user(self.driver_a)
        self.assertEqual(self.upload("demo_identity_document").status_code, 201)
        old_document.refresh_from_db()
        self.assertFalse(old_document.is_current)
        old_validation = DriverValidation.objects.get(pk=first["id"])
        self.assertEqual(old_validation.state, "superseded")
        self.as_user(self.admin)
        stale = self.post(
            f"admin/validations/{first['id']}/approve/", {"observations": "Old screen"}
        )
        self.assertEqual(
            (stale.status_code, stale.json()["code"]), (409, "stale_validation")
        )
        self.assertFalse(
            AdminActionLog.objects.filter(action="validation_approved").exists()
        )
        profile = DriverProfile.objects.get(user=self.driver_a)
        self.assertIsNone(profile.approved_revision)
        self.as_user(self.driver_a)
        second = self.post("driver/validations/submit/").json()
        self.assertGreater(second["revision"], first["revision"])
        self.as_user(self.admin)
        reject = self.post(
            f"admin/validations/{second['id']}/reject/",
            {"observations": "Replace sample"},
        )
        self.assertEqual(reject.status_code, 200)
        self.assertEqual(
            self.post(
                f"admin/validations/{second['id']}/reject/", {"observations": "Again"}
            ).status_code,
            409,
        )
        self.assertEqual(
            AdminActionLog.objects.filter(action="validation_rejected").count(), 1
        )
        self.as_user(self.driver_a)
        history = self.client.get(BASE + "driver/validations/", secure=True).json()
        self.assertEqual(history["validations"][0]["observations"], "Replace sample")
        third = self.post("driver/validations/submit/").json()
        self.assertGreater(third["revision"], second["revision"])
        self.as_user(self.admin)
        approve = self.post(
            f"admin/validations/{third['id']}/approve/",
            {"observations": "Demo accepted"},
        )
        self.assertEqual(approve.status_code, 200)
        profile.refresh_from_db()
        self.assertEqual(
            (profile.validation_state, profile.approved_revision),
            ("approved", third["revision"]),
        )
        self.assertEqual(
            AdminActionLog.objects.filter(action="validation_approved").count(), 1
        )
        self.as_user(self.driver_a)
        self.assertEqual(
            self.patch("driver/profile/", {"service_summary": "Demo"}).status_code, 200
        )
        profile.refresh_from_db()
        self.assertEqual(profile.validation_state, "approved")
        self.assertEqual(
            self.patch(
                "driver/profile/", {"display_name": "Changed synthetic"}
            ).status_code,
            200,
        )
        profile.refresh_from_db()
        self.assertEqual(
            (profile.validation_state, profile.approved_revision), ("draft", None)
        )
        self.assertEqual(DriverValidation.objects.get(pk=third["id"]).state, "approved")

    def test_submission_completeness_expiry_and_no_json_leaks(self):
        missing = self.post("driver/validations/submit/")
        self.assertEqual(missing.status_code, 400)
        self.assertIn("demo_vehicle_document", missing.json()["fields"])
        self.assertEqual(self.upload("demo_vehicle_document").status_code, 400)
        self.assertEqual(
            self.upload("demo_vehicle_document", expiry="2000-01-01").status_code, 400
        )
        self.assertEqual(self.upload("unknown_kind").status_code, 400)
        self.complete()
        for path in ("driver/profile/", "driver/documents/", "driver/validations/"):
            payload = self.client.get(BASE + path, secure=True).content.decode()
            self.assertNotIn(self.private.name, payload)
            self.assertNotIn("storage_key", payload)
            self.assertNotIn("sha256", payload)
        self.as_user(self.parent)
        self.assertEqual(
            self.client.get(BASE + "driver/validations/", secure=True).status_code, 403
        )
        self.client.logout()
        self.assertEqual(
            self.client.get(BASE + "driver/documents/", secure=True).json()["code"],
            "not_authenticated",
        )

    def test_upload_format_size_parser_and_immutability(self):
        bad = [
            (b"<svg></svg>", "x.svg", "image/svg+xml"),
            (b"<html></html>", "x.pdf", "application/pdf"),
            (b"PK\x03\x04", "x.zip", "application/zip"),
            (b"MZ\x00", "x.pdf", "application/pdf"),
            (b"%PDF-bad", "x.pdf", "application/pdf"),
            (b"\x89PNG\r\n\x1a\ninvalid", "x.png", "image/png"),
            (synthetic_image("PNG"), "x.jpg", "image/jpeg"),
            (synthetic_pdf(), "x.pdf", "image/png"),
        ]
        for content, name, mime in bad:
            response = self.upload("demo_identity_document", content, name, mime)
            self.assertEqual(response.status_code, 400, (name, mime, response.content))
        self.assertEqual(
            self.upload("demo_identity_document", b"x" * (MAX_BYTES + 1)).status_code,
            413,
        )
        self.assertEqual(DriverDocument.objects.count(), 0)
        self.assertEqual(list(Path(self.private.name).iterdir()), [])
        self.assertEqual(
            self.upload(
                "demo_identity_document",
                synthetic_image("PNG"),
                "demo.png",
                "image/png",
            ).status_code,
            201,
        )
        self.assertEqual(
            self.upload(
                "demo_identity_document",
                synthetic_image("JPEG"),
                "demo.jpg",
                "image/jpeg",
            ).status_code,
            201,
        )
        first, second = list(DriverDocument.objects.order_by("id"))
        self.assertNotEqual(first.storage_key, second.storage_key)
        self.assertFalse(first.is_current)
        self.assertTrue(second.is_current)
        self.assertEqual(first.content_type, "image/png")
        self.assertEqual(second.content_type, "image/jpeg")
        self.assertTrue((Path(self.private.name) / first.storage_key).exists())
        self.assertTrue((Path(self.private.name) / second.storage_key).exists())

    def test_expired_snapshot_blocks_approval_but_not_rejection(self):
        from unittest.mock import patch

        submission = self.complete()
        self.as_user(self.admin)
        future = timezone.localdate() + timedelta(days=31)
        with patch("drivers.services.local_today", return_value=future):
            response = self.post(
                f"admin/validations/{submission['id']}/approve/",
                {"observations": "Demo review"},
            )
        self.assertEqual(response.status_code, 409)
        self.assertFalse(
            AdminActionLog.objects.filter(action="validation_approved").exists()
        )
        self.assertEqual(
            DriverValidation.objects.get(pk=submission["id"]).state, "pending"
        )
        self.assertEqual(
            self.post(
                f"admin/validations/{submission['id']}/reject/",
                {"observations": "Expired sample"},
            ).status_code,
            200,
        )

    def test_decision_rolls_back_if_audit_write_fails(self):
        from unittest.mock import patch

        submission = self.complete()
        self.as_user(self.admin)
        with patch(
            "drivers.services.AdminActionLog.objects.create",
            side_effect=RuntimeError("synthetic audit failure"),
        ):
            with self.assertRaises(RuntimeError):
                self.post(
                    f"admin/validations/{submission['id']}/approve/",
                    {"observations": "Demo review"},
                )
        self.assertEqual(
            DriverValidation.objects.get(pk=submission["id"]).state, "pending"
        )
        profile = DriverProfile.objects.get(user=self.driver_a)
        self.assertEqual(
            (profile.validation_state, profile.approved_revision), ("pending", None)
        )
        self.assertFalse(AdminActionLog.objects.exists())

    def test_upload_csrf_dimension_and_rate(self):
        import struct
        import zlib

        from django.core.files.uploadedfile import SimpleUploadedFile

        original = bytearray(synthetic_image("PNG"))
        original[16:24] = struct.pack(">II", 9000, 9000)
        original[29:33] = struct.pack(">I", zlib.crc32(original[12:29]) & 0xFFFFFFFF)
        self.assertEqual(
            self.upload(
                "demo_identity_document", bytes(original), "large.png", "image/png"
            ).status_code,
            400,
        )
        self.assertEqual(DriverDocument.objects.count(), 0)
        unprotected = self.client.post(
            BASE + "driver/documents/",
            {
                "kind": "demo_identity_document",
                "file": SimpleUploadedFile(
                    "demo.pdf", synthetic_pdf(), content_type="application/pdf"
                ),
            },
            secure=True,
            HTTP_ORIGIN="https://testserver",
        )
        self.assertEqual(unprotected.json()["code"], "csrf_failed")
        for _ in range(19):
            self.assertEqual(
                self.upload("demo_identity_document", b"bad").status_code, 400
            )
        self.assertEqual(self.upload("demo_identity_document", b"bad").status_code, 429)
        self.assertEqual(DriverDocument.objects.count(), 0)
        self.as_user(self.driver_b)
        self.assertEqual(self.upload("demo_identity_document").status_code, 201)

    def test_orphan_cleanup_and_malicious_filename(self):
        import os

        from django.core.exceptions import ValidationError as DjangoValidationError
        from django.core.management import call_command

        response = self.upload("demo_identity_document", name="../../not-a-path.pdf")
        self.assertEqual(response.status_code, 201)
        document = DriverDocument.objects.get()
        self.assertNotIn("not-a-path", document.storage_key)
        self.assertNotIn("/", document.storage_key)
        original = document.sha256
        document.sha256 = "0" * 64
        with self.assertRaises(DjangoValidationError):
            document.save()
        document.refresh_from_db()
        self.assertEqual(document.sha256, original)
        root = Path(self.private.name)
        staged = root / ".stage-interrupted"
        orphan = root / "unreferenced.pdf"
        staged.write_bytes(b"synthetic")
        orphan.write_bytes(b"synthetic")
        old = (timezone.now() - timedelta(hours=25)).timestamp()
        os.utime(staged, (old, old))
        os.utime(orphan, (old, old))
        call_command("cleanup_private_uploads")
        self.assertFalse(staged.exists())
        self.assertFalse(orphan.exists())
        self.assertTrue((root / document.storage_key).exists())

    def test_identity_edit_supersedes_pending_revision(self):
        first = self.complete()
        response = self.patch("driver/profile/", {"display_name": "New synthetic name"})
        self.assertEqual(response.status_code, 200)
        profile = DriverProfile.objects.get(user=self.driver_a)
        self.assertEqual(
            (profile.validation_state, profile.current_validation_revision),
            ("draft", 2),
        )
        self.assertEqual(
            DriverValidation.objects.get(pk=first["id"]).state, "superseded"
        )
        second = self.post("driver/validations/submit/").json()
        self.assertEqual(second["display_name_snapshot"], "New synthetic name")
        self.assertEqual(second["revision"], 2)

    def test_documents_expiring_before_submit_block_it(self):
        from unittest.mock import patch

        future = (timezone.localdate() + timedelta(days=1)).isoformat()
        for kind, _, required in CHECKLIST:
            self.assertEqual(
                self.upload(kind, expiry=future if required else None).status_code, 201
            )
        with patch(
            "drivers.services.local_today",
            return_value=timezone.localdate() + timedelta(days=2),
        ):
            response = self.post("driver/validations/submit/")
        self.assertEqual(response.status_code, 400)
        self.assertIn("demo_vehicle_document", response.json()["fields"])
        self.assertFalse(DriverValidation.objects.exists())

    def test_clients_cannot_set_server_owned_profile_or_decision_fields(self):
        self.assertEqual(
            self.patch("driver/profile/", {"validation_state": "approved"}).status_code,
            400,
        )
        profile = DriverProfile.objects.get(user=self.driver_a)
        self.assertEqual(profile.validation_state, "draft")
        submission = self.complete()
        self.as_user(self.admin)
        response = self.post(
            f"admin/validations/{submission['id']}/approve/",
            {
                "observations": "Demo",
                "reviewer": self.admin.pk,
                "revision": 999,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            DriverValidation.objects.get(pk=submission["id"]).state, "pending"
        )
        self.assertFalse(
            AdminActionLog.objects.filter(action="validation_approved").exists()
        )
