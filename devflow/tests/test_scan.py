"""Scan isolated fixtures without treating their filenames as sed programs."""
from pathlib import Path
import subprocess
import tempfile
import unittest


SCAN = Path(__file__).resolve().parents[1] / "scripts" / "devflow-scan.sh"


class ScanTests(unittest.TestCase):
    def test_filenames_are_printed_as_data(self):
        for name in ["literal|name.py", "unsafe|; w injected.py"]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                source = Path(tmp) / name
                content = "# TO" + "DO fixture"
                source.write_text(content + "\n", encoding="utf-8")
                result = subprocess.run(
                    ["bash", str(SCAN)], cwd=tmp,
                    text=True, capture_output=True, check=True,
                )
                self.assertEqual(set(Path(tmp).iterdir()), {source})
                self.assertEqual(result.stderr, "")
                self.assertIn(f"./{name}:1:{content}\n", result.stdout)


if __name__ == "__main__":
    unittest.main()
