/**
 * Checkout shipping step (#/shipping): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const SHIPPING_PAGE_TITLE = 'Aruma - Checkout - Envio'
  const SHIPPING_CHECKOUT_SCREEN = 'shipping'

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  global.create5_2_1__shippingScreening = ({
    pushToDataLayer,
    ensureCheckoutScreening,
  }) => {
    let lastVirtualPageUrl = ''

    const pushShippingScreeningVirtualPage = () => {
      if (!isCheckoutShippingPage()) {
        return
      }

      if (typeof ensureCheckoutScreening === 'function') {
        ensureCheckoutScreening()
      }

      const pageUrl = global.location.href

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushToDataLayer({
        event: 'virtualPage',
        page_location: pageUrl,
        page_title: SHIPPING_PAGE_TITLE,
        checkout_screen: SHIPPING_CHECKOUT_SCREEN,
      })
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

    return attach
  }
})(window)
