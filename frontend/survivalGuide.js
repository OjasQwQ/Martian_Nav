async function fetchSurvivalCards() {
  try {
    const res = await fetch('http://localhost:8000/survival-cards')
    const data = await res.json()
    renderSurvivalCards(data)
  } catch (err) {
    renderCardsError()
  }
}

function renderSurvivalCards(cards) {
  const section = document.getElementById('cards-section')

  const html = `
    <p class="text-mars text-xs font-semibold tracking-widest mb-2">SURVIVAL REFERENCE</p>
    <div class="flex flex-col gap-1.5">
      ${cards.map(card => `
        <div
          id="card-${card.id}"
          class="bg-space border border-white/5 rounded-lg overflow-hidden transition-all duration-200"
        >
          <!-- card header -->
          <button
            onclick="toggleCard('${card.id}')"
            class="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
          >
            <span class="text-offwhite/40 text-sm shrink-0">
              ${getCardIcon(card.id)}
            </span>
            <span class="text-offwhite text-sm font-semibold flex-1">
              ${card.title}
            </span>
            <span
              class="text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0"
              style="color: ${card.tag_color}; border-color: ${card.tag_color}40"
            >
              ${card.tag}
            </span>
            <span
              id="chevron-${card.id}"
              class="text-offwhite/30 text-xs shrink-0 transition-transform duration-200"
            >
              ▼
            </span>
          </button>

          <!-- summary always visible -->
          <p class="text-offwhite/45 text-xs leading-relaxed px-3 pb-2.5">
            ${card.summary}
          </p>

          <!-- detail expandable -->
          <div
            id="detail-${card.id}"
            class="hidden border-t border-white/5 px-3 py-2.5 bg-cyan/5"
          >
            <p class="text-offwhite/60 text-xs leading-relaxed">
              ${card.detail}
            </p>
          </div>
        </div>
      `).join('')}
    </div>
  `

  section.innerHTML = html
}

function toggleCard(id) {
  const detail = document.getElementById(`detail-${id}`)
  const chevron = document.getElementById(`chevron-${id}`)
  const card = document.getElementById(`card-${id}`)

  const isOpen = !detail.classList.contains('hidden')

  if (isOpen) {
    detail.classList.add('hidden')
    chevron.style.transform = 'rotate(0deg)'
    card.style.borderColor = 'rgba(255,255,255,0.05)'
  } else {
    detail.classList.remove('hidden')
    chevron.style.transform = 'rotate(180deg)'
    card.style.borderColor = 'rgba(231,111,50,0.3)'
  }
}

function getCardIcon(id) {
  const icons = {
    oxygen: '○',
    food: '◈',
    water: '◇',
    power: '◉',
    suits: '◫',
    comms: '◎',
    shelter: '▣'
  }
  return icons[id] || '◆'
}

function renderCardsError() {
  const section = document.getElementById('cards-section')
  section.innerHTML = `
    <p class="text-mars text-xs font-semibold tracking-widest mb-2">SURVIVAL REFERENCE</p>
    <div class="bg-space border border-amber/20 rounded-lg p-4 text-center">
      <p class="text-amber text-xs font-medium">Cannot reach backend</p>
      <p class="text-offwhite/30 text-xs mt-1">Make sure server.py is running</p>
      <button
        onclick="fetchSurvivalCards()"
        class="mt-3 px-3 py-1.5 bg-mars/10 border border-mars/30 rounded text-mars text-xs font-medium hover:bg-mars/20 transition-colors"
      >
        Retry
      </button>
    </div>
  `
}

fetchSurvivalCards()