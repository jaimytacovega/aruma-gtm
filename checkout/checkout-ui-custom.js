/**
 * Checkout-only script. aruma-gtm (react/index.tsx) does NOT run on /checkout/#/cart.
 *
 * Deploy to checkout6-custom.js (paste in order):
 * 1. checkout/4_3__cartPickButtons.js
 * 2. checkout/5_1_1__checkoutScreening.js
 * 3. checkout/checkoutCartItems.js
 * 4. checkout/5_1_2__startCheckout.js
 * 5. checkout/5_1_3__companyInfo.js
 * 6. checkout/5_1_4__submitCompanyInfo.js
 * 7. This file
 */
;(() => {
  if (window.__arumaGtmCheckoutInitialized) {
    return
  }

  if (typeof window.create4_3__cartPickButtons !== 'function') {
    console.error(
      '[aruma-gtm] Missing create4_3__cartPickButtons. Paste checkout/4_3__cartPickButtons.js first.'
    )
    return
  }

  if (typeof window.create5_1_1__checkoutScreening !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_1_1__checkoutScreening. Paste checkout/5_1_1__checkoutScreening.js first.'
    )
    return
  }

  if (typeof window.createCheckoutCartItems !== 'function') {
    console.error(
      '[aruma-gtm] Missing createCheckoutCartItems. Paste checkout/checkoutCartItems.js first.'
    )
    return
  }

  if (typeof window.create5_1_2__startCheckout !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_1_2__startCheckout. Paste checkout/5_1_2__startCheckout.js first.'
    )
    return
  }

  if (typeof window.create5_1_3__companyInfo !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_1_3__companyInfo. Paste checkout/5_1_3__companyInfo.js first.'
    )
    return
  }

  if (typeof window.create5_1_4__submitCompanyInfo !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_1_4__submitCompanyInfo. Paste checkout/5_1_4__submitCompanyInfo.js first.'
    )
    return
  }

  window.__arumaGtmCheckoutInitialized = true

  window.dataLayer = window.dataLayer || []

  const log = (...args) => {
    console.info('[aruma-gtm]', ...args)
  }

  const pushToDataLayer = (payload) => {
    window.dataLayer.push(payload)
    log(JSON.stringify(payload))
  }

  const isCheckoutCartPage = () =>
    window.location.pathname.includes('/checkout') &&
    (window.location.hash.includes('/cart') ||
      window.location.hash.includes('cart'))

  let lastAnalyticsUrl = ''

  const pushAnalyticsLoaded = () => {
    if (!isCheckoutCartPage()) {
      return
    }

    const pageUrl = window.location.href

    if (pageUrl === lastAnalyticsUrl) {
      return
    }

    lastAnalyticsUrl = pageUrl

    pushToDataLayer({
      event: 'analytics_loaded',
      pageTitle: document.title,
      pageUrl,
    })
  }

  const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

  const pushCartButtonEvent = (cta) => {
    pushToDataLayer({
      event: 'virtualEvent',
      portal: 'Aruma',
      subportal: 'Carrito',
      seccion: 'Carrito',
      subseccion: 'Carrito',
      intencion: cta,
      accion: 'Seleccionar elemento',
      elemento: 'Boton',
      cta,
    })
  }

  const cartPickButtons = window.create4_3__cartPickButtons({
    isCheckoutCartPage,
    pushCartButtonEvent,
    normalizeText,
  })

  const { NOT_AVAILABLE, enrichOrderFormItems } = window.createCheckoutCartItems()

  const checkoutScreening = window.create5_1_1__checkoutScreening({
    pushToDataLayer,
  })

  const startCheckout = window.create5_1_2__startCheckout({
    pushToDataLayer,
    enrichOrderFormItems,
    NOT_AVAILABLE,
  })

  const companyInfo = window.create5_1_3__companyInfo({
    pushToDataLayer,
    normalizeText,
  })

  const submitCompanyInfo = window.create5_1_4__submitCompanyInfo({
    pushToDataLayer,
    normalizeText,
  })

  const handleCartButtonsClick = (event) => {
    cartPickButtons(event)
  }

  const init = () => {
    pushAnalyticsLoaded()
    checkoutScreening()
    startCheckout()
    companyInfo()
    submitCompanyInfo()
    // Capture phase runs before Knockout's click: cart.next handler.
    document.addEventListener('click', handleCartButtonsClick, true)
  }

  window.addEventListener('hashchange', () => {
    lastAnalyticsUrl = ''
    pushAnalyticsLoaded()
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
