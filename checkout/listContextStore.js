/**
 * Shared list context in localStorage for storefront (React) and checkout.
 * Key: aruma-gtm:checkout-list-context
 */
;((global) => {
  const STORAGE_KEY = 'aruma-gtm:checkout-list-context'
  const PENDING_NAV_LIST_CONTEXT_KEY = 'aruma-gtm:pending-product-list-context'
  const CART_ITEM_LIST_CONTEXT_KEY = 'aruma-gtm:cart-item-list-context'
  const MAX_PRODUCT_ENTRIES = 50
  const MAX_CART_ITEM_LIST_ENTRIES = 100
  const PENDING_NAV_MAX_AGE_MS = 5 * 60 * 1000
  const PERSIST_EVENTS = new Set([
    'select_item',
    'view_item_list',
    'add_to_cart',
    'view_item',
    'add_payment_info',
    'add_shipping_info',
    'begin_checkout',
    'view_cart',
  ])

  const normalizeProductKey = (value) => {
    try {
      return decodeURIComponent(String(value)).trim().toLowerCase()
    } catch {
      return String(value).trim().toLowerCase()
    }
  }

  const normalizeListContext = (list) => {
    const listId = String(list?.listId || list?.listName || '').trim()
    const listName = String(list?.listName || list?.listId || '').trim()

    if (!listId && !listName) {
      return null
    }

    return {
      listId: listId || listName,
      listName: listName || listId,
    }
  }

  const GENERIC_LIST_LABELS = new Set(['listing', 'list of products'])
  const MAGENTA_POINTS_LIST_LABEL = 'magenta points'

  const isMagentaPointsListContext = (listId) =>
    String(listId ?? '')
      .trim()
      .toLowerCase() === MAGENTA_POINTS_LIST_LABEL

  const isUsableListContext = (list, options = {}) => {
    if (!list || isUnavailableListContext(list)) {
      return false
    }

    if (options.excludeMagentaPoints && isMagentaPointsListContext(list.listId)) {
      return false
    }

    return true
  }

  const isUnavailableListContext = (list) => {
    if (!list) {
      return true
    }

    const listId = String(list.listId || '').trim().toLowerCase()
    const listName = String(list.listName || '').trim().toLowerCase()

    return (
      !listId ||
      !listName ||
      listId === '(not available)' ||
      listName === '(not available)'
    )
  }

  const isGenericListContext = (list) => {
    if (!list) {
      return true
    }

    const listId = String(list.listId || '').trim().toLowerCase()
    const listName = String(list.listName || '').trim().toLowerCase()

    return (
      GENERIC_LIST_LABELS.has(listId) ||
      GENERIC_LIST_LABELS.has(listName) ||
      listId.startsWith('shelf--') ||
      listName.startsWith('shelf--') ||
      /^shelf[a-z]/i.test(listId) ||
      /^shelf[a-z]/i.test(listName)
    )
  }

  const LIST_CONTEXT_EVENTS = new Set([
    'select_item',
    'view_item_list',
    'add_to_cart',
    'view_item',
  ])

  const itemMatchesProduct = (item, slug, productId) => {
    if (!item || typeof item !== 'object') {
      return false
    }

    const slugKey = normalizeProductKey(slug)
    const productIdKey = productId
      ? normalizeProductKey(String(productId))
      : ''
    const itemId = normalizeProductKey(String(item.item_id ?? ''))

    return (
      itemId === slugKey || (productIdKey && itemId === productIdKey)
    )
  }

  const listEventMatchesProduct = (entry, slug, productId) => {
    const items = entry?.ecommerce?.items

    if (!Array.isArray(items)) {
      return false
    }

    return items.some((raw) => itemMatchesProduct(raw, slug, productId))
  }

  const readListContextForProductFromEntry = (entry, slug, productId) => {
    if (!listEventMatchesProduct(entry, slug, productId)) {
      return null
    }

    const items = entry?.ecommerce?.items

    if (Array.isArray(items)) {
      for (const raw of items) {
        if (!itemMatchesProduct(raw, slug, productId)) {
          continue
        }

        const fromItem = readListFromItem(raw)

        if (fromItem && !isUnavailableListContext(fromItem)) {
          return fromItem
        }
      }
    }

    const ecommerceList = readListFromEcommerce(entry)

    if (ecommerceList && !isUnavailableListContext(ecommerceList)) {
      return ecommerceList
    }

    return null
  }

  const listContextScore = (eventName, list) => {
    let score = 0

    if (
      eventName === 'select_item' ||
      eventName === 'add_to_cart' ||
      eventName === 'view_item'
    ) {
      score += 2
    }

    if (!isGenericListContext(list)) {
      score += 1
    }

    return score
  }

  const readStore = () => {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY)

      if (raw) {
        return JSON.parse(raw)
      }
    } catch {
      // localStorage unavailable or corrupt
    }

    return { last: null, byProduct: {} }
  }

  const writeStore = (store) => {
    try {
      const keys = Object.keys(store.byProduct || {})

      if (keys.length > MAX_PRODUCT_ENTRIES) {
        const trimmed = keys.slice(-MAX_PRODUCT_ENTRIES)
        const byProduct = {}

        for (const key of trimmed) {
          byProduct[key] = store.byProduct[key]
        }

        store.byProduct = byProduct
      }

      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      // localStorage unavailable or full
    }
  }

  const readListFromItem = (item) => {
    if (!item || typeof item !== 'object') {
      return null
    }

    const listName = String(item.item_list_name ?? '').trim()
    const listId = String(item.item_list_id ?? listName).trim()

    if (!listId && !listName) {
      return null
    }

    return {
      listId: listId || listName,
      listName: listName || listId,
    }
  }

  const readListFromEcommerce = (payload) => {
    const ecommerce = payload?.ecommerce

    if (!ecommerce || typeof ecommerce !== 'object') {
      return null
    }

    const listName = String(ecommerce.item_list_name ?? '').trim()
    const listId = String(ecommerce.item_list_id ?? listName).trim()

    if (!listId && !listName) {
      return null
    }

    return {
      listId: listId || listName,
      listName: listName || listId,
    }
  }

  const readCartItemListStore = () => {
    try {
      const raw = global.sessionStorage?.getItem(CART_ITEM_LIST_CONTEXT_KEY)

      if (raw) {
        return JSON.parse(raw)
      }
    } catch {
      // sessionStorage unavailable or corrupt
    }

    return {}
  }

  const writeCartItemListStore = (store) => {
    try {
      const keys = Object.keys(store || {})

      if (keys.length > MAX_CART_ITEM_LIST_ENTRIES) {
        const trimmed = keys.slice(-MAX_CART_ITEM_LIST_ENTRIES)
        const next = {}

        for (const key of trimmed) {
          next[key] = store[key]
        }

        store = next
      }

      global.sessionStorage?.setItem(
        CART_ITEM_LIST_CONTEXT_KEY,
        JSON.stringify(store)
      )
    } catch {
      // sessionStorage unavailable
    }
  }

  const saveCartItemListContext = ({ productId, slug, listId, listName }) => {
    const normalized = normalizeListContext({ listId, listName })

    if (!normalized || isUnavailableListContext(normalized)) {
      return
    }

    const store = readCartItemListStore()

    for (const key of [productId, slug]) {
      if (!key) {
        continue
      }

      const productKey = normalizeProductKey(String(key))

      if (!productKey) {
        continue
      }

      store[productKey] = normalized
    }

    writeCartItemListStore(store)
  }

  const getCartItemListContext = ({ slug, productId, excludeMagentaPoints }) => {
    const store = readCartItemListStore()
    const slugKey = slug ? normalizeProductKey(slug) : ''
    const productIdKey = productId
      ? normalizeProductKey(String(productId))
      : ''
    const options = { excludeMagentaPoints: Boolean(excludeMagentaPoints) }

    for (const key of [slugKey, productIdKey]) {
      if (!key || !store[key]) {
        continue
      }

      const normalized = normalizeListContext(store[key])

      if (isUsableListContext(normalized, options)) {
        return normalized
      }
    }

    return null
  }

  const saveListContextForKeys = (keys, list) => {
    const normalized = normalizeListContext(list)

    if (!normalized || isUnavailableListContext(normalized)) {
      return
    }

    const store = readStore()

    if (!isMagentaPointsListContext(normalized.listId)) {
      store.last = normalized
    }

    for (const key of keys) {
      const productKey = normalizeProductKey(String(key))

      if (!productKey) {
        continue
      }

      const existing = store.byProduct[productKey]

      if (
        existing &&
        isGenericListContext(normalized) &&
        !isGenericListContext(existing)
      ) {
        continue
      }

      store.byProduct[productKey] = normalized
    }

    writeStore(store)
  }

  global.createListContextStore = (NOT_AVAILABLE) => {
    const fallback = {
      listId: NOT_AVAILABLE,
      listName: NOT_AVAILABLE,
    }

    const saveListContextForProduct = ({ productId, slug, listId, listName }) => {
      saveListContextForKeys(
        [productId, slug].filter(Boolean),
        { listId, listName }
      )
      saveCartItemListContext({ productId, slug, listId, listName })
    }

    const persistListContextFromPayload = (payload) => {
      if (!payload || !PERSIST_EVENTS.has(String(payload.event))) {
        return
      }

      const ecommerceList = readListFromEcommerce(payload)
      const items = payload.ecommerce?.items

      if (!Array.isArray(items) || !items.length) {
        if (ecommerceList && !isUnavailableListContext(ecommerceList)) {
          const store = readStore()
          const normalized = normalizeListContext(ecommerceList)

          if (normalized && !isMagentaPointsListContext(normalized.listId)) {
            store.last = normalized
          }

          writeStore(store)
        }

        return
      }

      for (const raw of items) {
        const itemList = readListFromItem(raw) || ecommerceList

        if (!itemList || isUnavailableListContext(itemList)) {
          continue
        }

        saveListContextForKeys([raw.item_id, raw.slug].filter(Boolean), itemList)
      }
    }

    const productKeysMatch = (leftSlug, leftProductId, rightSlug, rightProductId) => {
      const slugKey = leftSlug ? normalizeProductKey(leftSlug) : ''
      const productIdKey = leftProductId
        ? normalizeProductKey(String(leftProductId))
        : ''
      const pendingSlugKey = rightSlug ? normalizeProductKey(rightSlug) : ''
      const pendingProductIdKey = rightProductId
        ? normalizeProductKey(String(rightProductId))
        : ''

      return (
        (slugKey && pendingSlugKey && slugKey === pendingSlugKey) ||
        (productIdKey &&
          pendingProductIdKey &&
          productIdKey === pendingProductIdKey)
      )
    }

    const savePendingNavigationListContext = ({
      slug,
      productId,
      listId,
      listName,
    }) => {
      saveListContextForProduct({ slug, productId, listId, listName })

      try {
        global.sessionStorage?.setItem(
          PENDING_NAV_LIST_CONTEXT_KEY,
          JSON.stringify({
            slug,
            productId,
            listId,
            listName,
            savedAt: Date.now(),
          })
        )
      } catch {
        // sessionStorage unavailable
      }
    }

    const getListContextFromStore = ({
      slug,
      productId,
      excludeMagentaPoints = false,
      allowLastFallback = false,
    }) => {
      const store = readStore()
      const slugKey = slug ? normalizeProductKey(slug) : ''
      const productIdKey = productId
        ? normalizeProductKey(String(productId))
        : ''
      const options = { excludeMagentaPoints: Boolean(excludeMagentaPoints) }
      const candidates = []

      if (slugKey && store.byProduct?.[slugKey]) {
        const normalized = normalizeListContext(store.byProduct[slugKey])

        if (isUsableListContext(normalized, options)) {
          candidates.push(normalized)
        }
      }

      if (productIdKey && store.byProduct?.[productIdKey]) {
        const normalized = normalizeListContext(store.byProduct[productIdKey])

        if (
          isUsableListContext(normalized, options) &&
          !candidates.some((entry) => entry.listId === normalized.listId)
        ) {
          candidates.push(normalized)
        }
      }

      const specific = candidates.filter(
        (entry) =>
          !isGenericListContext(entry) && !isUnavailableListContext(entry)
      )

      if (specific.length) {
        return specific[0]
      }

      if (candidates.length) {
        return candidates[0]
      }

      if (allowLastFallback && store.last) {
        const normalized = normalizeListContext(store.last)

        if (isUsableListContext(normalized, options)) {
          return normalized
        }
      }

      return fallback
    }

    const getPendingNavigationListContext = ({ slug, productId }) => {
      try {
        const raw = global.sessionStorage?.getItem(PENDING_NAV_LIST_CONTEXT_KEY)

        if (!raw) {
          return fallback
        }

        const pending = JSON.parse(raw)
        const age = Date.now() - Number(pending.savedAt ?? 0)

        if (!Number.isFinite(age) || age > PENDING_NAV_MAX_AGE_MS) {
          global.sessionStorage?.removeItem(PENDING_NAV_LIST_CONTEXT_KEY)
          return fallback
        }

        if (
          !productKeysMatch(
            slug,
            productId ?? '',
            pending.slug,
            pending.productId
          )
        ) {
          return fallback
        }

        const normalized = normalizeListContext(pending)

        if (!normalized || isUnavailableListContext(normalized)) {
          return fallback
        }

        return normalized
      } catch {
        return fallback
      }
    }

    const getListFromDataLayer = ({ slug, productId }) => {
      const dataLayer = global.dataLayer || []
      let bestProductMatch = null
      let bestProductScore = -1

      for (let index = dataLayer.length - 1; index >= 0; index -= 1) {
        const entry = dataLayer[index]

        if (
          !entry ||
          entry.arumaGtm !== true ||
          !LIST_CONTEXT_EVENTS.has(String(entry.event))
        ) {
          continue
        }

        const productList = readListContextForProductFromEntry(
          entry,
          slug,
          productId
        )

        if (!productList) {
          continue
        }

        const score = listContextScore(String(entry.event), productList)

        if (score > bestProductScore) {
          bestProductScore = score
          bestProductMatch = productList
        }
      }

      return { bestProductMatch }
    }

    const resolveListContextForProduct = ({
      slug,
      productId,
      excludeMagentaPoints = true,
    }) => {
      const lookupOptions = { excludeMagentaPoints: Boolean(excludeMagentaPoints) }

      const fromCartSession = getCartItemListContext({
        slug,
        productId,
        excludeMagentaPoints,
      })

      if (fromCartSession) {
        return fromCartSession
      }

      const { bestProductMatch } = getListFromDataLayer({
        slug,
        productId,
      })

      if (
        bestProductMatch &&
        isUsableListContext(bestProductMatch, lookupOptions)
      ) {
        return bestProductMatch
      }

      const fromPendingNav = getPendingNavigationListContext({ slug, productId })

      if (isUsableListContext(fromPendingNav, lookupOptions)) {
        return fromPendingNav
      }

      const fromStore = getListContextFromStore({
        slug,
        productId,
        excludeMagentaPoints,
        allowLastFallback: excludeMagentaPoints,
      })

      if (
        !isGenericListContext(fromStore) &&
        isUsableListContext(fromStore, lookupOptions)
      ) {
        return fromStore
      }

      return fromStore
    }

    const getListContextForProduct = resolveListContextForProduct

    const clearListContextStore = () => {
      try {
        global.localStorage?.removeItem(STORAGE_KEY)
        global.sessionStorage?.removeItem(PENDING_NAV_LIST_CONTEXT_KEY)
        global.sessionStorage?.removeItem(CART_ITEM_LIST_CONTEXT_KEY)
      } catch {
        // localStorage unavailable
      }
    }

    return {
      STORAGE_KEY,
      PENDING_NAV_LIST_CONTEXT_KEY,
      CART_ITEM_LIST_CONTEXT_KEY,
      persistListContextFromPayload,
      saveListContextForProduct,
      savePendingNavigationListContext,
      getCartItemListContext,
      getListContextFromStore,
      getListContextForProduct,
      resolveListContextForProduct,
      clearListContextStore,
    }
  }
})(window)
