"""Provisioning uses real ORM/validators; only terminal input is simulated."""

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError
from django.test import TestCase, override_settings

from accounts.models import DriverProfile, ParentProfile, User
from api.test_auth import PASSWORD

INPUT = "accounts.management.commands.create_demo_account"


@override_settings(DEMO_MODE=True)
class DemoAccountTests(TestCase):
    def create(self, role="parent", email="family@example.test", name="Familia Demo"):
        call_command(
            "create_demo_account",
            email=email,
            role=role,
            display_name=name,
            stdout=StringIO(),
        )

    def test_both_roles_have_normal_unprivileged_initial_profiles(self):
        with (
            patch(INPUT + ".sys.stdin.isatty", return_value=True),
            patch(INPUT + ".getpass.getpass", return_value=PASSWORD),
        ):
            for role, profile in (("parent", ParentProfile), ("driver", DriverProfile)):
                self.create(role, f"{role}@example.test", "Persona Demo")
                user = User.objects.get(email=f"{role}@example.test")
                self.assertTrue(user.check_password(PASSWORD))
                self.assertTrue(user.is_active)
                self.assertFalse(user.is_staff or user.is_superuser)
                self.assertEqual(
                    profile.objects.get(user=user).display_name, "Persona Demo"
                )
        driver = DriverProfile.objects.get()
        self.assertEqual(driver.validation_state, "draft")
        self.assertFalse(driver.publication_requested)
        self.assertFalse(driver.documents.exists())
        self.assertFalse(driver.validations.exists())

    def test_unsafe_inputs_and_duplicate_accounts_are_not_modified(self):
        with (
            patch(INPUT + ".sys.stdin.isatty", return_value=True),
            patch(INPUT + ".getpass.getpass", return_value=PASSWORD) as prompt,
        ):
            for email, name in (
                ("person@example.com", "Familia Demo"),
                ("person@example.test", "Sin etiqueta"),
            ):
                with self.assertRaises(CommandError):
                    self.create(email=email, name=name)
            prompt.assert_not_called()
            with self.assertRaises(CommandError):
                self.create(role="admin")
            prompt.assert_not_called()
            self.create()
            user = User.objects.get()
            previous_hash = user.password
            with self.assertRaises(CommandError):
                self.create(name="Otra Demo")
            user.refresh_from_db()
            self.assertEqual(user.password, previous_hash)
            self.assertEqual(user.parent_profile.display_name, "Familia Demo")
            self.assertEqual(User.objects.count(), 1)

    def test_password_validation_confirmation_and_atomic_profile_creation(self):
        with patch(INPUT + ".sys.stdin.isatty", return_value=True):
            for passwords in (("x", "x"), (PASSWORD, "Different-Password")):
                with (
                    patch(INPUT + ".getpass.getpass", side_effect=passwords),
                    self.assertRaises(CommandError),
                ):
                    self.create()
                self.assertFalse(User.objects.exists())
            with (
                patch(INPUT + ".getpass.getpass", return_value=PASSWORD),
                patch(
                    INPUT + ".ParentProfile.objects.create", side_effect=IntegrityError
                ),
                self.assertRaises(CommandError),
            ):
                self.create()
            self.assertFalse(User.objects.exists())

    def test_command_requires_demo_mode_and_a_terminal(self):
        with override_settings(DEMO_MODE=False), self.assertRaises(CommandError):
            self.create()
        with (
            patch(INPUT + ".sys.stdin.isatty", return_value=False),
            patch(INPUT + ".getpass.getpass") as prompt,
            self.assertRaises(CommandError),
        ):
            self.create()
        prompt.assert_not_called()
        self.assertFalse(User.objects.exists())
