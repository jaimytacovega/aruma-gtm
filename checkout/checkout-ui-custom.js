/**
 * Paste this file into VTEX Admin → Store Settings → Checkout → Checkout UI Custom → JavaScript.
 * Pixel apps (aruma-gtm react/index.tsx) do not run on /checkout — only on the storefront.
 */
;(function () {
  if (window.__arumaGtmCheckoutInitialized) {
    return
  }

  window.__arumaGtmCheckoutInitialized = true

  window.dataLayer = window.dataLayer || []

  var log = function () {
    console.info.apply(console, ['[aruma-gtm]'].concat([].slice.call(arguments)))
  }

  var pushToDataLayer = function (payload) {
    window.dataLayer.push(payload)
    log(JSON.stringify(payload))
  }

  var isCheckoutCartPage = function () {
    return (
      window.location.pathname.indexOf('/checkout') !== -1 &&
      (window.location.hash.indexOf('/cart') !== -1 ||
        window.location.hash.indexOf('cart') !== -1)
    )
  }

  var lastAnalyticsUrl = ''

  var pushAnalyticsLoaded = function () {
    if (!isCheckoutCartPage()) {
      return
    }

    var pageUrl = window.location.href

    if (pageUrl === lastAnalyticsUrl) {
      return
    }

    lastAnalyticsUrl = pageUrl

    pushToDataLayer({
      event: 'analytics_loaded',
      pageTitle: document.title,
      pageUrl: pageUrl,
    })
  }

  var normalizeText = function (value) {
    return (value || '').replace(/\s+/g, ' ').trim()
  }

  var pushCartButtonEvent = function (cta) {
    pushToDataLayer({
      event: 'virtualEvent',
      portal: 'Aruma',
      subportal: 'Carrito',
      seccion: 'Carrito',
      subseccion: 'Carrito',
      intencion: cta,
      accion: 'Seleccionar elemento',
      elemento: 'Boton',
      cta: cta,
    })
  }

  var handleCartButtonsClick = function (event) {
    if (!isCheckoutCartPage()) {
      return
    }

    var target = event.target

    if (!target || !target.closest) {
      return
    }

    var finalizeButton = target.closest(
      '#cart-to-orderform, a[data-event="cartToOrderform"]'
    )

    if (finalizeButton) {
      var finalizeCta =
        normalizeText(finalizeButton.textContent) || 'Finalizar compra'

      pushCartButtonEvent(finalizeCta)

      return
    }

    var continueShoppingButton = target.closest('.boton-seguir-comprando a')

    if (!continueShoppingButton) {
      return
    }

    var continueCta =
      normalizeText(
        continueShoppingButton.querySelector('p')
          ? continueShoppingButton.querySelector('p').textContent
          : ''
      ) ||
      normalizeText(continueShoppingButton.textContent) ||
      'Seguir comprando'

    pushCartButtonEvent(continueCta)
  }

  var init = function () {
    pushAnalyticsLoaded()
    document.addEventListener('click', handleCartButtonsClick, false)
  }

  window.addEventListener('hashchange', function () {
    lastAnalyticsUrl = ''
    pushAnalyticsLoaded()
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
