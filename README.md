# Martian Guide

Martian Guide is an interactive Mars map with a FastAPI backend. Its location catalog is based on the USGS/IAU Gazetteer of Planetary Nomenclature and includes curated mission and geology records. The Survival Guide shows coordinate-specific Mars Climate Database estimates, atmospheric mixing ratios, and sourced mission and hazard references.

## Requirements

- Git
- Python 3 and pip
- Internet access to download the Gazetteer and query the Mars Climate Database, and to load online map tiles, fonts, and libraries

## Fork and clone

1. Sign in to GitHub and use **Fork** on [OjasQwQ/Martian_Nav](https://github.com/OjasQwQ/Martian_Nav).
2. Clone your fork and add the original repository as `upstream`:

```powershell
git clone https://github.com/<YOUR-GITHUB-USERNAME>/Martian_Nav.git
cd Martian_Nav
git remote add upstream https://github.com/OjasQwQ/Martian_Nav.git
git remote -v
```

Alternatively, with [GitHub CLI](https://cli.github.com/):

```powershell
gh auth login
gh repo fork OjasQwQ/Martian_Nav --clone
cd Martian_Nav
```

To update your fork's `main` branch later:

```powershell
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

Create a branch for your changes and push it to your fork:

```powershell
git switch -c feature/describe-your-change
# Make and test your changes
# Replace this path with the file(s) you changed; avoid staging your whole virtual environment.
git add .\path\to\changed-file
git commit -m "Describe your change"
git push -u origin feature/describe-your-change
```

Then open a pull request from your branch to `OjasQwQ/Martian_Nav` on GitHub.

## Install dependencies

Run these commands from the repository root.

### Windows PowerShell

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r .\mars-map-app\requirements.txt
```

If PowerShell prevents virtual-environment activation, use the venv's Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\mars-map-app\requirements.txt
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r mars-map-app/requirements.txt
```

## Start the app

### One-click launch on Windows

Double-click `start-mars-map.bat`, or run:

```powershell
.\start-mars-map.bat
```

The launcher reuses a compatible server or starts one, waits for the API, and opens the app in your browser. The server runs in a separate console window; close that window to stop it. If port 8000 is occupied by an incompatible server, stop that server and run the launcher again.

Open the app through the local server at `http://127.0.0.1:8000`. Do not open `mars-map-app/static/index.html` directly as a `file:///` URL: the Survival Guide assets and the map's API requests require the server.

### Start manually

From the repository root:

```powershell
python .\mars-map-app\app.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The API endpoint is [http://127.0.0.1:8000/api/locations](http://127.0.0.1:8000/api/locations). Stop the server by pressing **Ctrl+C** in its terminal.

If dependencies are installed in the virtual environment and it is not activated, use:

```powershell
.\.venv\Scripts\python.exe .\mars-map-app\app.py
```

On macOS or Linux, start the app from the repository root with:

```bash
python mars-map-app/app.py
```

Check that the locations API responds in PowerShell:

```powershell
(Invoke-RestMethod http://127.0.0.1:8000/api/locations).locations.Count
```

In VS Code, the browser launch configuration opens `http://127.0.0.1:8000`; start the app server first.

## Deploy to Vercel

Import the **repository root** into Vercel. Set the project Root Directory to `.`
and leave the Build Command and Output Directory empty. Vercel detects the
FastAPI application through the root `index.py`; that entry point serves the map,
static assets, and API routes together. The root `requirements.txt` includes the
runtime's `pyshp` dependency. `vercel.json` allows up to 60 seconds for requests
that refresh the location catalog or query the climate model.

The first location-catalog request needs internet access to download the USGS/IAU
Gazetteer. Vercel function storage is temporary, so a later function instance may
download the catalog again. The climate model also requires outbound access to the
Mars Climate Database service.

## Survival Guide data

The selected map coordinates are used to query the Mars Climate Database (MCD)
v6.2 for modeled surface temperature, pressure, wind, dust, sunlight, and
atmospheric gases. The Guide labels these as model estimates; they are not live
measurements, a forecast, or a crew safety assessment. If the external model is
unavailable, the Guide reports that state rather than substituting invented
values. Mission and hazard cards provide general reference information and do
not imply that food, shelter, power, communications, or a safe site exists at a
selected coordinate.

## Run tests

From the repository root:

```powershell
py -3 -m unittest discover -s .\mars-map-app -v
```

On macOS or Linux, run `python3 -m unittest discover -s mars-map-app -v`.

## Location catalog and cache

The API downloads the Mars center-point dataset from the [USGS/IAU Gazetteer](https://planetarynames.wr.usgs.gov/Page/MARS/target), caches it for seven days, and combines it with curated mission and geology records. The full catalog appears in the Data Index search; the map starts with 20 featured markers and adds a marker for the selected location.

On Windows, the cache defaults to `%TEMP%\martian-nav\mars_nomenclature_center_pts.zip`. Set `MARS_CATALOG_CACHE_DIR` to use another directory. If the Gazetteer cannot be downloaded or refreshed, the API reports a warning and serves cached or bundled records when available.

## Mars position and traverse planning

Mars has no GPS service for an astronaut. **Locate Coordinates** therefore uses latitude and longitude that you enter in Mars coordinates; it does not read browser geolocation or claim to track a live astronaut. It places that manually supplied position on the 3D globe, then centers the 2D Mars map on it.

Use **Plot Traverse** to draw a path on the 2D map. To add it to local route history, give it a name and confirm that it represents a completed walk. Saved walks stay in that browser's local storage and are not uploaded to the server. The local planner can recommend a route only when a saved completed walk comes within 25 km of both the current position and the selected known destination. Recommendations reuse the recorded path and use straight-line connectors; they are advisory and do not account for terrain hazards, slope, rover/astronaut constraints, or communications. No historical astronaut or rover walk dataset is bundled, and the planner does not generate or verify such data.

## Troubleshooting

- **Location API unavailable:** Start the app and check `/api/locations`. The full Gazetteer requires internet access on first download; the page displays a warning if it has to use bundled records.
- **Port 8000 is already in use:** Stop the other Mars app from its terminal with **Ctrl+C**, then start this one. Do not stop a process unless you know it is the old app server.
- **Python packages are missing:** Activate the virtual environment and rerun the `pip install -r ...requirements.txt` command above.
