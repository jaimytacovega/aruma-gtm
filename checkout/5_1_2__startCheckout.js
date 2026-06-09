/**
 * Checkout flow: begin_checkout on #/profile, #/email, and fallbacks on #/shipping / #/payment.
 * Paste after checkoutCartItems.js.
 */
;((global) => {
  const isCheckoutIdentificationPage = () => {
    if (!global.location.pathname.includes('/checkout')) {
      return false
    }

    const hash = global.location.hash

    return hash.includes('/profile') || hash.includes('/email')
  }

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  const isCheckoutBeginCheckoutPage = () =>
    isCheckoutIdentificationPage() ||
    isCheckoutShippingPage() ||
    isCheckoutPaymentPage()

  global.create5_1_2__startCheckout = ({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
    NOT_AVAILABLE,
  }) => {
    let identificationBeginCheckoutFiredForHash = ''

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

    const shouldFireBeginCheckout = () => {
      if (isCheckoutIdentificationPage()) {
        return identificationBeginCheckoutFiredForHash !== global.location.hash
      }

      if (isCheckoutShippingPage() || isCheckoutPaymentPage()) {
        return !orderFormUtils.hasArumaGtmEventInDataLayer('begin_checkout')
      }

      return false
    }

    const runStartCheckout = async (orderForm) => {
      if (!isCheckoutBeginCheckoutPage() || !shouldFireBeginCheckout()) {
        return
      }

      if (!orderForm?.items?.length) {
        return
      }

      if (isCheckoutIdentificationPage()) {
        identificationBeginCheckoutFiredForHash = global.location.hash
      }

      const currency = orderFormUtils.getCurrency(orderForm)
      const coupon = orderFormUtils.getCoupon(orderForm)

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
        identificationBeginCheckoutFiredForHash = ''
        return
      }

      if (!isCheckoutIdentificationPage()) {
        identificationBeginCheckoutFiredForHash = ''
      }

      if (isCheckoutBeginCheckoutPage()) {
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
