/**
 * Shared list context in localStorage for storefront (React) and checkout.
 * Key: aruma-gtm:checkout-list-context
 */

export const LIST_CONTEXT_STORAGE_KEY = 'aruma-gtm:checkout-list-context'
const MAX_PRODUCT_ENTRIES = 50

const PERSIST_EVENTS = new Set([
    'select_item',
    'view_item_list',
    'add_to_cart',
    'view_item',
])

export type ProductListContext = {
    listId: string
    listName: string
}

type ListContextStore = {
    last: ProductListContext | null
    byProduct: Record<string, ProductListContext>
}

const normalizeProductKey = (value: string): string => {
    try {
        return decodeURIComponent(value).trim().toLowerCase()
    } catch {
        return value.trim().toLowerCase()
    }
}

const normalizeListContext = (
    list: ProductListContext | null | undefined
): ProductListContext | null => {
    if (!list) {
        return null
    }

    const listId = String(list.listId || list.listName || '').trim()
    const listName = String(list.listName || list.listId || '').trim()

    if (!listId && !listName) {
        return null
    }

    return {
        listId: listId || listName,
        listName: listName || listId,
    }
}

const readStore = (): ListContextStore => {
    if (typeof window === 'undefined') {
        return { last: null, byProduct: {} }
    }

    try {
        const raw = window.localStorage.getItem(LIST_CONTEXT_STORAGE_KEY)

        if (raw) {
            return JSON.parse(raw) as ListContextStore
        }
    } catch {
        // localStorage unavailable or corrupt
    }

    return { last: null, byProduct: {} }
}

const writeStore = (store: ListContextStore) => {
    if (typeof window === 'undefined') {
        return
    }

    try {
        const keys = Object.keys(store.byProduct)

        if (keys.length > MAX_PRODUCT_ENTRIES) {
            const trimmed = keys.slice(-MAX_PRODUCT_ENTRIES)
            const byProduct: Record<string, ProductListContext> = {}

            for (const key of trimmed) {
                byProduct[key] = store.byProduct[key]
            }

            store.byProduct = byProduct
        }

        window.localStorage.setItem(
            LIST_CONTEXT_STORAGE_KEY,
            JSON.stringify(store)
        )
    } catch {
        // localStorage unavailable or full
    }
}

const readListFromItem = (
    item: Record<string, unknown>
): ProductListContext | null => {
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

const readListFromEcommerce = (
    payload: Record<string, unknown>
): ProductListContext | null => {
    const ecommerce = payload.ecommerce as Record<string, unknown> | undefined

    if (!ecommerce) {
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

const saveListContextForKeys = (
    keys: Array<string | undefined | null>,
    list: ProductListContext
) => {
    const normalized = normalizeListContext(list)

    if (!normalized) {
        return
    }

    const store = readStore()

    store.last = normalized

    for (const key of keys) {
        if (!key) {
            continue
        }

        const productKey = normalizeProductKey(String(key))

        if (productKey) {
            store.byProduct[productKey] = normalized
        }
    }

    writeStore(store)
}

export const saveListContextForProduct = ({
    productId,
    slug,
    listId,
    listName,
}: {
    productId?: string
    slug?: string
    listId: string
    listName: string
}) => {
    saveListContextForKeys([productId, slug], { listId, listName })
}

export const persistListContextFromPayload = (
    payload: Record<string, unknown>
) => {
    if (!PERSIST_EVENTS.has(String(payload.event))) {
        return
    }

    const ecommerceList = readListFromEcommerce(payload)
    const items = (payload.ecommerce as Record<string, unknown> | undefined)
        ?.items

    if (!Array.isArray(items) || !items.length) {
        if (ecommerceList) {
            const store = readStore()
            store.last = normalizeListContext(ecommerceList)
            writeStore(store)
        }

        return
    }

    for (const raw of items) {
        if (!raw || typeof raw !== 'object') {
            continue
        }

        const item = raw as Record<string, unknown>
        const itemList = readListFromItem(item) || ecommerceList

        if (!itemList) {
            continue
        }

        saveListContextForKeys([String(item.item_id ?? '')], itemList)
    }
}

export const getListContextFromStore = (
    slug: string,
    productId: string | undefined,
    fallback: ProductListContext
): ProductListContext => {
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

export const clearListContextStore = () => {
    if (typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.removeItem(LIST_CONTEXT_STORAGE_KEY)
    } catch {
        // localStorage unavailable
    }
}
