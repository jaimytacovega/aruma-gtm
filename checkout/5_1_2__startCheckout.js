/**
 * Checkout identification (#/profile, #/email): begin_checkout. Paste after checkoutCartItems.js.
 */
;((global) => {
  const isCheckoutIdentificationPage = () => {
    if (!global.location.pathname.includes('/checkout')) {
      return false
    }

    const hash = global.location.hash

    return hash.includes('/profile') || hash.includes('/email')
  }

  global.create5_1_2__startCheckout = ({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
    NOT_AVAILABLE,
  }) => {
    let beginCheckoutFired = false

    const buildBeginCheckoutPayload = (items, currency, coupon) => {
      const value = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const magentaPoints_value = items.reduce(
        (sum, item) => sum + item.magentaPoints_price * item.quantity,
        0
      )

      return {
        event: 'begin_checkout',
        ecommerce: {
          currency,
          value: Number(value.toFixed(2)),
          magentaPoints_value,
          coupon,
          items,
        },
      }
    }

    const runStartCheckout = async (orderForm) => {
      if (!isCheckoutIdentificationPage() || beginCheckoutFired) {
        return
      }

      if (!orderForm?.items?.length) {
        return
      }

      beginCheckoutFired = true

      const currency =
        orderForm.storePreferencesData?.currencyCode ||
        orderForm.storePreferencesData?.currency ||
        'PEN'
      const coupon = orderForm.marketingData?.coupon || NOT_AVAILABLE

      const items = await enrichOrderFormItems(
        orderForm.items,
        orderFormUtils
      )

      pushToDataLayer(buildBeginCheckoutPayload(items, currency, coupon))
    }

    const requestOrderForm = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void runStartCheckout(orderForm)
      })
    }

    const onHashChange = () => {
      if (!global.location.pathname.includes('/checkout')) {
        beginCheckoutFired = false
        return
      }

      if (isCheckoutIdentificationPage()) {
        requestOrderForm()
      }
    }

    const attach = () => {
      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', (_, orderForm) => {
          void runStartCheckout(orderForm)
        })
      }

      requestOrderForm()
      global.addEventListener('hashchange', onHashChange)
    }

    return attach
  }
})(window)
