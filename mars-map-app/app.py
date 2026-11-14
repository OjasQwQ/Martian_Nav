import io
import logging
import os
import re
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import shapefile
import uvicorn

app = FastAPI(title="NASA Space Apps 2026 - Martian Map Base")
logger = logging.getLogger(__name__)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GAZETTEER_URL = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip"
GAZETTEER_SOURCE = "USGS/IAU Gazetteer of Planetary Nomenclature"
GAZETTEER_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
FEATURED_GAZETTEER_FEATURES = {
    "olympus mons": "Volcanic landmark",
    "gusev": "Spirit rover discovery site",
    "meridiani planum": "Opportunity rover discovery site",
    "elysium planitia": "Recent mission landing site",
    "utopia planitia": "Major landing and exploration region",
    "chryse planitia": "Historic landing region",
    "ares vallis": "Major water-history discovery",
    "noctis labyrinthus": "Major geological landmark",
    "hellas planitia": "Largest impact basin",
    "isidis planitia": "Major exploration region",
    "tharsis": "Major volcanic province",
    "arcadia planitia": "Exploration region",
    "endeavour": "Opportunity rover exploration site",
}

# Curated records retain the mission and geological details not in the Gazetteer.
CURATED_LOCATIONS = [
    {
        "id": "jezero-margin-unit",
        "name": "Jezero Crater: Margin Unit",
        "mission": "Mars 2020 Perseverance",
        "lat": 18.4447,
        "lon": 77.4508,
        "elev": -2485,
        "water_summary": (
            "3-Episode Water System: (1) CO2-rich groundwater altered igneous olivine into carbonate ridges; "
            "(2) Ancient lake shoreline deposited silica below water level; "
            "(3) Late-stage hydrothermal fluid alteration."
        ),
        "minerals": ["Igneous Olivine", "Carbonate Ridges", "Hydrothermal Silica"],
        "image_2d": "https://mars.nasa.gov/system/resources/detail_files/27762_PIA26067-web.jpg",
        "feature_type": "Geological unit",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": None,
        "source_url": None,
        "featured": True,
        "featured_category": "Perseverance discovery site"
    },
    {
        "id": "jezero-neretva-vallis",
        "name": "Jezero Crater: Neretva Vallis Inlet Channel",
        "mission": "Mars 2020 Perseverance / MRO HiRISE",
        "lat": 18.5210,
        "lon": 77.3650,
        "elev": -2310,
        "water_summary": (
            "Ancient river channel that breached the western rim of Jezero Crater, "
            "carrying clay and carbonate sediments into the crater lake."
        ),
        "minerals": ["Smectite Clays", "Carbonates", "hydrated Silica"],
        "image_2d": "https://photojournal.jpl.nasa.gov/jpegMod/PIA23969_modest.jpg",
        "feature_type": "Inlet channel",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": None,
        "source_url": None,
        "featured": True,
        "featured_category": "Perseverance discovery site"
    },
    {
        "id": "nili-fossae",
        "name": "Nili Fossae Regional Trough",
        "mission": "MRO CRISM / Mars Express",
        "lat": 21.5000,
        "lon": 74.2000,
        "elev": -650,
        "water_summary": (
            "Largest exposed carbonate-olivine bedrock unit on Mars, preserving "
            "Noachian-era subsurface groundwater pathways."
        ),
        "minerals": ["Magnesium Carbonate", "Olivine", "Phyllosilicates"],
        "image_2d": "https://photojournal.jpl.nasa.gov/jpegMod/PIA11431_modest.jpg",
        "feature_type": "Regional trough",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": None,
        "source_url": None,
        "featured": True,
        "featured_category": "Major mineral discovery"
    },
    {
        "id": "gale-mount-sharp",
        "name": "Gale Crater: Mount Sharp Boxwork Ridges",
        "mission": "Curiosity Rover (MSL)",
        "lat": -5.0800,
        "lon": 137.8500,
        "elev": -4120,
        "water_summary": (
            "Groundwater flowed through bedrock fractures, depositing minerals that "
            "hardened into boxwork ridges as surrounding rock eroded."
        ),
        "minerals": ["Sulfate Salts", "Clay Minerals", "Hematite"],
        "image_2d": "https://mars.nasa.gov/system/resources/detail_files/27190_PIA25626-web.jpg",
        "feature_type": "Crater and mountain",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": None,
        "source_url": None,
        "featured": True,
        "featured_category": "Curiosity discovery site"
    },
    {
        "id": "valles-marineris",
        "name": "Valles Marineris: Coprates Chasma",
        "mission": "MRO HiRISE",
        "lat": -13.9000,
        "lon": -60.5000,
        "elev": -4800,
        "water_summary": (
            "Deep canyon system exposing ancient layered crust and hydrated sulfate deposits "
            "from massive subsurface flood releases."
        ),
        "minerals": ["Hydrated Sulfates", "Basaltic Breccia"],
        "image_2d": "https://photojournal.jpl.nasa.gov/jpegMod/PIA19916_modest.jpg",
        "feature_type": "Canyon system",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": None,
        "source_url": None,
        "featured": True,
        "featured_category": "Major geological landmark"
    },
    {
        "id": "mars-3-landing-site",
        "name": "Mars 3 Landing Site (approximate)",
        "mission": "Mars 3 (1971)",
        "lat": -45.0,
        "lon": -158.0,
        "elev": None,
        "water_summary": (
            "First spacecraft to make a survivable landing on Mars; contact was lost "
            "shortly after touchdown."
        ),
        "minerals": [],
        "image_2d": None,
        "feature_type": "Mission landing site (approximate)",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": None,
        "source_url": "https://en.wikipedia.org/wiki/Mars_3",
        "featured": True,
        "featured_category": "First soft landing"
    },
    {
        "id": "viking-1-landing-site",
        "name": "Viking 1 Landing Site",
        "mission": "Viking 1 (1976)",
        "lat": 22.483,
        "lon": -47.94,
        "elev": None,
        "water_summary": (
            "First truly successful landing on Mars; Viking 1 returned the first "
            "surface images from the planet."
        ),
        "minerals": [],
        "image_2d": None,
        "feature_type": "Mission landing site",
        "origin": None,
        "diameter_km": None,
        "approval_date": None,
        "approval_status": None,
        "quadrangle": "Chryse Planitia",
        "source_url": "https://science.nasa.gov/mission/viking-1/",
        "featured": True,
        "featured_category": "First successful U.S. landing"
    },
]


