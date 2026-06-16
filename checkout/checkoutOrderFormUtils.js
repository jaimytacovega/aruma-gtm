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

    const TOTALIZER_TAX_IDS = ['Tax', 'Taxes', 'CustomTax', 'IGV']
    const TOTALIZER_SHIPPING_IDS = ['Shipping', 'Delivery', 'Frete']
    const TOTALIZER_NON_TAX_PATTERN =
      /^(items|shipping|delivery|frete|discounts?)$/i
    const TOTALIZER_TAX_PATTERN = /tax|igv|impuesto|iva/i
    const PERU_IGV_RATE = 0.18

    const roundMoney = (value) => Number(value.toFixed(2))

    const getOrderCurrency = (orderForm) =>
      orderForm?.storePreferencesData?.currencyCode ||
      orderForm?.storePreferencesData?.currency ||
      'PEN'

    const normalizeMoneyCents = (value) => {
      if (!value) {
        return 0
      }

      return roundMoney(value / 100)
    }

    const extractInclusiveTaxFromGross = (grossAmount, currency) => {
      const code = (currency ?? 'PEN').toUpperCase()

      if (code !== 'PEN' || grossAmount <= 0) {
        return 0
      }

      return roundMoney((grossAmount * PERU_IGV_RATE) / (1 + PERU_IGV_RATE))
    }

    const mergeOrderTotalizers = (orders) => {
      const byId = new Map()

      for (const order of orders) {
        for (const entry of order.totalizers ?? []) {
          if (!entry?.id) {
            continue
          }

          byId.set(entry.id, (byId.get(entry.id) ?? 0) + (entry.value ?? 0))
        }
      }

      return [...byId.entries()].map(([id, value]) => ({ id, value }))
    }

    const findTotalizerCents = (totalizers, ids) => {
      if (!totalizers?.length) {
        return 0
      }

      for (const id of ids) {
        const match = totalizers.find(
          (entry) => entry.id?.toLowerCase() === id.toLowerCase() && entry.value
        )

        if (match?.value) {
          return match.value
        }
      }

      return 0
    }

    const findTotalizerCentsByTaxPattern = (totalizers) => {
      if (!totalizers?.length) {
        return 0
      }

      return totalizers.reduce((sum, entry) => {
        if (!entry.value) {
          return sum
        }

        const id = entry.id ?? ''
        const name = entry.name ?? ''

        if (
          TOTALIZER_NON_TAX_PATTERN.test(id) ||
          TOTALIZER_NON_TAX_PATTERN.test(name)
        ) {
          return sum
        }

        if (TOTALIZER_TAX_PATTERN.test(id) || TOTALIZER_TAX_PATTERN.test(name)) {
          return sum + entry.value
        }

        return sum
      }, 0)
    }

    const getTaxFromOrderItems = (orderForm) => {
      let totalCents = 0

      for (const item of orderForm?.items ?? []) {
        if (item.tax) {
          totalCents += item.tax
        }
      }

      return normalizeMoneyCents(totalCents)
    }

    const getShippingFromLogisticsInfo = (orderForm) => {
      let totalCents = 0

      for (const info of orderForm?.shippingData?.logisticsInfo ?? []) {
        if (info.price) {
          totalCents += info.price
          continue
        }

        const selectedId = info.selectedSlaId || info.selectedSla
        const sla = info.slas?.find(
          (entry) => entry.id === selectedId || entry.name === selectedId
        )

        if (sla?.price) {
          totalCents += sla.price
        }
      }

      return normalizeMoneyCents(totalCents)
    }

    const getPurchaseEcommerceTotals = (orderForm, itemsSubtotal) => {
      let tax = normalizeMoneyCents(
        findTotalizerCents(orderForm?.totalizers, TOTALIZER_TAX_IDS) ||
          findTotalizerCentsByTaxPattern(orderForm?.totalizers)
      )
      let shipping = normalizeMoneyCents(
        findTotalizerCents(orderForm?.totalizers, TOTALIZER_SHIPPING_IDS)
      )
      let value = normalizeMoneyCents(orderForm?.value)

      if (!tax) {
        tax = getTaxFromOrderItems(orderForm)
      }

      if (!shipping) {
        shipping = getShippingFromLogisticsInfo(orderForm)
      }

      if (!value) {
        value = roundMoney(itemsSubtotal + shipping + tax)
      } else if (!shipping && value > itemsSubtotal) {
        shipping = roundMoney(Math.max(0, value - itemsSubtotal - tax))
      }

      if (!tax && value > itemsSubtotal + shipping) {
        tax = roundMoney(value - itemsSubtotal - shipping)
      }

      if (!tax) {
        tax = extractInclusiveTaxFromGross(
          roundMoney(itemsSubtotal + shipping),
          getOrderCurrency(orderForm)
        )
      }

      return { value, tax, shipping }
    }

    const getCurrency = (orderForm) =>
      orderForm?.storePreferencesData?.currencyCode ||
      orderForm?.storePreferencesData?.currency ||
      'PEN'

    const getCoupon = (orderForm) =>
      orderForm?.marketingData?.coupon || NOT_AVAILABLE

    const getOrderValue = (orderForm) => (orderForm?.value ?? 0) / 100

    const getPaymentTypeFromDom = () => {
      const resolvePaymentTypeFromPaymentElement = (activePayment) => {
        const paymentId = activePayment.id || ''
        const label = normalizeText(
          activePayment.querySelector('.payment-group-item-text')?.textContent ||
            activePayment.textContent
        )

        if (paymentId.includes('Yape') || /yape/i.test(label)) {
          return PAYMENT_TYPE_YAPE
        }

        if (
          paymentId.includes('MercadoPagoOff') ||
          paymentId.includes('promissory') ||
          /efectivo/i.test(label)
        ) {
          return PAYMENT_TYPE_CASH
        }

        if (
          paymentId.includes('creditCard') ||
          /tarjeta|cr[eé]dito|debito|d[eé]bito/i.test(label)
        ) {
          return PAYMENT_TYPE_CARD
        }

        return normalizePaymentType(
          label || activePayment.getAttribute('data-name') || ''
        )
      }

      // VTEX marks the user choice with v-custom-payment-item-active; .active can linger on card.
      const selectedPayment = document.querySelector(
        '.payment-group-item.v-custom-payment-item-active'
      )

      if (selectedPayment) {
        const resolved = resolvePaymentTypeFromPaymentElement(selectedPayment)

        if (resolved && resolved !== NOT_AVAILABLE) {
          return resolved
        }
      }

      for (const activePayment of document.querySelectorAll(
        '.payment-group-item.active, .payment-group-list-btn.active'
      )) {
        if (!(activePayment instanceof HTMLElement)) {
          continue
        }

        if (activePayment.classList.contains('v-custom-payment-item-active')) {
          continue
        }

        const resolved = resolvePaymentTypeFromPaymentElement(activePayment)

        if (resolved && resolved !== NOT_AVAILABLE) {
          return resolved
        }
      }

      return ''
    }

    const PAYMENT_TYPE_YAPE = 'Yape'
    const PAYMENT_TYPE_CASH = 'Pago efectivo'
    const PAYMENT_TYPE_CARD = 'Tarjeta de credito y debito'
    const SHIPPING_TIER_HOME = 'Despacho a Domicilio'
    const SHIPPING_TIER_PICKUP = 'Retirar en Tienda'

    const normalizePaymentType = (value) => {
      if (!isUsableContextValue(value)) {
        return NOT_AVAILABLE
      }

      const lower = String(value).toLowerCase()

      if (lower.includes('yape')) {
        return PAYMENT_TYPE_YAPE
      }

      if (
        lower.includes('efectivo') ||
        lower.includes('mercadopagooff') ||
        lower.includes('promissory') ||
        lower.includes('cash')
      ) {
        return PAYMENT_TYPE_CASH
      }

      if (
        lower.includes('creditcard') ||
        lower.includes('tarjeta') ||
        lower.includes('credit') ||
        lower.includes('debit') ||
        lower.includes('visa') ||
        lower.includes('mastercard') ||
        lower.includes('amex') ||
        lower.includes('american express') ||
        lower.includes('diners') ||
        /^\d+$/.test(lower.trim())
      ) {
        return PAYMENT_TYPE_CARD
      }

      return NOT_AVAILABLE
    }

    const normalizeShippingTier = (value) => {
      if (!isUsableContextValue(value)) {
        return NOT_AVAILABLE
      }

      const lower = String(value).toLowerCase()

      if (
        lower.includes('pickup') ||
        lower.includes('recoger') ||
        lower.includes('retirar') ||
        lower.includes('pick-up') ||
        (lower.includes('tienda') && !lower.includes('domicilio'))
      ) {
        return SHIPPING_TIER_PICKUP
      }

      if (
        lower.includes('delivery') ||
        lower.includes('domicilio') ||
        lower.includes('despacho') ||
        lower.includes('enviar') ||
        lower.includes('direccion') ||
        lower.includes('dirección')
      ) {
        return SHIPPING_TIER_HOME
      }

      return NOT_AVAILABLE
    }

    const getShippingTierFromDom = () => {
      if (
        document.querySelector(
          '#shipping-option-pickup-in-point.shp-method-option-active, #shipping-option-pickup-in-point.vtex-omnishipping-1-x-deliveryOptionActive'
        )
      ) {
        return SHIPPING_TIER_PICKUP
      }

      if (
        document.querySelector(
          '#shipping-option-delivery.shp-method-option-active, #shipping-option-delivery.vtex-omnishipping-1-x-deliveryOptionActive'
        )
      ) {
        return SHIPPING_TIER_HOME
      }

      return ''
    }

    const CHECKOUT_PURCHASE_CONTEXT_KEY = 'aruma-gtm:checkout-purchase-context'

    const isUsableContextValue = (value) =>
      Boolean(value && String(value).trim() && value !== NOT_AVAILABLE)

    const persistCheckoutPurchaseContext = (partial) => {
      try {
        const raw = global.sessionStorage.getItem(CHECKOUT_PURCHASE_CONTEXT_KEY)
        const current = raw ? JSON.parse(raw) : {}

        global.sessionStorage.setItem(
          CHECKOUT_PURCHASE_CONTEXT_KEY,
          JSON.stringify({
            ...current,
            ...partial,
            updatedAt: Date.now(),
          })
        )
      } catch {
        // sessionStorage unavailable
      }
    }

    const readCheckoutPurchaseContext = () => {
      try {
        const raw = global.sessionStorage.getItem(CHECKOUT_PURCHASE_CONTEXT_KEY)

        return raw ? JSON.parse(raw) : {}
      } catch {
        return {}
      }
    }

    const readLastArumaGtmEcommerceString = (eventName, field) => {
      const dataLayer = global.dataLayer || []

      for (let index = dataLayer.length - 1; index >= 0; index -= 1) {
        const entry = dataLayer[index]

        if (entry?.arumaGtm !== true || entry.event !== eventName) {
          continue
        }

        const value = entry.ecommerce?.[field]

        if (typeof value === 'string' && isUsableContextValue(value)) {
          return normalizeText(value)
        }
      }

      return ''
    }

    const resolvePaymentTypeFromOrderForm = (orderForm) => {
      const paymentName = orderForm?.paymentNames?.[0]

      if (paymentName) {
        return normalizeText(paymentName)
      }

      const payment = orderForm?.paymentData?.payments?.[0]

      if (payment?.paymentSystemName) {
        return normalizeText(payment.paymentSystemName)
      }

      if (payment?.groupName) {
        return normalizeText(payment.groupName)
      }

      if (payment?.group) {
        return normalizeText(payment.group)
      }

      if (payment?.paymentSystem) {
        return String(payment.paymentSystem)
      }

      for (const transaction of orderForm?.paymentData?.transactions ?? []) {
        for (const txPayment of transaction.payments ?? []) {
          if (txPayment.paymentSystemName) {
            return normalizeText(txPayment.paymentSystemName)
          }

          if (txPayment.groupName) {
            return normalizeText(txPayment.groupName)
          }

          if (txPayment.group) {
            return normalizeText(txPayment.group)
          }

          if (txPayment.paymentSystem) {
            return String(txPayment.paymentSystem)
          }
        }
      }

      return ''
    }

    const resolveShippingTierFromOrderForm = (orderForm) => {
      const logisticsInfo = orderForm?.shippingData?.logisticsInfo ?? []

      for (const logistics of logisticsInfo) {
        const selectedSla = logistics?.slas?.find(
          (sla) => sla.id === logistics.selectedSlaId
        )

        if (selectedSla?.name) {
          return normalizeText(selectedSla.name)
        }

        if (isUsableContextValue(logistics.selectedSla)) {
          return normalizeText(logistics.selectedSla)
        }

        if (selectedSla?.deliveryChannel === 'pickup-in-point') {
          return 'Recoger en la tienda'
        }

        if (selectedSla?.deliveryChannel === 'delivery') {
          return 'Enviar a la dirección'
        }

        if (logistics.selectedDeliveryChannel === 'pickup-in-point') {
          return 'Recoger en la tienda'
        }

        if (logistics.selectedDeliveryChannel === 'delivery') {
          return 'Enviar a la dirección'
        }
      }

      return ''
    }

    const getPaymentType = (orderForm) => {
      const fromDom = getPaymentTypeFromDom()
      const fromOrderForm = resolvePaymentTypeFromOrderForm(orderForm)

      const raw = isCheckoutPaymentPage()
        ? fromDom ||
          fromOrderForm ||
          readCheckoutPurchaseContext().payment_type ||
          readLastArumaGtmEcommerceString('add_payment_info', 'payment_type') ||
          ''
        : fromOrderForm ||
          fromDom ||
          readCheckoutPurchaseContext().payment_type ||
          readLastArumaGtmEcommerceString('add_payment_info', 'payment_type') ||
          ''

      const normalized = normalizePaymentType(raw)

      return normalized !== NOT_AVAILABLE ? normalized : NOT_AVAILABLE
    }

    const getShippingTier = (orderForm) => {
      const raw =
        resolveShippingTierFromOrderForm(orderForm) ||
        getShippingTierFromDom() ||
        readCheckoutPurchaseContext().shipping_tier ||
        readLastArumaGtmEcommerceString('add_shipping_info', 'shipping_tier') ||
        ''

      const normalized = normalizeShippingTier(raw)

      return normalized !== NOT_AVAILABLE ? normalized : NOT_AVAILABLE
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
        totalizers: mergeOrderTotalizers(orders),
        paymentData:
          orders.find((order) => order.paymentData)?.paymentData ??
          primary.paymentData ??
          null,
        shippingData:
          orders.find((order) => order.shippingData)?.shippingData ??
          primary.shippingData ??
          null,
        paymentNames:
          primary.paymentNames ??
          orders.find((order) => order.paymentNames?.length)?.paymentNames,
        marketingData: primary.marketingData ?? null,
        storePreferencesData: primary.storePreferencesData ?? null,
      }
    }

    const FIRED_ORDER_PLACED_KEY = 'aruma-gtm:fired-order-placed-events'

    const readFiredOrderPlacedStore = () => {
      try {
        const raw = global.localStorage?.getItem(FIRED_ORDER_PLACED_KEY)

        if (raw) {
          const parsed = JSON.parse(raw)

          return {
            virtualPage: new Set(parsed.virtualPage ?? []),
            purchase: new Set(parsed.purchase ?? []),
          }
        }
      } catch {
        // localStorage unavailable or corrupt
      }

      return { virtualPage: new Set(), purchase: new Set() }
    }

    const writeFiredOrderPlacedStore = (store) => {
      try {
        global.localStorage?.setItem(
          FIRED_ORDER_PLACED_KEY,
          JSON.stringify({
            virtualPage: [...store.virtualPage],
            purchase: [...store.purchase],
          })
        )
      } catch {
        // localStorage unavailable
      }
    }

    const hasFiredOrderPlacedEvent = (eventName, orderGroup) => {
      if (!orderGroup) {
        return false
      }

      const store = readFiredOrderPlacedStore()

      return store[eventName]?.has(orderGroup) ?? false
    }

    const markOrderPlacedEventFired = (eventName, orderGroup) => {
      if (!orderGroup) {
        return
      }

      const store = readFiredOrderPlacedStore()
      store[eventName].add(orderGroup)
      writeFiredOrderPlacedStore(store)
    }

    let orderPlacedTransitionWatcherAttached = false
    const orderPlacedTransitionListeners = new Set()

    const notifyOrderPlacedTransition = (source) => {
      if (!isCheckoutOrderPlacedPage()) {
        return
      }

      orderPlacedTransitionListeners.forEach((listener) => {
        listener(source)
      })
    }

    const onOrderPlacedTransition = (listener) => {
      orderPlacedTransitionListeners.add(listener)

      return () => {
        orderPlacedTransitionListeners.delete(listener)
      }
    }

    const setupOrderPlacedTransitionWatcher = () => {
      if (orderPlacedTransitionWatcherAttached) {
        return
      }

      orderPlacedTransitionWatcherAttached = true

      let lastHref = global.location.href

      const checkTransition = (source) => {
        const href = global.location.href

        if (href !== lastHref) {
          lastHref = href
        }

        notifyOrderPlacedTransition(source)
      }

      global.setInterval(() => {
        checkTransition('poll')
      }, 200)

      const wrapHistoryMethod = (methodName) => {
        const original = global.history?.[methodName]

        if (typeof original !== 'function') {
          return
        }

        global.history[methodName] = function patchedHistoryMethod(...args) {
          const result = original.apply(this, args)
          global.setTimeout(() => {
            checkTransition(`history.${methodName}`)
          }, 0)

          return result
        }
      }

      wrapHistoryMethod('pushState')
      wrapHistoryMethod('replaceState')

      global.addEventListener('popstate', () => {
        checkTransition('popstate')
      })
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

    const listContextStore = global.createListContextStore(NOT_AVAILABLE)

    const getListFromLastSelectItem = (slug, productId) =>
      listContextStore.getListContextForProduct({ slug, productId })

    const getListContextForOrderItem = (orderItem) => {
      const slug =
        getSlugFromDetailUrl(orderItem?.detailUrl) ||
        String(orderItem?.productId ?? '')

      return listContextStore.getListContextForProduct({
        slug,
        productId: orderItem?.productId,
      })
    }

    const clearCheckoutListContext = () => listContextStore.clearListContextStore()

    const hasArumaGtmEventInDataLayer = (eventName) => {
      const dataLayer = global.dataLayer || []

      return dataLayer.some(
        (entry) => entry?.arumaGtm === true && entry.event === eventName
      )
    }

    const CHECKOUT_FLOW_NAVIGATIONS_KEY = 'aruma-gtm:checkout-flow-navigations'
    const MAX_CHECKOUT_FLOW_NAVIGATIONS = 50

    let checkoutFlowStepChain = Promise.resolve()

    const readCheckoutFlowNavigations = () => {
      try {
        const raw = global.sessionStorage.getItem(CHECKOUT_FLOW_NAVIGATIONS_KEY)

        if (raw) {
          const parsed = JSON.parse(raw)

          return Array.isArray(parsed) ? parsed : []
        }
      } catch {
        // sessionStorage unavailable or corrupt
      }

      return []
    }

    const persistCheckoutFlowNavigation = (entry) => {
      try {
        const navigations = readCheckoutFlowNavigations()

        navigations.push(entry)

        if (navigations.length > MAX_CHECKOUT_FLOW_NAVIGATIONS) {
          navigations.splice(
            0,
            navigations.length - MAX_CHECKOUT_FLOW_NAVIGATIONS
          )
        }

        global.sessionStorage.setItem(
          CHECKOUT_FLOW_NAVIGATIONS_KEY,
          JSON.stringify(navigations)
        )
      } catch {
        // sessionStorage unavailable
      }
    }

    const normalizeCheckoutHash = (hash) => (hash || '').trim().toLowerCase()

    const getLastCheckoutNavigation = () => {
      const navigations = readCheckoutFlowNavigations()

      return navigations.length ? navigations[navigations.length - 1] : null
    }

    const isSameCheckoutNavigation = (entry) => {
      if (!entry) {
        return false
      }

      const currentHash = normalizeCheckoutHash(global.location.hash)
      const entryHash = normalizeCheckoutHash(entry.hash)

      if (currentHash && entryHash && currentHash === entryHash) {
        return true
      }

      return Boolean(entry.href && entry.href === global.location.href)
    }

    const getPreviousCheckoutNavigation = () => {
      const navigations = readCheckoutFlowNavigations()

      for (let index = navigations.length - 1; index >= 0; index -= 1) {
        if (!isSameCheckoutNavigation(navigations[index])) {
          return navigations[index]
        }
      }

      return null
    }

    const isCheckoutCartNavigation = (navigation) => {
      if (!navigation) {
        return false
      }

      const hash = normalizeCheckoutHash(navigation.hash)

      return hash === '#/cart' || hash.endsWith('/cart') || navigation.step === 'cart'
    }

    const cameFromCheckoutCart = () =>
      isCheckoutCartNavigation(getPreviousCheckoutNavigation())

    const chainCheckoutFlowStep = (stepName, fn) => {
      checkoutFlowStepChain = checkoutFlowStepChain
        .then(() => fn())
        .catch((error) => {
          console.info(
            '[aruma-gtm]',
            'checkout-flow',
            'step failed',
            stepName,
            error
          )
        })

      return checkoutFlowStepChain
    }

    const getCheckoutNavigationStep = () => {
      const { pathname, hash } = global.location

      if (!pathname.includes('/checkout')) {
        return null
      }

      const hashLower = hash.toLowerCase()

      if (hashLower.includes('/profile')) {
        return 'profile'
      }

      if (hashLower.includes('/email')) {
        return 'email'
      }

      if (hashLower.includes('/shipping')) {
        return 'shipping'
      }

      if (hashLower.includes('/payment')) {
        return 'payment'
      }

      if (hashLower.includes('/cart')) {
        return 'cart'
      }

      if (
        /\/checkout\/orderplaced/i.test(pathname) ||
        hashLower.includes('orderplaced') ||
        hashLower.includes('/confirmation')
      ) {
        return 'orderPlaced'
      }

      return hash || 'checkout'
    }

    const logCheckoutNavigation = (source = 'navigation') => {
      const { pathname, hash } = global.location

      if (!pathname.includes('/checkout')) {
        return
      }

      const entry = {
        at: Date.now(),
        source,
        pathname,
        hash,
        step: getCheckoutNavigationStep(),
        href: global.location.href,
        previousNavigation: getPreviousCheckoutNavigation(),
        cameFromCart: cameFromCheckoutCart(),
      }

      console.info('[aruma-gtm]', 'checkout-flow', 'navigated', entry)
      persistCheckoutFlowNavigation(entry)
    }

    return {
      hasArumaGtmEventInDataLayer,
      getLastCheckoutNavigation,
      getPreviousCheckoutNavigation,
      cameFromCheckoutCart,
      chainCheckoutFlowStep,
      getCheckoutNavigationStep,
      logCheckoutNavigation,
      readCheckoutFlowNavigations,
      isCheckoutPaymentPage,
      isCheckoutOrderPlacedPage,
      getOrderGroupFromUrl,
      loadOrderPlacedOrderForm,
      getCurrency,
      getCoupon,
      getOrderValue,
      getPaymentType,
      getShippingTier,
      getShippingTierFromDom,
      normalizePaymentType,
      normalizeShippingTier,
      persistCheckoutPurchaseContext,
      getTransactionId,
      hasFiredOrderPlacedEvent,
      markOrderPlacedEventFired,
      onOrderPlacedTransition,
      setupOrderPlacedTransitionWatcher,
      getTax: (orderForm) => getTotalizerValue(orderForm, 'Tax'),
      getShipping: (orderForm) => getTotalizerValue(orderForm, 'Shipping'),
      getPurchaseEcommerceTotals,
      buildItemsEcommerceTotals,
      getSlugFromDetailUrl,
      getListFromLastSelectItem,
      getListContextForOrderItem,
      clearCheckoutListContext,
    }
  }
})(window)
