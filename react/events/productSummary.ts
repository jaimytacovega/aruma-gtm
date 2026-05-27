const PRODUCT_SUMMARY_SELECTOR =
  'section[class*="product-summary"][class*="container"], section.vtex-product-summary-2-x-container'

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() || ''

const parsePrice = (value: string): number => {
  const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.')

  if (!cleaned) {
    return 0
  }

  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

const getProductLink = (productEl: HTMLElement): HTMLAnchorElement | null => {
  const link = productEl.querySelector('a[href*="/p"]')

  return link instanceof HTMLAnchorElement ? link : null
}

const getProductSlug = (productEl: HTMLElement): string => {
  const href = getProductLink(productEl)?.getAttribute('href') ?? ''
  const match = href.match(/\/([^/]+)\/p\/?$/)

  return match?.[1] ?? ''
}

const getProductName = (productEl: HTMLElement): string => {
  const ariaLabel = productEl.getAttribute('aria-label') ?? ''

  if (ariaLabel.toLowerCase().startsWith('producto')) {
    return normalizeText(ariaLabel.replace(/^producto\s*/i, ''))
  }

  const nameEl = productEl.querySelector(
    '[class*="productName"], [class*="product-name"]'
  )

  return normalizeText(nameEl?.textContent) || getProductSlug(productEl)
}

const getProductBrand = (productEl: HTMLElement): string => {
  const brandEl = productEl.querySelector('[class*="brandName"]')

  return normalizeText(brandEl?.textContent)
}

const getProductPrice = (productEl: HTMLElement): number => {
  const priceEl = productEl.querySelector(
    '[class*="sellingPrice"], [class*="currencyLiteral"]'
  )

  return parsePrice(normalizeText(priceEl?.textContent))
}

const getListBlockClass = (element: Element | null): string | null => {
  if (!element) {
    return null
  }

  const match = element.className.match(/--([A-Za-z0-9_-]+)/)

  return match?.[1] ?? null
}

export type VisibleProduct = {
  slug: string
  name: string
  brand: string
  price: number
  index: number
  listId: string
  listName: string
}

export const getListContext = (productEl: HTMLElement): {
  listId: string
  listName: string
  listRoot: ParentNode
} => {
  const shelf = productEl.closest('[class*="sliderLayoutContainer"]')

  if (shelf) {
    const blockClass = getListBlockClass(shelf) || 'shelf'

    return {
      listId: blockClass,
      listName: blockClass,
      listRoot: shelf,
    }
  }

  const searchRoot =
    productEl.closest(
      '[class*="search-result"], [class*="searchResult"], main'
    ) ?? document

  if (
    window.location.pathname.includes('/search') ||
    window.location.search.includes('_q=')
  ) {
    const term = new URLSearchParams(window.location.search).get('_q') || ''

    return {
      listId: term ? `search:${term}` : 'search',
      listName: term ? `Search: ${term}` : 'Search results',
      listRoot: searchRoot,
    }
  }

  return {
    listId: 'listing',
    listName: 'List of products',
    listRoot: searchRoot,
  }
}

export const getProductIndex = (
  productEl: HTMLElement,
  listRoot: ParentNode
): number => {
  const cards = Array.from(
    listRoot.querySelectorAll(PRODUCT_SUMMARY_SELECTOR)
  ).filter((node): node is HTMLElement => node instanceof HTMLElement)

  const index = cards.indexOf(productEl)

  return index >= 0 ? index + 1 : 0
}

export const buildVisibleProduct = (
  productEl: HTMLElement
): VisibleProduct | null => {
  const slug = getProductSlug(productEl)

  if (!slug) {
    return null
  }

  const { listId, listName, listRoot } = getListContext(productEl)

  return {
    slug,
    name: getProductName(productEl),
    brand: getProductBrand(productEl),
    price: getProductPrice(productEl),
    index: getProductIndex(productEl, listRoot),
    listId,
    listName,
  }
}

export const getProductCardFromTarget = (target: Element): HTMLElement | null => {
  const link = target.closest('a[href*="/p"]')

  if (!(link instanceof HTMLAnchorElement)) {
    return null
  }

  const productEl = link.closest(PRODUCT_SUMMARY_SELECTOR)

  return productEl instanceof HTMLElement ? productEl : null
}

export { PRODUCT_SUMMARY_SELECTOR }