def _cache_path():
    cache_dir = Path(
        os.environ.get(
            "MARS_CATALOG_CACHE_DIR",
            Path(tempfile.gettempdir()) / "martian-nav",
        )
    )
    return cache_dir / "mars_nomenclature_center_pts.zip"


def parse_gazetteer_archive(payload):
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        members = archive.namelist()

        def find_member(suffix):
            return next(
                (name for name in members if name.lower().endswith(suffix)),
                None,
            )

        shp_name = find_member(".shp")
        dbf_name = find_member(".dbf")
        shx_name = find_member(".shx")
        cpg_name = find_member(".cpg")
        if not shp_name or not dbf_name or not shx_name:
            raise ValueError("Gazetteer archive is missing shapefile components")

        encoding = "utf-8"
        if cpg_name:
            encoding = archive.read(cpg_name).decode("ascii").strip() or encoding

        reader = shapefile.Reader(
            shp=io.BytesIO(archive.read(shp_name)),
            shx=io.BytesIO(archive.read(shx_name)),
            dbf=io.BytesIO(archive.read(dbf_name)),
            encoding=encoding,
        )
        try:
            field_names = [field[0].lower() for field in reader.fields[1:]]
            required_fields = {"name", "center_lat", "center_lon", "type", "link"}
            if not required_fields.issubset(field_names):
                raise ValueError("Gazetteer archive is missing required attributes")

            locations = []
            for record in reader.iterRecords():
                attributes = dict(zip(field_names, record))
                name = str(attributes.get("clean_name") or attributes["name"]).strip()
                try:
                    lat = float(attributes["center_lat"])
                    lon = float(attributes["center_lon"])
                except (TypeError, ValueError):
                    continue
                if not name or not (-90 <= lat <= 90):
                    continue

                lon = ((lon + 180) % 360) - 180
                link = str(attributes.get("link") or "").strip()
                feature_match = re.search(r"/Feature/(\d+)", link)
                if not feature_match:
                    continue

                diameter = attributes.get("diameter")
                try:
                    diameter = float(diameter) if diameter is not None else None
                except (TypeError, ValueError):
                    diameter = None

                locations.append(
                    {
                        "id": f"usgs-{feature_match.group(1)}",
                        "name": name,
                        "mission": None,
                        "lat": lat,
                        "lon": lon,
                        "elev": None,
                        "water_summary": None,
                        "minerals": [],
                        "image_2d": None,
                        "feature_type": str(attributes.get("type") or "").strip() or None,
                        "origin": str(attributes.get("origin") or "").strip() or None,
                        "diameter_km": diameter,
                        "approval_date": str(attributes.get("approvaldt") or "").strip() or None,
                        "approval_status": str(attributes.get("approval") or "").strip() or None,
                        "quadrangle": str(attributes.get("quad_name") or "").strip() or None,
                        "source_url": link.replace("http://", "https://", 1),
                        "featured": False,
                        "featured_category": None,
                    }
                )
        finally:
            reader.close()

    if not locations:
        raise ValueError("Gazetteer archive contained no usable Mars features")
    return locations


