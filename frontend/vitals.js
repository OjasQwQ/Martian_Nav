let activeSite = null
let activeRequest = null

function createTextElement(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  element.textContent = text
  return element
}

function formatCoordinate(value, axis) {
  const direction = axis === 'latitude'
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'W')
  return `${Math.abs(value).toFixed(4)}° ${direction}`
}

function updateSelectedPosition(site) {
  const position = document.getElementById('survival-position')
  position.replaceChildren()
  position.appendChild(createTextElement('span', '', site.name || 'Selected Mars location'))
  position.appendChild(
    createTextElement(
      'span',
      'survival-position-coordinates',
      `${formatCoordinate(site.lat, 'latitude')} · ${formatCoordinate(site.lon, 'longitude')}`
    )
  )
}

function createMetric(label, value, unit, note) {
  const card = createTextElement('article', 'survival-vital', '')
  card.appendChild(createTextElement('div', 'survival-vital-label', label))
  const number = createTextElement('div', 'survival-vital-value', '')
  number.appendChild(createTextElement('span', '', value))
  number.appendChild(createTextElement('span', 'survival-vital-unit', unit))
  card.appendChild(number)
  const meta = createTextElement('div', 'survival-vital-meta', '')
  meta.appendChild(createTextElement('span', 'survival-vital-note', note))
  meta.appendChild(createTextElement('span', 'survival-source', 'MCD'))
  card.appendChild(meta)
  return card
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`The climate model did not return ${label}.`)
  }
  return value
}

function renderVitals(data) {
  const section = document.getElementById('vitals-section')
  section.replaceChildren()
  section.appendChild(createTextElement('p', 'survival-section-title', 'SITE CONDITIONS'))

  const surface = data.surface
  const metrics = [
    ['Surface temperature', requireFinite(surface.temperature_c, 'surface temperature').toFixed(1), '°C', 'Modeled at the local surface'],
    ['Surface pressure', requireFinite(surface.pressure_pa, 'surface pressure').toFixed(1), 'Pa', 'Modeled at the local surface'],
    ['Wind speed', requireFinite(surface.wind_speed_mps, 'wind speed').toFixed(1), 'm/s', 'Modeled horizontal wind'],
    ['Dust optical depth', requireFinite(surface.dust_optical_depth, 'dust opacity').toFixed(3), 'τ', 'Seasonal model average'],
    ['Incident sunlight', requireFinite(surface.solar_flux_wm2, 'solar flux').toFixed(1), 'W/m²', 'Model input, not usable power']
  ]
  const grid = createTextElement('div', 'survival-vitals-grid', '')
  metrics.forEach(([label, value, unit, note]) => {
    grid.appendChild(createMetric(label, value, unit, note))
  })
  section.appendChild(grid)

  const model = data.model
  const localTime = Number(model.local_time_hours).toFixed(1)
  const description =
    `${model.name} · ${model.scenario} · Ls ${Number(model.solar_longitude_deg).toFixed(1)}° · ` +
    `local solar time ${localTime}h. ${model.disclaimer}`
  section.appendChild(createTextElement('p', 'survival-model-note', description))

  renderAtmosphere(data.gases)
  document.getElementById('model-state').textContent = 'MODELED'
  document.getElementById('model-updated').textContent =
    `Updated ${new Date(model.computed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatGas(gas) {
  const mixingRatio = requireFinite(gas.mixing_ratio, `${gas.label} mixing ratio`)
  const percent = mixingRatio * 100
  if (percent >= 0.01) {
    return { value: percent.toPrecision(3), unit: '% vol' }
  }
  return { value: (mixingRatio * 1000000).toPrecision(3), unit: 'ppmv' }
}

function renderAtmosphere(gases) {
  const section = document.getElementById('atmosphere-section')
  section.replaceChildren()
  section.appendChild(
    createTextElement('p', 'survival-section-title', 'ATMOSPHERIC GASES · MODEL')
  )
  section.appendChild(
    createTextElement(
      'p',
      'survival-data-note',
      'Volume mixing ratios at the selected site and modeled time; trace gases are shown in ppmv. These are not live sensor readings.'
    )
  )

  const grid = createTextElement('div', 'survival-gas-grid', '')
  gases.forEach(gas => {
    const formatted = formatGas(gas)
    const card = createTextElement('article', 'survival-gas-card', '')
    card.appendChild(createTextElement('div', 'survival-gas-name', gas.label))
    const value = createTextElement('div', 'survival-gas-value', '')
    value.appendChild(createTextElement('span', '', formatted.value))
    value.appendChild(createTextElement('span', 'survival-gas-unit', ` ${formatted.unit}`))
    card.appendChild(value)
    grid.appendChild(card)
  })
  section.appendChild(grid)
  section.appendChild(
    createTextElement(
      'div',
      'survival-warning',
      'Mars surface air is not breathable. This climatology is not a toxic-exposure assessment or a substitute for suit and habitat life support.'
    )
  )
}

function renderVitalsError(error) {
  const section = document.getElementById('vitals-section')
  section.replaceChildren()
  section.appendChild(createTextElement('p', 'survival-section-title', 'SITE CONDITIONS'))
  const panel = createTextElement('div', 'survival-error', '')
  panel.setAttribute('role', 'status')
  panel.appendChild(createTextElement('p', 'survival-error-title', 'Site model unavailable'))
  panel.appendChild(
    createTextElement(
      'p',
      'survival-error-message',
      `${error.message} No live or estimated values are being substituted.`
    )
  )
  panel.appendChild(
    createTextElement('button', 'survival-retry', 'Retry climate model')
  )
  panel.lastChild.type = 'button'
  panel.lastChild.dataset.retrySite = 'true'
  section.appendChild(panel)
  document.getElementById('atmosphere-section').replaceChildren()
  document.getElementById('model-state').textContent = 'UNAVAILABLE'
  document.getElementById('model-updated').textContent = 'No model data'
}

async function fetchSiteConditions(site) {
  activeSite = site
  if (activeRequest) activeRequest.abort()
  activeRequest = new AbortController()
  document.getElementById('model-state').textContent = 'LOADING'
  document.getElementById('model-updated').textContent = 'Querying MCD'

  const params = new URLSearchParams({
    lat: String(site.lat),
    lon: String(site.lon)
  })

  try {
    const response = await fetch(`/api/survival-guide?${params}`, {
      signal: activeRequest.signal
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.detail || `Climate model request failed (${response.status})`)
    }
    renderVitals(data)
  } catch (error) {
    if (error.name === 'AbortError') return
    renderVitalsError(error)
  }
}

window.addEventListener('mars-location-selected', event => {
  const site = event.detail
  if (!site || !Number.isFinite(site.lat) || !Number.isFinite(site.lon)) return
  updateSelectedPosition(site)
  fetchSiteConditions(site)
})

document.getElementById('vitals-section').addEventListener('click', event => {
  if (event.target.closest('[data-retry-site]') && activeSite) {
    fetchSiteConditions(activeSite)
  }
})
