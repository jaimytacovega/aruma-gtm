/**
 * Checkout-only script. aruma-gtm (react/index.tsx) does NOT run on /checkout/#/cart.
 *
 * Deploy to checkout6-custom.js:
 * 1. Paste checkout/4_3__cartPickButtons.js
 * 2. Paste this file
 *
 * Or Admin: Checkout → gear → Code → checkout6-custom.js (append both in order).
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

  const handleCartButtonsClick = (event) => {
    cartPickButtons(event)
  }

  const init = () => {
    pushAnalyticsLoaded()
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
