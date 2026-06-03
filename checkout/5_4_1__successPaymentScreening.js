/**
 * Checkout order placed: virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  global.create5_4_1__successPaymentScreening = ({
    pushToDataLayer,
    orderFormUtils,
  }) => {
    const log = (...args) => {
      console.info('[aruma-gtm]', '5_4_1__successPaymentScreening', ...args)
    }

    let lastVirtualPageUrl = ''

    const pushSuccessPaymentVirtualPage = (source) => {
      const isOrderPlaced = orderFormUtils.isCheckoutOrderPlacedPage()
      const pageUrl = global.location.href

      log('push attempt', {
        source,
        isOrderPlaced,
        pathname: global.location.pathname,
        hash: global.location.hash,
        search: global.location.search,
        pageUrl,
        lastVirtualPageUrl,
      })

      if (!isOrderPlaced) {
        log('skip: not order placed page')
        return
      }

      if (pageUrl === lastVirtualPageUrl) {
        log('skip: duplicate pageUrl')
        return
      }

      lastVirtualPageUrl = pageUrl

      const payload = {
        event: 'virtualPage',
        page_location: pageUrl,
        page_title: 'Aruma - Checkout - Compra exitosa',
      }

      log('pushing virtualPage', payload)
      pushToDataLayer(payload)
    }

    const onHashChange = () => {
      log('hashchange', {
        href: global.location.href,
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
      })

      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        lastVirtualPageUrl = ''
        log('left order placed page, reset dedupe')
        return
      }

      pushSuccessPaymentVirtualPage('hashchange')
    }

    const sync = () => {
      pushSuccessPaymentVirtualPage('sync')
    }

    const attach = () => {
      log('attach', {
        href: global.location.href,
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
        orderGroup: orderFormUtils.getOrderGroupFromUrl?.() ?? '',
      })

      pushSuccessPaymentVirtualPage('attach')

      global.addEventListener('hashchange', onHashChange)
      global.addEventListener('pageshow', () => {
        pushSuccessPaymentVirtualPage('pageshow')
      })
    }

    return { attach, sync }
  }
})(window)
