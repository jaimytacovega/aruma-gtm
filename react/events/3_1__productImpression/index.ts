import { canUseDOM } from 'vtex.render-runtime'

import { log } from '../../utils'

import {
  buildViewItem,
  buildViewItemListPayload,
  clearCatalogCache,
  fetchCatalogProduct,
  prefetchCatalogProduct,
} from './catalog'

const DESKTOP_VISIBILITY_THRESHOLD = 0.25
const MOBILE_VISIBILITY_THRESHOLD = 0.75
const MOBILE_MAX_WIDTH = 768

const PRODUCT_SUMMARY_SELECTOR =
  'section[class*="product-summary"][class*="container"], section.vtex-product-summary-2-x-container'

const SLIDE_SELECTOR = '[class*="slider-layout-0-x-slide"]'

/** Products seen in the same viewport wave (scroll stop / mount burst) flush together. */
const BATCH_DEBOUNCE_MS = 200

/** Snapshot of a product card the user can see (debug only — no dataLayer yet). */
type VisibleProduct = {
  slug: string
  name: string
  brand: string
  price: number
  index: number
  listId: string
  listName: string
}

type PendingEntry = {
  product: VisibleProduct
  el: HTMLElement
}

const observedProducts = new Set<Element>()
/** Once per page: list + slug — scroll back does not log again. */
const loggedProductKeys = new Set<string>()

let intersectionObserver: IntersectionObserver | null = null
let domObserver: MutationObserver | null = null
let trackingActive = false
let batchLogCount = 0
let batchFlushTimer: number | null = null

/** Pending products per list — flushed only when still in viewport at flush time. */
const pendingByList = new Map<string, PendingEntry[]>()

const isMobileViewport = (): boolean =>
  window.innerWidth < MOBILE_MAX_WIDTH

const getVisibilityThreshold = (): number =>
  isMobileViewport() ? MOBILE_VISIBILITY_THRESHOLD : DESKTOP_VISIBILITY_THRESHOLD

const isCenterInViewport = (productEl: HTMLElement): boolean => {
  const rect = productEl.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  return (
    centerX >= 0 &&
    centerX <= window.innerWidth &&
    centerY >= 0 &&
    centerY <= window.innerHeight
  )
}

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

const getListContext = (productEl: HTMLElement): {
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

const getProductIndex = (
  productEl: HTMLElement,
  listRoot: ParentNode
): number => {
  const cards = Array.from(
    listRoot.querySelectorAll(PRODUCT_SUMMARY_SELECTOR)
  ).filter((node): node is HTMLElement => node instanceof HTMLElement)

  const index = cards.indexOf(productEl)

  return index >= 0 ? index + 1 : 0
}

const isVtexSlideVisible = (productEl: HTMLElement): boolean => {
  const slide = productEl.closest(SLIDE_SELECTOR)

  if (!slide) {
    return true
  }

  if (slide.getAttribute('aria-hidden') === 'true') {
    return false
  }

  return !slide.className.includes('--hidden')
}

const getVisibleAreaRatio = (element: Element): number => {
  const rect = element.getBoundingClientRect()

  if (rect.width === 0 || rect.height === 0) {
    return 0
  }

  const visibleWidth =
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
  const visibleHeight =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)

  if (visibleWidth <= 0 || visibleHeight <= 0) {
    return 0
  }

  return (visibleWidth * visibleHeight) / (rect.width * rect.height)
}

const isProductVisible = (productEl: HTMLElement): boolean => {
  if (!isVtexSlideVisible(productEl)) {
    return false
  }

  if (getVisibleAreaRatio(productEl) < getVisibilityThreshold()) {
    return false
  }

  if (isMobileViewport() && !isCenterInViewport(productEl)) {
    return false
  }

  return true
}

