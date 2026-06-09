/**
 * Checkout shipping (#/shipping): add_shipping_info after successful submit (#btn-go-to-payment).
 * Paste before checkout-ui-custom.js.
 */
;((global) => {
  const SHIPPING_SUBMIT_SELECTOR = '#btn-go-to-payment'
  const PENDING_TIMEOUT_MS = 30000

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  const isSubmitButtonEnabled = (button) => {
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

  const matchesShippingSubmitButton = (node) =>
    node instanceof Element && node.matches(SHIPPING_SUBMIT_SELECTOR)

  const findShippingSubmitButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesShippingSubmitButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(SHIPPING_SUBMIT_SELECTOR)
    }

    return null
  }

  global.create5_2_2__submitShipping = ({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
    normalizeText,
    NOT_AVAILABLE,
  }) => {
    let pendingShippingSubmit = false
    let capturedShippingTier = ''
    let pendingTimeoutId = null

    const clearPending = () => {
      pendingShippingSubmit = false
      capturedShippingTier = ''

      if (pendingTimeoutId !== null) {
        global.clearTimeout(pendingTimeoutId)
        pendingTimeoutId = null
      }
    }

    const getShippingTierFromDom = () => {
      const activeOption = document.querySelector(
        '#shipping-option-delivery.shp-method-option-active, #shipping-option-delivery.vtex-omnishipping-1-x-deliveryOptionActive, #shipping-option-pickup-in-point.shp-method-option-active, #shipping-option-pickup-in-point.vtex-omnishipping-1-x-deliveryOptionActive, .shp-method-option-active, .vtex-omnishipping-1-x-deliveryOptionActive'
      )

      if (!activeOption) {
        return ''
      }

      const main = activeOption.querySelector('.shp-method-option-text')?.textContent
      const complement = activeOption.querySelector(
        '.shp-method-option-complement'
      )?.textContent

      return normalizeText([main, complement].filter(Boolean).join(' '))
    }

    const getShippingTierFromOrderForm = (orderForm) => {
      const logisticsInfo = orderForm?.shippingData?.logisticsInfo ?? []

      for (const logistics of logisticsInfo) {
        const selectedSla = logistics?.slas?.find(
          (sla) => sla.id === logistics.selectedSlaId
        )

        if (selectedSla?.name) {
          return normalizeText(selectedSla.name)
        }

        if (selectedSla?.deliveryChannel === 'pickup-in-point') {
          return 'Recoger en la tienda'
        }

        if (selectedSla?.deliveryChannel === 'delivery') {
          return 'Enviar a la dirección'
        }
      }

      return ''
    }

    const resolveShippingTier = (orderForm) =>
      capturedShippingTier ||
      getShippingTierFromDom() ||
      getShippingTierFromOrderForm(orderForm) ||
      NOT_AVAILABLE

    const buildAddShippingInfoPayload = (
      items,
      currency,
      coupon,
      shipping_tier
    ) => {
      const value = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const magentaPoints_value = items.reduce(
        (sum, item) => sum + item.magentaPoints_price * item.quantity,
        0
      )

      return {
        event: 'add_shipping_info',
        ecommerce: {
          currency,
          value: Number(value.toFixed(2)),
          magentaPoints_value,
          coupon,
          shipping_tier,
          items,
        },
      }
    }

    const completeShippingSubmit = async (orderForm) => {
      if (!pendingShippingSubmit || !orderForm?.items?.length) {
        return
      }

      clearPending()

      const currency =
        orderForm.storePreferencesData?.currencyCode ||
        orderForm.storePreferencesData?.currency ||
        'PEN'
      const coupon = orderForm.marketingData?.coupon || NOT_AVAILABLE
      const shipping_tier = resolveShippingTier(orderForm)

      const items = await enrichOrderFormItems(
        orderForm.items,
        orderFormUtils
      )

      pushToDataLayer(
        buildAddShippingInfoPayload(items, currency, coupon, shipping_tier)
      )
    }

    const requestOrderFormAndComplete = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void completeShippingSubmit(orderForm)
      })
    }

    const startPendingShippingSubmit = () => {
      pendingShippingSubmit = true
      capturedShippingTier = getShippingTierFromDom()

      if (pendingTimeoutId !== null) {
        global.clearTimeout(pendingTimeoutId)
      }

      pendingTimeoutId = global.setTimeout(() => {
        clearPending()
      }, PENDING_TIMEOUT_MS)
    }

    const handleShippingSubmitClick = (event) => {
      if (!isCheckoutShippingPage()) {
        return
      }

      const button = findShippingSubmitButton(event)

      if (!button || !isSubmitButtonEnabled(button)) {
        return
      }

      startPendingShippingSubmit()
    }

    const handleHashChange = () => {
      if (!pendingShippingSubmit) {
        return
      }

      if (isCheckoutPaymentPage()) {
        requestOrderFormAndComplete()
      }
    }

    const handleOrderFormUpdated = (_, orderForm) => {
      if (!pendingShippingSubmit) {
        return
      }

      if (isCheckoutPaymentPage()) {
        void completeShippingSubmit(orderForm)
        return
      }

      const hasSelectedShipping = (orderForm?.shippingData?.logisticsInfo ?? []).some(
        (logistics) => Boolean(logistics?.selectedSlaId)
      )

      if (hasSelectedShipping && !isCheckoutShippingPage()) {
        void completeShippingSubmit(orderForm)
      }
    }

    const attach = () => {
      document.addEventListener('click', handleShippingSubmitClick, true)
      global.addEventListener('hashchange', handleHashChange)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', handleOrderFormUpdated)
      }
    }

    return attach
  }
})(window)
