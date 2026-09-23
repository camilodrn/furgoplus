from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.test import TestCase

from accounts.models import User


class UserTests(TestCase):
    def test_email_is_login_identifier_and_normalized(self):
        user = User.objects.create_user(
            "  DRIVER@Example.COM ", "safe-password", role=User.Role.DRIVER
        )
        self.assertEqual(user.email, "driver@example.com")
        self.assertFalse(hasattr(user, "username"))
        self.assertTrue(user.check_password("safe-password"))
        self.assertEqual(
            authenticate(email="driver@example.com", password="safe-password"), user
        )

    def test_email_is_required(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(" ", "safe-password", role=User.Role.PARENT)
        with self.assertRaises(ValueError):
            User.objects.create_user("person@example.com", "safe-password")

    def test_case_insensitive_email_uniqueness_at_database(self):
        User.objects.create_user(
            "person@example.com", "safe-password", role=User.Role.PARENT
        )
        other = User.objects.create_user(
            "other@example.com", "safe-password", role=User.Role.DRIVER
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=other.pk).update(email="PERSON@example.com")

    def test_superuser_has_admin_flags(self):
        user = User.objects.create_superuser("ADMIN@example.com", "safe-password")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                "other@example.com", "safe-password", is_staff=False
            )

    def test_inactive_user_cannot_authenticate(self):
        user = User.objects.create_user(
            "inactive@example.com",
            "safe-password",
            role=User.Role.PARENT,
            is_active=False,
        )
        self.assertIsNone(authenticate(email=user.email, password="safe-password"))
