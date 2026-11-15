// Fallback dataset in case index.html is opened directly without running app.py
const FALLBACK_LOCATIONS = [
  {
    id: "jezero-margin-unit",
    name: "Jezero Crater: Margin Unit",
    mission: "Mars 2020 Perseverance",
    lat: 18.4447,
    lon: 77.4508,
    elev: -2485,
    water_summary:
      "3-Episode Water System: (1) CO2-rich groundwater altered igneous olivine into carbonate ridges; (2) Ancient lake shoreline deposited silica below water level; (3) Late-stage hydrothermal fluid alteration.",
    minerals: ["Igneous Olivine", "Carbonate Ridges", "Hydrothermal Silica"],
    image_2d: "https://mars.nasa.gov/system/resources/detail_files/27762_PIA26067-web.jpg"
  },
  {
    id: "jezero-neretva-vallis",
    name: "Jezero Crater: Neretva Vallis Inlet Channel",
    mission: "Mars 2020 Perseverance / MRO HiRISE",
    lat: 18.521,
    lon: 77.365,
    elev: -2310,
    water_summary:
      "Ancient river channel that breached the western rim of Jezero Crater, carrying clay and carbonate sediments into the crater lake.",
    minerals: ["Smectite Clays", "Carbonates", "Hydrated Silica"],
    image_2d: "https://photojournal.jpl.nasa.gov/jpegMod/PIA23969_modest.jpg"
  },
  {
    id: "nili-fossae",
    name: "Nili Fossae Regional Trough",
    mission: "MRO CRISM / Mars Express",
    lat: 21.5,
    lon: 74.2,
    elev: -650,
    water_summary:
      "Largest exposed carbonate-olivine bedrock unit on Mars, preserving Noachian-era subsurface groundwater pathways.",
    minerals: ["Magnesium Carbonate", "Olivine", "Phyllosilicates"],
    image_2d: "https://photojournal.jpl.nasa.gov/jpegMod/PIA11431_modest.jpg"
  },
  {
    id: "gale-mount-sharp",
    name: "Gale Crater: Mount Sharp Boxwork Ridges",
    mission: "Curiosity Rover (MSL)",
    lat: -5.08,
    lon: 137.85,
    elev: -4120,
    water_summary:
      "Groundwater flowed through bedrock fractures, depositing minerals that hardened into boxwork ridges as surrounding rock eroded.",
    minerals: ["Sulfate Salts", "Clay Minerals", "Hematite"],
    image_2d: "https://mars.nasa.gov/system/resources/detail_files/27190_PIA25626-web.jpg"
  },
  {
    id: "valles-marineris",
    name: "Valles Marineris: Coprates Chasma",
    mission: "MRO HiRISE",
    lat: -13.9,
    lon: -60.5,
    elev: -4800,
    water_summary:
      "Deep canyon system exposing ancient layered crust and hydrated sulfate deposits from massive subsurface flood releases.",
    minerals: ["Hydrated Sulfates", "Basaltic Breccia"],
    image_2d: "https://photojournal.jpl.nasa.gov/jpegMod/PIA19916_modest.jpg"
  }
];

let marsLocations = [];
const MARS_RADIUS = 3.3895; // 3,389.5 km scaled
let targetCamPos = null;
let cameraTargetCallback = null;
let currentMarsPosition = null;
const markerMeshes = [];
const locationMarkers = {};
let activeTransientMarkerId = null;
let selectedLocationId = null;
let missionHighlights = [];

// ==========================================
// 1. INITIALIZE 2D LEAFLET MAP (NASA WMTS)
// ==========================================
const map2D = L.map("leaflet-2d-map", {
  crs: L.CRS.EPSG4326,
  center: [18.4447, 77.4508],
  zoom: 5,
  minZoom: 1,
  maxZoom: 8
});

let currentWMTSLayer = null;
function setWMTSLayer(layerName) {
  if (currentWMTSLayer) {
    map2D.removeLayer(currentWMTSLayer);
  }
  const tileUrl = `https://trek.nasa.gov/tiles/Mars/EQ/${layerName}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`;
  currentWMTSLayer = L.tileLayer(tileUrl, {
    attribution: "NASA Mars Trek WMTS",
    tileSize: 256,
    noWrap: true
  }).addTo(map2D);
}

setWMTSLayer("Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw");

document.getElementById("wmts-layer-select").addEventListener("change", (e) => {
  setWMTSLayer(e.target.value);
});

// Simple 2D Path Plotter (Base feature)
let drawingRoute = false;
let routePoints = [];
const routePolyline = L.polyline([], { color: "#b19b78", weight: 2, dashArray: "5, 6" }).addTo(map2D);
const recommendedRoutePolyline = L.polyline([], {
  color: "#bd7452",
  weight: 3,
  dashArray: "8, 5"
}).addTo(map2D);

const btnDrawRoute = document.getElementById("btn-draw-route");
const btnClearRoute = document.getElementById("btn-clear-route");
const btnSaveTraverse = document.getElementById("btn-save-traverse");
const traverseCompletedCheckbox = document.getElementById("traverse-completed");
const routePlanStatus = document.getElementById("route-plan-status");
const TRAVERSE_STORAGE_KEY = "martian-nav-completed-traverses-v1";
const MAX_SAVED_TRAVERSES = 50;
const MAX_TRAVERSE_POINTS = 500;
const ROUTE_SNAP_LIMIT_KM = 25;
let savedTraverses = [];
let routeStorageWarning = "";

