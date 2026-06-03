/**
 * Shared orderForm helpers for checkout ecommerce events.
 */
;((global) => {
  global.createCheckoutOrderFormUtils = (NOT_AVAILABLE) => {
    const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim()

    const isCheckoutPaymentPage = () =>
      global.location.pathname.includes('/checkout') &&
      global.location.hash.includes('/payment')

    const getOrderGroupFromUrl = () =>
      new URLSearchParams(global.location.search).get('og') || ''

    const isCheckoutOrderPlacedPage = () => {
      const path = global.location.pathname.toLowerCase()

      if (path.includes('/checkout/orderplaced')) {
        return true
      }

      if (!path.includes('/checkout')) {
        return false
      }

      const hash = global.location.hash.toLowerCase()

      return (
        hash.includes('/orderplaced') ||
        hash.includes('orderplaced') ||
        hash.includes('/confirmation')
      )
    }

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
      const fromUrl = getOrderGroupFromUrl()

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

    const fetchOrdersByOrderGroup = async (orderGroupId) => {
      if (!orderGroupId) {
        return null
      }

      if (global.vtexjs?.checkout?.getOrders) {
        try {
          const orders = await new Promise((resolve, reject) => {
            global.vtexjs.checkout.getOrders(orderGroupId).done(resolve).fail(reject)
          })

          if (Array.isArray(orders) && orders.length) {
            return orders
          }
        } catch {
          // fall through to fetch
        }
      }

      try {
        const response = await fetch(
          `/api/checkout/pub/orders/order-group/${encodeURIComponent(orderGroupId)}`,
          { credentials: 'same-origin' }
        )

        if (!response.ok) {
          return null
        }

        const data = await response.json()

        return Array.isArray(data) ? data : null
      } catch {
        return null
      }
    }

    const buildOrderFormFromOrders = (orders) => {
      if (!Array.isArray(orders) || !orders.length) {
        return null
      }

      const primary = orders[0]
      const items = orders.flatMap((order) => order.items || [])

      if (!items.length) {
        return null
      }

      return {
        ...primary,
        items,
        orderGroup: primary.orderGroup || getOrderGroupFromUrl(),
        value: orders.reduce((sum, order) => sum + (order.value || 0), 0),
      }
    }

    const loadOrderPlacedOrderForm = async () => {
      if (global.vtexjs?.checkout?.getOrderForm) {
        try {
          const orderForm = await new Promise((resolve, reject) => {
            global.vtexjs.checkout.getOrderForm().done(resolve).fail(reject)
          })

          if (orderForm?.items?.length) {
            return orderForm
          }
        } catch {
          // fall through
        }
      }

      const orders = await fetchOrdersByOrderGroup(getOrderGroupFromUrl())

      return buildOrderFormFromOrders(orders)
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
      getOrderGroupFromUrl,
      loadOrderPlacedOrderForm,
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
