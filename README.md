# Martian Guide

## Mars location catalog

The map uses the [USGS/IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MARS/target) Mars center-point dataset. The API downloads and caches the Gazetteer archive for seven days, then combines it with seven curated mission and geology records. The API returns the complete catalog; the Data Index search filters all returned locations, while the map initially shows 20 featured markers and adds the selected search result as a temporary marker.

The archive cache defaults to `%TEMP%\martian-nav\mars_nomenclature_center_pts.zip`. Set `MARS_CATALOG_CACHE_DIR` to use another cache directory. If the Gazetteer cannot be downloaded or refreshed and no valid cache is available, the API reports a warning and serves the bundled curated records.

### Run locally on Windows

```powershell
cd mars-map-app
python -m pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The complete catalog is also available at `/api/locations`.

### Run catalog parser tests

From the repository root:

```powershell
python -m unittest discover -s mars-map-app
```