function isValidTraverse(traverse) {
  return (
    traverse &&
    typeof traverse.id === "string" &&
    typeof traverse.name === "string" &&
    traverse.name.trim().length > 0 &&
    traverse.completed === true &&
    Array.isArray(traverse.points) &&
    traverse.points.length >= 2 &&
    traverse.points.length <= MAX_TRAVERSE_POINTS &&
    traverse.points.every(
      (point) =>
        point &&
        Number.isFinite(point.lat) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        Number.isFinite(point.lon) &&
        point.lon >= -180 &&
        point.lon <= 180
    )
  );
}

function loadSavedTraverses() {
  try {
    const stored = localStorage.getItem(TRAVERSE_STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      throw new Error("Saved traverse data must be a list.");
    }

    savedTraverses = parsed.filter(isValidTraverse);
    if (savedTraverses.length !== parsed.length) {
      routeStorageWarning = "Some invalid saved traverses were ignored.";
    }
  } catch (error) {
    console.error("Unable to load saved Mars traverses.", error);
    routeStorageWarning = "Saved traverse history could not be read from this browser.";
  }
}

function renderSavedTraverses() {
  const list = document.getElementById("saved-traverse-list");
  list.replaceChildren();
  if (savedTraverses.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "text-[10px] text-zinc-500";
    emptyState.textContent = "No completed walks saved in this browser.";
    list.appendChild(emptyState);
    return;
  }

  savedTraverses.forEach((traverse) => {
    const item = document.createElement("div");
    item.className = "text-[10px] text-zinc-300";
    const distance = traverse.points.slice(1).reduce(
      (sum, point, index) => sum + marsDistanceKm(traverse.points[index], point),
      0
    );
    item.textContent = `${traverse.name} · ${distance.toFixed(1)} km`;
    list.appendChild(item);
  });
}

function updateTraverseSaveButton() {
  btnSaveTraverse.disabled =
    routePoints.length < 2 || !traverseCompletedCheckbox.checked;
}

function saveCompletedTraverse() {
  const name = document.getElementById("traverse-name").value.trim();
  if (routePoints.length < 2) {
    routePlanStatus.textContent = "Plot at least two points before saving a completed walk.";
    return;
  }
  if (!traverseCompletedCheckbox.checked) {
    routePlanStatus.textContent = "Confirm that this plotted traverse was completed before saving.";
    return;
  }
  if (!name) {
    routePlanStatus.textContent = "Enter a name for this completed walk.";
    return;
  }
  if (savedTraverses.length >= MAX_SAVED_TRAVERSES) {
    routePlanStatus.textContent = `This browser has reached the ${MAX_SAVED_TRAVERSES}-walk storage limit.`;
    return;
  }
  if (routePoints.length > MAX_TRAVERSE_POINTS) {
    routePlanStatus.textContent = `A saved walk can contain at most ${MAX_TRAVERSE_POINTS} points.`;
    return;
  }

  const traverse = {
    id: `${Date.now()}-${savedTraverses.length}`,
    name,
    completed: true,
    points: routePoints.map(([lat, lon]) => ({ lat, lon }))
  };
  const updatedTraverses = [...savedTraverses, traverse];
  try {
    localStorage.setItem(TRAVERSE_STORAGE_KEY, JSON.stringify(updatedTraverses));
  } catch (error) {
    console.error("Unable to save completed Mars traverse.", error);
    routePlanStatus.textContent = "This browser could not save the traverse. Check local storage availability.";
    return;
  }

  savedTraverses = updatedTraverses;
  renderSavedTraverses();
  routePlanStatus.textContent = `Saved "${name}" as a completed walk on this device.`;
  document.getElementById("traverse-name").value = "";
  traverseCompletedCheckbox.checked = false;
  routePoints = [];
  routePolyline.setLatLngs([]);
  btnClearRoute.classList.add("hidden");
  drawingRoute = false;
  btnDrawRoute.textContent = "Plot Traverse: OFF";
  updateTraverseSaveButton();
}

loadSavedTraverses();
renderSavedTraverses();
if (routeStorageWarning) routePlanStatus.textContent = routeStorageWarning;

btnDrawRoute.addEventListener("click", () => {
  drawingRoute = !drawingRoute;
  if (drawingRoute) {
    routePoints = currentMarsPosition
      ? [[currentMarsPosition.lat, currentMarsPosition.lon]]
      : [];
    routePolyline.setLatLngs(routePoints);
    btnClearRoute.classList.toggle("hidden", routePoints.length === 0);
    updateTraverseSaveButton();
  }
  btnDrawRoute.textContent = `Plot Traverse: ${drawingRoute ? "ON (Click Map)" : "OFF"}`;
});

btnClearRoute.addEventListener("click", () => {
  routePoints = [];
  routePolyline.setLatLngs([]);
  btnClearRoute.classList.add("hidden");
  recommendedRoutePolyline.setLatLngs([]);
  updateTraverseSaveButton();
});

btnSaveTraverse.addEventListener("click", saveCompletedTraverse);
traverseCompletedCheckbox.addEventListener("change", updateTraverseSaveButton);

map2D.on("click", (e) => {
  if (!drawingRoute) return;
  if (routePoints.length >= MAX_TRAVERSE_POINTS) {
    routePlanStatus.textContent = `A traverse can contain at most ${MAX_TRAVERSE_POINTS} points.`;
    return;
  }
  routePoints.push([e.latlng.lat, e.latlng.lng]);
  routePolyline.setLatLngs(routePoints);
  btnClearRoute.classList.remove("hidden");
  updateTraverseSaveButton();
});

