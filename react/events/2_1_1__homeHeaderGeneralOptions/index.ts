import { pushToDataLayer } from '../../utils'


type HeaderGeneralOption = {
    containerSelector: string
    clickableSelector: string
    getCta: (container: HTMLElement, clickable: HTMLElement) => string
    matchesClick?: (clickable: HTMLElement) => boolean
}

const LOGIN_MODAL_UI_SELECTOR = [
    '[class*="aruma-login-0-x-sendButton"]',
    '[class*="aruma-login-0-x-formForgotPassword"]',
].join(', ')

const isHeaderLoginTrigger = (clickable: HTMLElement): boolean => {
    if (clickable.closest(LOGIN_MODAL_UI_SELECTOR)) {
        return false
    }

    return Boolean(
        clickable.closest('[class*="container_header_login"]') ||
        clickable.closest('[class*="containerHeaderLogin"]') ||
        clickable.querySelector('p')
    )
}

const HEADER_GENERAL_OPTIONS: HeaderGeneralOption[] = [
    {
        containerSelector:
            '[class*="container_header_login"], [class*="containerHeaderLogin"], [class*="flexCol--header-login"]',
        clickableSelector: 'button',
        matchesClick: isHeaderLoginTrigger,
        getCta: () => 'Inicia sesion',
    },
    {
        containerSelector: '[class*="container--storesaruma"]',
        clickableSelector: 'a',
        getCta: () => 'Encuentra tu tienda',
    },
    {
        containerSelector: '[class*="flexCol--header-magenta-button"]',
        clickableSelector: 'button',
        getCta: () => 'Magenta Points',
    },
]

const pushHeaderGeneralOption = (cta: string) => {
    pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Home',
        seccion: 'Header',
        subseccion: 'Opciones generales',
        intencion: 'Seleccionar opciones generales',
        accion: 'Seleccionar elemento',
        elemento: 'Boton',
        cta,
    })
}

const homeHeaderGeneralOptions = (target: Element) => {
    for (const option of HEADER_GENERAL_OPTIONS) {
        const clickable = target.closest(option.clickableSelector)
        if (!(clickable instanceof HTMLElement)) {
            continue
        }

        if (option.matchesClick && !option.matchesClick(clickable)) {
            continue
        }

        const container = clickable.closest(option.containerSelector)
        if (!(container instanceof HTMLElement)) {
            continue
        }

        const cta = option.getCta(container, clickable)
        if (!cta) {
            continue
        }

        pushHeaderGeneralOption(cta)
        return
    }
}

export { homeHeaderGeneralOptions }
