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

    def test_git_global_options_preserve_push_policy(self):
        for prefix in [
            "git",
            "git -C repo",
            "git -C 'repo with spaces'",
            "git -Crepo",
            "git -c advice.pushUpdateRejected=false",
            "git -cadvice.pushUpdateRejected=false",
            "git --git-dir=repo/.git",
            "git --git-dir repo/.git",
            "git --work-tree=repo --namespace=test",
            "git --work-tree repo --namespace test",
            "git --config-env=advice.pushUpdateRejected=ADVICE",
            "git --config-env advice.pushUpdateRejected=ADVICE",
            "git --no-pager --no-optional-locks",
            "git -C repo -C subdir -c advice.pushUpdateRejected=false --git-dir=.git",
            "/usr/bin/git -C repo",
        ]:
            for args, denied in [
                ("--force origin main", True),
                ("-f origin master", True),
                ("--force-with-lease origin main", True),
                ("origin main", False),
                ("--force origin feature", False),
            ]:
                with self.subTest(prefix=prefix, args=args):
                    result = self.decision(f"{prefix} push {args}")
                    self.assertEqual(result.get("permissionDecision"), "deny" if denied else None)
                    if not denied:
                        self.assertIn("push", result.get("additionalContext", ""))

    def test_git_global_option_values_are_not_push_arguments(self):
        for command in [
            "git -C main push --force origin feature",
            "git -c alias.example='push --force main' status",
            "git -c note.example='--force main' push origin feature",
            "git -C repo status",
            "git --unknown push --force origin main",
        ]:
            with self.subTest(command=command):
                result = self.decision(command)
                self.assertNotIn("permissionDecision", result)
                if " push origin " in command or " push --force origin feature" in command:
                    self.assertIn("push", result.get("additionalContext", ""))
                else:
                    self.assertEqual(result, {})

    def test_global_option_pushes_in_shell_composition(self):
        for command in [
            "echo ready && git -C repo push --force origin main",
            "cat missing || git -c advice.pushUpdateRejected=false push -f origin master",
            "echo ready\ngit --git-dir=repo/.git push --force-with-lease origin main",
            "echo $(git -C repo push --force origin main)",
            "echo `git -C repo push --force origin main`",
        ]:
            with self.subTest(command=command):
                self.assertEqual(self.decision(command).get("permissionDecision"), "deny")

    def test_quoted_global_option_examples_still_pass(self):
        for command in [
            "echo 'git -C repo push --force origin main'",
            "echo 'git -C repo push --force origin main; vercel link'",
            "rg 'git -c k=v push -f origin master' docs.md",
            "printf '%s' 'git --git-dir=repo/.git push --force origin main'",
        ]:
            with self.subTest(command=command):
                self.assertEqual(self.decision(command), {})


if __name__ == "__main__":
    unittest.main()