def _download_gazetteer():
    request = urllib.request.Request(
        GAZETTEER_URL,
        headers={"User-Agent": "MartianNav/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read(20 * 1024 * 1024 + 1)
    if len(payload) > 20 * 1024 * 1024:
        raise ValueError("Gazetteer archive exceeded the 20 MB download limit")
    return payload


def _load_location_payload():
    cache_path = _cache_path()
    cached_locations = None
    cache_is_fresh = False

    if cache_path.is_file():
        try:
            cached_locations = parse_gazetteer_archive(cache_path.read_bytes())
            cache_is_fresh = time.time() - cache_path.stat().st_mtime < GAZETTEER_CACHE_TTL_SECONDS
        except (OSError, ValueError, zipfile.BadZipFile, shapefile.ShapefileException) as error:
            logger.warning("Ignoring invalid Gazetteer cache at %s: %s", cache_path, error)

    warning = None
    catalog = cached_locations
    if not cache_is_fresh:
        try:
            payload = _download_gazetteer()
            catalog = parse_gazetteer_archive(payload)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            temporary_path = cache_path.with_suffix(".tmp")
            temporary_path.write_bytes(payload)
            os.replace(temporary_path, cache_path)
        except (OSError, ValueError, urllib.error.URLError, zipfile.BadZipFile, shapefile.ShapefileException) as error:
            logger.exception("Unable to refresh the USGS/IAU Mars Gazetteer")
            if catalog:
                warning = f"Using cached Gazetteer data; refresh failed: {error}"
            else:
                warning = f"Gazetteer unavailable; showing bundled locations: {error}"

    if catalog:
        for location in catalog:
            category = FEATURED_GAZETTEER_FEATURES.get(location["name"].casefold())
            if category:
                location["featured"] = True
                location["featured_category"] = category
        locations = catalog + CURATED_LOCATIONS
    else:
        locations = CURATED_LOCATIONS

    featured_count = sum(location["featured"] for location in locations)
    if featured_count < 20:
        logger.warning(
            "Only %d curated Gazetteer markers were found; 20 were requested",
            featured_count,
        )

    return {
        "status": "ok" if not warning else "degraded",
        "source": GAZETTEER_SOURCE if catalog else "Bundled curated locations",
        "warning": warning,
        "featured_count": featured_count,
        "locations": locations,
        "mission_highlights": [
            {
                "id": "mariner-4",
                "name": "Mariner 4",
                "summary": "First successful Mars flyby; no surface landing location.",
                "lat": None,
                "lon": None,
            },
            {
                "id": "mars-3",
                "name": "Mars 3",
                "summary": "First successful soft landing on Mars (1971).",
                "location_id": "mars-3-landing-site",
            },
            {
                "id": "viking-1",
                "name": "Viking 1",
                "summary": "First successful U.S. Mars landing (1976).",
                "location_id": "viking-1-landing-site",
            },
        ],
    }


_catalog_lock = Lock()
_location_payload = None


def get_location_payload():
    global _location_payload
    if _location_payload is None:
        with _catalog_lock:
            if _location_payload is None:
                _location_payload = _load_location_payload()
    return _location_payload


@app.get("/api/locations")
def get_locations():
    """Returns the complete Mars Gazetteer and curated location records."""
    return get_location_payload()


# Mount static files if the directory exists
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(static_dir, "index.html"))


if __name__ == "__main__":
    print("Starting Martian Map Server at http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
