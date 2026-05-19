import { canUseDOM } from 'vtex.render-runtime'

const log = (...args: unknown[]) => console.info('[aruma-gtm]', ...args)

/** Modal actions only — emailAndPasswordForm wraps the whole login app incl. header trigger. */
const LOGIN_MODAL_INTERACTION_SELECTOR = [
    '[class*="aruma-login-0-x-sendButton"]',
    '[class*="aruma-login-0-x-formForgotPassword"]',
].join(', ')

const isInsideLoginModalInteraction = (target: Element): boolean =>
    Boolean(target.closest(LOGIN_MODAL_INTERACTION_SELECTOR))

const pushToDataLayer = (payload: Record<string, unknown>) => {
    if (!canUseDOM) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(payload)
    log(JSON.stringify(payload))
}

export {
    pushToDataLayer,
    log,
    isInsideLoginModalInteraction,
}