map2D.on("mousemove", (e) => {
  updateHUD(e.latlng.lat, e.latlng.lng, null);
});

// ==========================================
// 2. INITIALIZE 3D MARS GLOBE (THREE.JS)
// ==========================================
const container3D = document.getElementById("three-canvas-container");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  container3D.clientWidth / container3D.clientHeight,
  0.1,
  1000
);
camera.position.set(0, 1.8, 9.0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(container3D.clientWidth, container3D.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container3D.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4.1;
controls.maxDistance = 20.0;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;

const scaleLabel = document.getElementById("hud-scale-val");
const scaleBar = document.getElementById("hud-scale-bar");
let currentScaleKm = null;
let currentScaleWidth = 0;

// Cancel fly-to animation immediately if user interacts manually
renderer.domElement.addEventListener("pointerdown", () => {
  targetCamPos = null;
  cameraTargetCallback = null;
});
renderer.domElement.addEventListener("wheel", () => {
  targetCamPos = null;
  cameraTargetCallback = null;
});

// Scene Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const dirLight = new THREE.DirectionalLight(0xfff3e0, 1.1);
dirLight.position.set(12, 8, 10);
scene.add(dirLight);

// Mars Sphere Mesh with NASA Color + Bump Relief
const globeGroup = new THREE.Group();
scene.add(globeGroup);

const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin("anonymous");

const marsMaterial = new THREE.MeshStandardMaterial({
  color: 0xa65337, // Warm Martian fallback tint before texture loads
  roughness: 0.85,
  metalness: 0.05
});

texLoader.load(
  "https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg",
  (texture) => {
    marsMaterial.color.setHex(0xffffff);
    marsMaterial.map = texture;
    marsMaterial.bumpMap = texture;
    marsMaterial.bumpScale = 0.06;
    marsMaterial.needsUpdate = true;
  }
);

const marsMesh = new THREE.Mesh(
  new THREE.SphereGeometry(MARS_RADIUS, 128, 128),
  marsMaterial
);
globeGroup.add(marsMesh);

// Current Mars position marker
const currentPositionPin = new THREE.Mesh(
  new THREE.SphereGeometry(0.095, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xbd7452 })
);
currentPositionPin.visible = false;
globeGroup.add(currentPositionPin);
let currentPositionMarker2D = null;

// Convert (Lat, Lon) -> 3D Vector3
function latLonToVec3(lat, lon, radius = MARS_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Raycaster for 3D Mouse Hover & Pin Clicks
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("mousemove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(marsMesh);
  if (hits.length > 0) {
    const pt = hits[0].point.clone().normalize();
    const lat = 90 - (Math.acos(pt.y) * 180) / Math.PI;
    let lon = (Math.atan2(pt.z, -pt.x) * 180) / Math.PI - 180;
    if (lon < -180) lon += 360;
    const estElev = Math.round(Math.sin(lat * 0.1) * Math.cos(lon * 0.1) * 3000 - 1400);
    updateHUD(lat, lon, estElev);
  }
});

renderer.domElement.addEventListener("click", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const pinHits = raycaster.intersectObjects(markerMeshes);
  if (pinHits.length > 0) {
    selectLocation(pinHits[0].object.userData);
  }
});

// ==========================================
// 3. FETCH & RENDER NASA DATASET LOCATIONS
// ==========================================
const locationsApiUrl =
  window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/api/locations"
    : "/api/locations";

