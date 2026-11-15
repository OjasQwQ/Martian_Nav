function createGuideElement(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

async function fetchSurvivalCards() {
  try {
    const response = await fetch('/api/survival-guide/references')
    if (!response.ok) {
      throw new Error(`Reference request failed (${response.status})`)
    }
    const cards = await response.json()
    if (!Array.isArray(cards)) {
      throw new Error('Survival references must be a list')
    }
    renderSurvivalCards(cards)
  } catch (error) {
    renderCardsError(error)
  }
}

function renderSurvivalCards(cards) {
  const section = document.getElementById('cards-section')
  section.replaceChildren()
  section.appendChild(
    createGuideElement('p', 'survival-section-title', 'MISSION SYSTEMS & SITE HAZARDS')
  )

  const list = createGuideElement('div', 'survival-card-list', '')
  cards.forEach(card => {
    const article = createGuideElement('article', 'survival-card', '')
    article.id = `card-${card.id}`

    const button = createGuideElement('button', 'survival-card-toggle', '')
    button.type = 'button'
    button.dataset.cardToggle = card.id
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-controls', `detail-${card.id}`)
    button.appendChild(
      createGuideElement('span', 'survival-card-icon', getCardIcon(card.id))
    )
    button.appendChild(
      createGuideElement('span', 'survival-card-title', card.title)
    )
    const tag = createGuideElement('span', 'survival-card-tag', card.tag)
    tag.style.setProperty('--tag-color', card.tag_color)
    button.appendChild(tag)
    const chevron = createGuideElement('span', 'survival-card-chevron', '▼')
    chevron.id = `chevron-${card.id}`
    chevron.setAttribute('aria-hidden', 'true')
    button.appendChild(chevron)
    article.appendChild(button)

    article.appendChild(
      createGuideElement('p', 'survival-card-summary', card.summary)
    )
    const detail = createGuideElement('div', 'survival-card-detail', '')
    detail.id = `detail-${card.id}`
    detail.hidden = true
    detail.appendChild(createGuideElement('p', '', card.detail))
    if (card.source_url) {
      const source = createGuideElement('a', 'survival-source-link', 'Source')
      source.href = card.source_url
      source.target = '_blank'
      source.rel = 'noopener noreferrer'
      detail.appendChild(source)
    }
    article.appendChild(detail)
    list.appendChild(article)
  })
  section.appendChild(list)
}

function toggleCard(id) {
  const detail = document.getElementById(`detail-${id}`)
  const chevron = document.getElementById(`chevron-${id}`)
  const button = document.querySelector(`[data-card-toggle="${id}"]`)
  if (!detail || !chevron || !button) return

  const isOpen = !detail.hidden
  detail.hidden = isOpen
  button.setAttribute('aria-expanded', String(!isOpen))
  chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
}

function getCardIcon(id) {
  const icons = {
    oxygen: '○',
    toxins: '⚠',
    water: '◇',
    food: '◈',
    power: '◉',
    spacesuits: '◫',
    comms: '◎',
    shelter: '▣'
  }
  return icons[id] || '◆'
}

function renderCardsError(error) {
  const section = document.getElementById('cards-section')
  section.replaceChildren()
  section.appendChild(
    createGuideElement('p', 'survival-section-title', 'MISSION SYSTEMS & SITE HAZARDS')
  )
  const panel = createGuideElement('div', 'survival-error', '')
  panel.setAttribute('role', 'status')
  panel.appendChild(
    createGuideElement('p', 'survival-error-title', 'Reference data unavailable')
  )
  panel.appendChild(
    createGuideElement('p', 'survival-error-message', error.message)
  )
  const retry = createGuideElement('button', 'survival-retry', 'Retry')
  retry.type = 'button'
  retry.dataset.retryCards = 'true'
  panel.appendChild(retry)
  section.appendChild(panel)
}

function renderSiteContext(site) {
  const context = document.getElementById('site-context')
  context.replaceChildren()
  if (!site.waterSummary && (!site.minerals || site.minerals.length === 0)) return

  const panel = createGuideElement('div', 'survival-site-context', '')
  panel.appendChild(
    createGuideElement(
      'p',
      'survival-site-label',
      'RECORDED GEOLOGY · NOT A SAFETY ASSAY'
    )
  )
  if (site.waterSummary) {
    panel.appendChild(createGuideElement('p', '', site.waterSummary))
  }
  if (site.minerals && site.minerals.length > 0) {
    panel.appendChild(
      createGuideElement('span', 'survival-site-label', 'REPORTED MINERALS')
    )
    panel.appendChild(createGuideElement('p', '', site.minerals.join(' · ')))
  }
  context.appendChild(panel)
}

window.addEventListener('mars-location-selected', event => {
  if (event.detail) renderSiteContext(event.detail)
})

document.getElementById('cards-section').addEventListener('click', event => {
  if (event.target.closest('[data-retry-cards]')) {
    fetchSurvivalCards()
    return
  }

  const toggle = event.target.closest('[data-card-toggle]')
  if (toggle) toggleCard(toggle.dataset.cardToggle)
})

fetchSurvivalCards()
