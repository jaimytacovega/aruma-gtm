import { canUseDOM } from 'vtex.render-runtime'

import { withHashedUserPii } from '../../hashPii'
import {
    clearAwaitingRegisterUserProperties,
    hasAwaitingRegisterUserProperties,
    pushToDataLayer,
    setAwaitingRegisterUserProperties,
} from '../../utils'
import type { UserData } from '../../typings/events'
import { waitForMagentaUserProperties } from '../magentaProfile'

const CREATE_ACCOUNT_ROOT_SELECTOR = '[class*="content--createAccount"]'
const REGISTER_SUCCESS_ROOT_SELECTOR = '[class*="content--welcomeToAruma"]'
const REGISTER_SUCCESS_WELCOME_SELECTOR = '[class*="welcome_container"]'

const REGISTER_STEP1_PAGE_TITLE = 'Aruma - Cuenta - Paso 1'
const REGISTER_STEP1_PAGE_PATH = '/cuenta/paso-1'

const REGISTER_SUCCESS_PAGE_TITLE = 'Aruma - Cuenta - Cuenta exitosa'
const REGISTER_SUCCESS_PAGE_PATH = '/cuenta/cuenta-exitosa'
const REGISTER_SUCCESS_TITLE_MARKER = 'Ya eres parte'
const REGISTER_DISCOVER_MORE_CTA = '¡Descubre más!'
const SESSION_POLL_MS = 500
const SESSION_MAX_WAIT_MS = 15000

type SessionField = { value?: string }

type SessionResponse = {
    namespaces?: {
        profile?: {
            isAuthenticated?: SessionField
            email?: SessionField
            document?: SessionField
            firstName?: SessionField
            lastName?: SessionField
            id?: SessionField
            phone?: SessionField
        }
    }
}

let registerFlowObserverAttached = false
let registerDiscoverMoreCaptureAttached = false
let registerStep1WasVisible = false
let registerSuccessWasVisible = false

const isVisibleElement = (element: HTMLElement | null): HTMLElement | null => {
    if (!element) {
        return null
    }

    const { height, width } = element.getBoundingClientRect()

    if (height === 0 || width === 0) {
        return null
    }

    return element
}

const normalizeText = (value: string | null | undefined): string =>
    value?.replace(/\s+/g, ' ').trim() || ''

const getButtonCta = (button: HTMLButtonElement): string => {
    return (
        normalizeText(
            button.querySelector('.vtex-button__label')?.textContent
        ) || normalizeText(button.textContent)
    )
}

const isRegisterStep1Visible = (): HTMLElement | null => {
    const step1 = document.querySelector(CREATE_ACCOUNT_ROOT_SELECTOR)

    if (!(step1 instanceof HTMLElement)) {
        return null
    }

    return isVisibleElement(step1)
}

const isRegisterSuccessVisible = (): HTMLElement | null => {
    const root = document.querySelector(REGISTER_SUCCESS_ROOT_SELECTOR)

    if (!(root instanceof HTMLElement)) {
        return null
    }

    const welcome = root.querySelector(REGISTER_SUCCESS_WELCOME_SELECTOR)
    const titleText = normalizeText(
        welcome?.querySelector('[class*="formTitle"]')?.textContent
    )

    if (!titleText.includes(REGISTER_SUCCESS_TITLE_MARKER)) {
        return null
    }

    return isVisibleElement(welcome instanceof HTMLElement ? welcome : root)
}

const isRegisterDiscoverMoreButton = (
    button: HTMLButtonElement
): boolean => {
    if (button.disabled) {
        return false
    }

    const root = button.closest(REGISTER_SUCCESS_ROOT_SELECTOR)

    if (!root) {
        return false
    }

    const cta = getButtonCta(button)

    return cta === REGISTER_DISCOVER_MORE_CTA
}

const findRegisterDiscoverMoreButton = (
    event: Event
): HTMLButtonElement | null => {
    if (typeof event.composedPath === 'function') {
        const fromPath = Array.from(event.composedPath()).find((node) => {
            if (!(node instanceof HTMLButtonElement)) {
                return false
            }

            return isRegisterDiscoverMoreButton(node)
        })

        if (fromPath instanceof HTMLButtonElement) {
            return fromPath
        }
    }

    if (!(event.target instanceof Element)) {
        return null
    }

    const button = event.target.closest('button')

    if (!(button instanceof HTMLButtonElement)) {
        return null
    }

    if (!isRegisterDiscoverMoreButton(button)) {
        return null
    }

    return button
}

const pushRegisterStep1VirtualPage = () => {
    pushToDataLayer({
        event: 'virtualPage',
        page_location: `${window.location.origin}${REGISTER_STEP1_PAGE_PATH}`,
        page_title: REGISTER_STEP1_PAGE_TITLE,
    })
}

const pushRegisterSuccessVirtualPage = () => {
    pushToDataLayer({
        event: 'virtualPage',
        page_location: `${window.location.origin}${REGISTER_SUCCESS_PAGE_PATH}`,
        page_title: REGISTER_SUCCESS_PAGE_TITLE,
    })
}

