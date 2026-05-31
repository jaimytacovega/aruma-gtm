/**
 * Checkout payment step (#/payment): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  global.create5_3_1__paymentScreening = ({ pushToDataLayer }) => {
    let lastVirtualPageUrl = ''

    const getPageTitle = () => document.title || 'Checkout'

    const pushPaymentScreeningVirtualPage = () => {
      if (!isCheckoutPaymentPage()) {
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
