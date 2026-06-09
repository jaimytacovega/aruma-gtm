/**
 * Shared list context in localStorage for storefront (React) and checkout.
 * Key: aruma-gtm:checkout-list-context
 */
;((global) => {
  const STORAGE_KEY = 'aruma-gtm:checkout-list-context'
  const MAX_PRODUCT_ENTRIES = 50
  const PERSIST_EVENTS = new Set([
    'select_item',
    'view_item_list',
    'add_to_cart',
    'view_item',
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

    if (!normalized) {
      return
    }

    const store = readStore()

    store.last = normalized

    for (const key of keys) {
      const productKey = normalizeProductKey(String(key))

      if (productKey) {
        store.byProduct[productKey] = normalized
      }
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
        if (ecommerceList) {
          const store = readStore()
          store.last = normalizeListContext(ecommerceList)
          writeStore(store)
        }

        return
      }

      for (const raw of items) {
        const itemList = readListFromItem(raw) || ecommerceList

        if (!itemList) {
          continue
        }

        saveListContextForKeys([raw.item_id], itemList)
      }
    }

    const getListContextForProduct = ({ slug, productId }) => {
      const store = readStore()
      const slugKey = slug ? normalizeProductKey(slug) : ''
      const productIdKey = productId
        ? normalizeProductKey(String(productId))
        : ''

      if (slugKey && store.byProduct?.[slugKey]) {
        return normalizeListContext(store.byProduct[slugKey]) ?? fallback
      }

      if (productIdKey && store.byProduct?.[productIdKey]) {
        return normalizeListContext(store.byProduct[productIdKey]) ?? fallback
      }

      if (store.last) {
        return normalizeListContext(store.last) ?? fallback
      }

      return fallback
    }

    const clearListContextStore = () => {
      try {
        global.localStorage?.removeItem(STORAGE_KEY)
      } catch {
        // localStorage unavailable
      }
    }

    return {
      STORAGE_KEY,
      persistListContextFromPayload,
      saveListContextForProduct,
      getListContextForProduct,
      clearListContextStore,
    }
  }
})(window)
