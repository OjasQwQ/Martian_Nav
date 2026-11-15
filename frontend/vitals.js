const statusColors = {
  nominal: '#35C5D5',
  warning: '#FFC857',
  info: '#E76F32'
}

const icons = {
  oxygen: '○',
  water: '◈',
  temperature: '◇',
  radiation: '◉',
  dust: '◫',
  gravity: '◎',
  wind: '◆',
  pressure: '◆'
}

async function fetchVitals() {
  try {
    const res = await fetch('http://localhost:8000/vitals')
    const data = await res.json()
    renderVitals(data)
    checkThresholds(data)
  } catch (err) {
    renderVitalsError()
  }
}

function renderVitals(data) {
  const section = document.getElementById('vitals-section')
  const entries = Object.entries(data)

  const html = `
    <p class="text-mars text-xs font-semibold tracking-widest mb-2">EVA VITALS</p>
    <div class="grid grid-cols-2 gap-2">
      ${entries.map(([key, v]) => `
        <div class="bg-space border border-white/5 rounded-lg p-3 flex flex-col gap-1">
          <div class="flex items-center gap-1.5">
            <span style="color: ${statusColors[v.status] || '#F2F4F7'}" class="text-xs">
              ${icons[key] || '◆'}
            </span>
            <span class="text-offwhite/50 text-xs font-medium flex-1 truncate">
              ${v.label}
            </span>
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              style="background: ${statusColors[v.status] || '#F2F4F7'}"
            ></span>
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-offwhite font-bold text-xl leading-none">${v.value}</span>
            <span class="text-offwhite/40 text-xs">${v.unit}</span>
          </div>
          <div class="flex items-center justify-between mt-0.5">
            <p class="text-offwhite/35 text-xs leading-snug flex-1">${v.note}</p>
            <span class="text-xs px-1 py-0.5 rounded ml-1 shrink-0 ${
              v.source === 'nasa'
                ? 'text-cyan bg-cyan/10'
                : 'text-offwhite/25 bg-white/5'
            }">
              ${v.source === 'nasa' ? 'NASA' : 'SIM'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `

  section.innerHTML = html

  let alertBox = document.getElementById('alert-box')
  if (!alertBox) {
    alertBox = document.createElement('div')
    alertBox.id = 'alert-box'
  }
  section.prepend(alertBox)
}

function renderVitalsError() {
  const section = document.getElementById('vitals-section')
  section.innerHTML = `
    <p class="text-mars text-xs font-semibold tracking-widest mb-2">EVA VITALS</p>
    <div class="bg-space border border-amber/20 rounded-lg p-4 text-center">
      <p class="text-amber text-xs font-medium">Cannot reach backend</p>
      <p class="text-offwhite/30 text-xs mt-1">Make sure server.py is running</p>
      <button
        onclick="fetchVitals()"
        class="mt-3 px-3 py-1.5 bg-mars/10 border border-mars/30 rounded text-mars text-xs font-medium hover:bg-mars/20 transition-colors"
      >
        Retry
      </button>
    </div>
  `
}

function checkThresholds(data) {
  const warnings = []

  if (data.oxygen && data.oxygen.value < 19.5) {
    warnings.push({
      label: 'OXYGEN LOW',
      value: `${data.oxygen.value}%`,
      color: '#FFC857'
    })
  }

  if (data.oxygen && data.oxygen.value < 16) {
    warnings.push({
      label: 'OXYGEN CRITICAL',
      value: `${data.oxygen.value}%`,
      color: '#FF4444'
    })
  }

  if (data.wind && data.wind.value > 10) {
    warnings.push({
      label: 'HIGH WINDS',
      value: `${data.wind.value} m/s`,
      color: '#FFC857'
    })
  }

  if (data.temperature && data.temperature.value < -80) {
    warnings.push({
      label: 'EXTREME COLD',
      value: `${data.temperature.value}°C`,
      color: '#FFC857'
    })
  }

  renderAlerts(warnings)
}

function renderAlerts(warnings) {
  let alertBox = document.getElementById('alert-box')
  if (!alertBox) {
    alertBox = document.createElement('div')
    alertBox.id = 'alert-box'
    const vitalsSection = document.getElementById('vitals-section')
    vitalsSection.prepend(alertBox)
  }

  if (warnings.length === 0) {
    alertBox.innerHTML = `
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-space mb-3">
        <span class="w-1.5 h-1.5 rounded-full bg-cyan shrink-0"></span>
        <span class="text-cyan text-xs font-medium">All systems nominal</span>
      </div>
    `
    return
  }

  alertBox.innerHTML = `
    <div class="flex flex-col gap-1.5 mb-3">
      ${warnings.map(w => `
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style="background: ${w.color}10; border-color: ${w.color}40;"
        >
          <span class="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style="background: ${w.color}"></span>
          <span class="text-xs font-bold tracking-wider flex-1" style="color: ${w.color}">${w.label}</span>
          <span class="text-xs font-semibold" style="color: ${w.color}">${w.value}</span>
        </div>
      `).join('')}
    </div>
  `
}

async function fetchStatus() {
  try {
    const res = await fetch('http://localhost:8000/status')
    const data = await res.json()
    document.getElementById('sol-display').textContent = `SOL ${data.sol}`
    if (data.last_updated) {
      const date = new Date(data.last_updated * 1000)
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      document.getElementById('last-updated').textContent = `updated ${time}`
    } else {
      document.getElementById('last-updated').textContent = 'live'
    }
  } catch (err) {
    document.getElementById('sol-display').textContent = 'SOL --'
    document.getElementById('last-updated').textContent = 'offline'
  }
}
fetchStatus()
fetchVitals()
setInterval(fetchVitals, 30000)
setInterval(fetchStatus, 30000)