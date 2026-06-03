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
    const log = (...args) => {
      console.info('[aruma-gtm]', '5_4_2__successPayment', ...args)
    }

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

    const runPurchase = async (orderForm, source) => {
      log('runPurchase called', {
        source,
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
        itemCount: orderForm?.items?.length ?? 0,
        orderGroup: orderFormUtils.getOrderGroupFromUrl?.() ?? '',
      })

      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        log('runPurchase skip: not order placed page')
        return
      }

      if (!orderForm?.items?.length) {
        log('runPurchase skip: no items on orderForm', orderForm)
        return
      }

      const transaction_id = orderFormUtils.getTransactionId(orderForm)

      if (
        transaction_id === lastPurchaseTransactionId &&
        transaction_id !== NOT_AVAILABLE
      ) {
        log('runPurchase skip: duplicate transaction_id', transaction_id)
        return
      }

      lastPurchaseTransactionId = transaction_id

      const currency = orderFormUtils.getCurrency(orderForm)
      const coupon = orderFormUtils.getCoupon(orderForm)
      const payment_type = orderFormUtils.getPaymentType(orderForm)
      const shipping_tier = orderFormUtils.getShippingTier(orderForm)

      log('enriching items for purchase', {
        transaction_id,
        currency,
        rawItemCount: orderForm.items.length,
      })

      let items

      try {
        items = await enrichOrderFormItems(
          orderForm.items,
          'purchase',
          'Purchase'
        )
      } catch (error) {
        log('enrichOrderFormItems failed', error)
        return
      }

      const totals = orderFormUtils.buildItemsEcommerceTotals(items)

      const payload = buildPurchasePayload(
        items,
        orderForm,
        currency,
        coupon,
        payment_type,
        shipping_tier,
        transaction_id,
        totals
      )

      log('pushing purchase', {
        transaction_id,
        itemCount: items.length,
        value: totals.value,
      })
      pushToDataLayer(payload)
    }

    const tryLoadAndRunPurchase = async (source) => {
      const isOrderPlaced = orderFormUtils.isCheckoutOrderPlacedPage()

      log('tryLoadAndRunPurchase', {
        source,
        isOrderPlaced,
        pathname: global.location.pathname,
        search: global.location.search,
        hasVtexjs: Boolean(global.vtexjs?.checkout),
      })

      if (!isOrderPlaced) {
        log('tryLoadAndRunPurchase skip: not order placed page')
        return false
      }

      let orderForm

      try {
        orderForm = await orderFormUtils.loadOrderPlacedOrderForm()
      } catch (error) {
        log('loadOrderPlacedOrderForm failed', error)
        return false
      }

      log('loadOrderPlacedOrderForm result', {
        hasOrderForm: Boolean(orderForm),
        itemCount: orderForm?.items?.length ?? 0,
        orderGroup: orderForm?.orderGroup,
        orderFormId: orderForm?.orderFormId,
      })

      if (orderForm?.items?.length) {
        await runPurchase(orderForm, source)
        return true
      }

      log('tryLoadAndRunPurchase: no items yet')
      return false
    }

    const scheduleLoadRetry = () => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        log('scheduleLoadRetry skip: not order placed page')
        return
      }

      if (loadAttempts >= LOAD_MAX_ATTEMPTS) {
        log('scheduleLoadRetry stop: max attempts reached', LOAD_MAX_ATTEMPTS)
        return
      }

      loadAttempts += 1

      log('scheduleLoadRetry', { attempt: loadAttempts, delayMs: LOAD_RETRY_MS })

      loadTimeoutId = global.setTimeout(async () => {
        const completed = await tryLoadAndRunPurchase(`retry-${loadAttempts}`)

        if (!completed) {
          scheduleLoadRetry()
        } else {
          log('purchase completed on retry', { attempt: loadAttempts })
        }
      }, LOAD_RETRY_MS)
    }

    const requestOrderForm = (source) => {
      log('requestOrderForm', { source })

      loadAttempts = 0

      if (loadTimeoutId !== null) {
        global.clearTimeout(loadTimeoutId)
        loadTimeoutId = null
      }

      void (async () => {
        const completed = await tryLoadAndRunPurchase(source)

        if (!completed) {
          log('requestOrderForm: starting retry loop')
          scheduleLoadRetry()
        }
      })()
    }

    const handleHashChange = () => {
      log('hashchange', {
        href: global.location.href,
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
      })

      if (orderFormUtils.isCheckoutOrderPlacedPage()) {
        requestOrderForm('hashchange')
        return
      }

      log('left order placed page, reset state')
      lastPurchaseTransactionId = ''
      loadAttempts = 0

      if (loadTimeoutId !== null) {
        global.clearTimeout(loadTimeoutId)
        loadTimeoutId = null
      }
    }

    const handleOrderFormUpdated = (_, orderForm) => {
      log('orderFormUpdated.vtex', {
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
        itemCount: orderForm?.items?.length ?? 0,
      })

      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return
      }

      void runPurchase(orderForm, 'orderFormUpdated.vtex')
    }

    const sync = () => {
      log('sync')
      requestOrderForm('sync')
    }

    const attach = () => {
      const isOrderPlaced = orderFormUtils.isCheckoutOrderPlacedPage()

      log('attach', {
        href: global.location.href,
        pathname: global.location.pathname,
        search: global.location.search,
        isOrderPlaced,
        orderGroup: orderFormUtils.getOrderGroupFromUrl?.() ?? '',
        hasVtexjs: Boolean(global.vtexjs?.checkout),
        hasJQuery: Boolean(global.jQuery),
      })

      if (isOrderPlaced) {
        requestOrderForm('attach')
      } else {
        log('attach skip requestOrderForm: not on order placed page yet')
      }

      global.addEventListener('hashchange', handleHashChange)
      global.addEventListener('pageshow', () => {
        requestOrderForm('pageshow')
      })

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', handleOrderFormUpdated)
        log('listening: orderFormUpdated.vtex')
      } else {
        log('jQuery not available, orderFormUpdated.vtex not bound')
      }
    }

    return { attach, sync }
  }
})(window)
