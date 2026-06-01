/**
 * Checkout order placed: virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  global.create5_4_1__successPaymentScreening = ({
    pushToDataLayer,
    orderFormUtils,
  }) => {
    let lastVirtualPageUrl = ''

    const getPageTitle = () => document.title || 'Checkout'

    const pushSuccessPaymentVirtualPage = () => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
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
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        lastVirtualPageUrl = ''
        return
      }

      pushSuccessPaymentVirtualPage()
    }

    const attach = () => {
      pushSuccessPaymentVirtualPage()
      global.addEventListener('hashchange', onHashChange)
    }

    return attach
  }
})(window)
