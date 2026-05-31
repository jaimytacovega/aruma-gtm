/**
 * Checkout-only script. aruma-gtm (react/index.tsx) does NOT run on /checkout/#/cart.
 *
 * Where to paste (use whichever exists in your account):
 *
 * A) Checkout UI Custom app (vtex.checkout-ui-custom installed)
 *    Admin search: "Checkout UI Custom"
 *    Or: Store settings → Storefront → Checkout UI Custom → JavaScript tab → Publish
 *
 * B) Legacy checkout code editor (most common if A is missing)
 *    Admin sidebar: Checkout → gear icon on your store → Code tab
 *    → open checkout6-custom.js → paste at end → Save
 *    Direct URL:
 *    https://{account}.myvtex.com/admin/portal#/sites/default/code/files/checkout6-custom.js
 */
;(() => {
  if (window.__arumaGtmCheckoutInitialized) {
    return
  }

  window.__arumaGtmCheckoutInitialized = true

  window.dataLayer = window.dataLayer || []

  const FINALIZE_SELECTOR =
    '#cart-to-orderform, a[data-event="cartToOrderform"], a.btn-place-order'

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

  const matchesFinalizeButton = (element) => {
    if (!(element instanceof Element)) {
      return false
    }

    return element.matches(FINALIZE_SELECTOR)
  }

  /** Knockout may stop bubble; disabled button uses pointer-events:none (click goes through). */
  const findFinalizeButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesFinalizeButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      const fromTarget = event.target.closest(FINALIZE_SELECTOR)

      if (fromTarget) {
        return fromTarget
      }
    }

    const button = document.querySelector('#cart-to-orderform')

    if (!button || typeof event.clientX !== 'number') {
      return null
    }

    const rect = button.getBoundingClientRect()

    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      return button
    }

    return null
  }

  const handleCartButtonsClick = (event) => {
    if (!isCheckoutCartPage()) {
      return
    }

    const finalizeButton = findFinalizeButton(event)

    if (finalizeButton) {
      const finalizeCta = 'Finalizar compra'

      pushCartButtonEvent(finalizeCta)

      return
    }

    const target = event.target

    if (!(target instanceof Element)) {
      return
    }

    const continueShoppingButton = target.closest('.boton-seguir-comprando a')

    if (!continueShoppingButton) {
      return
    }

    const continueLabel = continueShoppingButton.querySelector('p')
    const continueCta =
      normalizeText(continueLabel ? continueLabel.textContent : '') ||
      normalizeText(continueShoppingButton.textContent) ||
      'Seguir comprando'

    pushCartButtonEvent(continueCta)
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
