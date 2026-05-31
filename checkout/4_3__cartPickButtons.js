/**
 * Cart page button clicks (checkout). Paste before checkout-ui-custom.js in checkout6-custom.js.
 */
;((global) => {
  const FINALIZE_SELECTOR =
    '#cart-to-orderform, a[data-event="cartToOrderform"], a.btn-place-order'

  const matchesFinalizeButton = (element) => {
    if (!(element instanceof Element)) {
      return false
    }

    return element.matches(FINALIZE_SELECTOR)
  }

  /** Knockout may stop bubble; disabled button uses pointer-events:none (click goes through). */
  const findFinalizeButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesFinalizeButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      const fromTarget = event.target.closest(FINALIZE_SELECTOR)

      if (fromTarget) {
        return fromTarget
      }
    }

    const button = document.querySelector('#cart-to-orderform')

    if (!button || typeof event.clientX !== 'number') {
      return null
    }

    const rect = button.getBoundingClientRect()

    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      return button
    }

    return null
  }

  const create4_3__cartPickButtons = ({
    isCheckoutCartPage,
    pushCartButtonEvent,
    normalizeText,
  }) => {
    const handler = (event) => {
      if (!isCheckoutCartPage()) {
        return
      }

      const finalizeButton = findFinalizeButton(event)

      if (finalizeButton) {
        pushCartButtonEvent('Finalizar compra')

        return
      }

      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const continueShoppingButton = target.closest('.boton-seguir-comprando a')

      if (!continueShoppingButton) {
        return
      }

      const continueLabel = continueShoppingButton.querySelector('p')
      const continueCta =
        normalizeText(continueLabel ? continueLabel.textContent : '') ||
        normalizeText(continueShoppingButton.textContent) ||
        'Seguir comprando'

      pushCartButtonEvent(continueCta)
    }

    Object.defineProperty(handler, 'name', { value: '4_3__cartPickButtons' })

    return handler
  }

  global.create4_3__cartPickButtons = create4_3__cartPickButtons
})(window)
