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
const leafletMarkers = {};

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
async function loadLocations() {
  try {
    const res = await fetch("/api/locations");
    if (!res.ok) throw new Error("Using local fallback");
    const data = await res.json();
    marsLocations = data.locations;
  } catch {
    marsLocations = FALLBACK_LOCATIONS;
  }

  const listEl = document.getElementById("location-list");
  listEl.innerHTML = "";

  marsLocations.forEach((loc) => {
    // 1. Sidebar Button
    const btn = document.createElement("button");
    btn.className =
      "w-full text-left p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/50 transition";
    btn.innerHTML = `
      <div class="font-semibold text-zinc-200 truncate">${loc.name}</div>
      <div class="text-[10px] text-zinc-400">${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°</div>
    `;
    btn.addEventListener("click", () => selectLocation(loc));
    listEl.appendChild(btn);

    // 2. 3D Globe Pin
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xb19b78 })
    );
    pin.position.copy(latLonToVec3(loc.lat, loc.lon, MARS_RADIUS + 0.04));
    pin.userData = loc;
    globeGroup.add(pin);
    markerMeshes.push(pin);

    // 3. 2D Leaflet Marker
    const marker2d = L.circleMarker([loc.lat, loc.lon], {
      radius: 7,
      color: "#b19b78",
      fillColor: "#b19b78",
      fillOpacity: 0.78
    })
      .addTo(map2D)
      .bindPopup(`<b>${loc.name}</b><br>${loc.mission}`);

    marker2d.on("click", () => selectLocation(loc));
    leafletMarkers[loc.id] = marker2d;
  });

  // Load initial location without stopping auto-spin
  if (marsLocations.length > 0) {
    selectLocation(marsLocations[0], false);
  }
}

function selectLocation(loc, fly3D = true) {
  // Highlight selected 3D pin in green
  markerMeshes.forEach((m) => {
    m.material.color.setHex(m.userData.id === loc.id ? 0xe0d4bc : 0xb19b78);
  });

  if (fly3D) {
    controls.autoRotate = false;
    document.getElementById("btn-auto-rotate").textContent = "Globe Rotation: OFF";
    targetCamPos = latLonToVec3(loc.lat, loc.lon, 5.5);
  }

  updateHUD(loc.lat, loc.lon, loc.elev);

  // Update 2D Info Panel
  document.getElementById("loc-title").textContent = loc.name;
  document.getElementById("loc-mission").textContent = loc.mission;
  document.getElementById("loc-img").src = loc.image_2d;
  document.getElementById("loc-img-link").href = loc.image_2d;
  document.getElementById("loc-water").textContent = loc.water_summary;

  const minContainer = document.getElementById("loc-minerals");
  minContainer.innerHTML = loc.minerals
    .map(
      (m) =>
        `<span class="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-orange-300">${m}</span>`
    )
    .join("");

  map2D.flyTo([loc.lat, loc.lon], 6, { duration: 1.0 });
  if (leafletMarkers[loc.id]) {
    leafletMarkers[loc.id].openPopup();
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
}

function toggleSidebar() {
  document.getElementById("dataset-sidebar").classList.toggle("hidden");
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
  datasetSidebar.style.flex = "";
  leftColumn.style.flexBasis = "50%";
});

document.getElementById("btn-toggle-2d").addEventListener("click", () => {
  const isHidden = pane2D.classList.toggle("hidden");
  datasetSidebar.style.flex = isHidden ? "1 1 100%" : "";
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
