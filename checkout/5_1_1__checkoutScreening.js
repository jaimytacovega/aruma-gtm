/**
 * Checkout identification (#/profile, #/email): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const isCheckoutScreeningPage = () => {
    if (!global.location.pathname.includes('/checkout')) {
      return false
    }

    const hash = global.location.hash

    return hash.includes('/profile') || hash.includes('/email')
  }

  global.create5_1_1__checkoutScreening = ({ pushToDataLayer }) => {
    let lastVirtualPageUrl = ''

    const pushCheckoutScreeningVirtualPage = () => {
      if (!isCheckoutScreeningPage()) {
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
        page_title: 'Aruma - Checkout - Identifcacion',
      })
    }

    const onHashChange = () => {
      if (!isCheckoutScreeningPage()) {
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
