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
const REGISTER_SUCCESS_TITLE = 'Ya eres parte de Aruma'
const REGISTER_DISCOVER_MORE_CTA = '¡Descubre más!'

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

    if (!titleText.includes(REGISTER_SUCCESS_TITLE)) {
        return null
    }

    return isVisibleElement(root)
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

const pushRegisterSuccessEvents = () => {
    pushToDataLayer({
        event: 'virtualPage',
        page_location: `${window.location.origin}${REGISTER_SUCCESS_PAGE_PATH}`,
        page_title: REGISTER_SUCCESS_PAGE_TITLE,
    })

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
