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

const SELECT_ITEM_HISTORY_KEY = 'aruma-gtm:select-items'
const SELECT_ITEM_HISTORY_LIMIT = 30

const persistSelectItem = (payload: Record<string, unknown>) => {
    if (payload.event !== 'select_item') {
        return
    }

    try {
        const raw = window.sessionStorage.getItem(SELECT_ITEM_HISTORY_KEY)
        const history = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : []

        history.push(payload)
        window.sessionStorage.setItem(
            SELECT_ITEM_HISTORY_KEY,
            JSON.stringify(history.slice(-SELECT_ITEM_HISTORY_LIMIT))
        )
    } catch {
        // sessionStorage unavailable or full
    }
}

const pushToDataLayer = (payload: Record<string, unknown>, disableLog: boolean = false) => {
    if (!canUseDOM) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(payload)
    persistSelectItem(payload)
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