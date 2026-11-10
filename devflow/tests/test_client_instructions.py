"""Check the documented generator in an isolated copy of the plugin."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[1]


class ClientInstructionsTests(unittest.TestCase):
    def test_generator_and_utf8_skill(self):
        (ROOT / "skills/devflow/SKILL.md").read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            plugin = Path(tmp) / "devflow"
            shutil.copytree(ROOT, plugin)
            result = subprocess.run(
                [sys.executable, str(plugin / "scripts/build-client-instructions.py")],
                text=True, capture_output=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            for name in ["chatgpt-project.md", "claude-project.md", "devflow-web/SKILL.md"]:
                generated = plugin / "client-instructions" / name
                self.assertEqual(generated.read_bytes(), (ROOT / "client-instructions" / name).read_bytes())
            with zipfile.ZipFile(plugin / "client-instructions/devflow-web-skill.zip") as archive:
                self.assertEqual(archive.namelist(), ["devflow/SKILL.md"])
                self.assertEqual(archive.read("devflow/SKILL.md"),
                                 (plugin / "client-instructions/devflow-web/SKILL.md").read_bytes())


if __name__ == "__main__":
    unittest.main()
