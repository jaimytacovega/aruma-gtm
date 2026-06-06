import { canUseDOM } from 'vtex.render-runtime'

import { pushToDataLayer } from '../../utils'

const CREATE_ACCOUNT_ROOT_SELECTOR = '[class*="content--createAccount"]'

const REGISTER_STEP1_PAGE_TITLE = 'Aruma - Cuenta - Paso 1'
const REGISTER_STEP1_PAGE_PATH = '/cuenta/paso-1'

let registerFlowObserverAttached = false
let registerStep1WasVisible = false

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

const isRegisterStep1Visible = (): HTMLElement | null => {
    const step1 = document.querySelector(CREATE_ACCOUNT_ROOT_SELECTOR)

    if (!(step1 instanceof HTMLElement)) {
        return null
    }

    return isVisibleElement(step1)
}

const pushRegisterStep1VirtualPage = () => {
    pushToDataLayer({
        event: 'virtualPage',
        page_location: `${window.location.origin}${REGISTER_STEP1_PAGE_PATH}`,
        page_title: REGISTER_STEP1_PAGE_TITLE,
    })
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

const syncRegisterFlow = () => {
    syncRegisterStep1()
    // syncRegisterStep2()
}

const registerUser = () => {
    if (!canUseDOM || registerFlowObserverAttached) {
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

export { registerUser }
