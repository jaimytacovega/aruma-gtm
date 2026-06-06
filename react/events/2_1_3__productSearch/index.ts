import { canUseDOM } from 'vtex.render-runtime'

import { pushToDataLayer } from '../../utils'

const AUTOCOMPLETE_SELECTOR = '[class*="biggy-autocomplete"]'
const SEARCH_INPUT_SELECTOR = [
  '[class*="searchBarInnerContainer"] input[type="text"]',
  '[class*="autoCompleteOuterContainer"] input[type="text"]',
].join(', ')
const NO_SUGGESTIONS_CTA = 'NOT AVAILABLE'
const SYNC_DEBOUNCE_MS = 300

let observerAttached = false
let lastFingerprint = ''
let syncTimer: number | null = null

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() || ''

const getSearchTerm = (): string => {
  const input = document.querySelector(SEARCH_INPUT_SELECTOR)

  if (!(input instanceof HTMLInputElement)) {
    return ''
  }

  return normalizeText(input.value)
}

const isAutocompleteVisible = (section: HTMLElement): boolean => {
  if (!section.isConnected) {
    return false
  }

  if (section.className.includes('biggy-js-container--hidden')) {
    return false
  }

  const { height, width } = section.getBoundingClientRect()

  return height > 0 && width > 0
}

const extractFirstSuggestion = (section: HTMLElement): string | null => {
  const titleEl = section.querySelector('[class*="itemListTitle"]')
  const titleText = normalizeText(titleEl?.textContent).toLowerCase()

  if (titleText.includes('sin sugerencias')) {
    return NO_SUGGESTIONS_CTA
  }

  const firstItem = section.querySelector('[class*="itemListItem"]')

  if (!firstItem) {
    return null
  }

  const firstSubLink = firstItem.querySelector('[class*="itemListSubItemLink"]')

  if (firstSubLink) {
    const text = normalizeText(firstSubLink.textContent)

    if (text) {
      return text
    }
  }

  const mainLink = firstItem.querySelector('[class*="itemListLinkTitle"]')
  const text = normalizeText(mainLink?.textContent)

  return text || null
}

const pushSearchVirtualEvent = (searchTerm: string, cta: string) => {
  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Home',
    seccion: 'Header',
    subseccion: 'Buscador',
    intencion: 'Seleccionar menu',
    accion: `Buscar ${searchTerm}`,
    elemento: 'Buscador',
    cta,
  })
}

const syncProductSearch = () => {
  const sections = document.querySelectorAll(AUTOCOMPLETE_SELECTOR)
  let matchedVisible = false

  for (const node of Array.from(sections)) {
    if (!(node instanceof HTMLElement) || !isAutocompleteVisible(node)) {
      continue
    }

    const searchTerm = getSearchTerm()

    if (!searchTerm) {
      continue
    }

    const cta = extractFirstSuggestion(node)

    if (!cta) {
      matchedVisible = true
      continue
    }

    const fingerprint = `${searchTerm}|${cta}`

    if (fingerprint === lastFingerprint) {
      matchedVisible = true
      continue
    }

    lastFingerprint = fingerprint
    pushSearchVirtualEvent(searchTerm, cta)
    matchedVisible = true
    break
  }

  if (!matchedVisible) {
    lastFingerprint = ''
  }
}

const scheduleProductSearchSync = () => {
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer)
  }

  syncTimer = window.setTimeout(() => {
    syncTimer = null
    syncProductSearch()
  }, SYNC_DEBOUNCE_MS)
}

const registerProductSearch = () => {
  if (!canUseDOM || observerAttached) {
    return
  }

  const observer = new MutationObserver(() => {
    scheduleProductSearchSync()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  })

  observerAttached = true
  scheduleProductSearchSync()
}

export { registerProductSearch }
