/**
 * Checkout "Te puede interesar" carousel: view_item_list, select_item, add_to_cart.
 * Paste after checkoutCartItems.js.
 */
;((global) => {
  const ROOT_SELECTOR = '.productos-recomendados'
  const CARD_SELECTOR = `${ROOT_SELECTOR} .item.item-recomendado`
  const ADD_BTN_SELECTOR = '.boton-agregar-recomendado'
  const LIST_TITLE_DEFAULT = 'Te puede interesar'
  const BATCH_DEBOUNCE_MS = 200
  const ACTIVE_SLIDE_SCAN_DELAY_MS = 350
  const ADD_PENDING_TIMEOUT_MS = 8000
  const ADD_POLL_INTERVAL_MS = 250
  const CHECKOUT_IMPRESSION_SESSION_KEY =
    'aruma-gtm:checkout-recommended-impressions'

  const parsePrice = (value) => {
    const cleaned = String(value ?? '')
      .replace(/[^\d.,]/g, '')
      .replace(',', '.')

    if (!cleaned) {
      return 0
    }

    const parsed = Number.parseFloat(cleaned)

    return Number.isFinite(parsed) ? parsed : 0
  }

  const getHrefFromCard = (card) => {
    const link = card.querySelector('a[href*="/p"]')

    if (link instanceof HTMLAnchorElement && link.href) {
      return link.href
    }

    return link?.getAttribute('href') ?? ''
  }

  const getSlugFromHref = (href, getSlugFromDetailUrl) => {
    if (!href) {
      return ''
    }

    try {
      const path = href.startsWith('http')
        ? new URL(href).pathname
        : href.split('?')[0]
      const match = path.match(/\/([^/]+)\/p\/?$/)

      return match?.[1] ?? getSlugFromDetailUrl(path)
    } catch {
      return ''
    }
  }

  const getListTitle = (card, normalizeText) => {
    const root = card.closest(ROOT_SELECTOR)
    const title = normalizeText(root?.querySelector('h1')?.textContent)

    return title || LIST_TITLE_DEFAULT
  }

  const getProductIdFromCard = (card) => {
    const button = card.querySelector(ADD_BTN_SELECTOR)
    const fromData = button?.getAttribute('data-id')

    if (fromData) {
      return fromData
    }

    const numericClass = Array.from(card.classList).find((name) => /^\d+$/.test(name))

    return numericClass ?? ''
  }

  const isInteractiveCard = (card) => {
    const owlItem = card.closest('.owl-item')

    if (!(owlItem instanceof HTMLElement)) {
      return true
    }

    if (owlItem.classList.contains('active')) {
      return true
    }

    return !owlItem.classList.contains('cloned')
  }

  const isActiveSlideCard = (card) => {
    const owlItem = card.closest('.owl-item')

    if (!(owlItem instanceof HTMLElement)) {
      return true
    }

    return owlItem.classList.contains('active')
  }

  const getCardIndex = (card, listRoot, getSlugFromDetailUrl) => {
    const slug = getSlugFromHref(getHrefFromCard(card), getSlugFromDetailUrl)

    if (!slug) {
      return 0
    }

    const cards = Array.from(
      listRoot.querySelectorAll('.item.item-recomendado')
    ).filter((entry) => {
      const owlItem = entry.closest('.owl-item')

      return !owlItem?.classList.contains('cloned')
    })

    for (let index = 0; index < cards.length; index += 1) {
      const entrySlug = getSlugFromHref(
        getHrefFromCard(cards[index]),
        getSlugFromDetailUrl
      )

      if (entrySlug === slug) {
        return index + 1
      }
    }

    return 0
  }

  const buildVisibleProduct = (card, normalizeText, getSlugFromDetailUrl) => {
    const slug = getSlugFromHref(getHrefFromCard(card), getSlugFromDetailUrl)

    if (!slug) {
      return null
    }

    const listRoot = card.closest(ROOT_SELECTOR) ?? card
    const listLabel = getListTitle(card, normalizeText)
    const nameEl = card.querySelector('.nombre-recomendado p')

    const name =
      normalizeText(nameEl?.getAttribute('title')) ||
      normalizeText(nameEl?.textContent) ||
      slug

    const brand = normalizeText(
      card.querySelector('.marca-recomendado p')?.textContent
    )
    const listPrice = parsePrice(
      card.querySelector('.precio-lista-recomendado p')?.textContent
    )
    const price = parsePrice(card.querySelector('.precio-recomendado p')?.textContent)

    return {
      slug,
      name,
      brand,
      price: price || listPrice,
      listPrice: listPrice || price,
      index: getCardIndex(card, listRoot, getSlugFromDetailUrl),
      listId: listLabel,
      listName: listLabel,
      productId: getProductIdFromCard(card),
      quantity: 1,
    }
  }

  const getCardFromTarget = (target) => {
    const card = target.closest(CARD_SELECTOR)

    if (!(card instanceof HTMLElement) || !isInteractiveCard(card)) {
      return null
    }

    return card
  }

  const getAddButtonFromTarget = (target) => {
    const button = target.closest(ADD_BTN_SELECTOR)

    if (!(button instanceof HTMLElement)) {
      return null
    }

    if (!button.closest(ROOT_SELECTOR)) {
      return null
    }

    return button
  }

  const snapshotQuantities = (orderForm) => {
    const bySku = new Map()
    const byProductId = new Map()

    ;(orderForm.items || []).forEach((item) => {
      const skuKey = String(item.id ?? '')

      if (skuKey) {
        bySku.set(skuKey, item.quantity ?? 0)
      }

      const productId = String(item.productId ?? '')

      if (productId) {
        byProductId.set(productId, item.quantity ?? 0)
      }
    })

    return { bySku, byProductId }
  }

  const itemMatchesProductId = (item, productId) =>
    Boolean(productId && String(item.productId ?? '') === productId)

  const itemMatchesSlugHint = (item, slugHint, getSlugFromDetailUrl) => {
    if (!slugHint) {
      return false
    }

    const slugKey = slugHint.toLowerCase()
    const detailUrl = String(item.detailUrl ?? '').toLowerCase()

    return (
      detailUrl.includes(`/${slugKey}/p`) ||
      getSlugFromDetailUrl(item.detailUrl).toLowerCase() === slugKey
    )
  }

  const findIncreasedItem = (
    snapshot,
    orderForm,
    productId,
    slugHint,
    getSlugFromDetailUrl
  ) => {
    const increases = []

    for (const item of orderForm.items || []) {
      const skuKey = String(item.id ?? '')
      const before = snapshot.bySku.get(skuKey)
      const quantity = item.quantity ?? 0

      if (!skuKey || quantity <= 0) {
        continue
      }

      if (before === undefined) {
        increases.push({ item, addedQty: quantity })
        continue
      }

      if (quantity > before) {
        increases.push({ item, addedQty: quantity - before })
      }
    }

    if (!increases.length) {
      return null
    }

    if (productId) {
      const productMatch = increases.find((entry) =>
        itemMatchesProductId(entry.item, productId)
      )

      if (productMatch) {
        return productMatch
      }
    }

    if (slugHint) {
      const slugMatch = increases.find((entry) =>
        itemMatchesSlugHint(entry.item, slugHint, getSlugFromDetailUrl)
      )

      if (slugMatch) {
        return slugMatch
      }
    }

    if (increases.length === 1) {
      return increases[0]
    }

    return null
  }

  global.createRecommendedCarousel = ({
    isCheckoutPage,
    pushToDataLayer,
    listContextStore,
    cartItems,
    orderFormUtils,
    normalizeText,
  }) => {
    const {
      buildViewItem,
      fetchCatalogProduct,
      getSlugFromDetailUrl,
      buildViewItemListPayload,
      buildSelectItemPayload,
      buildAddToCartPayload,
      enrichOrderFormItems,
    } = cartItems

    let attached = false
    let domObserver = null
    let owlClassObserver = null
    let activeSlideScanTimer = null
    let boundCarouselRoot = null
    const observedOwlItems = new Set()
    const loggedSlugs = new Set()
    const pendingByList = new Map()
    let batchFlushTimer = null
    let flushInProgress = false

    let pendingAdd = null
    let addInFlight = false

    const getDedupeKey = (visible) => `${visible.listId}:${visible.slug}`

    const loadLoggedSlugs = () => {
      try {
        const raw = global.sessionStorage?.getItem(CHECKOUT_IMPRESSION_SESSION_KEY)

        if (!raw) {
          return
        }

        const keys = JSON.parse(raw)

        if (!Array.isArray(keys)) {
          return
        }

        for (const key of keys) {
          if (typeof key === 'string' && key) {
            loggedSlugs.add(key)
          }
        }
      } catch {
        // sessionStorage unavailable or corrupt
      }
    }

    const persistLoggedSlugs = () => {
      try {
        global.sessionStorage?.setItem(
          CHECKOUT_IMPRESSION_SESSION_KEY,
          JSON.stringify([...loggedSlugs])
        )
      } catch {
        // sessionStorage unavailable
      }
    }

    const clearCheckoutImpressionSession = () => {
      loggedSlugs.clear()

      try {
        global.sessionStorage?.removeItem(CHECKOUT_IMPRESSION_SESSION_KEY)
      } catch {
        // sessionStorage unavailable
      }
    }

    const clearPendingImpressions = () => {
      if (batchFlushTimer) {
        global.clearTimeout(batchFlushTimer)
        batchFlushTimer = null
      }

      pendingByList.clear()
    }

    const onCheckoutNavigation = () => {
      clearPendingImpressions()

      if (!isCheckoutPage()) {
        clearCheckoutImpressionSession()
        return
      }

      scanCarousel()
    }

    const saveListContext = (visible) => {
      listContextStore.saveListContextForProduct({
        slug: visible.slug,
        productId: visible.productId,
        listId: visible.listId,
        listName: visible.listName,
      })
    }

    const enrichVisibleProduct = async (visible) => {
      let catalog = null

      try {
        catalog = await fetchCatalogProduct(visible.slug)
      } catch {
        catalog = null
      }

      return buildViewItem(visible, catalog)
    }

    const flushPendingBatches = async () => {
      if (!pendingByList.size || flushInProgress) {
        return
      }

      flushInProgress = true

      try {
        for (const [listId, entries] of pendingByList.entries()) {
          const visibleProducts = entries
            .filter((entry) => entry.el.isConnected)
            .map((entry) => entry.visible)

          if (!visibleProducts.length) {
            continue
          }

          const items = await Promise.all(
            visibleProducts.map((visible) => enrichVisibleProduct(visible))
          )
          const listName = visibleProducts[0].listName

          pushToDataLayer(buildViewItemListPayload(items, listId, listName))
        }
      } finally {
        pendingByList.clear()
        flushInProgress = false
      }
    }

    const scheduleBatchFlush = () => {
      if (batchFlushTimer) {
        global.clearTimeout(batchFlushTimer)
      }

      batchFlushTimer = global.setTimeout(() => {
        batchFlushTimer = null
        void flushPendingBatches()
      }, BATCH_DEBOUNCE_MS)
    }

    const queueImpression = (card, visible) => {
      const dedupeKey = getDedupeKey(visible)

      if (loggedSlugs.has(dedupeKey)) {
        return
      }

      loggedSlugs.add(dedupeKey)
      persistLoggedSlugs()

      const batch = pendingByList.get(visible.listId) ?? []

      batch.push({ el: card, visible })
      pendingByList.set(visible.listId, batch)
      scheduleBatchFlush()
    }

    const observeOwlItems = (root) => {
      if (!owlClassObserver) {
        owlClassObserver = new MutationObserver((mutations) => {
          const classChanged = mutations.some(
            (mutation) =>
              mutation.type === 'attributes' &&
              mutation.attributeName === 'class' &&
              mutation.target instanceof HTMLElement &&
              mutation.target.classList.contains('owl-item')
          )

          if (classChanged) {
            scheduleActiveSlideScan()
          }
        })
      }

      root.querySelectorAll('.owl-item').forEach((item) => {
        if (observedOwlItems.has(item)) {
          return
        }

        observedOwlItems.add(item)
        owlClassObserver.observe(item, {
          attributes: true,
          attributeFilter: ['class'],
        })
      })
    }

    const scheduleActiveSlideScan = () => {
      if (activeSlideScanTimer) {
        global.clearTimeout(activeSlideScanTimer)
      }

      activeSlideScanTimer = global.setTimeout(() => {
        activeSlideScanTimer = null
        scanActiveSlides()
      }, ACTIVE_SLIDE_SCAN_DELAY_MS)
    }

    const scanActiveSlides = () => {
      if (!isCheckoutPage()) {
        return
      }

      const root = global.document.querySelector(ROOT_SELECTOR)

      if (!root) {
        return
      }

      root
        .querySelectorAll('.owl-item.active .item.item-recomendado')
        .forEach((card) => {
          if (!(card instanceof HTMLElement) || !isActiveSlideCard(card)) {
            return
          }

          const visible = buildVisibleProduct(
            card,
            normalizeText,
            getSlugFromDetailUrl
          )

          if (!visible) {
            return
          }

          queueImpression(card, visible)
        })
    }

    const bindCarouselControls = (root) => {
      if (boundCarouselRoot === root) {
        return
      }

      if (boundCarouselRoot) {
        boundCarouselRoot.removeEventListener('click', onCarouselControlClick, true)
      }

      boundCarouselRoot = root
      root.addEventListener('click', onCarouselControlClick, true)

      const carousel = root.querySelector('.owl-carousel')

      if (carousel && global.jQuery) {
        global
          .jQuery(carousel)
          .off('changed.owl.carousel.arumaGtm translated.owl.carousel.arumaGtm')
          .on(
            'changed.owl.carousel.arumaGtm translated.owl.carousel.arumaGtm',
            () => {
              scheduleActiveSlideScan()
            }
          )
      }
    }

    const onCarouselControlClick = (event) => {
      if (!(event.target instanceof Element)) {
        return
      }

      if (
        event.target.closest('.owl-prev, .owl-next, .owl-dot, .owl-nav, .owl-dots')
      ) {
        scheduleActiveSlideScan()
      }
    }

    const scanCarousel = () => {
      if (!isCheckoutPage()) {
        return
      }

      const root = global.document.querySelector(ROOT_SELECTOR)

      if (!root) {
        return
      }

      observeOwlItems(root)
      bindCarouselControls(root)
      scanActiveSlides()
    }

    const fireSelectItem = async (card) => {
      const visible = buildVisibleProduct(card, normalizeText, getSlugFromDetailUrl)

      if (!visible) {
        return
      }

      saveListContext(visible)

      const item = await enrichVisibleProduct(visible)

      pushToDataLayer(buildSelectItemPayload(item))
    }

    const clearPendingAdd = () => {
      pendingAdd = null
    }

    const runRecommendedAddToCart = async (orderFormOverride) => {
      if (!pendingAdd || addInFlight) {
        return
      }

      const orderForm =
        orderFormOverride ??
        (await new Promise((resolve) => {
          const checkout = global.vtexjs?.checkout

          if (!checkout?.getOrderForm) {
            resolve(null)
            return
          }

          checkout.getOrderForm().done(resolve).fail(() => resolve(null))
        }))

      if (!orderForm) {
        return
      }

      const result = findIncreasedItem(
        pendingAdd.snapshot,
        orderForm,
        pendingAdd.productId,
        pendingAdd.slugHint,
        getSlugFromDetailUrl
      )

      if (!result || result.addedQty <= 0) {
        return
      }

      clearPendingAdd()
      addInFlight = true

      try {
        const itemForEnrich = { ...result.item, quantity: result.addedQty }
        const items = await enrichOrderFormItems([itemForEnrich], orderFormUtils)
        const currency = orderFormUtils.getCurrency(orderForm)

        pushToDataLayer(buildAddToCartPayload(items, currency))
      } finally {
        addInFlight = false
      }
    }

    const watchOrderFormAfterAddClick = () => {
      const startedAt = Date.now()

      const poll = async () => {
        if (!pendingAdd) {
          return
        }

        await runRecommendedAddToCart()

        if (!pendingAdd) {
          return
        }

        if (Date.now() - startedAt >= ADD_PENDING_TIMEOUT_MS) {
          clearPendingAdd()
          return
        }

        global.setTimeout(() => {
          void poll()
        }, ADD_POLL_INTERVAL_MS)
      }

      void poll()
    }

    const onRecommendedAddClick = async (button) => {
      if (pendingAdd || addInFlight) {
        return
      }

      const card = button.closest('.item.item-recomendado')

      if (!(card instanceof HTMLElement)) {
        return
      }

      const visible = buildVisibleProduct(card, normalizeText, getSlugFromDetailUrl)

      if (!visible?.productId) {
        return
      }

      saveListContext(visible)

      const checkout = global.vtexjs?.checkout

      if (!checkout?.getOrderForm) {
        return
      }

      checkout.getOrderForm().done((orderForm) => {
        pendingAdd = {
          snapshot: snapshotQuantities(orderForm),
          productId: visible.productId,
          slugHint: visible.slug,
          startedAt: Date.now(),
        }

        watchOrderFormAfterAddClick()
      })
    }

    const onDocumentClick = (event) => {
      if (!isCheckoutPage()) {
        return
      }

      if (!(event.target instanceof Element)) {
        return
      }

      const addButton = getAddButtonFromTarget(event.target)

      if (addButton) {
        const card = addButton.closest('.item.item-recomendado')

        if (card instanceof HTMLElement) {
          void fireSelectItem(card)
        }

        void onRecommendedAddClick(addButton)
        return
      }

      const card = getCardFromTarget(event.target)

      if (!card) {
        return
      }

      if (event.target.closest(ADD_BTN_SELECTOR)) {
        return
      }

      void fireSelectItem(card)
    }

    const onOrderFormUpdated = (_, orderForm) => {
      if (!isCheckoutPage() || !pendingAdd) {
        return
      }

      void runRecommendedAddToCart(orderForm)
    }

    const attach = () => {
      if (attached || typeof global.document === 'undefined') {
        return
      }

      loadLoggedSlugs()

      domObserver = new MutationObserver(() => {
        scanCarousel()
      })

      domObserver.observe(global.document.body, {
        childList: true,
        subtree: true,
      })

      global.document.addEventListener('click', onDocumentClick, true)
      global.addEventListener('hashchange', onCheckoutNavigation)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', onOrderFormUpdated)
      }

      scanCarousel()
      attached = true
    }

    return attach
  }
})(window)