const buildVisibleProduct = (productEl: HTMLElement): VisibleProduct | null => {
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

const getLogKey = (product: VisibleProduct): string =>
  `${product.listId}:${product.slug}`

const scheduleBatchFlush = () => {
  if (batchFlushTimer !== null) {
    window.clearTimeout(batchFlushTimer)
  }

  batchFlushTimer = window.setTimeout(() => {
    batchFlushTimer = null
    void flushPendingBatches()
  }, BATCH_DEBOUNCE_MS)
}

const isAlreadyPending = (key: string): boolean => {
  for (const batch of pendingByList.values()) {
    if (batch.some((entry) => getLogKey(entry.product) === key)) {
      return true
    }
  }

  return false
}

const flushPendingBatches = async () => {
  if (pendingByList.size === 0) {
    return
  }

  let hasRemainingPending = false

  for (const [listId, entries] of pendingByList.entries()) {
    const ready: PendingEntry[] = []
    const stillPending: PendingEntry[] = []

    for (const entry of entries) {
      if (!entry.el.isConnected) {
        continue
      }

      if (isProductVisible(entry.el)) {
        ready.push(entry)
        loggedProductKeys.add(getLogKey(entry.product))
      } else {
        stillPending.push(entry)
      }
    }

    if (ready.length > 0) {
      const sorted = [...ready].sort(
        (a, b) => a.product.index - b.product.index
      )

      const items = await Promise.all(
        sorted.map(async (entry) => {
          const catalog = await fetchCatalogProduct(entry.product.slug)

          return buildViewItem(entry.product, catalog)
        })
      )

      const { listName } = sorted[0].product

      batchLogCount += 1

      const payload = buildViewItemListPayload(items, listId, listName)

      log('view_item_list', {
        batch: batchLogCount,
        viewport: isMobileViewport() ? 'mobile' : 'desktop',
        source: 'vtex-catalog-api+dom',
        ...payload,
      })
    }

    if (stillPending.length > 0) {
      pendingByList.set(listId, stillPending)
      hasRemainingPending = true
    } else {
      pendingByList.delete(listId)
    }
  }

  if (hasRemainingPending) {
    scheduleBatchFlush()
  }
}

const queueVisibleProduct = (productEl: HTMLElement) => {
  if (!isProductVisible(productEl)) {
    return
  }

  const product = buildVisibleProduct(productEl)

  if (!product) {
    return
  }

  const key = getLogKey(product)

  if (loggedProductKeys.has(key) || isAlreadyPending(key)) {
    return
  }

  const batch = pendingByList.get(product.listId) ?? []

  prefetchCatalogProduct(product.slug)

  batch.push({ product, el: productEl })
  pendingByList.set(product.listId, batch)
  scheduleBatchFlush()
}

const collectNewlyVisible = (productEl: HTMLElement) => {
  queueVisibleProduct(productEl)
}

const syncVisibleProducts = () => {
  document.querySelectorAll(PRODUCT_SUMMARY_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return
    }

    observeProduct(node)
    collectNewlyVisible(node)
  })
}

const observeProduct = (productEl: HTMLElement) => {
  if (!intersectionObserver || observedProducts.has(productEl)) {
    return
  }

  observedProducts.add(productEl)
  intersectionObserver.observe(productEl)
}

const scanForProducts = () => {
  document.querySelectorAll(PRODUCT_SUMMARY_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement) {
      observeProduct(node)
    }
  })

  syncVisibleProducts()
}

const handleIntersection: IntersectionObserverCallback = (entries) => {
  for (const entry of entries) {
    const productEl = entry.target

    if (!(productEl instanceof HTMLElement)) {
      continue
    }

    collectNewlyVisible(productEl)
  }
}

const disconnectProductImpression = () => {
  if (batchFlushTimer !== null) {
    window.clearTimeout(batchFlushTimer)
    batchFlushTimer = null
  }

  void flushPendingBatches()

  intersectionObserver?.disconnect()
  domObserver?.disconnect()
  intersectionObserver = null
  domObserver = null
  observedProducts.clear()
  loggedProductKeys.clear()
  pendingByList.clear()
  clearCatalogCache()
  trackingActive = false
  batchLogCount = 0
}

const connectProductImpression = () => {
  if (!canUseDOM || trackingActive) {
    return
  }

  intersectionObserver = new IntersectionObserver(handleIntersection, {
    threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    root: null,
    rootMargin: '0px',
  })

  domObserver = new MutationObserver((mutations) => {
    let hasNewProducts = false

    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof Element)) {
          continue
        }

        if (
          node.matches(PRODUCT_SUMMARY_SELECTOR) ||
          node.querySelector(PRODUCT_SUMMARY_SELECTOR)
        ) {
          hasNewProducts = true
        }
      }
    }

    if (hasNewProducts) {
      scanForProducts()
    }
  })

  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })

  trackingActive = true
  scanForProducts()
}

const registerProductImpression = () => {
  if (!canUseDOM) {
    return
  }

  disconnectProductImpression()
  connectProductImpression()
}

export { registerProductImpression, disconnectProductImpression }
