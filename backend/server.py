from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import webbrowser
import threading
import time
from data import vitals_data, survival_cards
from nasa_fetch import fetch_nasa_weather

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
    return survival_cards

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
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")