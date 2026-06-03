/**
 * Checkout identification (#/profile, #/email): virtualPage. Paste before checkout-ui-custom.js.
 */
;((global) => {
  const IDENTIFICATION_PAGE_TITLE = 'Aruma - Checkout - Identifcacion'
  const IDENTIFICATION_CHECKOUT_SCREEN = 'identification'

  const isCheckoutScreeningPage = () => {
    if (!global.location.pathname.includes('/checkout')) {
      return false
    }

    const hash = global.location.hash

    return hash.includes('/profile') || hash.includes('/email')
  }

  const hasIdentificationVirtualPageInDataLayer = () => {
    const dataLayer = global.dataLayer || []

    return dataLayer.some((entry) => {
      if (!entry || entry.event !== 'virtualPage') {
        return false
      }

      if (entry.checkout_screen === IDENTIFICATION_CHECKOUT_SCREEN) {
        return true
      }

      return entry.page_title === IDENTIFICATION_PAGE_TITLE
    })
  }

  global.create5_1_1__checkoutScreening = ({ pushToDataLayer }) => {
    let lastVirtualPageUrl = ''

    const buildIdentificationVirtualPagePayload = (pageUrl) => ({
      event: 'virtualPage',
      page_location: pageUrl,
      page_title: IDENTIFICATION_PAGE_TITLE,
      checkout_screen: IDENTIFICATION_CHECKOUT_SCREEN,
    })

    const getIdentificationBackfillLocation = () => {
      if (isCheckoutScreeningPage()) {
        return global.location.href
      }

      return `${global.location.origin}${global.location.pathname}#/profile`
    }

    const pushIdentificationVirtualPage = (pageUrl) => {
      pushToDataLayer(buildIdentificationVirtualPagePayload(pageUrl))
    }

    const ensureIdentificationVirtualPage = () => {
      if (hasIdentificationVirtualPageInDataLayer()) {
        return false
      }

      pushIdentificationVirtualPage(getIdentificationBackfillLocation())

      return true
    }

    const pushCheckoutScreeningVirtualPage = () => {
      if (!isCheckoutScreeningPage()) {
        return
      }

      const pageUrl = global.location.href

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushIdentificationVirtualPage(pageUrl)
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

    return {
      attach,
      ensureIdentificationVirtualPage,
      hasIdentificationVirtualPageInDataLayer,
    }
  }
})(window)
