/**
 * Checkout profile step (#/profile): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const isCheckoutProfilePage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/profile')

  global.create5_1_1__checkoutScreening = ({ pushToDataLayer }) => {
    let lastVirtualPageUrl = ''

    const getPageTitle = () => document.title || 'Checkout'

    const pushCheckoutScreeningVirtualPage = () => {
      if (!isCheckoutProfilePage()) {
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
      if (!isCheckoutProfilePage()) {
        lastVirtualPageUrl = ''
        return
      }

      pushCheckoutScreeningVirtualPage()
    }

    const attach = () => {
      pushCheckoutScreeningVirtualPage()
      global.addEventListener('hashchange', onHashChange)
    }

    return attach
  }
})(window)
