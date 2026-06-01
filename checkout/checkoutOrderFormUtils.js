/**
 * Shared orderForm helpers for checkout ecommerce events.
 */
;((global) => {
  global.createCheckoutOrderFormUtils = (NOT_AVAILABLE) => {
    const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

    const isCheckoutPaymentPage = () =>
      global.location.pathname.includes('/checkout') &&
      global.location.hash.includes('/payment')

    const isCheckoutOrderPlacedPage = () =>
      global.location.pathname.includes('/checkout') &&
      (global.location.hash.includes('/orderplaced') ||
        global.location.hash.includes('orderplaced') ||
        global.location.hash.includes('/confirmation'))

    const getTotalizerValue = (orderForm, id) => {
      const totalizer = orderForm?.totalizers?.find((entry) => entry.id === id)

      if (!totalizer?.value) {
        return 0
      }

      return totalizer.value / 100
    }

    const getCurrency = (orderForm) =>
      orderForm?.storePreferencesData?.currencyCode ||
      orderForm?.storePreferencesData?.currency ||
      'PEN'

    const getCoupon = (orderForm) =>
      orderForm?.marketingData?.coupon || NOT_AVAILABLE

    const getOrderValue = (orderForm) => (orderForm?.value ?? 0) / 100

    const getPaymentTypeFromDom = () => {
      const activePayment = document.querySelector(
        '.payment-group-item.active, .payment-group-item.v-custom-payment-item-active, .v-custom-payment-item-active, .payment-group-list-btn.active'
      )

      if (!activePayment) {
        return ''
      }

      return (
        normalizeText(activePayment.getAttribute('data-name')) ||
        normalizeText(activePayment.textContent)
      )
    }

    const getPaymentType = (orderForm) => {
      const payment = orderForm?.paymentData?.payments?.[0]

      if (payment?.paymentSystemName) {
        return normalizeText(payment.paymentSystemName)
      }

      if (payment?.groupName) {
        return normalizeText(payment.groupName)
      }

      if (payment?.paymentSystem) {
        return String(payment.paymentSystem)
      }

      return getPaymentTypeFromDom() || NOT_AVAILABLE
    }

    const getShippingTier = (orderForm) => {
      const logisticsInfo = orderForm?.shippingData?.logisticsInfo ?? []

      for (const logistics of logisticsInfo) {
        const selectedSla = logistics?.slas?.find(
          (sla) => sla.id === logistics.selectedSlaId
        )

        if (selectedSla?.name) {
          return normalizeText(selectedSla.name)
        }

        if (selectedSla?.deliveryChannel === 'pickup-in-point') {
          return 'Recoger en la tienda'
        }

        if (selectedSla?.deliveryChannel === 'delivery') {
          return 'Enviar a la dirección'
        }
      }

      return NOT_AVAILABLE
    }

    const getTransactionId = (orderForm) => {
      const fromUrl = new URLSearchParams(global.location.search).get('og')

      if (fromUrl) {
        return fromUrl
      }

      return (
        orderForm?.orderGroup ||
        orderForm?.id ||
        orderForm?.orderFormId ||
        NOT_AVAILABLE
      )
    }

    const buildItemsEcommerceTotals = (items) => {
      const value = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const magentaPoints_value = items.reduce(
        (sum, item) => sum + item.magentaPoints_price * item.quantity,
        0
      )

      return {
        value: Number(value.toFixed(2)),
        magentaPoints_value,
      }
    }

    return {
      isCheckoutPaymentPage,
      isCheckoutOrderPlacedPage,
      getCurrency,
      getCoupon,
      getOrderValue,
      getPaymentType,
      getShippingTier,
      getTransactionId,
      getTax: (orderForm) => getTotalizerValue(orderForm, 'Tax'),
      getShipping: (orderForm) => getTotalizerValue(orderForm, 'Shipping'),
      buildItemsEcommerceTotals,
    }
  }
})(window)
