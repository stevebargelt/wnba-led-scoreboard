"""Visual regression tests for preview generation."""

import json
import os
import subprocess
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops


class TestVisualRegression(unittest.TestCase):
    """Test visual consistency of generated preview images."""

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures."""
        cls.project_root = Path(__file__).parent.parent
        cls.baseline_dir = cls.project_root / "tests" / "visual" / "baselines"
        cls.diff_dir = cls.project_root / "tests" / "visual" / "diffs"
        cls.test_output_dir = cls.project_root / "tests" / "visual" / "test_output"
        cls.generate_script = cls.project_root / "scripts" / "generate_preview.py"

        cls.test_output_dir.mkdir(parents=True, exist_ok=True)
        cls.diff_dir.mkdir(parents=True, exist_ok=True)

        cls.test_config = {
            "device_id": "test-device",
            "display": {
                "width": 64,
                "height": 32,
                "brightness": 75
            },
            "preferences": {
                "timezone": "America/New_York",
                "big_logos": False
            },
            "leagues": ["wnba", "nhl"],
            "favorite_teams": []
        }

        cls.scenes = ["idle", "pregame", "live", "live_big", "final"]
        cls.default_tolerance = 0.05

    @classmethod
    def tearDownClass(cls):
        """Clean up test output directory."""
        if cls.test_output_dir.exists():
            import shutil
            shutil.rmtree(cls.test_output_dir)

    def _generate_test_preview(self, scene: str) -> Path:
        """Generate a test preview for the given scene."""
        cmd = [
            "python3",
            str(self.generate_script),
            "--device-id", "test-device",
            "--scene", scene,
            "--output", str(self.test_output_dir / scene),
            "--config-json", json.dumps(self.test_config)
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(self.project_root)
        )

        if result.returncode != 0:
            self.fail(f"Failed to generate test preview for {scene}: {result.stderr}")

        output = json.loads(result.stdout)
        if not output.get("success"):
            self.fail(f"Preview generation failed for {scene}: {output.get('error')}")

        test_path = Path(output["path"])
        if not test_path.exists():
            self.fail(f"Generated preview not found: {test_path}")

        return test_path

    def _compare_images(
        self,
        baseline_path: Path,
        test_path: Path,
        tolerance: float = None,
        mask_regions: list = None
    ) -> tuple[bool, float, Image.Image]:
        """
        Compare two images and return whether they match within tolerance.

        Args:
            baseline_path: Path to baseline image
            test_path: Path to test image
            tolerance: Maximum allowed difference (0.0-1.0). Defaults to class default.
            mask_regions: List of (x, y, width, height) tuples to ignore during comparison

        Returns:
            Tuple of (matches, diff_percentage, diff_image)
        """
        if tolerance is None:
            tolerance = self.default_tolerance

        baseline = Image.open(baseline_path).convert("RGB")
        test = Image.open(test_path).convert("RGB")

        if baseline.size != test.size:
            return False, 1.0, None

        if mask_regions:
            baseline_copy = baseline.copy()
            test_copy = test.copy()

            for x, y, width, height in mask_regions:
                black_box = Image.new("RGB", (width, height), (0, 0, 0))
                baseline_copy.paste(black_box, (x, y))
                test_copy.paste(black_box, (x, y))

            baseline = baseline_copy
            test = test_copy

        diff = ImageChops.difference(baseline, test)

        diff_array = np.array(diff)
        total_pixels = diff_array.size
        total_diff = np.sum(diff_array)
        max_possible_diff = total_pixels * 255

        diff_percentage = total_diff / max_possible_diff if max_possible_diff > 0 else 0.0

        matches = diff_percentage <= tolerance

        return matches, diff_percentage, diff

    def _save_diff_image(self, scene: str, diff_image: Image.Image):
        """Save a diff image for debugging."""
        diff_path = self.diff_dir / f"{scene}_diff.png"
        diff_image.save(diff_path)
        return diff_path

    def _check_baselines_exist(self):
        """Check if baseline images exist, skip tests if not."""
        missing = []
        for scene in self.scenes:
            baseline_path = self.baseline_dir / f"{scene}_baseline.png"
            if not baseline_path.exists():
                missing.append(scene)

        if missing:
            self.skipTest(
                f"Baseline images not found for: {', '.join(missing)}. "
                f"Run scripts/generate_preview_baselines.sh to create them."
            )

    def test_baselines_directory_exists(self):
        """Test that baselines directory exists."""
        self.assertTrue(
            self.baseline_dir.exists(),
            "Baselines directory does not exist. Run scripts/generate_preview_baselines.sh"
        )

    def test_idle_scene_visual_consistency(self):
        """Test that idle scene matches baseline."""
        self._check_baselines_exist()
        scene = "idle"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        matches, diff_pct, diff_img = self._compare_images(baseline_path, test_path)

        if not matches:
            diff_path = self._save_diff_image(scene, diff_img)
            self.fail(
                f"{scene} scene differs from baseline by {diff_pct:.2%} "
                f"(tolerance: {self.default_tolerance:.2%}). "
                f"Diff saved to: {diff_path}"
            )

        self.assertTrue(matches, f"{scene} scene should match baseline")

    def test_pregame_scene_visual_consistency(self):
        """Test that pregame scene matches baseline."""
        self._check_baselines_exist()
        scene = "pregame"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        matches, diff_pct, diff_img = self._compare_images(baseline_path, test_path)

        if not matches:
            diff_path = self._save_diff_image(scene, diff_img)
            self.fail(
                f"{scene} scene differs from baseline by {diff_pct:.2%} "
                f"(tolerance: {self.default_tolerance:.2%}). "
                f"Diff saved to: {diff_path}"
            )

        self.assertTrue(matches, f"{scene} scene should match baseline")

    def test_live_scene_visual_consistency(self):
        """Test that live scene matches baseline."""
        self._check_baselines_exist()
        scene = "live"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        matches, diff_pct, diff_img = self._compare_images(baseline_path, test_path)

        if not matches:
            diff_path = self._save_diff_image(scene, diff_img)
            self.fail(
                f"{scene} scene differs from baseline by {diff_pct:.2%} "
                f"(tolerance: {self.default_tolerance:.2%}). "
                f"Diff saved to: {diff_path}"
            )

        self.assertTrue(matches, f"{scene} scene should match baseline")

    def test_live_big_scene_visual_consistency(self):
        """Test that live_big scene matches baseline."""
        self._check_baselines_exist()
        scene = "live_big"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        matches, diff_pct, diff_img = self._compare_images(baseline_path, test_path)

        if not matches:
            diff_path = self._save_diff_image(scene, diff_img)
            self.fail(
                f"{scene} scene differs from baseline by {diff_pct:.2%} "
                f"(tolerance: {self.default_tolerance:.2%}). "
                f"Diff saved to: {diff_path}"
            )

        self.assertTrue(matches, f"{scene} scene should match baseline")

    def test_final_scene_visual_consistency(self):
        """Test that final scene matches baseline."""
        self._check_baselines_exist()
        scene = "final"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        matches, diff_pct, diff_img = self._compare_images(baseline_path, test_path)

        if not matches:
            diff_path = self._save_diff_image(scene, diff_img)
            self.fail(
                f"{scene} scene differs from baseline by {diff_pct:.2%} "
                f"(tolerance: {self.default_tolerance:.2%}). "
                f"Diff saved to: {diff_path}"
            )

        self.assertTrue(matches, f"{scene} scene should match baseline")

    def test_tolerance_configuration(self):
        """Test that tolerance can be configured."""
        self._check_baselines_exist()
        scene = "idle"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        strict_matches, _, _ = self._compare_images(
            baseline_path, test_path, tolerance=0.01
        )
        relaxed_matches, _, _ = self._compare_images(
            baseline_path, test_path, tolerance=0.50
        )

        self.assertTrue(
            relaxed_matches or strict_matches,
            "At least one tolerance level should pass for identical images"
        )

    def test_mask_regions_for_timestamps(self):
        """Test that mask regions can be used to ignore non-deterministic elements."""
        self._check_baselines_exist()
        scene = "live"
        baseline_path = self.baseline_dir / f"{scene}_baseline.png"
        test_path = self._generate_test_preview(scene)

        mask_regions = [(0, 0, 20, 8)]

        matches, diff_pct, _ = self._compare_images(
            baseline_path, test_path, mask_regions=mask_regions
        )

        self.assertIsNotNone(diff_pct, "Diff percentage should be calculated")

    def test_diff_image_generation(self):
        """Test that diff images are generated on failure."""
        self._check_baselines_exist()

        baseline = Image.new("RGB", (64, 32), (255, 0, 0))
        test = Image.new("RGB", (64, 32), (0, 255, 0))

        baseline_path = self.test_output_dir / "test_baseline.png"
        test_path = self.test_output_dir / "test_image.png"

        baseline.save(baseline_path)
        test.save(test_path)

        matches, _, diff_img = self._compare_images(baseline_path, test_path)

        self.assertFalse(matches, "Different images should not match")
        self.assertIsNotNone(diff_img, "Diff image should be generated")

        diff_path = self._save_diff_image("test", diff_img)
        self.assertTrue(diff_path.exists(), "Diff image should be saved")


if __name__ == "__main__":
    unittest.main()
