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
      if (!entry || entry.arumaGtm !== true || entry.event !== 'virtualPage') {
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

    const getIdentificationPageLocation = () =>
      `${global.location.origin}/checkout/identificacion`

    const buildIdentificationVirtualPagePayload = () => ({
      event: 'virtualPage',
      page_location: getIdentificationPageLocation(),
      page_title: IDENTIFICATION_PAGE_TITLE,
      checkout_screen: IDENTIFICATION_CHECKOUT_SCREEN,
    })

    const pushIdentificationVirtualPage = () => {
      pushToDataLayer(buildIdentificationVirtualPagePayload())
    }

    const ensureIdentificationVirtualPage = () => {
      if (hasIdentificationVirtualPageInDataLayer()) {
        return false
      }

      pushIdentificationVirtualPage()

      return true
    }

    const pushCheckoutScreeningVirtualPage = () => {
      if (!isCheckoutScreeningPage()) {
        return
      }

      const pageUrl = getIdentificationPageLocation()

      if (pageUrl === lastVirtualPageUrl) {
        return
      }

      lastVirtualPageUrl = pageUrl

      pushIdentificationVirtualPage()
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
