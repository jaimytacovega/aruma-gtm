/**
 * Checkout shipping (#/shipping): add_shipping_info after successful submit (#btn-go-to-payment).
 * Fallback on #/payment when previous navigation was #/cart (after begin_checkout).
 */
;((global) => {
  const SHIPPING_SUBMIT_SELECTOR = '#btn-go-to-payment'
  const PENDING_TIMEOUT_MS = 30000

  const isCheckoutShippingPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/shipping')

  const isCheckoutPaymentPage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/payment')

  const isSubmitButtonEnabled = (button) => {
    if (button.hasAttribute('disabled')) {
      return false
    }

    if ('disabled' in button && button.disabled) {
      return false
    }

    const style = global.getComputedStyle(button)

    if (style.pointerEvents === 'none' || style.cursor === 'not-allowed') {
      return false
    }

    return true
  }

  const matchesShippingSubmitButton = (node) =>
    node instanceof Element && node.matches(SHIPPING_SUBMIT_SELECTOR)

  const findShippingSubmitButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesShippingSubmitButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(SHIPPING_SUBMIT_SELECTOR)
    }

    return null
  }

  global.create5_2_2__submitShipping = ({
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
    normalizeText,
    NOT_AVAILABLE,
  }) => {
    const log = (...args) => {
      console.info('[aruma-gtm]', 'checkout-flow', 'add_shipping_info', ...args)
    }

    const addShippingInfoFiredHashes = new Set()

    const claimAddShippingInfoForHash = (hash) => {
      if (addShippingInfoFiredHashes.has(hash)) {
        return false
      }

      addShippingInfoFiredHashes.add(hash)
      return true
    }

    let pendingShippingSubmit = false
    let capturedShippingTier = ''
    let pendingTimeoutId = null

    const clearPending = () => {
      pendingShippingSubmit = false
      capturedShippingTier = ''

      if (pendingTimeoutId !== null) {
        global.clearTimeout(pendingTimeoutId)
        pendingTimeoutId = null
      }
    }

    const getShippingTierFromDom = () => {
      if (
        document.querySelector(
          '#shipping-option-pickup-in-point.shp-method-option-active, #shipping-option-pickup-in-point.vtex-omnishipping-1-x-deliveryOptionActive'
        )
      ) {
        return 'pickup-in-point'
      }

      if (
        document.querySelector(
          '#shipping-option-delivery.shp-method-option-active, #shipping-option-delivery.vtex-omnishipping-1-x-deliveryOptionActive'
        )
      ) {
        return 'delivery'
      }

      const activeOption = document.querySelector(
        '.shp-method-option-active, .vtex-omnishipping-1-x-deliveryOptionActive'
      )

      if (!activeOption) {
        return ''
      }

      const main = activeOption.querySelector('.shp-method-option-text')?.textContent
      const complement = activeOption.querySelector(
        '.shp-method-option-complement'
      )?.textContent

      return normalizeText([main, complement].filter(Boolean).join(' '))
    }

    const getShippingTierFromOrderForm = (orderForm) => {
      const logisticsInfo = orderForm?.shippingData?.logisticsInfo ?? []

      for (const logistics of logisticsInfo) {
        const selectedSla = logistics?.slas?.find(
          (sla) => sla.id === logistics.selectedSlaId
        )

        if (selectedSla?.name) {
          return normalizeText(selectedSla.name)
        }

        if (logistics?.selectedSla) {
          return normalizeText(logistics.selectedSla)
        }

        if (selectedSla?.deliveryChannel === 'pickup-in-point') {
          return 'pickup-in-point'
        }

        if (selectedSla?.deliveryChannel === 'delivery') {
          return 'delivery'
        }

        if (logistics?.selectedDeliveryChannel === 'pickup-in-point') {
          return 'pickup-in-point'
        }

        if (logistics?.selectedDeliveryChannel === 'delivery') {
          return 'delivery'
        }
      }

      return ''
    }

    const resolveShippingTier = (orderForm) => {
      const raw =
        capturedShippingTier ||
        getShippingTierFromDom() ||
        getShippingTierFromOrderForm(orderForm) ||
        ''

      if (raw && typeof orderFormUtils.normalizeShippingTier === 'function') {
        const normalized = orderFormUtils.normalizeShippingTier(raw)

        if (normalized !== NOT_AVAILABLE) {
          return normalized
        }
      }

      if (typeof orderFormUtils.getShippingTier === 'function') {
        return orderFormUtils.getShippingTier(orderForm)
      }

      return raw || NOT_AVAILABLE
    }

    const buildAddShippingInfoPayload = (
      items,
      currency,
      coupon,
      shipping_tier,
      orderForm
    ) => {
      const totals = orderFormUtils.buildCheckoutEcommerceTotals(orderForm, items)

      return {
        event: 'add_shipping_info',
        ecommerce: {
          currency,
          value: totals.value,
          magentaPoints_value: totals.magentaPoints_value,
          coupon,
          shipping_tier,
          items,
        },
      }
    }

    const pushAddShippingInfo = async (orderForm, reason) => {
      if (!orderForm?.items?.length) {
        log('skip: no items', reason)
        return
      }

      const currency = orderFormUtils.getCurrency(orderForm)
      const coupon = orderFormUtils.getCoupon(orderForm)
      const shipping_tier = resolveShippingTier(orderForm)

      const items = await enrichOrderFormItems(
        orderForm.items,
        orderFormUtils
      )

      log('firing', reason, global.location.hash)
      pushToDataLayer(
        buildAddShippingInfoPayload(items, currency, coupon, shipping_tier, orderForm)
      )

      if (
        typeof orderFormUtils.persistCheckoutPurchaseContext === 'function' &&
        shipping_tier !== NOT_AVAILABLE
      ) {
        orderFormUtils.persistCheckoutPurchaseContext({ shipping_tier })
      }
    }

    const completeShippingSubmit = async (orderForm) => {
      if (!pendingShippingSubmit || !orderForm?.items?.length) {
        return
      }

      await pushAddShippingInfo(orderForm, 'shipping-submit')
      clearPending()
    }

    const runAddShippingInfoFallback = async (orderForm, source) => {
      if (!isCheckoutPaymentPage()) {
        return
      }

      if (!orderFormUtils.cameFromCheckoutCart()) {
        log('skip: payment without cart previous', source, {
          hash: global.location.hash,
          previous: orderFormUtils.getPreviousCheckoutNavigation(),
        })
        return
      }

      const hash = global.location.hash

      if (!claimAddShippingInfoForHash(`${hash}:fallback`)) {
        log('skip: already fired fallback for hash', source, hash)
        return
      }

      await orderFormUtils.chainCheckoutFlowStep('add_shipping_info', () =>
        pushAddShippingInfo(orderForm, `payment-from-cart:${source}`)
      )
    }

    const requestOrderFormAndComplete = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void completeShippingSubmit(orderForm)
      })
    }

    const startPendingShippingSubmit = () => {
      pendingShippingSubmit = true
      capturedShippingTier = getShippingTierFromDom()

      if (pendingTimeoutId !== null) {
        global.clearTimeout(pendingTimeoutId)
      }

      pendingTimeoutId = global.setTimeout(() => {
        clearPending()
      }, PENDING_TIMEOUT_MS)
    }

    const handleShippingSubmitClick = (event) => {
      if (!isCheckoutShippingPage()) {
        return
      }

      const button = findShippingSubmitButton(event)

      if (!button || !isSubmitButtonEnabled(button)) {
        return
      }

      startPendingShippingSubmit()
    }

    const requestOrderFormAndRunFallback = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void runAddShippingInfoFallback(orderForm, 'getOrderForm')
      })
    }

    const handleHashChange = () => {
      if (!global.location.pathname.includes('/checkout')) {
        return
      }

      if (isCheckoutPaymentPage()) {
        if (pendingShippingSubmit) {
          requestOrderFormAndComplete()
          return
        }

        requestOrderFormAndRunFallback()
      }
    }

    const handleOrderFormUpdated = (_, orderForm) => {
      if (pendingShippingSubmit) {
        if (isCheckoutPaymentPage()) {
          void completeShippingSubmit(orderForm)
          return
        }

        const hasSelectedShipping = (orderForm?.shippingData?.logisticsInfo ?? []).some(
          (logistics) => Boolean(logistics?.selectedSlaId)
        )

        if (hasSelectedShipping && !isCheckoutShippingPage()) {
          void completeShippingSubmit(orderForm)
        }

        return
      }
    }

    const attach = () => {
      document.addEventListener('click', handleShippingSubmitClick, true)
      global.addEventListener('hashchange', handleHashChange, true)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', handleOrderFormUpdated)
      }

      if (isCheckoutPaymentPage()) {
        requestOrderFormAndRunFallback()
      }
    }

    return attach
  }
})(window)
