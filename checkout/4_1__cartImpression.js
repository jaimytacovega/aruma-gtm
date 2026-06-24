/**
 * Checkout cart (#/cart): view_cart. Paste after checkoutOrderFormUtils.js.
 */
;((global) => {
  const isCheckoutCartPage = () => {
    if (!global.location.pathname.includes('/checkout')) {
      return false
    }

    return global.location.hash.includes('/cart')
  }

  global.create4_1__cartImpression = ({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
  }) => {
    let lastViewCartKey = ''
    let viewCartInFlight = false

    const getViewCartKey = (orderForm) =>
      [
        global.location.href,
        orderForm?.value ?? 0,
        orderForm?.marketingData?.coupon ?? '',
        orderForm?.items?.length ?? 0,
      ].join(':')

    const buildViewCartPayload = (items, currency, orderForm) => {
      const totals = orderFormUtils.buildCheckoutEcommerceTotals(orderForm, items)

      return {
        event: 'view_cart',
        ecommerce: {
          currency,
          value: totals.value,
          magentaPoints_value: totals.magentaPoints_value,
          items,
        },
      }
    }

    const runViewCart = async (orderForm) => {
      if (!isCheckoutCartPage() || !orderForm?.items?.length) {
        return
      }

      const cartKey = getViewCartKey(orderForm)

      if (cartKey === lastViewCartKey || viewCartInFlight) {
        return
      }

      viewCartInFlight = true

      try {
        const currency = orderFormUtils.getCurrency(orderForm)
        const items = await enrichOrderFormItems(
          orderForm.items,
          orderFormUtils
        )

        pushToDataLayer(buildViewCartPayload(items, currency, orderForm))
        lastViewCartKey = cartKey
      } finally {
        viewCartInFlight = false
      }
    }

    const requestOrderForm = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void runViewCart(orderForm)
      })
    }

    const onHashChange = () => {
      if (!isCheckoutCartPage()) {
        lastViewCartKey = ''
        return
      }

      requestOrderForm()
    }

    const attach = () => {
      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', (_, orderForm) => {
          if (!isCheckoutCartPage()) {
            return
          }

          void runViewCart(orderForm)
        })
      }

      requestOrderForm()
      global.addEventListener('hashchange', onHashChange)
    }

    return attach
  }
})(window)
