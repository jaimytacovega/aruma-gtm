import { canUseDOM } from 'vtex.render-runtime'

import { log, pushToDataLayer } from '../../utils'

import {
  buildViewItem,
  buildViewItemListPayload,
  clearCatalogCache,
  fetchCatalogProduct,
  prefetchCatalogProduct,
} from './catalog'
import {
  buildVisibleProduct,
  PRODUCT_SUMMARY_SELECTOR,
} from '../productSummary'
import type { VisibleProduct } from '../productSummary'


const DESKTOP_VISIBILITY_THRESHOLD = 0.25
const MOBILE_VISIBILITY_THRESHOLD = 0.75
const MOBILE_MAX_WIDTH = 768

const SLIDE_SELECTOR =
  '[class*="slider-layout-0-x-slide"], [class*="shelf-1-x-slide"], [class*="shelf-"][class*="slide"]'

/** Products seen in the same viewport wave (scroll stop / mount burst) flush together. */
const BATCH_DEBOUNCE_MS = 200

type PendingEntry = {
  product: VisibleProduct
  el: HTMLElement
  pageKey: string
}

const observedProducts = new Set<Element>()
/** Once per page: list + slug — scroll back does not log again. */
const loggedProductKeys = new Set<string>()
/** Slugs already sent in view_item_list for a page + list (allows scroll batches). */
const sentProductsByListSession = new Map<string, Set<string>>()

let intersectionObserver: IntersectionObserver | null = null
let domObserver: MutationObserver | null = null
let trackingActive = false
let batchLogCount = 0
let batchFlushTimer: number | null = null
let lastImpressionPageKey = ''
let navigationWatcherInstalled = false
let flushInProgress = false

/** Pending products per list — flushed only when still in viewport at flush time. */
const pendingByList = new Map<string, PendingEntry[]>()

const getImpressionPageKey = (): string =>
  `${window.location.pathname}${window.location.search}`

const getListSessionKey = (listId: string, pageKey: string): string =>
  `${pageKey}:${listId}`

const getSentProductsForList = (listId: string, pageKey: string): Set<string> => {
  const sessionKey = getListSessionKey(listId, pageKey)
  let sent = sentProductsByListSession.get(sessionKey)

  if (!sent) {
    sent = new Set()
    sentProductsByListSession.set(sessionKey, sent)
  }

  return sent
}

const getProductDedupeKey = (product: VisibleProduct): string => product.slug

const cancelPendingImpressions = () => {
  if (batchFlushTimer !== null) {
    window.clearTimeout(batchFlushTimer)
    batchFlushTimer = null
  }

  pendingByList.clear()
}

const installNavigationWatcher = () => {
  if (navigationWatcherInstalled || !canUseDOM) {
    return
  }

  navigationWatcherInstalled = true

  const onRouteChange = () => {
    cancelPendingImpressions()
  }

  window.addEventListener('popstate', onRouteChange)

  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history)

    window.history[method] = (
      ...args: Parameters<History['pushState']>
    ) => {
      onRouteChange()
      return original(...args)
    }
  }
}

const isSearchRoute = (): boolean =>
  window.location.pathname.includes('/search') ||
  window.location.search.includes('_q=')

const hasSearchQuery = (): boolean =>
  Boolean(new URLSearchParams(window.location.search).get('_q')?.trim())

/** VTEX search often hydrates without _q first, then updates URL — defer to avoid two list ids. */
const shouldDeferSearchImpression = (): boolean =>
  isSearchRoute() && !hasSearchQuery()

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
  if (pendingByList.size === 0 || flushInProgress) {
    return
  }

  flushInProgress = true
  const currentPageKey = getImpressionPageKey()

  try {
    let hasRemainingPending = false

    for (const [listId, entries] of pendingByList.entries()) {
      const ready: PendingEntry[] = []
      const stillPending: PendingEntry[] = []

      for (const entry of entries) {
        if (entry.pageKey !== currentPageKey) {
          continue
        }

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
        const sentProducts = getSentProductsForList(listId, currentPageKey)
        const newReady = ready.filter(
          (entry) => !sentProducts.has(getProductDedupeKey(entry.product))
        )

        if (newReady.length > 0) {
          const sorted = [...newReady].sort(
            (a, b) => a.product.index - b.product.index
          )

          const items = await Promise.all(
            sorted.map(async (entry) => {
              let catalog = null

              try {
                catalog = await fetchCatalogProduct(entry.product.slug)
              } catch (error) {
                log('catalog impression fetch failed', error)
              }

              return buildViewItem(entry.product, catalog)
            })
          )

          for (const entry of sorted) {
            sentProducts.add(getProductDedupeKey(entry.product))
          }

          const { listName } = sorted[0].product

          batchLogCount += 1

          const payload = buildViewItemListPayload(items, listId, listName)

          pushToDataLayer(payload)
        } else {
          log('skip view_item_list — no new products', listId)
        }
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
  } finally {
    flushInProgress = false
  }
}

const queueVisibleProduct = (productEl: HTMLElement) => {
  if (shouldDeferSearchImpression()) {
    return
  }

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

  batch.push({ product, el: productEl, pageKey: getImpressionPageKey() })
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
  cancelPendingImpressions()

  intersectionObserver?.disconnect()
  domObserver?.disconnect()
  intersectionObserver = null
  domObserver = null
  observedProducts.clear()
  loggedProductKeys.clear()
  sentProductsByListSession.clear()
  pendingByList.clear()
  clearCatalogCache()
  trackingActive = false
  batchLogCount = 0
}

const connectProductImpression = () => {
  if (!canUseDOM || trackingActive) {
    return
  }

  installNavigationWatcher()

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

  const pageKey = getImpressionPageKey()

  // Search/PLP often emit multiple vtex:pageView for the same URL while hydrating.
  if (pageKey === lastImpressionPageKey && trackingActive) {
    scanForProducts()
    return
  }

  lastImpressionPageKey = pageKey
  disconnectProductImpression()
  connectProductImpression()
}

export { registerProductImpression, disconnectProductImpression, cancelPendingImpressions }
