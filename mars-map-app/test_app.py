import io
import sys
import unittest
import zipfile
from pathlib import Path

import shapefile

sys.path.insert(0, str(Path(__file__).parent))
import app


def make_gazetteer_archive(duplicate_record=False):
    shp = io.BytesIO()
    shx = io.BytesIO()
    dbf = io.BytesIO()
    writer = shapefile.Writer(shp=shp, shx=shx, dbf=dbf)
    writer.field("name", "C", size=80)
    writer.field("clean_name", "C", size=80)
    writer.field("approvaldt", "C", size=20)
    writer.field("origin", "C", size=80)
    writer.field("diameter", "N", size=12, decimal=2)
    writer.field("center_lon", "N", size=12, decimal=4)
    writer.field("center_lat", "N", size=12, decimal=4)
    writer.field("type", "C", size=40)
    writer.field("approval", "C", size=20)
    writer.field("quad_name", "C", size=40)
    writer.field("link", "C", size=120)
    writer.point(190, 15)
    record = (
        "Crater Alpha",
        "Crater Alpha",
        "2001-01-02",
        "A named scientist",
        42.5,
        190,
        15,
        "Crater",
        "Approved",
        "Quadrangle A",
        "https://planetarynames.wr.usgs.gov/Feature/123",
    )
    writer.record(*record)
    if duplicate_record:
        writer.point(190, 15)
        writer.record(*record)
    writer.close()

    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr("mars.shp", shp.getvalue())
        archive.writestr("mars.shx", shx.getvalue())
        archive.writestr("mars.dbf", dbf.getvalue())
        archive.writestr("mars.cpg", "UTF-8")
    return payload.getvalue()


class GazetteerParserTests(unittest.TestCase):
    def test_extracts_feature_metadata_and_normalizes_longitude(self):
        locations = app.parse_gazetteer_archive(make_gazetteer_archive())

        self.assertEqual(len(locations), 1)
        location = locations[0]
        self.assertEqual(location["id"], "usgs-123")
        self.assertEqual(location["name"], "Crater Alpha")
        self.assertEqual(location["lat"], 15)
        self.assertEqual(location["lon"], -170)
        self.assertEqual(location["diameter_km"], 42.5)
        self.assertEqual(location["feature_type"], "Crater")
        self.assertEqual(location["origin"], "A named scientist")
        self.assertEqual(location["approval_date"], "2001-01-02")
        self.assertEqual(location["approval_status"], "Approved")
        self.assertEqual(location["quadrangle"], "Quadrangle A")
        self.assertEqual(
            location["source_url"],
            "https://planetarynames.wr.usgs.gov/Feature/123",
        )

    def test_rejects_archive_without_shapefile_components(self):
        empty_archive = io.BytesIO()
        with zipfile.ZipFile(empty_archive, "w"):
            pass
        with self.assertRaisesRegex(ValueError, "missing shapefile components"):
            app.parse_gazetteer_archive(empty_archive.getvalue())

    def test_deduplicates_identical_feature_rows(self):
        locations = app.parse_gazetteer_archive(
            make_gazetteer_archive(duplicate_record=True)
        )

        self.assertEqual(len(locations), 1)
        self.assertEqual(locations[0]["id"], "usgs-123")


if __name__ == "__main__":
    unittest.main()
