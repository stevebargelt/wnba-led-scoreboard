"""Integration tests for generate_preview.py CLI script."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


class TestGeneratePreview(unittest.TestCase):
    """Test generate_preview.py script via subprocess."""

    def setUp(self):
        """Create temporary directory for test outputs."""
        self.temp_dir = tempfile.mkdtemp()
        self.script_path = Path(__file__).parent.parent / "scripts" / "generate_preview.py"

        self.test_config = {
            "matrix_config": {
                "width": 64,
                "height": 32,
                "brightness": 75,
                "pwm_bits": 11,
                "hardware_mapping": "regular",
                "chain_length": 1,
                "parallel": 1,
                "gpio_slowdown": 1
            },
            "render_config": {
                "logo_variant": "small",
                "live_layout": "stacked"
            }
        }

    def tearDown(self):
        """Clean up temporary directory."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _run_generate_preview(self, *args):
        """Helper to run generate_preview.py with arguments."""
        cmd = ["python3", str(self.script_path)] + list(args)
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result

    def _validate_png(self, path: str):
        """Validate that a file is a valid PNG."""
        self.assertTrue(Path(path).exists(), f"PNG file not found: {path}")
        try:
            img = Image.open(path)
            img.verify()
            return True
        except Exception as e:
            self.fail(f"Invalid PNG file {path}: {e}")

    def _validate_success_output(self, output: str, expected_scene: str):
        """Validate successful JSON output format."""
        last_line = output.strip().split('\n')[-1]
        data = json.loads(last_line)
        self.assertTrue(data.get("success"), "Expected success=True")
        self.assertIn("path", data, "Missing 'path' in output")
        self.assertIn("scene", data, "Missing 'scene' in output")
        self.assertEqual(data["scene"], expected_scene, f"Expected scene={expected_scene}")
        return data

    def test_generate_idle_preview(self):
        """Test idle scene generates valid PNG file."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "idle",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "idle")
        self._validate_png(output["path"])

    def test_generate_pregame_preview(self):
        """Test pregame scene generates valid PNG file."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "pregame",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "pregame")
        self._validate_png(output["path"])

    def test_generate_live_preview(self):
        """Test live scene generates valid PNG file."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "live")
        self._validate_png(output["path"])

    def test_generate_live_big_preview(self):
        """Test live_big scene generates valid PNG file."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live_big",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "live_big")
        self._validate_png(output["path"])

    def test_generate_final_preview(self):
        """Test final scene generates valid PNG file."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "final",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "final")
        self._validate_png(output["path"])

    def test_invalid_config_json(self):
        """Test invalid JSON configuration returns proper error."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", "invalid json"
        )

        self.assertNotEqual(result.returncode, 0, "Expected non-zero exit code")
        last_line = result.stdout.strip().split('\n')[-1]
        output = json.loads(last_line)
        self.assertFalse(output.get("success"), "Expected success=False")
        self.assertIn("error", output, "Expected 'error' field in output")

    def test_incomplete_config_uses_defaults(self):
        """Test incomplete config uses defaults and succeeds."""
        incomplete_config = {"matrix_config": {"width": 64}}

        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", json.dumps(incomplete_config)
        )

        self.assertEqual(result.returncode, 0, "Script should succeed with defaults")
        last_line = result.stdout.strip().split('\n')[-1]
        output = json.loads(last_line)
        self.assertTrue(output.get("success"), "Expected success=True")
        self.assertIn("path", output, "Expected 'path' field in output")
        self._validate_png(output["path"])

    def test_output_directory_creation(self):
        """Test script creates output directory if it doesn't exist."""
        nonexistent_dir = Path(self.temp_dir) / "nested" / "output"

        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "idle",
            "--output", str(nonexistent_dir),
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "idle")
        self.assertTrue(nonexistent_dir.exists(), "Output directory not created")
        self._validate_png(output["path"])

    def test_default_scene_is_live(self):
        """Test that default scene is 'live' when not specified."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        output = self._validate_success_output(result.stdout, "live")
        self._validate_png(output["path"])

    def test_all_scenes_use_demo_data(self):
        """Test that all scenes work with demo game data."""
        scenes = ["idle", "pregame", "live", "live_big", "final"]

        for scene in scenes:
            with self.subTest(scene=scene):
                result = self._run_generate_preview(
                    "--device-id", "test-device-id",
                    "--scene", scene,
                    "--output", self.temp_dir,
                    "--config-json", json.dumps(self.test_config)
                )

                self.assertEqual(result.returncode, 0, f"Scene {scene} failed: {result.stderr}")
                output = self._validate_success_output(result.stdout, scene)
                self._validate_png(output["path"])

    def test_json_output_format_structure(self):
        """Test that JSON output has correct structure."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        last_line = result.stdout.strip().split('\n')[-1]
        output = json.loads(last_line)

        self.assertIsInstance(output, dict, "Output should be a JSON object")
        self.assertIn("success", output, "Output missing 'success' field")
        self.assertIsInstance(output["success"], bool, "'success' should be boolean")
        self.assertIn("path", output, "Output missing 'path' field")
        self.assertIsInstance(output["path"], str, "'path' should be string")
        self.assertIn("scene", output, "Output missing 'scene' field")
        self.assertIsInstance(output["scene"], str, "'scene' should be string")

    def test_error_output_format_structure(self):
        """Test that error JSON output has correct structure."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", "invalid"
        )

        self.assertNotEqual(result.returncode, 0, "Expected non-zero exit code")
        last_line = result.stdout.strip().split('\n')[-1]
        output = json.loads(last_line)

        self.assertIsInstance(output, dict, "Output should be a JSON object")
        self.assertIn("success", output, "Output missing 'success' field")
        self.assertFalse(output["success"], "'success' should be False on error")
        self.assertIn("error", output, "Error output missing 'error' field")
        self.assertIsInstance(output["error"], str, "'error' should be string")

    def test_png_dimensions_match_config(self):
        """Test that generated PNG matches configured dimensions."""
        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", json.dumps(self.test_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        last_line = result.stdout.strip().split('\n')[-1]
        output = json.loads(last_line)

        img = Image.open(output["path"])
        self.assertEqual(img.width, 64, "PNG width should match config")
        self.assertEqual(img.height, 32, "PNG height should match config")

    def test_different_matrix_dimensions(self):
        """Test generation with different matrix dimensions."""
        custom_config = self.test_config.copy()
        custom_config["matrix_config"] = custom_config["matrix_config"].copy()
        custom_config["matrix_config"]["width"] = 128
        custom_config["matrix_config"]["height"] = 64

        result = self._run_generate_preview(
            "--device-id", "test-device-id",
            "--scene", "live",
            "--output", self.temp_dir,
            "--config-json", json.dumps(custom_config)
        )

        self.assertEqual(result.returncode, 0, f"Script failed: {result.stderr}")
        last_line = result.stdout.strip().split('\n')[-1]
        output = json.loads(last_line)

        img = Image.open(output["path"])
        self.assertEqual(img.width, 128, "PNG width should be 128")
        self.assertEqual(img.height, 64, "PNG height should be 64")


if __name__ == "__main__":
    unittest.main()
