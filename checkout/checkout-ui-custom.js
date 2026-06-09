/**
 * Checkout-only script. aruma-gtm (react/index.tsx) does NOT run on /checkout/#/cart.
 *
 * Deploy (single paste): checkout/checkout-ui-custom.min.js → checkout6-custom.js
 * Regenerate min bundle after edits: node checkout/build-checkout-min.mjs
 *
 * Deploy (separate files, paste in order):
 * 1. checkout/4_3__cartPickButtons.js
 * 2. checkout/5_1_1__checkoutScreening.js
 * 3. checkout/listContextStore.js
 * 4. checkout/checkoutCartItems.js
 * 5. checkout/checkoutOrderFormUtils.js
 * 6. checkout/3_5__addToCart.js
 * 7. checkout/4_2__removeFromCart.js
 * 8. checkout/4_1__cartImpression.js
 * 9. checkout/5_1_2__startCheckout.js
 * 10. checkout/5_1_3__companyInfo.js
 * 11. checkout/5_1_4__submitCompanyInfo.js
 * 12. checkout/5_2_1__shippingScreening.js
 * 13. checkout/5_2_2__submitShipping.js
 * 14. checkout/5_2_3__shippingPickButton.js
 * 15. checkout/5_3_1__paymentScreening.js
 * 16. checkout/5_3_2__paymentInfo.js
 * 17. checkout/5_3_3__paymentPickButton.js
 * 18. checkout/5_4_1__successPaymentScreening.js
 * 19. checkout/5_4_2__successPayment.js
 * 20. This file
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

  if (typeof window.createListContextStore !== 'function') {
    console.error(
      '[aruma-gtm] Missing createListContextStore. Paste checkout/listContextStore.js first.'
    )
    return
  }

  if (typeof window.createCheckoutCartItems !== 'function') {
    console.error(
      '[aruma-gtm] Missing createCheckoutCartItems. Paste checkout/checkoutCartItems.js first.'
    )
    return
  }

  if (typeof window.createCheckoutOrderFormUtils !== 'function') {
    console.error(
      '[aruma-gtm] Missing createCheckoutOrderFormUtils. Paste checkout/checkoutOrderFormUtils.js first.'
    )
    return
  }

  if (typeof window.create3_5__addToCart !== 'function') {
    console.error(
      '[aruma-gtm] Missing create3_5__addToCart. Paste checkout/3_5__addToCart.js first.'
    )
    return
  }

  if (typeof window.create4_2__removeFromCart !== 'function') {
    console.error(
      '[aruma-gtm] Missing create4_2__removeFromCart. Paste checkout/4_2__removeFromCart.js first.'
    )
    return
  }

  if (typeof window.create4_1__cartImpression !== 'function') {
    console.error(
      '[aruma-gtm] Missing create4_1__cartImpression. Paste checkout/4_1__cartImpression.js first.'
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

  if (typeof window.create5_2_1__shippingScreening !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_2_1__shippingScreening. Paste checkout/5_2_1__shippingScreening.js first.'
    )
    return
  }

  if (typeof window.create5_2_2__submitShipping !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_2_2__submitShipping. Paste checkout/5_2_2__submitShipping.js first.'
    )
    return
  }

  if (typeof window.create5_2_3__shippingPickButton !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_2_3__shippingPickButton. Paste checkout/5_2_3__shippingPickButton.js first.'
    )
    return
  }

  if (typeof window.create5_3_1__paymentScreening !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_3_1__paymentScreening. Paste checkout/5_3_1__paymentScreening.js first.'
    )
    return
  }

  if (typeof window.create5_3_2__paymentInfo !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_3_2__paymentInfo. Paste checkout/5_3_2__paymentInfo.js first.'
    )
    return
  }

  if (typeof window.create5_3_3__paymentPickButton !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_3_3__paymentPickButton. Paste checkout/5_3_3__paymentPickButton.js first.'
    )
    return
  }

  if (typeof window.create5_4_1__successPaymentScreening !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_4_1__successPaymentScreening. Paste checkout/5_4_1__successPaymentScreening.js first.'
    )
    return
  }

  if (typeof window.create5_4_2__successPayment !== 'function') {
    console.error(
      '[aruma-gtm] Missing create5_4_2__successPayment. Paste checkout/5_4_2__successPayment.js first.'
    )
    return
  }

  window.__arumaGtmCheckoutInitialized = true

  window.dataLayer = window.dataLayer || []

  const log = (...args) => {
    console.info('[aruma-gtm]', ...args)
  }

  const { NOT_AVAILABLE, enrichOrderFormItems } = window.createCheckoutCartItems()
  const listContextStore = window.createListContextStore(NOT_AVAILABLE)
  const orderFormUtils = window.createCheckoutOrderFormUtils(NOT_AVAILABLE)

  const pushToDataLayer = (payload) => {
    window.dataLayer.push(payload)
    listContextStore.persistListContextFromPayload(payload)
    log(JSON.stringify(payload))
  }

  const isCheckoutCartPage = () =>
    window.location.pathname.includes('/checkout') &&
    window.location.hash.includes('/cart')

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

  const checkoutScreening = window.create5_1_1__checkoutScreening({
    pushToDataLayer,
  })

  const cartImpression = window.create4_1__cartImpression({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
  })

  const addToCart = window.create3_5__addToCart({
    isCheckoutCartPage,
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
  })

  const removeFromCart = window.create4_2__removeFromCart({
    isCheckoutCartPage,
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
  })

  const startCheckout = window.create5_1_2__startCheckout({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
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

  const shippingScreening = window.create5_2_1__shippingScreening({
    pushToDataLayer,
    ensureCheckoutScreening: checkoutScreening.ensureIdentificationVirtualPage,
  })

  const submitShipping = window.create5_2_2__submitShipping({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
    normalizeText,
    NOT_AVAILABLE,
  })

  const shippingPickButton = window.create5_2_3__shippingPickButton({
    pushToDataLayer,
    normalizeText,
  })

  const paymentScreening = window.create5_3_1__paymentScreening({
    pushToDataLayer,
    ensureCheckoutScreening: checkoutScreening.ensureIdentificationVirtualPage,
    ensureShippingScreening: shippingScreening.ensureShippingVirtualPage,
  })

  const paymentInfo = window.create5_3_2__paymentInfo({
    pushToDataLayer,
    enrichOrderFormItems,
    NOT_AVAILABLE,
    orderFormUtils,
  })

  const paymentPickButton = window.create5_3_3__paymentPickButton({
    pushToDataLayer,
    normalizeText,
    orderFormUtils,
  })

  const successPaymentScreening = window.create5_4_1__successPaymentScreening({
    pushToDataLayer,
    orderFormUtils,
    ensurePaymentScreening: paymentScreening.ensurePaymentVirtualPage,
  })

  const successPayment = window.create5_4_2__successPayment({
    pushToDataLayer,
    enrichOrderFormItems,
    NOT_AVAILABLE,
    orderFormUtils,
  })

  const syncOrderPlacedEvents = () => {
    if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
      return
    }

    log('syncOrderPlacedEvents', window.location.href)
    orderFormUtils.clearCheckoutListContext()
    successPaymentScreening.sync()
    successPayment.sync()
  }

  window.__arumaGtmOrderPlacedSync = syncOrderPlacedEvents

  let lastWatchedHref = window.location.href

  const watchCheckoutHref = () => {
    if (window.location.href === lastWatchedHref) {
      return
    }

    lastWatchedHref = window.location.href
    log('href changed', lastWatchedHref)
    syncOrderPlacedEvents()
    lastAnalyticsUrl = ''
    pushAnalyticsLoaded()
  }

  const handleCartButtonsClick = (event) => {
    cartPickButtons(event)
  }

  const init = () => {
    pushAnalyticsLoaded()
    cartImpression()
    addToCart()
    removeFromCart()
    checkoutScreening.attach()
    startCheckout()
    companyInfo()
    submitCompanyInfo()
    shippingScreening.attach()
    submitShipping()
    shippingPickButton()
    paymentScreening.attach()
    paymentInfo()
    paymentPickButton()
    successPaymentScreening.attach()
    successPayment.attach()
    syncOrderPlacedEvents()
    // Capture phase runs before Knockout's click: cart.next handler.
    document.addEventListener('click', handleCartButtonsClick, true)
  }

  orderFormUtils.setupOrderPlacedTransitionWatcher()
  window.setInterval(watchCheckoutHref, 200)
  window.addEventListener('popstate', syncOrderPlacedEvents)
  window.addEventListener('pageshow', syncOrderPlacedEvents)

  window.addEventListener('hashchange', () => {
    lastWatchedHref = window.location.href
    syncOrderPlacedEvents()
    lastAnalyticsUrl = ''
    pushAnalyticsLoaded()
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
