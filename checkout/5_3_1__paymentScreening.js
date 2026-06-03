/**
 * Checkout payment step (#/payment): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const PAYMENT_PAGE_TITLE = 'Aruma - Checkout - Pago'
  const PAYMENT_CHECKOUT_SCREEN = 'payment'

  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  global.create5_3_1__paymentScreening = ({
    pushToDataLayer,
    ensureCheckoutScreening,
    ensureShippingScreening,
  }) => {
    let lastVirtualPageUrl = ''

    const ensurePriorCheckoutScreens = () => {
      if (typeof ensureCheckoutScreening === 'function') {
        ensureCheckoutScreening()
      }

      if (typeof ensureShippingScreening === 'function') {
        ensureShippingScreening()
      }
    }

    const pushPaymentScreeningVirtualPage = () => {
      if (!isCheckoutPaymentPage()) {
        return
      }

      ensurePriorCheckoutScreens()

      const pageUrl = global.location.href

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushToDataLayer({
        event: 'virtualPage',
        page_location: pageUrl,
        page_title: PAYMENT_PAGE_TITLE,
        checkout_screen: PAYMENT_CHECKOUT_SCREEN,
      })
    }

    const onHashChange = () => {
      if (!isCheckoutPaymentPage()) {
        lastVirtualPageUrl = ''
        return
      }

      pushPaymentScreeningVirtualPage()
    }

    const attach = () => {
      pushPaymentScreeningVirtualPage()
      global.addEventListener('hashchange', onHashChange)
    }

    return attach
  }
})(window)
