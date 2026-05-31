/**
 * Checkout shipping step (#/shipping): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  global.create5_2_1__shippingScreening = ({ pushToDataLayer }) => {
    let lastVirtualPageUrl = ''

    const getPageTitle = () => document.title || 'Checkout'

    const pushShippingScreeningVirtualPage = () => {
      if (!isCheckoutShippingPage()) {
        return
      }

      const pageUrl = global.location.href

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushToDataLayer({
        event: 'virtualPage',
        page_location: pageUrl,
        page_title: getPageTitle(),
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
