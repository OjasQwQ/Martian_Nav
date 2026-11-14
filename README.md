# Martian Guide

Martian Guide is an interactive Mars map with a FastAPI backend. Its location catalog is based on the USGS/IAU Gazetteer of Planetary Nomenclature and includes curated mission and geology records.

## Requirements

- Git
- Python 3 and pip
- Internet access to download the Gazetteer on first run and to load online map tiles

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

To check that the API is returning locations in PowerShell:

```powershell
(Invoke-RestMethod http://127.0.0.1:8000/api/locations).locations.Count
```

## Run tests

From the repository root:

```powershell
python -m unittest discover -s mars-map-app -v
```

## Location catalog and cache

The API downloads the Mars center-point dataset from the [USGS/IAU Gazetteer](https://planetarynames.wr.usgs.gov/Page/MARS/target), caches it for seven days, and combines it with curated mission and geology records. The full catalog appears in the Data Index search; the map starts with 20 featured markers and adds a marker for the selected location.

On Windows, the cache defaults to `%TEMP%\martian-nav\mars_nomenclature_center_pts.zip`. Set `MARS_CATALOG_CACHE_DIR` to use another directory. If the Gazetteer cannot be downloaded or refreshed, the API reports a warning and serves cached or bundled records when available.

## Troubleshooting

- **Location API unavailable:** Start the app and check `/api/locations`. The full Gazetteer requires internet access on first download; the page displays a warning if it has to use bundled records.
- **Port 8000 is already in use:** Stop the other Mars app from its terminal with **Ctrl+C**, then start this one. Do not stop a process unless you know it is the old app server.
- **Python packages are missing:** Activate the virtual environment and rerun the `pip install -r ...requirements.txt` command above.
