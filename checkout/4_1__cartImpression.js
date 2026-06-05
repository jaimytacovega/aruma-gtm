/**
 * Checkout cart (#/cart): view_cart. Paste after checkoutOrderFormUtils.js.
 */
;((global) => {
  const LIST_ID = 'view_cart'
  const LIST_NAME = 'View cart'

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
    let lastViewCartUrl = ''
    let viewCartInFlight = false

    const buildViewCartPayload = (items, currency) => {
      const totals = orderFormUtils.buildItemsEcommerceTotals(items)

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

      const pageUrl = global.location.href

      if (pageUrl === lastViewCartUrl || viewCartInFlight) {
        return
      }

      viewCartInFlight = true

      try {
        const currency = orderFormUtils.getCurrency(orderForm)
        const items = await enrichOrderFormItems(
          orderForm.items,
          LIST_ID,
          LIST_NAME
        )

        pushToDataLayer(buildViewCartPayload(items, currency))
        lastViewCartUrl = pageUrl
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
        lastViewCartUrl = ''
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
