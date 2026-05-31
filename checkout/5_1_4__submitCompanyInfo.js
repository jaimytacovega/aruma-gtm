/**
 * Checkout profile: Continuar (#btn-submit-clientData) when enabled. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const SUBMIT_SELECTOR = '#btn-submit-clientData'
  const INTENCION = 'Continuar al paso de envio'

  const isCheckoutProfilePage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/profile')

  const isSubmitButtonEnabled = (button) => {
    if (button.hasAttribute('disabled')) {
      return false
    }

    if ('disabled' in button && button.disabled) {
      return false
    }

    return true
  }

  const matchesSubmitButton = (node) => {
    if (!(node instanceof Element)) {
      return false
    }

    return node.matches(SUBMIT_SELECTOR)
  }

  const findSubmitButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event.composedPath().find((node) => matchesSubmitButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(SUBMIT_SELECTOR)
    }

    return null
  }

  global.create5_1_4__submitCompanyInfo = ({ pushToDataLayer, normalizeText }) => {
    const pushSubmitCompanyInfoEvent = (cta) => {
      pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Checkout',
        seccion: 'Identificación',
        subseccion: 'Identificación',
        intencion: INTENCION,
        accion: 'Seleccionar elemento',
        elemento: 'Boton',
        cta,
      })
    }

    const handleClick = (event) => {
      if (!isCheckoutProfilePage()) {
        return
      }

      const button = findSubmitButton(event)

      if (!button || !isSubmitButtonEnabled(button)) {
        return
      }

      const cta = normalizeText(button.textContent) || 'Continuar'

      pushSubmitCompanyInfoEvent(cta)
    }

    const attach = () => {
      document.addEventListener('click', handleClick, true)
    }

    return attach
  }
})(window)
