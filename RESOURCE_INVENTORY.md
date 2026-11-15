# Martian Nav — Data, Resources, and Tools

Prepared for NASA Space Apps Challenge 2026 on 15 November 2026.

## Scope and attribution note

This inventory records resources referenced by the project files in this repository. It cannot establish every source consulted during development or identify materials used outside the repository. Team members should add any research, code, images, datasets, or services they used that are not listed here, and verify the current attribution and reuse terms for each external resource before submission.

The repository's `LICENSE` applies to this project's own code as stated there. It does not automatically license third-party data, imagery, fonts, map tiles, or libraries. The license file's copyright notice is not proof of authorship or licensing for those external materials.

## Data and scientific information

| Resource | Use in the project | Source / notes |
|---|---|---|
| USGS/IAU Gazetteer of Planetary Nomenclature — Mars center-point archive | Primary runtime catalog of named Mars features and their center coordinates and available nomenclature attributes (name, feature type, origin, diameter, approval information, quadrangle, and feature link). The app downloads the archive, caches it for seven days where the host permits, and parses its shapefile components. On Vercel, local function storage is temporary and a later function instance may download the archive again. | [Mars Gazetteer page](https://planetarynames.wr.usgs.gov/Page/MARS/target); [archive URL used by the app](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.zip). The archive is hosted on Amazon S3; the project identifies the dataset as the USGS/IAU Gazetteer. |
| Mars Climate Database (MCD) v6.2 | Coordinate- and time-dependent climatology estimates returned by the Survival Guide: surface temperature, pressure, wind, dust optical depth, incident sunlight, and volume mixing ratios for CO₂, N₂, argon, O₂, CO, O₃, and H₂O vapor. The app computes Mars season and local solar time and makes three variable-group requests to the MCD CGI. Results are labeled as model output, not live observations, a forecast, or a human safety assessment. | [MCD home and documentation](https://www-mars.lmd.jussieu.fr/mcd_python/); [MCD CGI endpoint used by the app](https://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py). The feature requires outbound network access and can show an unavailable state if the external service fails. |
| Curated Mars locations | Curated mission and geology records in the Python backend. The browser JavaScript also carries a five-location fallback dataset, but the complete interface and Survival Guide require the FastAPI server. These records add coordinates, elevations, mission labels, geology summaries, mineral lists, and image links not supplied by the app's Gazetteer parser. | Embedded in [`app.py`](mars-map-app/app.py) and [`main.js`](mars-map-app/static/main.js). The Viking 1 record links to [NASA's Viking 1 mission page](https://science.nasa.gov/mission/viking-1/); the Mars 3 record links to [Wikipedia's Mars 3 article](https://en.wikipedia.org/wiki/Mars_3). Other curated records have no per-record source URL in the code. Their geological claims and coordinates should be checked against primary mission/science references and cited individually if required by the submission. |
| NASA Mars Trek map tiles | 2D shaded-relief map imagery; the app requests tiles from NASA's Mars Trek WMTS service. | [NASA Mars Trek tile service](https://trek.nasa.gov/tiles/Mars/EQ/). The configured layer is `Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw`; the displayed attribution is “NASA Mars Trek WMTS.” Tiles are loaded online, not bundled. |
| NASA/JPL images linked by the curated location records | Location-card / detail imagery, loaded from remote URLs at runtime. | See the image inventory below. |
| Mars 3 and Viking 1 mission highlights | Short mission summaries and links in the application response. | Embedded in [`app.py`](mars-map-app/app.py). The Viking 1 location cites NASA; the Mars 3 location cites Wikipedia. The Mariner 4 highlight says it has no surface landing location and does not include a separate source URL. |
| Survival Guide reference cards | General mission and hazard context for oxygen/life support, toxic gases and regolith, water, food, power, spacesuits/EVA, communications, and shelter. These cards are not coordinate-specific measurements or proof that human infrastructure exists at a map point. The Phoenix perchlorate result is explicitly limited to its landing site. | Embedded in [`survival_guide.py`](mars-map-app/survival_guide.py). Sources include [NASA's Mars 2020/Perseverance instrument information for MOXIE](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/#moxie), [NASA's Phoenix mission page](https://science.nasa.gov/mission/mars-phoenix/), and the MCD documentation linked above. The code also links to [NASA's Mars Reconnaissance Orbiter page](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/) for communications context; verify that specific URL before submission because it could not be independently checked during this update. |
| Unit-test fixture data | A small synthetic shapefile archive is generated in memory by the tests to exercise parsing, duplicate handling, longitude normalization, coordinate bounds, and reference-card coverage. It includes a test record named “Crater Alpha”; it is not operational Mars data. MCD parser and Mars-season tests use small synthetic response strings and fixed dates, not downloaded production data. | Generated by `make_gazetteer_archive()` in [`test_app.py`](mars-map-app/test_app.py); model fixtures are in [`test_survival_guide.py`](mars-map-app/test_survival_guide.py). No downloaded production dataset or external image is required by these tests. |
| User-recorded traverse paths | Completed walks are saved in the user's browser local storage and used for nearby route recommendations. The project does not bundle historical astronaut or rover walk tracks. | Browser-local data handled in [`main.js`](mars-map-app/static/main.js), as described in [`README.md`](README.md). |

### External image and texture assets

These are remote assets referenced by the project; image files are not included in the repository.

| Use | Referenced asset |
|---|---|
| Jezero Crater: Margin Unit | [NASA image PIA26067](https://mars.nasa.gov/system/resources/detail_files/27762_PIA26067-web.jpg) |
| Jezero Crater: Neretva Vallis Inlet Channel | [JPL Photojournal PIA23969 image](https://photojournal.jpl.nasa.gov/jpegMod/PIA23969_modest.jpg) |
| Nili Fossae Regional Trough | [JPL Photojournal PIA11431 image](https://photojournal.jpl.nasa.gov/jpegMod/PIA11431_modest.jpg) |
| Gale Crater: Mount Sharp Boxwork Ridges | [NASA image PIA25626](https://mars.nasa.gov/system/resources/detail_files/27190_PIA25626-web.jpg) |
| Valles Marineris: Coprates Chasma | [JPL Photojournal PIA19916 image](https://photojournal.jpl.nasa.gov/jpegMod/PIA19916_modest.jpg) |
| 3D Mars globe texture | [Mars texture hosted on Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg). The code does not record the original creator or license; identify and cite the source file's Commons description page and confirm its terms before publishing. |

## Code and project files

Project-authored or project-maintained files found in the repository:

| File | Contents |
|---|---|
| [`mars-map-app/app.py`](mars-map-app/app.py) | FastAPI service, Gazetteer download/cache/parser, curated backend records, and `/api/locations` endpoint. |
| [`mars-map-app/survival_guide.py`](mars-map-app/survival_guide.py) | MCD request and response parsing, Mars season/local-time calculation, modeled site conditions, and Survival Guide reference cards. |
| [`mars-map-app/static/index.html`](mars-map-app/static/index.html) | Application page and interface markup/styles; includes external library and font references. |
| [`mars-map-app/static/main.js`](mars-map-app/static/main.js) | 2D/3D map behavior, fallback location records, location display, local traverse storage/planning, and selected-location events for the Survival Guide. |
| [`mars-map-app/static/survival-assets/survivalGuide.css`](mars-map-app/static/survival-assets/survivalGuide.css), [`mars-map-app/static/survival-assets/survivalGuide.js`](mars-map-app/static/survival-assets/survivalGuide.js), and [`mars-map-app/static/survival-assets/vitals.js`](mars-map-app/static/survival-assets/vitals.js) | Shared Survival Guide styles, reference-card rendering, and coordinate-specific climate-model rendering. The map app serves these under `/static/survival-assets/`; the standalone backend also exposes `/survival-assets/`. |
| [`mars-map-app/test_app.py`](mars-map-app/test_app.py) and [`mars-map-app/test_survival_guide.py`](mars-map-app/test_survival_guide.py) | Python unit tests for the Gazetteer/API and the climate-model parser and date calculations. |
| [`mars-map-app/requirements.txt`](mars-map-app/requirements.txt) | Python dependency pins. |
| [`index.py`](index.py) and [`vercel.json`](vercel.json) | Vercel FastAPI entry point and function timeout configuration. |
| [`requirements.txt`](requirements.txt) | Root Python dependencies used by Vercel, including `pyshp` for Gazetteer parsing. |
| [`start-mars-map.ps1`](start-mars-map.ps1) and [`start-mars-map.bat`](start-mars-map.bat) | Windows application launch scripts. |
| [`.vscode/launch.json`](.vscode/launch.json) | VS Code browser-launch configuration for `http://127.0.0.1:8000`; start the FastAPI server first. Do not open the HTML as a `file:///` URL because its server assets and API routes will not load. |
| [`README.md`](README.md) | Setup, use, data-cache, and route-planning documentation. |
| [`RESOURCE_INVENTORY.md`](RESOURCE_INVENTORY.md) | Data, third-party resource, software, and attribution inventory with remaining verification items. |
| [`LICENSE`](LICENSE) | Repository MIT License notice. |

No separate local image files or copied third-party application source files were found in the project tree. Third-party JavaScript and CSS are loaded from CDNs at runtime.

## Software libraries, services, and tools

### Runtime libraries and hosted assets

| Tool / library | Version or reference | Project use |
|---|---|---|
| Python | Python 3 (the repository does not pin an exact interpreter version; Vercel chooses a supported runtime unless configured in project settings) | Backend and tests. |
| FastAPI | `0.162.7` | HTTP API and static page service. |
| Uvicorn | `0.54.0` | Local ASGI server. |
| Pydantic | `2.14.3` | Declared Python dependency. |
| pyshp | `3.1.8` | Reading the Gazetteer's shapefile data. |
| Python standard library | `io`, `logging`, `os`, `re`, `tempfile`, `time`, `urllib`, `zipfile`, `pathlib`, `threading`, and `unittest` | HTTP download/cache handling, parsing support, synchronization, filesystem work, and tests. |
| Three.js | `r128` | 3D Mars globe; [cdnjs script](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js). |
| OrbitControls | Three.js examples `0.128.0` | 3D globe interaction; [jsDelivr script](https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js). |
| Leaflet | `1.9.4` | 2D map, markers, and paths; [unpkg CSS](https://unpkg.com/leaflet@1.9.4/dist/leaflet.css) and [JavaScript](https://unpkg.com/leaflet@1.9.4/dist/leaflet.js). |
| Tailwind CSS | CDN build; no version is pinned in the HTML | Interface styling utilities; [CDN script](https://cdn.tailwindcss.com). |
| Inter font | Google Fonts stylesheet | Interface typography; [Inter stylesheet](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap). |
| NASA Mars Trek WMTS | Online service | 2D map tile imagery. |
| Mars Climate Database v6.2 | Online scientific climatology service | Coordinate-specific modeled surface and atmospheric values for the Survival Guide; not a live sensor feed or safety assessment. |
| NASA/JPL and Wikimedia-hosted image URLs | Listed above | Location imagery and 3D globe texture. |

CDN-loaded dependencies are not vendored, and the HTML does not include integrity hashes. Their availability and delivered versions can depend on the external services (particularly the unpinned Tailwind CDN build).

### Development and execution tools

- Git and GitHub are referenced in the project workflow documentation for source control and collaboration.
- `pip` installs the Python dependencies; Python's `unittest` runner executes the tests.
- Windows PowerShell and Windows batch (`.bat`) are used by the provided launcher scripts.
- A web browser displays the frontend; the VS Code launch configuration opens the local HTTP app after its FastAPI server has been started.
- The app uses browser `localStorage` for traverse history and `fetch` for its local API. These are platform APIs, not additional downloaded project packages.
- Internet access is needed for the full Gazetteer refresh, MCD requests, NASA map tiles, external images, and CDN-hosted libraries/fonts. The app can fall back to bundled curated records if the Gazetteer is unavailable; the Survival Guide reports unavailable MCD data rather than fabricating model values.

## Verification items before submission

1. Add primary sources for every curated scientific statement and location coordinate whose record currently has no `source_url`; distinguish authoritative source data from editorial summaries.
2. Record the original creator, source-page link, license/credit wording, and access date for each image, texture, map layer, dataset, and external library as required by its provider.
3. Confirm whether the current terms permit the intended presentation and redistribution. Do not treat “NASA,” “JPL,” “open source,” or “available online” as a blanket license for every item.
4. Add any tools, code, data, tests, or other materials used by team members that are not represented in this repository inventory.
















































                            +                                           +                                                                                                                               