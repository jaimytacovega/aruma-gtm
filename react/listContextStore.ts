/**
 * Shared list context in localStorage for storefront (React) and checkout.
 * Key: aruma-gtm:checkout-list-context
 */

export const LIST_CONTEXT_STORAGE_KEY = 'aruma-gtm:checkout-list-context'
export const PENDING_NAV_LIST_CONTEXT_KEY = 'aruma-gtm:pending-product-list-context'
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

export type ProductListContext = {
    listId: string
    listName: string
}

const GENERIC_LIST_LABELS = new Set(['listing', 'list of products'])

export const isUnavailableListContext = (
    list: ProductListContext | null | undefined
): boolean => {
    if (!list) {
        return true
    }

    const listId = list.listId.trim().toLowerCase()
    const listName = list.listName.trim().toLowerCase()

    return (
        !listId ||
        !listName ||
        listId === '(not available)' ||
        listName === '(not available)'
    )
}

export const isGenericListContext = (
    list: ProductListContext | null | undefined
): boolean => {
    if (!list) {
        return true
    }

    const listId = list.listId.trim().toLowerCase()
    const listName = list.listName.trim().toLowerCase()

    return (
        GENERIC_LIST_LABELS.has(listId) ||
        GENERIC_LIST_LABELS.has(listName) ||
        listId.startsWith('shelf--') ||
        listName.startsWith('shelf--') ||
        /^shelf[a-z]/i.test(listId) ||
        /^shelf[a-z]/i.test(listName)
    )
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

    if (!normalized || isUnavailableListContext(normalized)) {
        return
    }

    const store = readStore()

    store.last = normalized

    for (const key of keys) {
        if (!key) {
            continue
        }

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
        if (ecommerceList && !isUnavailableListContext(ecommerceList)) {
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

        if (!itemList || isUnavailableListContext(itemList)) {
            continue
        }

        saveListContextForKeys(
            [String(item.item_id ?? ''), String(item.slug ?? '')],
            itemList
        )
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
    const candidates: ProductListContext[] = []

    if (slugKey && store.byProduct?.[slugKey]) {
        const normalized = normalizeListContext(store.byProduct[slugKey])

        if (normalized) {
            candidates.push(normalized)
        }
    }

    if (productIdKey && store.byProduct?.[productIdKey]) {
        const normalized = normalizeListContext(store.byProduct[productIdKey])

        if (normalized && !candidates.some((entry) => entry.listId === normalized.listId)) {
            candidates.push(normalized)
        }
    }

    const specific = candidates.filter(
        (entry) => !isGenericListContext(entry) && !isUnavailableListContext(entry)
    )

    if (specific.length) {
        return specific[0]
    }

    if (candidates.length) {
        return candidates[0]
    }

    if (store.last) {
        return normalizeListContext(store.last) ?? fallback
    }

    return fallback
}

type PendingNavListContext = ProductListContext & {
    slug?: string
    productId?: string
    savedAt: number
}

const productKeysMatch = (
    leftSlug: string,
    leftProductId: string,
    rightSlug?: string,
    rightProductId?: string
): boolean => {
    const slugKey = leftSlug ? normalizeProductKey(leftSlug) : ''
    const productIdKey = leftProductId
        ? normalizeProductKey(String(leftProductId))
        : ''
    const pendingSlugKey = rightSlug ? normalizeProductKey(rightSlug) : ''
    const pendingProductIdKey = rightProductId
        ? normalizeProductKey(String(rightProductId))
        : ''

    return Boolean(
        (slugKey && pendingSlugKey && slugKey === pendingSlugKey) ||
            (productIdKey &&
                pendingProductIdKey &&
                productIdKey === pendingProductIdKey)
    )
}

export const savePendingNavigationListContext = ({
    slug,
    productId,
    listId,
    listName,
}: {
    slug?: string
    productId?: string
    listId: string
    listName: string
}) => {
    saveListContextForProduct({ slug, productId, listId, listName })

    if (typeof window === 'undefined') {
        return
    }

    try {
        const payload: PendingNavListContext = {
            slug,
            productId,
            listId,
            listName,
            savedAt: Date.now(),
        }

        window.sessionStorage.setItem(
            PENDING_NAV_LIST_CONTEXT_KEY,
            JSON.stringify(payload)
        )
    } catch {
        // sessionStorage unavailable
    }
}

export const getPendingNavigationListContext = (
    slug: string,
    productId: string | undefined,
    fallback: ProductListContext
): ProductListContext => {
    if (typeof window === 'undefined') {
        return fallback
    }

    try {
        const raw = window.sessionStorage.getItem(PENDING_NAV_LIST_CONTEXT_KEY)

        if (!raw) {
            return fallback
        }

        const pending = JSON.parse(raw) as PendingNavListContext
        const age = Date.now() - Number(pending.savedAt ?? 0)

        if (!Number.isFinite(age) || age > PENDING_NAV_MAX_AGE_MS) {
            window.sessionStorage.removeItem(PENDING_NAV_LIST_CONTEXT_KEY)
            return fallback
        }

        if (!productKeysMatch(slug, productId ?? '', pending.slug, pending.productId)) {
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

export const clearListContextStore = () => {
    if (typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.removeItem(LIST_CONTEXT_STORAGE_KEY)
        window.sessionStorage.removeItem(PENDING_NAV_LIST_CONTEXT_KEY)
    } catch {
        // localStorage unavailable
    }
}
