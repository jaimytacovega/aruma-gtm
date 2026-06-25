/**
 * Shared list context in localStorage for storefront (React) and checkout.
 * Key: aruma-gtm:checkout-list-context
 */
;((global) => {
  const STORAGE_KEY = 'aruma-gtm:checkout-list-context'
  const PENDING_NAV_LIST_CONTEXT_KEY = 'aruma-gtm:pending-product-list-context'
  const MAX_PRODUCT_ENTRIES = 50
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
      GENERIC_LIST_LABELS.has(listId) || GENERIC_LIST_LABELS.has(listName)
    )
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

  const saveListContextForKeys = (keys, list) => {
    const normalized = normalizeListContext(list)

    if (!normalized || isUnavailableListContext(normalized)) {
      return
    }

    const store = readStore()

    store.last = normalized

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
          store.last = normalizeListContext(ecommerceList)
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

    const getListContextForProduct = ({ slug, productId }) => {
      const store = readStore()
      const slugKey = slug ? normalizeProductKey(slug) : ''
      const productIdKey = productId
        ? normalizeProductKey(String(productId))
        : ''

      if (slugKey && store.byProduct?.[slugKey]) {
        const normalized = normalizeListContext(store.byProduct[slugKey])

        if (normalized && !isGenericListContext(normalized) && !isUnavailableListContext(normalized)) {
          return normalized
        }
      }

      if (productIdKey && store.byProduct?.[productIdKey]) {
        const normalized = normalizeListContext(store.byProduct[productIdKey])

        if (normalized && !isGenericListContext(normalized) && !isUnavailableListContext(normalized)) {
          return normalized
        }
      }

      if (store.last) {
        const normalized = normalizeListContext(store.last)

        if (normalized && !isUnavailableListContext(normalized)) {
          return normalized
        }
      }

      return fallback
    }

    const clearListContextStore = () => {
      try {
        global.localStorage?.removeItem(STORAGE_KEY)
        global.sessionStorage?.removeItem(PENDING_NAV_LIST_CONTEXT_KEY)
      } catch {
        // localStorage unavailable
      }
    }

    return {
      STORAGE_KEY,
      PENDING_NAV_LIST_CONTEXT_KEY,
      persistListContextFromPayload,
      saveListContextForProduct,
      savePendingNavigationListContext,
      getListContextForProduct,
      clearListContextStore,
    }
  }
})(window)