async function loadLocations() {
  let loadMessage = "";
  try {
    const res = await fetch(locationsApiUrl);
    if (!res.ok) throw new Error(`Location API returned HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.locations)) {
      throw new Error("Location API response must contain a locations array");
    }

    const ids = new Set();
    marsLocations = data.locations.map((loc, index) => {
      if (
        !loc ||
        typeof loc.id !== "string" ||
        typeof loc.name !== "string" ||
        !Number.isFinite(loc.lat) ||
        loc.lat < -90 ||
        loc.lat > 90 ||
        !Number.isFinite(loc.lon) ||
        loc.lon < -180 ||
        loc.lon > 180 ||
        (loc.elev != null && !Number.isFinite(loc.elev)) ||
        !Array.isArray(loc.minerals) ||
        !loc.minerals.every((mineral) => typeof mineral === "string") ||
        (loc.featured !== undefined && typeof loc.featured !== "boolean") ||
        (loc.diameter_km != null && !Number.isFinite(loc.diameter_km))
      ) {
        throw new Error(`Location API returned an invalid location at index ${index}`);
      }

      const optionalTextFields = [
        "mission",
        "water_summary",
        "image_2d",
        "feature_type",
        "origin",
        "approval_date",
        "approval_status",
        "quadrangle",
        "source_url",
        "featured_category"
      ];
      if (optionalTextFields.some((field) => loc[field] != null && typeof loc[field] !== "string")) {
        throw new Error(`Location API returned invalid text metadata at index ${index}`);
      }
      if (ids.has(loc.id)) throw new Error(`Location API returned duplicate ID "${loc.id}"`);
      ids.add(loc.id);
      return loc;
    });

    if (data.warning != null && typeof data.warning !== "string") {
      throw new Error("Location API warning must be a string");
    }
    if (
      data.mission_highlights != null &&
      (!Array.isArray(data.mission_highlights) ||
        data.mission_highlights.some(
          (highlight) =>
            !highlight ||
            typeof highlight.name !== "string" ||
            typeof highlight.summary !== "string" ||
            (highlight.location_id != null && typeof highlight.location_id !== "string")
        ))
    ) {
      throw new Error("Location API returned invalid mission highlights");
    }
    missionHighlights = data.mission_highlights || [];
    if (data.warning) loadMessage = data.warning;
  } catch (error) {
    console.error(`Unable to load locations from ${locationsApiUrl}.`, error);
    marsLocations = FALLBACK_LOCATIONS.map((loc) => ({ ...loc, featured: true }));
    missionHighlights = [];
    const reason = error instanceof Error ? error.message : String(error);
    loadMessage = `Location API unavailable (${reason}); showing ${marsLocations.length} bundled locations.`;
  }

  document.getElementById("location-search").addEventListener("input", () => {
    renderLocationList(loadMessage);
  });
  renderLocationList(loadMessage);
  renderMissionHighlights();
  renderRouteDestinations();
  if (routeStorageWarning) {
    routePlanStatus.textContent = routeStorageWarning;
  } else if (savedTraverses.length === 0) {
    routePlanStatus.textContent =
      "Set a Mars position and save a completed traverse to enable route recommendations.";
  } else {
    routePlanStatus.textContent = `${savedTraverses.length} completed walk(s) available on this device.`;
  }

  marsLocations
    .filter((loc) => loc.featured)
    .slice(0, 20)
    .forEach((loc) => addLocationMarker(loc, true));

  const initialLocation =
    marsLocations.find((loc) => loc.id === "jezero-margin-unit") ||
    marsLocations.find((loc) => loc.featured) ||
    marsLocations[0];
  if (initialLocation && !currentMarsPosition) {
    selectLocation(initialLocation, false);
  }
}

function renderLocationList(message = "") {
  const listEl = document.getElementById("location-list");
  const countEl = document.getElementById("location-count");
  const query = document.getElementById("location-search").value.trim().toLocaleLowerCase();
  const matches = marsLocations.filter((loc) => {
    const fields = [
      loc.name,
      loc.mission,
      loc.feature_type,
      loc.origin,
      loc.approval_status,
      loc.approval_date,
      loc.quadrangle,
      loc.featured_category
    ];
    return !query || fields.some((value) => value && value.toLocaleLowerCase().includes(query));
  });

  listEl.replaceChildren();
  countEl.textContent = `${matches.length.toLocaleString()} of ${marsLocations.length.toLocaleString()} locations${
    message ? ` — ${message}` : ""
  }`;

  if (matches.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "px-2 py-1 text-[10px] text-zinc-400";
    emptyState.textContent = "No matching locations.";
    listEl.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  matches.forEach((loc) => {
    const btn = document.createElement("button");
    btn.className = `w-full text-left p-2 rounded bg-zinc-900 hover:bg-zinc-800 border ${
      selectedLocationId === loc.id ? "border-orange-400" : "border-zinc-800"
    } hover:border-orange-500/50 transition`;
    btn.dataset.locationId = loc.id;
    btn.setAttribute("aria-pressed", selectedLocationId === loc.id ? "true" : "false");
    const name = document.createElement("div");
    name.className = "font-semibold text-zinc-200 truncate";
    name.textContent = loc.name;
    const coordinates = document.createElement("div");
    coordinates.className = "text-[10px] text-zinc-400";
    coordinates.textContent = `${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°`;
    const metadata = document.createElement("div");
    metadata.className = "text-[10px] text-zinc-500 truncate";
    metadata.textContent = loc.featured
      ? loc.featured_category || "Featured location"
      : loc.feature_type || "Mars feature";
    btn.append(name, coordinates, metadata);
    btn.addEventListener("click", () => selectLocation(loc));
    fragment.appendChild(btn);
  });
  listEl.appendChild(fragment);
}

function renderMissionHighlights() {
  const listEl = document.getElementById("mission-highlight-list");
  listEl.replaceChildren();
  missionHighlights.forEach((highlight) => {
    const location = marsLocations.find((loc) => loc.id === highlight.location_id);
    const item = location
      ? document.createElement("button")
      : document.createElement("div");
    item.className = location
      ? "w-full text-left p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
      : "p-2 rounded bg-zinc-900 border border-zinc-800";
    const name = document.createElement("div");
    name.className = "font-semibold text-zinc-200";
    name.textContent = highlight.name;
    const summary = document.createElement("div");
    summary.className = "text-[10px] text-zinc-400";
    summary.textContent = highlight.summary;
    item.append(name, summary);
    if (location) item.addEventListener("click", () => selectLocation(location));
    listEl.appendChild(item);
  });
}

function addLocationMarker(loc, featured = false) {
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(featured ? 0.075 : 0.095, 16, 16),
    new THREE.MeshBasicMaterial({ color: featured ? 0xb19b78 : 0xe0d4bc })
  );
  pin.position.copy(latLonToVec3(loc.lat, loc.lon, MARS_RADIUS + 0.04));
  pin.userData = loc;
  globeGroup.add(pin);
  markerMeshes.push(pin);

  const popupContent = document.createElement("div");
  const popupName = document.createElement("strong");
  popupName.textContent = loc.name;
  const popupMetadata = document.createElement("div");
  popupMetadata.textContent = loc.mission || loc.feature_type || "Mars feature";
  popupContent.append(popupName, popupMetadata);

  const marker2d = L.circleMarker([loc.lat, loc.lon], {
    radius: featured ? 5 : 8,
    color: featured ? "#b19b78" : "#e0d4bc",
    fillColor: featured ? "#b19b78" : "#e0d4bc",
    fillOpacity: 0.85
  })
    .addTo(map2D)
    .bindPopup(popupContent);
  marker2d.on("click", () => selectLocation(loc));
  locationMarkers[loc.id] = { pin, marker2d };
}

function removeTransientMarker() {
  if (!activeTransientMarkerId) return;
  const marker = locationMarkers[activeTransientMarkerId];
  if (marker) {
    map2D.removeLayer(marker.marker2d);
    globeGroup.remove(marker.pin);
    marker.pin.geometry.dispose();
    marker.pin.material.dispose();
    const markerIndex = markerMeshes.indexOf(marker.pin);
    if (markerIndex !== -1) markerMeshes.splice(markerIndex, 1);
    delete locationMarkers[activeTransientMarkerId];
  }
  activeTransientMarkerId = null;
}

function updateSurvivalGuideLocation(location) {
  window.dispatchEvent(
    new CustomEvent("mars-location-selected", {
      detail: {
        lat: location.lat,
        lon: location.lon,
        name: location.name,
        waterSummary: location.water_summary || "",
        minerals: location.minerals || []
      }
    })
  );
}

function selectLocation(loc, fly3D = true) {
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return;
  if (activeTransientMarkerId !== loc.id) removeTransientMarker();
  if (!locationMarkers[loc.id]) {
    addLocationMarker(loc);
    activeTransientMarkerId = loc.id;
  }

  selectedLocationId = loc.id;
  updateSurvivalGuideLocation(loc);
  document.querySelectorAll("#location-list button[data-location-id]").forEach((button) => {
    const selected = button.dataset.locationId === loc.id;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.classList.toggle("border-orange-400", selected);
    button.classList.toggle("border-zinc-800", !selected);
  });
  markerMeshes.forEach((pin) => {
    pin.material.color.setHex(pin.userData.id === loc.id ? 0xe0d4bc : 0xb19b78);
  });

  if (fly3D) {
    cameraTargetCallback = null;
    controls.autoRotate = false;
    document.getElementById("btn-auto-rotate").textContent = "Globe Rotation: OFF";
    targetCamPos = latLonToVec3(loc.lat, loc.lon, 5.5);
  }

  if (!currentMarsPosition || fly3D) {
    updateHUD(loc.lat, loc.lon, loc.elev);
    document.getElementById("hud-elev").textContent =
      Number.isFinite(loc.elev) ? `${loc.elev} m` : "N/A";
  }

  if (!currentMarsPosition || fly3D) {
    document.getElementById("loc-title").textContent = loc.name;
  }
  const waterCard = document.getElementById("loc-water-card");
  waterCard.classList.toggle("hidden", !loc.water_summary);
  document.getElementById("loc-water").textContent = loc.water_summary || "";

  const minContainer = document.getElementById("loc-minerals");
  document.getElementById("loc-minerals-card").classList.toggle(
    "hidden",
    loc.minerals.length === 0
  );
  minContainer.replaceChildren(
    ...loc.minerals.map((mineral) => {
      const mineralTag = document.createElement("span");
      mineralTag.className =
        "px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-orange-300";
      mineralTag.textContent = mineral;
      return mineralTag;
    })
  );

  const detailFields = [
    ["Feature type", loc.feature_type],
    ["Diameter", Number.isFinite(loc.diameter_km) ? `${loc.diameter_km.toFixed(2)} km` : null],
    ["Approval", loc.approval_status],
    ["Approved", loc.approval_date],
    ["Quadrangle", loc.quadrangle],
    ["Named for", loc.origin]
  ];
  const detailContainer = document.getElementById("loc-gazetteer-details");
  detailContainer.replaceChildren(
    ...detailFields.filter(([, value]) => value).map(([label, value]) => {
      const row = document.createElement("div");
      const fieldLabel = document.createElement("span");
      fieldLabel.className = "text-zinc-500";
      fieldLabel.textContent = `${label}: `;
      const fieldValue = document.createElement("span");
      fieldValue.textContent = value;
      row.append(fieldLabel, fieldValue);
      return row;
    })
  );
  const sourceLink = document.getElementById("loc-source-link");
  sourceLink.classList.toggle("hidden", !loc.source_url);
  sourceLink.href = loc.source_url || "#";
  document.getElementById("loc-gazetteer-card").classList.toggle(
    "hidden",
    detailContainer.childElementCount === 0 && !loc.source_url
  );

  if (!currentMarsPosition || fly3D) {
    map2D.flyTo([loc.lat, loc.lon], 6, { duration: 1.0 });
    locationMarkers[loc.id].marker2d.openPopup();
  }
}

function updateHUD(lat, lon, elev) {
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
  document.getElementById("hud-lat").textContent = latStr;
  document.getElementById("hud-lon").textContent = lonStr;
  if (elev !== null) {
    document.getElementById("hud-elev").textContent = `${elev} m`;
  }
}

function formatMarsCoordinate(value, axis) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? (axis === "lat" ? "N" : "E") : axis === "lat" ? "S" : "W"}`;
}

function setManualMarsPosition() {
  const latInput = document.getElementById("position-lat");
  const lonInput = document.getElementById("position-lon");
  const badge = document.getElementById("position-badge");
  const inputs = [latInput, lonInput];
  const rawValues = inputs.map((input) => input.value.trim());
  const lat = Number(rawValues[0]);
  const lon = Number(rawValues[1]);
  const valid =
    rawValues.every((value) => value !== "") &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180;

  inputs.forEach((input) => input.setAttribute("aria-invalid", valid ? "false" : "true"));
  if (!valid) {
    badge.textContent = "Enter a valid Mars latitude (-90 to 90) and longitude (-180 to 180).";
    return;
  }

  currentMarsPosition = { lat, lon };
  updateSurvivalGuideLocation({
    lat,
    lon,
    name: "Manual Mars coordinates",
    water_summary: "",
    minerals: []
  });
  currentPositionPin.position.copy(latLonToVec3(lat, lon, MARS_RADIUS + 0.05));
  currentPositionPin.visible = true;

  const positionPopup = document.createElement("span");
  positionPopup.textContent = `Manually set astronaut position: ${formatMarsCoordinate(lat, "lat")}, ${formatMarsCoordinate(lon, "lon")}`;
  if (!currentPositionMarker2D) {
    currentPositionMarker2D = L.circleMarker([lat, lon], {
      radius: 8,
      color: "#e0d4bc",
      weight: 2,
      fillColor: "#bd7452",
      fillOpacity: 1
    }).addTo(map2D);
  } else {
    currentPositionMarker2D.setLatLng([lat, lon]);
  }
  currentPositionMarker2D.bindPopup(positionPopup);

  badge.textContent = `Manual Mars position: ${formatMarsCoordinate(lat, "lat")}, ${formatMarsCoordinate(lon, "lon")}`;
  document.getElementById("loc-title").textContent = "Manual Set Pos";
  document.getElementById("loc-water-card").classList.add("hidden");
  document.getElementById("loc-minerals-card").classList.add("hidden");
  document.getElementById("loc-gazetteer-card").classList.add("hidden");
  controls.autoRotate = false;
  document.getElementById("btn-auto-rotate").textContent = "Globe Rotation: OFF";
  targetCamPos = latLonToVec3(lat, lon, 5.0);
  cameraTargetCallback = () => {
    const pane = document.getElementById("pane-2d");
    if (pane.classList.contains("hidden")) {
      pane.classList.remove("hidden");
      pane2DVisible = true;
      updateLeftColumnLayout();
    }
    map2D.invalidateSize();
    map2D.flyTo([lat, lon], 6, { duration: 1.0 });
    currentPositionMarker2D.openPopup();
  };

  updateHUD(lat, lon, null);
  document.getElementById("hud-elev").textContent = "N/A";
}

document.getElementById("btn-locate-coordinates").addEventListener("click", setManualMarsPosition);

function marsDistanceKm(first, second) {
  const firstLat = Array.isArray(first) ? first[0] : first.lat;
  const firstLon = Array.isArray(first) ? first[1] : first.lon;
  const secondLat = Array.isArray(second) ? second[0] : second.lat;
  const secondLon = Array.isArray(second) ? second[1] : second.lon;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(secondLat - firstLat);
  const lonDelta = toRadians(secondLon - firstLon);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(firstLat)) *
      Math.cos(toRadians(secondLat)) *
      Math.sin(lonDelta / 2) ** 2;
  return 2 * MARS_RADIUS * 1000 * Math.asin(Math.sqrt(haversine));
}

function renderRouteDestinations() {
  const select = document.getElementById("route-destination");
  select.replaceChildren();
  const destinations = marsLocations.filter((location) => location.featured);
  if (destinations.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No known locations available";
    option.value = "";
    select.appendChild(option);
    return;
  }

  destinations.forEach((location) => {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = location.name;
    select.appendChild(option);
  });
}

function findRouteRecommendation(start, destination) {
  let bestRoute = null;
  savedTraverses.forEach((traverse) => {
    const points = traverse.points;
    let nearestStart = { index: -1, distance: Infinity };
    let nearestDestination = { index: -1, distance: Infinity };
    points.forEach((point, index) => {
      const startDistance = marsDistanceKm(start, point);
      if (startDistance < nearestStart.distance) {
        nearestStart = { index, distance: startDistance };
      }
      const destinationDistance = marsDistanceKm(destination, point);
      if (destinationDistance < nearestDestination.distance) {
        nearestDestination = { index, distance: destinationDistance };
      }
    });

    if (
      nearestStart.distance > ROUTE_SNAP_LIMIT_KM ||
      nearestDestination.distance > ROUTE_SNAP_LIMIT_KM
    ) {
      return;
    }

    const routeSection =
      nearestStart.index <= nearestDestination.index
        ? points.slice(nearestStart.index, nearestDestination.index + 1)
        : points
            .slice(nearestDestination.index, nearestStart.index + 1)
            .reverse();
    const routePoints = [
      start,
      ...routeSection,
      destination
    ];
    const distance = routePoints.slice(1).reduce(
      (sum, point, index) => sum + marsDistanceKm(routePoints[index], point),
      0
    );
    if (!bestRoute || distance < bestRoute.distance) {
      bestRoute = {
        traverse,
        points: routePoints.map((point) => [point.lat, point.lon]),
        distance,
        startConnectorKm: nearestStart.distance,
        destinationConnectorKm: nearestDestination.distance
      };
    }
  });
  return bestRoute;
}

function planLocalRoute() {
  recommendedRoutePolyline.setLatLngs([]);
  if (!currentMarsPosition) {
    routePlanStatus.textContent = "Set the astronaut's Mars coordinates before planning a route.";
    return;
  }
  const destination = marsLocations.find(
    (location) => location.id === document.getElementById("route-destination").value
  );
  if (!destination) {
    routePlanStatus.textContent = "Choose a known Mars destination.";
    return;
  }
  if (savedTraverses.length === 0) {
    routePlanStatus.textContent =
      "No completed walks are saved. Plot and save a completed traverse first; no historic route is fabricated.";
    return;
  }

  const recommendation = findRouteRecommendation(currentMarsPosition, destination);
  if (!recommendation) {
    routePlanStatus.textContent =
      `No saved walk connects this position and destination within ${ROUTE_SNAP_LIMIT_KM} km of its recorded points.`;
    return;
  }

  recommendedRoutePolyline.setLatLngs(recommendation.points);
  map2D.fitBounds(recommendedRoutePolyline.getBounds(), { padding: [24, 24], maxZoom: 6 });
  routePlanStatus.textContent =
    `Suggested from completed walk "${recommendation.traverse.name}" · ${recommendation.distance.toFixed(1)} km. Start/destination connectors are straight-line estimates; terrain safety is not assessed.`;
}

document.getElementById("btn-plan-route").addEventListener("click", planLocalRoute);

// ==========================================
// 5. RESIZABLE & HIDEABLE WORKSPACE PANELS
// ==========================================
const resizer = document.getElementById("drag-resizer");
const pane3D = document.getElementById("pane-3d");
const pane2D = document.getElementById("pane-2d");
const workspacePanels = document.getElementById("workspace-panels");
const leftColumn = document.getElementById("workspace-left-column");
const datasetSidebar = document.getElementById("dataset-sidebar");
const survivalGuide = document.getElementById("survival-guide");
const survivalGuideButton = document.getElementById("act-survival-btn");
const mapInfoButton = document.getElementById("act-data-btn");
let isDragging = false;
let pane2DVisible = true;

resizer.addEventListener("mousedown", () => {
  isDragging = true;
  resizer.classList.add("active");
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const rect = workspacePanels.getBoundingClientRect();
  const isNarrowLayout = window.matchMedia("(max-width: 760px)").matches;
  const pct = isNarrowLayout
    ? ((e.clientY - rect.top) / rect.height) * 100
    : ((e.clientX - rect.left) / rect.width) * 100;
  if (pct > 20 && pct < 85) {
    leftColumn.style.flexBasis = `${pct}%`;
  }
});

window.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    resizer.classList.remove("active");
  }
});

