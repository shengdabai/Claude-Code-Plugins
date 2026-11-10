"""Exercise hook decisions without executing any shell command."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


GUARD = Path(__file__).resolve().parents[1] / "hooks" / "devflow-guard.py"


class GuardTests(unittest.TestCase):
    def decision(self, command):
        env = {**os.environ, "DEVFLOW_OFF": "0"}
        result = subprocess.run(
            [sys.executable, str(GUARD)],
            input=json.dumps({"tool_name": "Bash", "tool_input": {"command": command}}),
            text=True, capture_output=True, check=True, env=env,
        )
        return json.loads(result.stdout)["hookSpecificOutput"] if result.stdout else {}

    def test_read_prefix_cannot_hide_force_push(self):
        for command in [
            "echo ready && git push --force origin main",
            "printf ready; git push -f origin master",
            "cat missing || git push --force origin main",
            "rg pattern file | git push -f origin main",
            "echo ready\ngit push --force origin main",
            "echo $(git push --force origin main)",
            "echo `git push --force origin main`",
        ]:
            with self.subTest(command=command):
                self.assertEqual(self.decision(command).get("permissionDecision"), "deny")

    def test_read_prefix_cannot_hide_confirmation(self):
        self.assertEqual(
            self.decision("echo ready && vercel link").get("permissionDecision"), "ask"
        )

    def test_plain_quoted_examples_still_pass(self):
        for command in [
            "echo 'git push --force origin main'",
            "printf '%s\\n' 'git push -f origin master'",
            "rg 'git push --force origin main' docs.md",
            "echo 'git push -f origin main; vercel link'",
        ]:
            with self.subTest(command=command):
                self.assertEqual(self.decision(command), {})

    def test_direct_dangerous_commands_still_block(self):
        self.assertEqual(
            self.decision("git push --force origin main").get("permissionDecision"), "deny"
        )
        self.assertEqual(self.decision("vercel link").get("permissionDecision"), "ask")


if __name__ == "__main__":
    unittest.main()
