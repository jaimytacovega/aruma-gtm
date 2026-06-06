import { pushToDataLayer } from '../../utils'

const LOGIN_SEND_BUTTON_SELECTOR = [
  '[class*="aruma-login-0-x-sendButton"]',
  '[class*="aruma-aruma-theme-8-x-ButtonLogin"]',
].join(', ')

const getButtonCta = (button: HTMLButtonElement): string => {
  return (
    button
      .querySelector('.vtex-button__label')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ||
    button.textContent?.replace(/\s+/g, ' ').trim() ||
    ''
  )
}

const registerPickButtons = (target: Element) => {
  const sendButtonBlock = target.closest(LOGIN_SEND_BUTTON_SELECTOR)
  if (!sendButtonBlock) {
    return
  }

  const button = target.closest('button')
  if (!(button instanceof HTMLButtonElement) || !sendButtonBlock.contains(button)) {
    return
  }

  const cta = getButtonCta(button)
  if (!cta) {
    return
  }

  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Home',
    seccion: 'Registro',
    subseccion: 'Iniciar sesión',
    intencion: 'Recuperar contraseña',
    accion: 'Seleccionar elemento',
    elemento: 'Boton',
    cta,
  })
}

export { registerPickButtons }