// Automatic ResizeObserver keeps 3D WebGL & 2D Leaflet sharp whenever panes change size
const resizeObserver = new ResizeObserver(() => {
  if (container3D.clientWidth > 0 && container3D.clientHeight > 0) {
    camera.aspect = container3D.clientWidth / container3D.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container3D.clientWidth, container3D.clientHeight);
  }
  map2D.invalidateSize();
});
resizeObserver.observe(pane3D);
resizeObserver.observe(pane2D);

// UI Buttons for Hiding / Showing Containers
function toggleMainContainer() {
  const mainEl = document.getElementById("mars-project-container");
  const emptyEl = document.getElementById("empty-workspace");
  const hidden = mainEl.classList.toggle("hidden");
  emptyEl.classList.toggle("hidden", !hidden);
  emptyEl.classList.toggle("flex", hidden);
  if (hidden) {
    pane2DVisible = !pane2D.classList.contains("hidden");
    pane2D.classList.add("hidden");
  } else {
    pane2D.classList.toggle("hidden", !pane2DVisible);
  }
  updateLeftColumnLayout();
}

function toggleSidebar() {
  const isVisible = !datasetSidebar.classList.toggle("hidden");
  mapInfoButton.classList.toggle("is-active", isVisible);
  mapInfoButton.setAttribute("aria-pressed", String(isVisible));
  updateLeftColumnLayout();
}

