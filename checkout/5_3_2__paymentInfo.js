/**
 * Checkout payment (#/payment): add_payment_info on #btn-finalizar-compra (enabled).
 */
;((global) => {
  const PURCHASE_BUTTON_SELECTOR = '#btn-finalizar-compra'
  const AWAITING_ORDER_PLACED_KEY = 'aruma-gtm:awaiting-order-placed'

  const setAwaitingOrderPlaced = () => {
    try {
      global.sessionStorage.setItem(
        AWAITING_ORDER_PLACED_KEY,
        String(Date.now())
      )
    } catch {
      // sessionStorage unavailable
    }
  }

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

  global.create5_3_2__paymentInfo = ({
    pushToDataLayer,
    enrichOrderFormItems,
    NOT_AVAILABLE,
    orderFormUtils,
  }) => {
    let addPaymentInfoFired = false

    const buildAddPaymentInfoPayload = (
      items,
      currency,
      coupon,
      payment_type,
      totals
    ) => ({
      event: 'add_payment_info',
      ecommerce: {
        currency,
        value: totals.value,
        magentaPoints_value: totals.magentaPoints_value,
        coupon,
        payment_type,
        items,
      },
    })

    const runAddPaymentInfo = async (orderForm) => {
      if (!orderFormUtils.isCheckoutPaymentPage() || addPaymentInfoFired) {
        return
      }

      if (!orderForm?.items?.length) {
        return
      }

      addPaymentInfoFired = true

      const currency = orderFormUtils.getCurrency(orderForm)
      const coupon = orderFormUtils.getCoupon(orderForm)
      const payment_type = orderFormUtils.getPaymentType(orderForm)

      const items = await enrichOrderFormItems(
        orderForm.items,
        orderFormUtils
      )

      const totals = orderFormUtils.buildCheckoutEcommerceTotals(orderForm, items)

      pushToDataLayer(
        buildAddPaymentInfoPayload(items, currency, coupon, payment_type, totals)
      )

      if (typeof orderFormUtils.persistCheckoutPurchaseContext === 'function') {
        orderFormUtils.persistCheckoutPurchaseContext({
          payment_type,
          items: items.map((item) => ({
            item_id: String(item.item_id ?? ''),
            item_list_id: String(item.item_list_id ?? ''),
            item_list_name: String(item.item_list_name ?? ''),
          })),
        })
      }

      setAwaitingOrderPlaced()
    }

    const requestOrderForm = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void runAddPaymentInfo(orderForm)
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

      requestOrderForm()
    }

    const handleHashChange = () => {
      if (!orderFormUtils.isCheckoutPaymentPage()) {
        addPaymentInfoFired = false
      }
    }

    const attach = () => {
      document.addEventListener('click', handleClick, true)
      global.addEventListener('hashchange', handleHashChange)
    }

    return attach
  }
})(window)
