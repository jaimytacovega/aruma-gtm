import { pushToDataLayer } from '../../utils'

const FORGOT_PASSWORD_SELECTOR = '[class*="aruma-login-0-x-formForgotPassword"]'
const FORGOT_PASSWORD_CTA = '¿Olvidaste tu contraseña?'

const registerRecoverPassword = (target: Element) => {
  const forgotPasswordBlock = target.closest(FORGOT_PASSWORD_SELECTOR)
  if (!forgotPasswordBlock) {
    return
  }

  const anchor = target.closest('a')
  if (!(anchor instanceof HTMLAnchorElement) || !forgotPasswordBlock.contains(anchor)) {
    return
  }

  const cta =
    anchor.textContent?.replace(/\s+/g, ' ').trim() || FORGOT_PASSWORD_CTA

  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Home',
    seccion: 'Registro',
    subseccion: 'Iniciar sesión',
    intencion: 'Recuperar contraseña',
    accion: 'Seleccionar elemento',
    elemento: 'Link',
    cta,
  })
}

export { registerRecoverPassword }
