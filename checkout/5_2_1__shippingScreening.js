/**
 * Checkout shipping step (#/shipping): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const SHIPPING_PAGE_TITLE = 'Aruma - Checkout - Envio'
  const SHIPPING_CHECKOUT_SCREEN = 'shipping'

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  const hasShippingVirtualPageInDataLayer = () => {
    const dataLayer = global.dataLayer || []

    return dataLayer.some((entry) => {
      if (!entry || entry.arumaGtm !== true || entry.event !== 'virtualPage') {
        return false
      }

      if (entry.checkout_screen === SHIPPING_CHECKOUT_SCREEN) {
        return true
      }

      return entry.page_title === SHIPPING_PAGE_TITLE
    })
  }

  global.create5_2_1__shippingScreening = ({
    pushToDataLayer,
    ensureCheckoutScreening,
  }) => {
    let lastVirtualPageUrl = ''

    const getShippingPageLocation = () =>
      `${global.location.origin}/checkout/envio`

    const buildShippingVirtualPagePayload = () => ({
      event: 'virtualPage',
      page_location: getShippingPageLocation(),
      page_title: SHIPPING_PAGE_TITLE,
      checkout_screen: SHIPPING_CHECKOUT_SCREEN,
    })

    const pushShippingVirtualPage = () => {
      pushToDataLayer(buildShippingVirtualPagePayload())
    }

    const ensureShippingVirtualPage = () => {
      if (hasShippingVirtualPageInDataLayer()) {
        return false
      }

      if (typeof ensureCheckoutScreening === 'function') {
        ensureCheckoutScreening()
      }

      pushShippingVirtualPage()

      return true
    }

    const pushShippingScreeningVirtualPage = () => {
      if (!isCheckoutShippingPage()) {
        return
      }

      if (typeof ensureCheckoutScreening === 'function') {
        ensureCheckoutScreening()
      }

      const pageUrl = getShippingPageLocation()

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushShippingVirtualPage()
    }

    const onHashChange = () => {
      if (!isCheckoutShippingPage()) {
        lastVirtualPageUrl = ''
        return
      }

      pushShippingScreeningVirtualPage()
    }

    const attach = () => {
      pushShippingScreeningVirtualPage()
      global.addEventListener('hashchange', onHashChange)
    }

    return {
      attach,
      ensureShippingVirtualPage,
      hasShippingVirtualPageInDataLayer,
    }
  }
})(window)