const pushRegisterSuccessVirtualEvent = () => {
    pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Home',
        seccion: 'Registro',
        subseccion: 'Crear cuenta',
        intencion: 'Cuenta exitosa',
        accion: 'Cuenta exitosa',
        elemento: 'Modal',
        cta: 'Cuenta exitosa',
    })
}

const pushRegisterSuccessEvents = () => {
    pushRegisterSuccessVirtualPage()
    pushRegisterSuccessVirtualEvent()
}

const readSessionField = (field?: SessionField): string | undefined => {
    const value = field?.value?.trim()

    return value || undefined
}

const fetchAuthenticatedUserData = async (): Promise<UserData | null> => {
    try {
        const response = await fetch('/api/sessions?items=*', {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
            },
        })

        if (!response.ok) {
            return null
        }

        const session = (await response.json()) as SessionResponse
        const profile = session.namespaces?.profile
        const isAuthenticated =
            readSessionField(profile?.isAuthenticated) === 'true'

        if (!isAuthenticated) {
            return null
        }

        return {
            event: 'pageInfo',
            eventName: 'vtex:userData',
            eventType: 'userData',
            accountName: '',
            pageTitle: document.title,
            pageUrl: window.location.href,
            currency: '',
            isAuthenticated: true,
            email: readSessionField(profile?.email),
            document: readSessionField(profile?.document),
            firstName: readSessionField(profile?.firstName),
            lastName: readSessionField(profile?.lastName),
            id: readSessionField(profile?.id),
            phone: readSessionField(profile?.phone),
        }
    } catch {
        return null
    }
}

let pendingRegisterUserPropertiesSync = false

const syncPendingRegisterUserProperties = async () => {
    if (!hasAwaitingRegisterUserProperties() || pendingRegisterUserPropertiesSync) {
        return
    }

    pendingRegisterUserPropertiesSync = true
    const startedAt = Date.now()

    try {
        while (
            hasAwaitingRegisterUserProperties() &&
            Date.now() - startedAt < SESSION_MAX_WAIT_MS
        ) {
            const userData = await fetchAuthenticatedUserData()

            if (userData && handleRegisterUserData(userData)) {
                return
            }

            await new Promise((resolve) => {
                window.setTimeout(resolve, SESSION_POLL_MS)
            })
        }
    } finally {
        pendingRegisterUserPropertiesSync = false
    }
}

const pushRegisterUserProperties = (data: UserData) => {
    waitForMagentaUserProperties(
        {
            document: data.document,
            email: data.email,
        },
        (userProperties) => {
            void (async () => {
                const hashed = await withHashedUserPii(userProperties)

                pushToDataLayer({
                    event: 'userProperties',
                    ...hashed,
                })
            })()
        }
    )
}

const syncRegisterStep1 = () => {
    const step1 = isRegisterStep1Visible()

    if (step1 && !registerStep1WasVisible) {
        registerStep1WasVisible = true
        pushRegisterStep1VirtualPage()
        return
    }

    if (!step1 && registerStep1WasVisible) {
        registerStep1WasVisible = false
    }
}

const syncRegisterSuccess = () => {
    const success = isRegisterSuccessVisible()

    if (success && !registerSuccessWasVisible) {
        registerSuccessWasVisible = true
        pushRegisterSuccessEvents()
        // Arm userProperties before dismiss/reload — user may close modal without
        // clicking "¡Descubre más!" (sessionStorage survives same-tab reload).
        setAwaitingRegisterUserProperties()
        return
    }

    if (!success && registerSuccessWasVisible) {
        registerSuccessWasVisible = false
    }
}

const syncRegisterFlow = () => {
    syncRegisterStep1()
    syncRegisterSuccess()
    // syncRegisterStep2()
}

const setupRegisterDiscoverMoreCapture = () => {
    if (!canUseDOM || registerDiscoverMoreCaptureAttached) {
        return
    }

    document.addEventListener(
        'click',
        (event) => {
            const button = findRegisterDiscoverMoreButton(event)

            if (!button) {
                return
            }

            // Refresh the awaiting window if they click the CTA after the modal appeared.
            setAwaitingRegisterUserProperties()
        },
        true
    )

    registerDiscoverMoreCaptureAttached = true
}

const handleRegisterUserData = (data: UserData): boolean => {
    if (!data.isAuthenticated || !hasAwaitingRegisterUserProperties()) {
        return false
    }

    clearAwaitingRegisterUserProperties()
    pushRegisterUserProperties(data)
    return true
}

const registerUser = () => {
    if (!canUseDOM) {
        return
    }

    setupRegisterDiscoverMoreCapture()
    void syncPendingRegisterUserProperties()

    if (registerFlowObserverAttached) {
        return
    }

    const observer = new MutationObserver(() => {
        syncRegisterFlow()
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    })

    registerFlowObserverAttached = true
    syncRegisterFlow()
}

export { registerUser, handleRegisterUserData }