function toggleSurvivalGuide() {
  const isVisible = !survivalGuide.classList.toggle("hidden");
  survivalGuideButton.classList.toggle("is-active", isVisible);
  survivalGuideButton.setAttribute("aria-pressed", String(isVisible));
}

function updateLeftColumnLayout() {
  const sidebarVisible = !datasetSidebar.classList.contains("hidden");
  const mapVisible = !pane2D.classList.contains("hidden");
  datasetSidebar.style.flex = sidebarVisible && !mapVisible ? "1 1 100%" : "";
  pane2D.style.flex = mapVisible && !sidebarVisible ? "1 1 100%" : "";
}

document.getElementById("act-map-btn").addEventListener("click", toggleMainContainer);
document.getElementById("btn-tab-close").addEventListener("click", toggleMainContainer);
document.getElementById("btn-reopen-container").addEventListener("click", toggleMainContainer);

mapInfoButton.addEventListener("click", toggleSidebar);
document.getElementById("btn-close-sidebar").addEventListener("click", toggleSidebar);
survivalGuideButton.addEventListener("click", toggleSurvivalGuide);

document.getElementById("btn-auto-rotate").addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  document.getElementById("btn-auto-rotate").textContent = `Globe Rotation: ${
    controls.autoRotate ? "ON" : "OFF"
  }`;
});

