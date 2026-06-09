/**
 * Checkout payment step (#/payment): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const PAYMENT_PAGE_TITLE = 'Aruma - Checkout - Pago'
  const PAYMENT_CHECKOUT_SCREEN = 'payment'

  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  const hasPaymentVirtualPageInDataLayer = () => {
    const dataLayer = global.dataLayer || []

    return dataLayer.some((entry) => {
      if (!entry || entry.arumaGtm !== true || entry.event !== 'virtualPage') {
        return false
      }

      if (entry.checkout_screen === PAYMENT_CHECKOUT_SCREEN) {
        return true
      }

      return entry.page_title === PAYMENT_PAGE_TITLE
    })
  }

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

    const getPaymentPageLocation = () =>
      `${global.location.origin}/checkout/pago`

    const buildPaymentVirtualPagePayload = () => ({
      event: 'virtualPage',
      page_location: getPaymentPageLocation(),
      page_title: PAYMENT_PAGE_TITLE,
      checkout_screen: PAYMENT_CHECKOUT_SCREEN,
    })

    const pushPaymentVirtualPage = () => {
      pushToDataLayer(buildPaymentVirtualPagePayload())
    }

    const ensurePaymentVirtualPage = () => {
      if (hasPaymentVirtualPageInDataLayer()) {
        return false
      }

      ensurePriorCheckoutScreens()
      pushPaymentVirtualPage()

      return true
    }

    const pushPaymentScreeningVirtualPage = () => {
      if (!isCheckoutPaymentPage()) {
        return
      }

      ensurePriorCheckoutScreens()

      const pageUrl = getPaymentPageLocation()

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushPaymentVirtualPage()
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

    return {
      attach,
      ensurePaymentVirtualPage,
      hasPaymentVirtualPageInDataLayer,
    }
  }
})(window)
