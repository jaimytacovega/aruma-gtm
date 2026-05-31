/**
 * Checkout shipping (#/shipping): virtualEvent on #btn-go-to-payment click (enabled).
 * Paste before checkout-ui-custom.js.
 */
;((global) => {
  const SHIPPING_PAYMENT_SELECTOR = '#btn-go-to-payment'

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  const isPaymentButtonEnabled = (button) => {
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

    return true
  }

  const matchesPaymentButton = (node) =>
    node instanceof Element && node.matches(SHIPPING_PAYMENT_SELECTOR)

  const findPaymentButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesPaymentButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(SHIPPING_PAYMENT_SELECTOR)
    }

    return null
  }

  global.create5_2_3__shippingPickButton = ({ pushToDataLayer, normalizeText }) => {
    const pushShippingPickButtonEvent = (cta) => {
      pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Checkout',
        seccion: 'Envío',
        subseccion: 'Envío',
        intencion: cta,
        accion: 'Seleccionar elemento',
        elemento: 'Boton',
        cta,
      })
    }

    const handleClick = (event) => {
      if (!isCheckoutShippingPage()) {
        return
      }

      const button = findPaymentButton(event)

      if (!button || !isPaymentButtonEnabled(button)) {
        return
      }

      const cta = normalizeText(button.textContent) || 'Ir para el pago'

      pushShippingPickButtonEvent(cta)
    }

    const attach = () => {
      document.addEventListener('click', handleClick, true)
    }

    return attach
  }
})(window)
