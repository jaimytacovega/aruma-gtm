/**
 * Checkout order placed: purchase event.
 */
;((global) => {
  global.create5_4_2__successPayment = ({
    pushToDataLayer,
    enrichOrderFormItems,
    NOT_AVAILABLE,
    orderFormUtils,
  }) => {
    let lastPurchaseTransactionId = ''

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

    const requestOrderForm = () => {
      if (!global.vtexjs?.checkout?.getOrderForm) {
        return
      }

      global.vtexjs.checkout.getOrderForm().done((orderForm) => {
        void runPurchase(orderForm)
      })
    }

    const handleHashChange = () => {
      if (orderFormUtils.isCheckoutOrderPlacedPage()) {
        requestOrderForm()
        return
      }

      lastPurchaseTransactionId = ''
    }

    const handleOrderFormUpdated = (_, orderForm) => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return
      }

      if (orderForm?.orderGroup || orderForm?.id) {
        void runPurchase(orderForm)
      }
    }

    const attach = () => {
      if (orderFormUtils.isCheckoutOrderPlacedPage()) {
        requestOrderForm()
      }

      global.addEventListener('hashchange', handleHashChange)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', handleOrderFormUpdated)
      }
    }

    return attach
  }
})(window)
