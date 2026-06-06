import { canUseDOM } from 'vtex.render-runtime'

import {
    NOT_AVAILABLE,
    log,
    pushToDataLayer,
    setAwaitingLogin,
} from '../../utils'
import type { UserData } from '../../typings/events'

const LOGIN_FORM_SELECTOR = '[class*="emailAndPasswordForm"]'
const LOGIN_SUBMIT_SELECTOR = `${LOGIN_FORM_SELECTOR} button[type="submit"]`

let loginAwaitingCaptureAttached = false

const findLoginSubmitButton = (event: Event): HTMLButtonElement | null => {
    if (typeof event.composedPath === 'function') {
        const fromPath = Array.from(event.composedPath()).find((node) => {
            if (!(node instanceof HTMLButtonElement)) {
                return false
            }

            if (node.type !== 'submit') {
                return false
            }

            return Boolean(node.closest(LOGIN_FORM_SELECTOR))
        })

        if (fromPath instanceof HTMLButtonElement) {
            return fromPath
        }
    }

    if (!(event.target instanceof Element)) {
        return null
    }

    const button = event.target.closest('button[type="submit"]')

    if (!(button instanceof HTMLButtonElement)) {
        return null
    }

    if (!button.closest(LOGIN_FORM_SELECTOR)) {
        return null
    }

    return button
}

const isLoginFormSubmit = (event: Event): boolean => {
    const form = event.target

    if (!(form instanceof HTMLFormElement)) {
        return false
    }

    return form.closest(LOGIN_FORM_SELECTOR) instanceof Element
}

const setupLoginAwaitingCapture = () => {
    if (!canUseDOM || loginAwaitingCaptureAttached) {
        return
    }

    document.addEventListener(
        'click',
        (event) => {
            const button = findLoginSubmitButton(event)

            if (!button) {
                return
            }

            log('login submit capture click', {
                buttonType: button.type,
                cta:
                    button
                        .querySelector('.vtex-button__label')
                        ?.textContent?.replace(/\s+/g, ' ')
                        .trim() || button.textContent?.replace(/\s+/g, ' ').trim(),
            })
            setAwaitingLogin('capture-login-submit-click')
        },
        true
    )

    document.addEventListener(
        'submit',
        (event) => {
            if (!isLoginFormSubmit(event)) {
                return
            }

            log('login submit capture form')
            setAwaitingLogin('capture-login-form-submit')
        },
        true
    )

    loginAwaitingCaptureAttached = true
    log('login awaiting capture attached', {
        loginFormSelector: LOGIN_FORM_SELECTOR,
        loginSubmitSelector: LOGIN_SUBMIT_SELECTOR,
    })
}

const userAuthenticated = (data: UserData) => {
    pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Home',
        seccion: 'Registro',
        subseccion: 'Iniciar sesión',
        intencion: 'Inicio exitoso',
        accion: 'Inicio exitoso',
        elemento: 'Modal',
        cta: 'Inicio exitoso',
    })

    pushToDataLayer({
        event: 'userProperties',
        userID: data.document || NOT_AVAILABLE,
        correo: data.email || NOT_AVAILABLE,
        edadUsuario: NOT_AVAILABLE,
        magentaUser: NOT_AVAILABLE,
        magentaPointsUser: NOT_AVAILABLE,
    })
}

export { userAuthenticated, setupLoginAwaitingCapture }
