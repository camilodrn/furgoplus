import subprocess
import unittest
from unittest.mock import patch

from local_assistant.hardware import service_inventory


class DiagnosticTests(unittest.TestCase):
    def test_services_only_use_fixed_readonly_commands_and_local_docker_socket(self):
        with patch("local_assistant.hardware.shutil.which", return_value="/bin/tool"), \
             patch("local_assistant.hardware.subprocess.run", return_value=
                   subprocess.CompletedProcess([], 0, stdout=b"metadata")) as run:
            report = service_inventory()
        self.assertTrue(all(row["status"] == "ok" for row in report.values()))
        for call in run.call_args_list:
            command = call.args[0]
            self.assertNotIn("shell", call.kwargs)
            self.assertEqual(call.kwargs["timeout"], 5)
            self.assertIn(command[0], {"systemctl", "ss", "docker"})
            self.assertTrue(set(command).isdisjoint({"sudo", "inspect", "logs", "exec", "start", "restart", "up"}))
            if command[0] == "docker" and "compose" not in command:
                self.assertEqual(command[1:3], ["--host", "unix:///var/run/docker.sock"])

    def test_missing_tools_and_permission_errors_are_reported_without_installing(self):
        with patch("local_assistant.hardware.shutil.which", return_value=None), \
             patch("local_assistant.hardware.subprocess.run") as run:
            report = service_inventory()
        run.assert_not_called()
        self.assertTrue(all(row["status"] == "command_missing" for row in report.values()))
        with patch("local_assistant.hardware.shutil.which", return_value="/bin/tool"), \
             patch("local_assistant.hardware.subprocess.run", side_effect=PermissionError("private")):
            report = service_inventory()
        self.assertTrue(all(row == {"status": "unavailable"} for row in report.values()))


if __name__ == "__main__":
    unittest.main()
