import { canUseDOM } from 'vtex.render-runtime'

const log = (...args: unknown[]) => console.info('[aruma-gtm]', ...args)
const NOT_AVAILABLE = '(not available)'

/** Modal actions only — emailAndPasswordForm wraps the whole login app incl. header trigger. */
const LOGIN_MODAL_INTERACTION_SELECTOR = [
    '[class*="aruma-login-0-x-sendButton"]',
    '[class*="aruma-login-0-x-formForgotPassword"]',
].join(', ')

const isInsideLoginModalInteraction = (target: Element): boolean =>
    Boolean(target.closest(LOGIN_MODAL_INTERACTION_SELECTOR))

type ProductListContext = {
    listId: string
    listName: string
}

const normalizeProductKey = (value: string): string => {
    try {
        return decodeURIComponent(value).trim().toLowerCase()
    } catch {
        return value.trim().toLowerCase()
    }
}

const selectItemMatchesProduct = (
    entry: Record<string, unknown>,
    slug: string,
    productId?: string
): boolean => {
    const ecommerce = entry.ecommerce as Record<string, unknown> | undefined
    const items = ecommerce?.items

    if (!Array.isArray(items)) {
        return false
    }

    const slugKey = normalizeProductKey(slug)
    const productIdKey = productId
        ? normalizeProductKey(String(productId))
        : ''

    for (const raw of items) {
        if (!raw || typeof raw !== 'object') {
            continue
        }

        const item = raw as Record<string, unknown>
        const itemId = normalizeProductKey(String(item.item_id ?? ''))

        if (itemId === slugKey || (productIdKey && itemId === productIdKey)) {
            return true
        }
    }

    return false
}

const readSelectItemList = (
    entry: Record<string, unknown>
): ProductListContext | null => {
    const ecommerce = entry.ecommerce as Record<string, unknown> | undefined

    if (!ecommerce) {
        return null
    }

    const listName = String(ecommerce.item_list_name ?? '').trim()
    const listId = String(ecommerce.item_list_id ?? listName).trim()

    if (!listName && !listId) {
        return null
    }

    return {
        listId: listId || listName,
        listName: listName || listId,
    }
}

/** PDP list context: last select_item for this product, else last select_item, else fallback. */
const getListFromLastSelectItem = (
    slug: string,
    productId?: string,
    fallback: ProductListContext = {
        listId: NOT_AVAILABLE,
        listName: NOT_AVAILABLE,
    }
): ProductListContext => {
    if (!canUseDOM) {
        return fallback
    }

    window.dataLayer = window.dataLayer || []
    let lastSelectItemList: ProductListContext | null = null

    for (let index = window.dataLayer.length - 1; index >= 0; index -= 1) {
        const entry = window.dataLayer[index]

        if (!entry || entry.event !== 'select_item') {
            continue
        }

        const list = readSelectItemList(entry)

        if (!list) {
            continue
        }

        if (!lastSelectItemList) {
            lastSelectItemList = list
        }

        if (selectItemMatchesProduct(entry, slug, productId)) {
            return list
        }
    }

    return lastSelectItemList ?? fallback
}

const CHECKOUT_LIST_CONTEXT_KEY = 'aruma-gtm:checkout-list-context'
const MAX_CHECKOUT_PRODUCT_ENTRIES = 50

type CheckoutListContextStore = {
    last: ProductListContext | null
    byProduct: Record<string, ProductListContext>
}

const readCheckoutListStore = (): CheckoutListContextStore => {
    try {
        const raw = window.localStorage.getItem(CHECKOUT_LIST_CONTEXT_KEY)

        if (raw) {
            return JSON.parse(raw) as CheckoutListContextStore
        }
    } catch {
        // localStorage unavailable or corrupt
    }

    return { last: null, byProduct: {} }
}

const writeCheckoutListStore = (store: CheckoutListContextStore) => {
    try {
        const keys = Object.keys(store.byProduct)

        if (keys.length > MAX_CHECKOUT_PRODUCT_ENTRIES) {
            const trimmed = keys.slice(-MAX_CHECKOUT_PRODUCT_ENTRIES)
            const byProduct: Record<string, ProductListContext> = {}

            for (const key of trimmed) {
                byProduct[key] = store.byProduct[key]
            }

            store.byProduct = byProduct
        }

        window.localStorage.setItem(
            CHECKOUT_LIST_CONTEXT_KEY,
            JSON.stringify(store)
        )
    } catch {
        // localStorage unavailable or full
    }
}

/** Storefront select_item → localStorage for checkout cart +/- after full page reload. */
const persistSelectItemForCheckout = (payload: Record<string, unknown>) => {
    if (payload.event !== 'select_item') {
        return
    }

    const list = readSelectItemList(payload)

    if (!list) {
        return
    }

    const store = readCheckoutListStore()
    const value = list.listName || list.listId

    store.last = {
        listId: value,
        listName: value,
    }

    const items = (payload.ecommerce as Record<string, unknown> | undefined)?.items

    if (Array.isArray(items)) {
        for (const raw of items) {
            if (!raw || typeof raw !== 'object') {
                continue
            }

            const item = raw as Record<string, unknown>
            const productKey = normalizeProductKey(String(item.item_id ?? ''))

            if (productKey) {
                store.byProduct[productKey] = store.last
            }
        }
    }

    writeCheckoutListStore(store)
}

const pushToDataLayer = (payload: Record<string, unknown>, disableLog: boolean = false) => {
    if (!canUseDOM) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(payload)
    persistSelectItemForCheckout(payload)
    if (!disableLog) {
        log(JSON.stringify(payload))
    }
}

export {
    pushToDataLayer,
    getListFromLastSelectItem,
    log,
    isInsideLoginModalInteraction,
    NOT_AVAILABLE,
}