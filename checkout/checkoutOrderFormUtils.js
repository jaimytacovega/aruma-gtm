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
      const { pathname, hash } = global.location

      // VTEX uses /checkout/orderPlaced/ (capital P); match pathname only, case-insensitive.
      if (/\/checkout\/orderplaced/i.test(pathname)) {
        return true
      }

      if (!/\/checkout/i.test(pathname)) {
        return false
      }

      const hashLower = hash.toLowerCase()

      return (
        hashLower.includes('/orderplaced') ||
        hashLower.includes('orderplaced') ||
        hashLower.includes('/confirmation')
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

    const getItemNetValue = (item) =>
      Number(((item.price - item.discount) * item.quantity).toFixed(2))

    const buildItemsEcommerceTotals = (items) => {
      const value = items.reduce((sum, item) => sum + getItemNetValue(item), 0)
      const magentaPoints_value = items.reduce(
        (sum, item) => sum + item.magentaPoints_price * item.quantity,
        0
      )

      return {
        value: Number(value.toFixed(2)),
        magentaPoints_value,
      }
    }

    const getSlugFromDetailUrl = (detailUrl) => {
      if (!detailUrl) {
        return ''
      }

      const path = detailUrl.startsWith('http')
        ? new URL(detailUrl, global.location.origin).pathname
        : detailUrl
      const match = path.match(/\/([^/]+)\/p\/?$/)

      return match?.[1] ?? ''
    }

    const normalizeProductKey = (value) => {
      try {
        return decodeURIComponent(value).trim().toLowerCase()
      } catch {
        return String(value).trim().toLowerCase()
      }
    }

    const CHECKOUT_LIST_CONTEXT_KEY = 'aruma-gtm:checkout-list-context'

    const normalizeListContext = (list) => {
      const value = String(list?.listName || list?.listId || '').trim()

      if (!value) {
        return null
      }

      return {
        listId: value,
        listName: value,
      }
    }

    const readCheckoutListStore = () => {
      try {
        const raw = global.localStorage?.getItem(CHECKOUT_LIST_CONTEXT_KEY)

        if (raw) {
          return JSON.parse(raw)
        }
      } catch {
        // localStorage unavailable or corrupt
      }

      return { last: null, byProduct: {} }
    }

    const getListFromLastSelectItem = (slug, productId) => {
      const fallback = {
        listId: NOT_AVAILABLE,
        listName: NOT_AVAILABLE,
      }

      const store = readCheckoutListStore()
      const slugKey = normalizeProductKey(slug)
      const productIdKey = productId
        ? normalizeProductKey(String(productId))
        : ''

      if (slugKey && store.byProduct?.[slugKey]) {
        return normalizeListContext(store.byProduct[slugKey]) ?? fallback
      }

      if (productIdKey && store.byProduct?.[productIdKey]) {
        return normalizeListContext(store.byProduct[productIdKey]) ?? fallback
      }

      if (store.last) {
        return normalizeListContext(store.last) ?? fallback
      }

      return fallback
    }

    const clearCheckoutListContext = () => {
      try {
        global.localStorage?.removeItem(CHECKOUT_LIST_CONTEXT_KEY)
      } catch {
        // localStorage unavailable
      }
    }

    const getListContextForOrderItem = (orderItem) => {
      const slug =
        getSlugFromDetailUrl(orderItem?.detailUrl) ||
        String(orderItem?.productId ?? '')

      return getListFromLastSelectItem(slug, orderItem?.productId)
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
      getSlugFromDetailUrl,
      getListFromLastSelectItem,
      getListContextForOrderItem,
      clearCheckoutListContext,
    }
  }
})(window)
