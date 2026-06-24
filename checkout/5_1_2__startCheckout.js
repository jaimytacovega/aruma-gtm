/**
 * Checkout flow: begin_checkout only when the previous navigation was #/cart.
 * Regular path: cart → profile/email. Skipped steps: cart → shipping, cart → payment.
 */
;((global) => {
  const isCheckoutIdentificationPage = () => {
    if (!global.location.pathname.includes('/checkout')) {
      return false
    }

    const hash = global.location.hash

    return hash.includes('/profile') || hash.includes('/email')
  }

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  const isCheckoutFlowPage = () =>
    isCheckoutIdentificationPage() ||
    isCheckoutShippingPage() ||
    isCheckoutPaymentPage()

  global.create5_1_2__startCheckout = ({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
    NOT_AVAILABLE,
  }) => {
    const log = (...args) => {
      console.info('[aruma-gtm]', 'checkout-flow', 'begin_checkout', ...args)
    }

    const beginCheckoutFiredHashes = new Set()

    const claimBeginCheckoutForHash = (hash) => {
      if (beginCheckoutFiredHashes.has(hash)) {
        return false
      }

      beginCheckoutFiredHashes.add(hash)
      return true
    }

    const buildBeginCheckoutPayload = (items, currency, coupon, orderForm) => {
      const totals = orderFormUtils.buildCheckoutEcommerceTotals(orderForm, items)

      return {
        event: 'begin_checkout',
        ecommerce: {
          currency,
          value: totals.value,
          magentaPoints_value: totals.magentaPoints_value,
          coupon,
          items,
        },
      }
    }

    const pushBeginCheckout = async (orderForm, reason) => {
      const currency = orderFormUtils.getCurrency(orderForm)
      const coupon = orderFormUtils.getCoupon(orderForm)

      const items = await enrichOrderFormItems(
        orderForm.items,
        orderFormUtils
      )

      log('firing', reason, global.location.hash)
      pushToDataLayer(buildBeginCheckoutPayload(items, currency, coupon, orderForm))
    }

    const getFlowStep = () => {
      if (isCheckoutIdentificationPage()) {
        return 'identification'
      }

      if (isCheckoutShippingPage()) {
        return 'shipping'
      }

      if (isCheckoutPaymentPage()) {
        return 'payment'
      }

      return ''
    }

    const runStartCheckout = async (orderForm, source) => {
      if (!orderForm?.items?.length) {
        log('skip: no items', source, global.location.hash)
        return
      }

      if (!isCheckoutFlowPage()) {
        return
      }

      if (!orderFormUtils.cameFromCheckoutCart()) {
        log('skip: not from cart', source, {
          hash: global.location.hash,
          step: getFlowStep(),
          previous: orderFormUtils.getPreviousCheckoutNavigation(),
        })
        return
      }

      const hash = global.location.hash

      if (!claimBeginCheckoutForHash(hash)) {
        log('skip: already fired for hash', source, hash)
        return
      }

      const reason = `${getFlowStep()}-from-cart:${source}`
      const fire = () => pushBeginCheckout(orderForm, reason)

      if (isCheckoutPaymentPage()) {
        await orderFormUtils.chainCheckoutFlowStep('begin_checkout', fire)
        return
      }

      await fire()
    }

    const requestOrderForm = (source) => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        log('skip: vtexjs.checkout.getOrderForm unavailable', source)
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void runStartCheckout(orderForm, source)
      })
    }

    const onHashChange = () => {
      if (!global.location.pathname.includes('/checkout')) {
        return
      }

      if (isCheckoutFlowPage()) {
        requestOrderForm('hashchange')
      }
    }

    const attach = () => {
      if (isCheckoutFlowPage()) {
        requestOrderForm('attach')
      }

      global.addEventListener('hashchange', onHashChange, true)
    }

    return attach
  }
})(window)
