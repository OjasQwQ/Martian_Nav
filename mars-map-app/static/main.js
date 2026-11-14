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

const btnDrawRoute = document.getElementById("btn-draw-route");
const btnClearRoute = document.getElementById("btn-clear-route");

btnDrawRoute.addEventListener("click", () => {
  drawingRoute = !drawingRoute;
  btnDrawRoute.textContent = `Plot Traverse: ${drawingRoute ? "ON (Click Map)" : "OFF"}`;
});

btnClearRoute.addEventListener("click", () => {
  routePoints = [];
  routePolyline.setLatLngs([]);
  btnClearRoute.classList.add("hidden");
});

map2D.on("click", (e) => {
  if (!drawingRoute) return;
  routePoints.push([e.latlng.lat, e.latlng.lng]);
  routePolyline.setLatLngs(routePoints);
  btnClearRoute.classList.remove("hidden");
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

// Cancel fly-to animation immediately if user interacts manually
renderer.domElement.addEventListener("pointerdown", () => {
  targetCamPos = null;
});
renderer.domElement.addEventListener("wheel", () => {
  targetCamPos = null;
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
  color: 0xd97742, // Warm Martian fallback tint before texture loads
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

// GPS Marker Pin (Blue)
const gpsPin = new THREE.Mesh(
  new THREE.SphereGeometry(0.095, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xc2b69e })
);
gpsPin.visible = false;
globeGroup.add(gpsPin);

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

  marsLocations
    .filter((loc) => loc.featured)
    .slice(0, 20)
    .forEach((loc) => addLocationMarker(loc, true));

  const initialLocation =
    marsLocations.find((loc) => loc.id === "jezero-margin-unit") ||
    marsLocations.find((loc) => loc.featured) ||
    marsLocations[0];
  if (initialLocation) selectLocation(initialLocation, false);
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

function selectLocation(loc, fly3D = true) {
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return;
  if (activeTransientMarkerId !== loc.id) removeTransientMarker();
  if (!locationMarkers[loc.id]) {
    addLocationMarker(loc);
    activeTransientMarkerId = loc.id;
  }

  selectedLocationId = loc.id;
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
    controls.autoRotate = false;
    document.getElementById("btn-auto-rotate").textContent = "Globe Rotation: OFF";
    targetCamPos = latLonToVec3(loc.lat, loc.lon, 5.5);
  }

  updateHUD(loc.lat, loc.lon, loc.elev);
  document.getElementById("hud-elev").textContent =
    Number.isFinite(loc.elev) ? `${loc.elev} m` : "N/A";

  document.getElementById("loc-title").textContent = loc.name;
  const missionLabel = document.getElementById("loc-mission");
  missionLabel.textContent = loc.mission || loc.feature_type || "Mars feature";
  missionLabel.classList.toggle("hidden", !loc.mission && !loc.feature_type);

  const imageCard = document.getElementById("loc-image-card");
  const image = document.getElementById("loc-img");
  const imageLink = document.getElementById("loc-img-link");
  imageCard.classList.toggle("hidden", !loc.image_2d);
  image.src = loc.image_2d || "";
  imageLink.href = loc.image_2d || "#";

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

  map2D.flyTo([loc.lat, loc.lon], 6, { duration: 1.0 });
  locationMarkers[loc.id].marker2d.openPopup();
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

// ==========================================
// 4. TOP-LEFT GPS QUICK ZOOM
// ==========================================
document.getElementById("btn-gps-zoom").addEventListener("click", () => {
  const badge = document.getElementById("gps-badge");
  badge.classList.remove("hidden");
  badge.textContent = "Acquiring GPS coordinates...";

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lockGPSOnMars(pos.coords.latitude, pos.coords.longitude, "Live GPS Mapped");
      },
      () => {
        // Fallback if browser blocks geolocation
        lockGPSOnMars(18.4447, 77.4508, "Fallback: Jezero Beacon");
      },
      { timeout: 5000 }
    );
  } else {
    lockGPSOnMars(18.4447, 77.4508, "Fallback: Jezero Beacon");
  }
});

function lockGPSOnMars(lat, lon, sourceLabel) {
  const badge = document.getElementById("gps-badge");
  badge.textContent = `GPS: ${lat.toFixed(4)}°, ${lon.toFixed(4)}° (${sourceLabel})`;

  gpsPin.position.copy(latLonToVec3(lat, lon, MARS_RADIUS + 0.05));
  gpsPin.visible = true;

  controls.autoRotate = false;
  document.getElementById("btn-auto-rotate").textContent = "Globe Rotation: OFF";
  targetCamPos = latLonToVec3(lat, lon, 5.0);

  map2D.flyTo([lat, lon], 6, { duration: 1.0 });
  updateHUD(lat, lon, -2485);
}

// ==========================================
// 5. RESIZABLE & HIDEABLE WORKSPACE PANELS
// ==========================================
const resizer = document.getElementById("drag-resizer");
const pane3D = document.getElementById("pane-3d");
const pane2D = document.getElementById("pane-2d");
const workspacePanels = document.getElementById("workspace-panels");
const leftColumn = document.getElementById("workspace-left-column");
const datasetSidebar = document.getElementById("dataset-sidebar");
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
  datasetSidebar.classList.toggle("hidden");
  updateLeftColumnLayout();
}

function updateLeftColumnLayout() {
  const sidebarVisible = !datasetSidebar.classList.contains("hidden");
  const mapVisible = !pane2D.classList.contains("hidden");
  datasetSidebar.style.flex = sidebarVisible && !mapVisible ? "1 1 100%" : "";
  pane2D.style.flex = mapVisible && !sidebarVisible ? "1 1 100%" : "";
}

document.getElementById("btn-toggle-container").addEventListener("click", toggleMainContainer);
document.getElementById("act-map-btn").addEventListener("click", toggleMainContainer);
document.getElementById("btn-tab-close").addEventListener("click", toggleMainContainer);
document.getElementById("btn-reopen-container").addEventListener("click", toggleMainContainer);

document.getElementById("btn-toggle-sidebar").addEventListener("click", toggleSidebar);
document.getElementById("act-data-btn").addEventListener("click", toggleSidebar);
document.getElementById("btn-close-sidebar").addEventListener("click", toggleSidebar);

document.getElementById("btn-split-equal").addEventListener("click", () => {
  pane2D.classList.remove("hidden");
  pane2DVisible = true;
  updateLeftColumnLayout();
  leftColumn.style.flexBasis = "50%";
});

document.getElementById("btn-toggle-2d").addEventListener("click", () => {
  const isHidden = pane2D.classList.toggle("hidden");
  pane2DVisible = !isHidden;
  updateLeftColumnLayout();
});

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
      targetCamPos = null;
    }
  }

  controls.update();

  // Update dynamic scale bar in bottom-left HUD
  const distFromSurface = Math.max(0.5, camera.position.length() - MARS_RADIUS);
  const scaleKm = Math.round(distFromSurface * 210);
  document.getElementById("hud-scale-val").textContent = `${scaleKm} km`;

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