// ==========================================
// 6. ANIMATION LOOP & SCALE BAR
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  if (targetCamPos) {
    camera.position.lerp(targetCamPos, 0.07);
    if (camera.position.distanceTo(targetCamPos) < 0.08) {
      const callback = cameraTargetCallback;
      targetCamPos = null;
      cameraTargetCallback = null;
      if (callback) callback();
    }
  }

  controls.update();

  // Keep the scale bar near 140 px and use familiar 1-2-5 distance steps.
  const viewWidthKm =
    2 *
    Math.max(0.1, camera.position.length() - MARS_RADIUS) *
    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
    camera.aspect *
    1000;
  const kmPerPixel = viewWidthKm / Math.max(1, container3D.clientWidth);
  const scaleMagnitude = Math.pow(10, Math.floor(Math.log10(kmPerPixel * 140)));
  const scaleFraction = (kmPerPixel * 140) / scaleMagnitude;
  const scaleStep = scaleFraction >= 5 ? 5 : scaleFraction >= 2 ? 2 : 1;
  const scaleKm = scaleStep * scaleMagnitude;
  const targetScaleWidth = Math.min(140, scaleKm / kmPerPixel);

  if (scaleKm !== currentScaleKm) {
    currentScaleKm = scaleKm;
    scaleLabel.textContent = `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: scaleKm < 10 ? 1 : 0
    }).format(scaleKm)} km`;
  }
  if (currentScaleWidth === 0) currentScaleWidth = targetScaleWidth;
  else currentScaleWidth += (targetScaleWidth - currentScaleWidth) * 0.18;
  scaleBar.style.width = `${currentScaleWidth.toFixed(1)}px`;

  renderer.render(scene, camera);
}

