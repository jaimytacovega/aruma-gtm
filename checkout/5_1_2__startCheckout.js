/**
 * Checkout profile step (#/profile): begin_checkout. Paste after checkoutCartItems.js.
 */
;((global) => {
  const isCheckoutProfilePage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/profile')

  global.create5_1_2__startCheckout = ({
    pushToDataLayer,
    enrichOrderFormItems,
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
      if (!isCheckoutProfilePage() || beginCheckoutFired) {
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
        'begin_checkout',
        'Begin checkout'
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

      if (isCheckoutProfilePage()) {
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
