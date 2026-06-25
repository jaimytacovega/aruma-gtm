import type { VisibleProduct } from './productSummary'

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() || ''

const parsePrice = (value: string | null | undefined): number => {
  const cleaned = String(value ?? '')
    .replace(/[^\d.,]/g, '')
    .replace(',', '.')

  if (!cleaned) {
    return 0
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

export const GOPERSONAL_ROOT_SELECTOR = '[data-gopersonal="true"]'

export const GOPERSONAL_PRODUCT_SELECTOR =
  '[data-gopersonal="true"] .slid-child-wrap'

export const isGoPersonalProduct = (element: HTMLElement): boolean => {
  if (element.matches(GOPERSONAL_PRODUCT_SELECTOR)) {
    return true
  }

  return Boolean(
    element.classList.contains('slid-child-wrap') &&
      element.closest(GOPERSONAL_ROOT_SELECTOR)
  )
}

const getGoPersonalCard = (element: HTMLElement): HTMLElement | null => {
  if (element.matches('.slid-child-wrap')) {
    return element
  }

  const card = element.closest('[data-gopersonal="true"] .slid-child-wrap')

  return card instanceof HTMLElement ? card : null
}

const getGoPersonalHref = (card: HTMLElement): string => {
  const link = card.querySelector('a[href*="/p"]')

  if (link instanceof HTMLAnchorElement && link.href) {
    return link.href
  }

  const onclick = card.getAttribute('onclick') ?? ''
  const match = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/)

  return match?.[1] ?? ''
}

const getSlugFromHref = (href: string): string => {
  if (!href) {
    return ''
  }

  try {
    const path = href.startsWith('http')
      ? new URL(href).pathname
      : href.split('?')[0]
    const match = path.match(/\/([^/]+)\/p\/?$/)

    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

const getGoPersonalListTitle = (card: HTMLElement): string => {
  const root = card.closest(GOPERSONAL_ROOT_SELECTOR)
  const titleEl = root?.querySelector('[class*="gs_title"]')

  return normalizeText(titleEl?.textContent) || 'Recomendados para ti'
}

const getGoPersonalIndex = (card: HTMLElement, listRoot: ParentNode): number => {
  const href = getGoPersonalHref(card)

  if (href) {
    try {
      const gsIndex = new URL(href, window.location.origin).searchParams.get(
        'gsIndex'
      )

      if (gsIndex !== null) {
        const parsed = Number.parseInt(gsIndex, 10)

        if (Number.isFinite(parsed)) {
          return parsed + 1
        }
      }
    } catch {
      // ignore malformed href
    }
  }

  const cards = Array.from(
    listRoot.querySelectorAll('.slid-child-wrap')
  ).filter((node): node is HTMLElement => node instanceof HTMLElement)

  const index = cards.indexOf(card)

  return index >= 0 ? index + 1 : 0
}

export const getGoPersonalProductId = (card: HTMLElement): string | undefined => {
  const addButton = card.querySelector('[class*="gs_add_cart_btn"]')
  const onclick = addButton?.getAttribute('onclick') ?? ''
  const match = onclick.match(/gsAddToCart_[^(]+\([^,]+,\s*['"](\d+)['"]\)/)

  return match?.[1]
}

export const buildGoPersonalVisibleProduct = (
  element: HTMLElement
): VisibleProduct | null => {
  const card = getGoPersonalCard(element)

  if (!card) {
    return null
  }

  const slug = getSlugFromHref(getGoPersonalHref(card))

  if (!slug) {
    return null
  }

  const listRoot = card.closest(GOPERSONAL_ROOT_SELECTOR) ?? card
  const listLabel = getGoPersonalListTitle(card)
  const addButton = card.querySelector('[class*="gs_add_cart_btn"]')

  const name =
    normalizeText(addButton?.getAttribute('data-product-name')) ||
    normalizeText(card.querySelector('.product-item-desc')?.textContent) ||
    slug

  const brand =
    normalizeText(addButton?.getAttribute('data-product-brand')) ||
    normalizeText(card.querySelector('[class*="gs_brand"]')?.textContent)

  const price = parsePrice(
    addButton?.getAttribute('data-product-price') ??
      card.querySelector('.price-label')?.textContent
  )

  return {
    slug,
    name,
    brand,
    price,
    index: getGoPersonalIndex(card, listRoot),
    listId: listLabel,
    listName: listLabel,
  }
}
