from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path
import sys
import threading
import time
import webbrowser

from data import vitals_data
from nasa_fetch import fetch_nasa_weather

mars_app_directory = str(Path(__file__).resolve().parents[1] / "mars-map-app")
if mars_app_directory not in sys.path:
    sys.path.insert(0, mars_app_directory)
from survival_guide import (
    SURVIVAL_REFERENCE_CARDS,
    SurvivalDataUnavailable,
    get_site_conditions,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
cached_vitals = None
cached_charts = None
last_fetched = 0
CACHE_DURATION = 1800  

def get_nasa_data():
    global cached_vitals, cached_charts, last_fetched
    now = time.time()
    if now - last_fetched > CACHE_DURATION or cached_vitals is None:
        vitals, charts = fetch_nasa_weather()
        if vitals:
            cached_vitals = vitals
            cached_charts = charts
            last_fetched = now
    return cached_vitals, cached_charts

@app.get("/vitals")
def get_vitals():
    nasa_vitals, _ = get_nasa_data()
    if nasa_vitals:
        return nasa_vitals
    return vitals_data

@app.get("/survival-cards")
def get_survival_cards():
    return SURVIVAL_REFERENCE_CARDS


@app.get("/api/survival-guide")
def get_survival_guide(lat: float, lon: float):
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(
            status_code=422,
            detail="Latitude must be between -90 and 90 and longitude between -180 and 180.",
        )
    try:
        return get_site_conditions(lat, lon)
    except SurvivalDataUnavailable as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/survival-guide/references")
def get_survival_guide_references():
    return SURVIVAL_REFERENCE_CARDS

@app.get("/status")
def get_status():
    _, charts = get_nasa_data()
    if charts:
        return {
            "sol": charts['sol'],
            "status": "nominal",
            "crew": "active",
            "last_updated": int(last_fetched)
        }
    return {"sol": 847, "status": "nominal", "crew": "active", "last_updated": 0}

@app.get("/charts")
def get_charts():
    _, charts = get_nasa_data()
    if charts:
        return charts
    return {"error": "NASA data unavailable", "fallback": True}
def open_browser():
    webbrowser.open("http://localhost:8000")

threading.Timer(1.5, open_browser).start()
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
survival_assets_path = os.path.join(
    mars_app_directory,
    "static",
    "survival-assets",
)
app.mount(
    "/survival-assets",
    StaticFiles(directory=survival_assets_path),
    name="survival-assets",
)
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")