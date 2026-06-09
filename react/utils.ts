import { canUseDOM } from 'vtex.render-runtime'

import {
    getListContextFromStore,
    persistListContextFromPayload,
} from './listContextStore'
import type { ProductListContext } from './listContextStore'

const log = (...args: unknown[]) => console.info('[aruma-gtm]', ...args)
const NOT_AVAILABLE = '(not available)'

/** Modal actions only — emailAndPasswordForm wraps the whole login app incl. header trigger. */
const LOGIN_MODAL_INTERACTION_SELECTOR = [
    '[class*="aruma-login-0-x-sendButton"]',
    '[class*="aruma-login-0-x-formForgotPassword"]',
].join(', ')

const isInsideLoginModalInteraction = (target: Element): boolean =>
    Boolean(target.closest(LOGIN_MODAL_INTERACTION_SELECTOR))

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

const LIST_CONTEXT_EVENTS = new Set(['select_item', 'view_item_list'])

const readListContextFromEcommerce = (
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

const listEventMatchesProduct = (
    entry: Record<string, unknown>,
    slug: string,
    productId?: string
): boolean => {
    if (entry.event === 'select_item') {
        return selectItemMatchesProduct(entry, slug, productId)
    }

    if (entry.event !== 'view_item_list') {
        return false
    }

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

/** List context from last select_item / view_item_list for this product, else last list event. */
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
    let lastListContext: ProductListContext | null = null

    for (let index = window.dataLayer.length - 1; index >= 0; index -= 1) {
        const entry = window.dataLayer[index]

        if (!entry || !LIST_CONTEXT_EVENTS.has(String(entry.event))) {
            continue
        }

        const list = readListContextFromEcommerce(entry)

        if (!list) {
            continue
        }

        if (!lastListContext) {
            lastListContext = list
        }

        if (listEventMatchesProduct(entry, slug, productId)) {
            return list
        }
    }

    if (lastListContext) {
        return lastListContext
    }

    return getListContextFromStore(slug, productId, fallback)
}

const pushToDataLayer = (payload: Record<string, unknown>, disableLog: boolean = false) => {
    if (!canUseDOM) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ ...payload, arumaGtm: true })
    persistListContextFromPayload(payload)
    if (!disableLog) {
        log(JSON.stringify(payload))
    }
}

const AWAITING_LOGIN_KEY = 'aruma-gtm:awaiting-login'
const AWAITING_LOGIN_TIMEOUT_MS = 30000
let awaitingLoginTimeoutId: number | null = null

const readAwaitingLoginValue = () => {
    try {
        return window.sessionStorage.getItem(AWAITING_LOGIN_KEY)
    } catch {
        return null
    }
}

const setAwaitingLogin = () => {
    try {
        window.sessionStorage.setItem(AWAITING_LOGIN_KEY, '1')
    } catch {
        return
    }

    if (awaitingLoginTimeoutId !== null) {
        window.clearTimeout(awaitingLoginTimeoutId)
    }

    awaitingLoginTimeoutId = window.setTimeout(() => {
        awaitingLoginTimeoutId = null
        clearAwaitingLogin()
    }, AWAITING_LOGIN_TIMEOUT_MS)
}

const hasAwaitingLogin = () => readAwaitingLoginValue() === '1'

const clearAwaitingLogin = () => {
    try {
        window.sessionStorage.removeItem(AWAITING_LOGIN_KEY)
    } catch {
        return
    }

    if (awaitingLoginTimeoutId !== null) {
        window.clearTimeout(awaitingLoginTimeoutId)
        awaitingLoginTimeoutId = null
    }
}

const AWAITING_REGISTER_USER_PROPERTIES_KEY =
    'aruma-gtm:awaiting-register-user-properties'
const AWAITING_REGISTER_USER_PROPERTIES_TIMEOUT_MS = 60000
let awaitingRegisterUserPropertiesTimeoutId: number | null = null

const readAwaitingRegisterUserPropertiesValue = () => {
    try {
        return window.sessionStorage.getItem(
            AWAITING_REGISTER_USER_PROPERTIES_KEY
        )
    } catch {
        return null
    }
}

const setAwaitingRegisterUserProperties = () => {
    try {
        window.sessionStorage.setItem(
            AWAITING_REGISTER_USER_PROPERTIES_KEY,
            '1'
        )
    } catch {
        return
    }

    if (awaitingRegisterUserPropertiesTimeoutId !== null) {
        window.clearTimeout(awaitingRegisterUserPropertiesTimeoutId)
    }

    awaitingRegisterUserPropertiesTimeoutId = window.setTimeout(() => {
        awaitingRegisterUserPropertiesTimeoutId = null
        clearAwaitingRegisterUserProperties()
    }, AWAITING_REGISTER_USER_PROPERTIES_TIMEOUT_MS)
}

const hasAwaitingRegisterUserProperties = () =>
    readAwaitingRegisterUserPropertiesValue() === '1'

const clearAwaitingRegisterUserProperties = () => {
    try {
        window.sessionStorage.removeItem(AWAITING_REGISTER_USER_PROPERTIES_KEY)
    } catch {
        return
    }

    if (awaitingRegisterUserPropertiesTimeoutId !== null) {
        window.clearTimeout(awaitingRegisterUserPropertiesTimeoutId)
        awaitingRegisterUserPropertiesTimeoutId = null
    }
}

export {
    pushToDataLayer,
    getListFromLastSelectItem,
    log,
    isInsideLoginModalInteraction,
    NOT_AVAILABLE,
    setAwaitingLogin,
    hasAwaitingLogin,
    clearAwaitingLogin,
    setAwaitingRegisterUserProperties,
    hasAwaitingRegisterUserProperties,
    clearAwaitingRegisterUserProperties,
}