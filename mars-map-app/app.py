import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI(title="NASA Space Apps 2026 - Martian Map Base")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Verified NASA Dataset Locations (Early Mars Complex Water Systems & Landings)
MARS_LOCATIONS = [
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
        "image_2d": "https://mars.nasa.gov/system/resources/detail_files/27762_PIA26067-web.jpg"
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
        "image_2d": "https://photojournal.jpl.nasa.gov/jpegMod/PIA23969_modest.jpg"
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
        "image_2d": "https://photojournal.jpl.nasa.gov/jpegMod/PIA11431_modest.jpg"
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
        "image_2d": "https://mars.nasa.gov/system/resources/detail_files/27190_PIA25626-web.jpg"
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
        "image_2d": "https://photojournal.jpl.nasa.gov/jpegMod/PIA19916_modest.jpg"
    }
]


@app.get("/api/locations")
async def get_locations():
    """Returns NASA Mars dataset locations."""
    return {"status": "ok", "locations": MARS_LOCATIONS}


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
