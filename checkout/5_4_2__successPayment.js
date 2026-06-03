/**
 * Checkout order placed (/checkout/orderPlaced/?og=...): purchase event.
 */
;((global) => {
  const LOAD_RETRY_MS = 500
  const LOAD_MAX_ATTEMPTS = 12

  global.create5_4_2__successPayment = ({
    pushToDataLayer,
    enrichOrderFormItems,
    NOT_AVAILABLE,
    orderFormUtils,
  }) => {
    let lastPurchaseTransactionId = ''
    let loadAttempts = 0
    let loadTimeoutId = null

    const buildPurchasePayload = (
      items,
      orderForm,
      currency,
      coupon,
      payment_type,
      shipping_tier,
      transaction_id,
      totals
    ) => ({
      event: 'purchase',
      ecommerce: {
        transaction_id,
        currency,
        value: totals.value,
        magentaPoints_value: totals.magentaPoints_value,
        tax: orderFormUtils.getTax(orderForm),
        shipping: orderFormUtils.getShipping(orderForm),
        coupon,
        shipping_tier,
        payment_type,
        items,
      },
    })

    const runPurchase = async (orderForm) => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return
      }

      if (!orderForm?.items?.length) {
        return
      }

      const transaction_id = orderFormUtils.getTransactionId(orderForm)

      if (
        transaction_id === lastPurchaseTransactionId &&
        transaction_id !== NOT_AVAILABLE
      ) {
        return
      }

      lastPurchaseTransactionId = transaction_id

      const currency = orderFormUtils.getCurrency(orderForm)
      const coupon = orderFormUtils.getCoupon(orderForm)
      const payment_type = orderFormUtils.getPaymentType(orderForm)
      const shipping_tier = orderFormUtils.getShippingTier(orderForm)

      const items = await enrichOrderFormItems(
        orderForm.items,
        'purchase',
        'Purchase'
      )

      const totals = orderFormUtils.buildItemsEcommerceTotals(items)

      pushToDataLayer(
        buildPurchasePayload(
          items,
          orderForm,
          currency,
          coupon,
          payment_type,
          shipping_tier,
          transaction_id,
          totals
        )
      )
    }

    const tryLoadAndRunPurchase = async () => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return false
      }

      const orderForm = await orderFormUtils.loadOrderPlacedOrderForm()

      if (orderForm?.items?.length) {
        await runPurchase(orderForm)
        return true
      }

      return false
    }

    const scheduleLoadRetry = () => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return
      }

      if (loadAttempts >= LOAD_MAX_ATTEMPTS) {
        return
      }

      loadAttempts += 1

      loadTimeoutId = global.setTimeout(async () => {
        const completed = await tryLoadAndRunPurchase()

        if (!completed) {
          scheduleLoadRetry()
        }
      }, LOAD_RETRY_MS)
    }

    const requestOrderForm = () => {
      loadAttempts = 0

      if (loadTimeoutId !== null) {
        global.clearTimeout(loadTimeoutId)
        loadTimeoutId = null
      }

      void (async () => {
        const completed = await tryLoadAndRunPurchase()

        if (!completed) {
          scheduleLoadRetry()
        }
      })()
    }

    const handleHashChange = () => {
      if (orderFormUtils.isCheckoutOrderPlacedPage()) {
        requestOrderForm()
        return
      }

      lastPurchaseTransactionId = ''
      loadAttempts = 0

      if (loadTimeoutId !== null) {
        global.clearTimeout(loadTimeoutId)
        loadTimeoutId = null
      }
    }

    const handleOrderFormUpdated = (_, orderForm) => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return
      }

      void runPurchase(orderForm)
    }

    const attach = () => {
      if (orderFormUtils.isCheckoutOrderPlacedPage()) {
        requestOrderForm()
      }

      global.addEventListener('hashchange', handleHashChange)
      global.addEventListener('pageshow', requestOrderForm)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', handleOrderFormUpdated)
      }
    }

    return attach
  }
})(window)
