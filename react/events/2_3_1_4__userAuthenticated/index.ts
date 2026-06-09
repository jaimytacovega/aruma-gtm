import { canUseDOM } from 'vtex.render-runtime'

import { withHashedUserPii } from '../../hashPii'
import {
    pushToDataLayer,
    setAwaitingLogin,
} from '../../utils'
import type { UserData } from '../../typings/events'
import { waitForMagentaUserProperties } from '../magentaProfile'

const LOGIN_FORM_SELECTOR = '[class*="emailAndPasswordForm"]'

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

            setAwaitingLogin()
        },
        true
    )

    document.addEventListener(
        'submit',
        (event) => {
            if (!isLoginFormSubmit(event)) {
                return
            }

            setAwaitingLogin()
        },
        true
    )

    loginAwaitingCaptureAttached = true
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

export { userAuthenticated, setupLoginAwaitingCapture }
