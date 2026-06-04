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

const SECTION_TITLE_SELECTOR = [
  '[class*="sectionBlockTitle"]',
  '[class*="paragraph--sectionBlockTitle"]',
].join(', ')

const SHELF_CONTAINER_SELECTOR = '[class*="sliderLayoutContainer"]'

const SECTION_ROOT_SELECTOR =
  'section[class*="container"], section[class*="store-components"]'

const SHELF_TITLE_ROW_SELECTOR = '[class*="flexRowContent--title-slider"]'

const readSectionTitle = (container: Element): string => {
  const titleEl = container.querySelector(SECTION_TITLE_SELECTOR)

  return titleEl ? normalizeText(titleEl.textContent) : ''
}

/** Closest section title that appears before the shelf within the same VTEX block. */
const getClosestPrecedingTitleInRoot = (
  shelf: HTMLElement,
  root: ParentNode
): string => {
  const titles = Array.from(root.querySelectorAll(SECTION_TITLE_SELECTOR))
  let closest: HTMLElement | null = null

  for (const titleNode of titles) {
    if (!(titleNode instanceof HTMLElement)) {
      continue
    }

    const position = shelf.compareDocumentPosition(titleNode)

    if ((position & Node.DOCUMENT_POSITION_PRECEDING) === 0) {
      continue
    }

    if (!closest) {
      closest = titleNode
      continue
    }

    if (
      (closest.compareDocumentPosition(titleNode) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
    ) {
      closest = titleNode
    }
  }

  return closest ? normalizeText(closest.textContent) : ''
}

const getSliderSectionTitle = (shelf: HTMLElement): string => {
  const sectionRoot = shelf.closest(SECTION_ROOT_SELECTOR)

  if (!sectionRoot) {
    return getClosestPrecedingTitleInRoot(shelf, document)
  }

  const titleRow = sectionRoot.querySelector(SHELF_TITLE_ROW_SELECTOR)

  if (titleRow) {
    const title = readSectionTitle(titleRow)

    if (title) {
      return title
    }
  }

  return getClosestPrecedingTitleInRoot(shelf, sectionRoot)
}

const getCategoryListContext = (): { listId: string; listName: string } | null => {
  const heading = document.querySelector(
    'h1[class*="title"], [class*="galleryTitle"], [class*="pageTitle"]'
  )

  const title = normalizeText(heading?.textContent)

  if (!title) {
    return null
  }

  return {
    listId: title,
    listName: title,
  }
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
  const shelf = productEl.closest(SHELF_CONTAINER_SELECTOR)

  if (shelf instanceof HTMLElement) {
    const sectionTitle = getSliderSectionTitle(shelf)
    const blockClass = getListBlockClass(shelf) || 'shelf'
    const listLabel = sectionTitle || blockClass

    return {
      listId: listLabel,
      listName: listLabel,
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

  const galleryRoot = productEl.closest(
    '[class*="gallery"], [class*="search-result"], [class*="searchResult"]'
  )

  if (galleryRoot) {
    const categoryList = getCategoryListContext()

    if (categoryList) {
      return {
        ...categoryList,
        listRoot: galleryRoot,
      }
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
  const shelf = productEl.closest(SHELF_CONTAINER_SELECTOR)
  const scope =
    shelf instanceof HTMLElement ? shelf : listRoot

  const cards = Array.from(
    scope.querySelectorAll(PRODUCT_SUMMARY_SELECTOR)
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
