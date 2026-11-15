import sys
from pathlib import Path


app_directory = str(Path(__file__).resolve().parent / "mars-map-app")
if app_directory not in sys.path:
    sys.path.insert(0, app_directory)

from app import app
