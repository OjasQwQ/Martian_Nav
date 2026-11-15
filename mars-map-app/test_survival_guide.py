import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import survival_guide


class MarsClimateModelTests(unittest.TestCase):
    def test_parses_scientific_notation_from_model_results(self):
        response = """
        <ul>
          <li>Temperature (K) ..... 270.11594</li>
          <li>Ozone ..... 1.6160243e-08</li>
        </ul>
        """

        self.assertEqual(
            survival_guide.parse_mcd_response(response, 2),
            [270.11594, 1.6160243e-08],
        )

    def test_rejects_incomplete_model_results(self):
        with self.assertRaisesRegex(
            survival_guide.SurvivalDataUnavailable,
            "incomplete data",
        ):
            survival_guide.parse_mcd_response(
                "<ul><li>Temperature (K) ..... 270.1</li></ul>",
                2,
            )

    def test_season_conversion_wraps_at_the_martian_new_year(self):
        epoch = datetime(1975, 12, 19, 4, tzinfo=timezone.utc)
        longitude = datetime(2026, 11, 15, 11, 31, tzinfo=timezone.utc)

        epoch_ls, _ = survival_guide.mars_season_and_time(epoch)
        current_ls, local_time = survival_guide.mars_season_and_time(longitude)

        self.assertLess(min(epoch_ls, 360 - epoch_ls), 0.01)
        self.assertGreaterEqual(current_ls, 0)
        self.assertLess(current_ls, 360)
        self.assertGreaterEqual(local_time, 0)
        self.assertLess(local_time, 24)


if __name__ == "__main__":
    unittest.main()