loadLocations();
animate();

const starCanvas = document.getElementById("starfield");
const starContext = starCanvas.getContext("2d");
if (!starContext) {
  throw new Error("Unable to initialize the starfield canvas.");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stars = [];
let starfieldFrame = 0;
let starfieldTime = 0;
let starfieldWidth = 0;
let starfieldHeight = 0;
let starfieldDpr = 1;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function makeStar(x = randomBetween(0, starfieldWidth), y = randomBetween(0, starfieldHeight)) {
  const angle = randomBetween(-Math.PI * 0.36, -Math.PI * 0.14);
  const speed = randomBetween(9, 24);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: randomBetween(0.9, 1.45),
    opacity: randomBetween(0.24, 0.58),
    age: Math.random() * 22,
    lifetime: randomBetween(16, 38)
  };
}

function respawnStar(star) {
  star.x = randomBetween(-starfieldWidth * 0.08, starfieldWidth * 0.42);
  star.y = randomBetween(starfieldHeight * 0.68, starfieldHeight * 1.08);
  star.age = 0;
  star.lifetime = randomBetween(16, 38);
}

function resizeStarfield() {
  const oldWidth = starfieldWidth;
  const oldHeight = starfieldHeight;
  starfieldWidth = window.innerWidth;
  starfieldHeight = window.innerHeight;
  starfieldDpr = Math.min(window.devicePixelRatio || 1, 2);
  starCanvas.width = Math.round(starfieldWidth * starfieldDpr);
  starCanvas.height = Math.round(starfieldHeight * starfieldDpr);
  starCanvas.style.width = `${starfieldWidth}px`;
  starCanvas.style.height = `${starfieldHeight}px`;
  starContext.setTransform(starfieldDpr, 0, 0, starfieldDpr, 0, 0);

  if (oldWidth && oldHeight) {
    stars.forEach((star) => {
      star.x *= starfieldWidth / oldWidth;
      star.y *= starfieldHeight / oldHeight;
    });
  }

  const desiredCount = Math.min(450, Math.max(70, Math.round(
    (starfieldWidth * starfieldHeight) / 8500
  )));
  while (stars.length < desiredCount) stars.push(makeStar());
  stars.length = desiredCount;
  drawStarfield(0);
}

function drawStarfield(deltaSeconds) {
  starContext.clearRect(0, 0, starfieldWidth, starfieldHeight);

  stars.forEach((star) => {
    if (!reducedMotion.matches) {
      star.x += star.vx * deltaSeconds;
      star.y += star.vy * deltaSeconds;
      star.age += deltaSeconds;
      if (
        star.age >= star.lifetime ||
        star.x > starfieldWidth + 3 ||
        star.y < -3
      ) {
        respawnStar(star);
      }
    }

    const progress = star.age / star.lifetime;
    const fadeIn = Math.min(1, progress / 0.12);
    const fadeOut = Math.min(1, (1 - progress) / 0.2);
    const alpha = reducedMotion.matches
      ? star.opacity
      : star.opacity * Math.min(fadeIn, fadeOut);
    if (alpha <= 0) return;

    starContext.beginPath();
    starContext.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    starContext.fillStyle = `rgba(218, 215, 205, ${alpha})`;
    starContext.fill();
  });
}

function animateStarfield(timestamp) {
  starfieldFrame = 0;
  const deltaSeconds = starfieldTime
    ? Math.min((timestamp - starfieldTime) / 1000, 0.05)
    : 0;
  starfieldTime = timestamp;
  drawStarfield(deltaSeconds);

  if (!reducedMotion.matches) {
    starfieldFrame = requestAnimationFrame(animateStarfield);
  }
}

function startStarfield() {
  if (starfieldFrame) cancelAnimationFrame(starfieldFrame);
  starfieldTime = 0;
  starfieldFrame = requestAnimationFrame(animateStarfield);
}

resizeStarfield();
window.addEventListener("resize", resizeStarfield);
reducedMotion.addEventListener("change", startStarfield);
startStarfield();
