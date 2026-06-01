/**
 * Checkout payment (#/payment): virtualEvent on #btn-finalizar-compra click (enabled).
 */
;((global) => {
  const PURCHASE_BUTTON_SELECTOR = '#btn-finalizar-compra'
  const INTENCION = 'Continuar a la compra'

  const isPurchaseButtonEnabled = (button) => {
    if (button.hasAttribute('disabled')) {
      return false
    }

    if ('disabled' in button && button.disabled) {
      return false
    }

    const style = global.getComputedStyle(button)

    if (style.pointerEvents === 'none' || style.cursor === 'not-allowed') {
      return false
    }

    if (Number(style.opacity) < 1) {
      return false
    }

    return true
  }

  const matchesPurchaseButton = (node) =>
    node instanceof Element && node.matches(PURCHASE_BUTTON_SELECTOR)

  const findPurchaseButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesPurchaseButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(PURCHASE_BUTTON_SELECTOR)
    }

    return null
  }

  global.create5_3_3__paymentPickButton = ({
    pushToDataLayer,
    normalizeText,
    orderFormUtils,
  }) => {
    const pushPaymentPickButtonEvent = (cta) => {
      pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Checkout',
        seccion: 'Pago',
        subseccion: 'Pago',
        intencion: INTENCION,
        accion: 'Seleccionar elemento',
        elemento: 'Boton',
        cta,
      })
    }

    const handleClick = (event) => {
      if (!orderFormUtils.isCheckoutPaymentPage()) {
        return
      }

      const button = findPurchaseButton(event)

      if (!button || !isPurchaseButtonEnabled(button)) {
        return
      }

      const cta = normalizeText(button.textContent) || 'Comprar ahora'

      pushPaymentPickButtonEvent(cta)
    }

    const attach = () => {
      document.addEventListener('click', handleClick, true)
    }

    return attach
  }
})(window)
