import { log, NOT_AVAILABLE } from '../../utils'

const FIRED_ORDER_PLACED_KEY = 'aruma-gtm:fired-order-placed-events'
export const AWAITING_ORDER_PLACED_KEY = 'aruma-gtm:awaiting-order-placed'
export const CHECKOUT_PURCHASE_CONTEXT_KEY = 'aruma-gtm:checkout-purchase-context'
export const PAYMENT_TYPE_YAPE = 'Yape'
export const PAYMENT_TYPE_CASH = 'Pago efectivo'
export const PAYMENT_TYPE_CARD = 'Tarjeta de credito y debito'
export const SHIPPING_TIER_HOME = 'Despacho a Domicilio'
export const SHIPPING_TIER_PICKUP = 'Retirar en Tienda'

type CheckoutPurchaseItemContext = {
  item_id: string
  item_list_id: string
  item_list_name: string
}

type CheckoutPurchaseContext = {
  payment_type?: string
  shipping_tier?: string
  items?: CheckoutPurchaseItemContext[]
}

const AWAITING_ORDER_PLACED_MS = 30 * 60 * 1000
const SUCCESS_PAGE_TITLE = 'Aruma - Checkout - Compra exitosa'
const SUCCESS_CHECKOUT_SCREEN = 'success'

type FiredOrderPlacedStore = {
  virtualPage: Set<string>
  purchase: Set<string>
}

type OrderApiItem = {
  detailUrl?: string
  productId?: string
  name?: string
  brand?: string
  additionalInfo?: { brandName?: string }
  sellingPrice?: number
  price?: number
  priceIsInt?: boolean
  quantity?: number
  discount?: number
}

type OrderApiOrder = {
  orderGroup?: string
  orderFormId?: string
  id?: string
  value?: number
  items?: OrderApiItem[]
  paymentNames?: string[]
  totalizers?: Array<{ id: string; value: number }>
  paymentData?: {
    payments?: Array<{
      paymentSystemName?: string
      groupName?: string
      group?: string
      paymentSystem?: string | number
    }>
    transactions?: Array<{
      payments?: Array<{
        paymentSystemName?: string
        groupName?: string
        group?: string
        paymentSystem?: string | number
      }>
    }>
  }
  shippingData?: {
    logisticsInfo?: Array<{
      selectedSlaId?: string
      selectedSla?: string
      selectedDeliveryChannel?: string
      slas?: Array<{
        id?: string
        name?: string
        deliveryChannel?: string
      }>
    }>
  }
  marketingData?: { coupon?: string }
  storePreferencesData?: {
    currencyCode?: string
    currency?: string
  }
}

export type LoadedOrderPlacedOrder = OrderApiOrder & {
  items: OrderApiItem[]
  orderGroup: string
  value: number
}

const readFiredOrderPlacedStore = (): FiredOrderPlacedStore => {
  try {
    const raw = window.localStorage.getItem(FIRED_ORDER_PLACED_KEY)

    if (raw) {
      const parsed = JSON.parse(raw) as {
        virtualPage?: string[]
        purchase?: string[]
      }

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

const writeFiredOrderPlacedStore = (store: FiredOrderPlacedStore) => {
  try {
    window.localStorage.setItem(
      FIRED_ORDER_PLACED_KEY,
      JSON.stringify({
        virtualPage: Array.from(store.virtualPage),
        purchase: Array.from(store.purchase),
      })
    )
  } catch {
    // localStorage unavailable
  }
}

export const setAwaitingOrderPlaced = () => {
  try {
    window.sessionStorage.setItem(
      AWAITING_ORDER_PLACED_KEY,
      String(Date.now())
    )
  } catch {
    // sessionStorage unavailable
  }
}

export const hasAwaitingOrderPlaced = () => {
  try {
    const raw = window.sessionStorage.getItem(AWAITING_ORDER_PLACED_KEY)

    if (!raw) {
      return false
    }

    const timestamp = Number(raw)

    if (!timestamp || Date.now() - timestamp > AWAITING_ORDER_PLACED_MS) {
      window.sessionStorage.removeItem(AWAITING_ORDER_PLACED_KEY)
      return false
    }

    return true
  } catch {
    return false
  }
}

export const clearAwaitingOrderPlaced = () => {
  try {
    window.sessionStorage.removeItem(AWAITING_ORDER_PLACED_KEY)
    window.sessionStorage.removeItem(CHECKOUT_PURCHASE_CONTEXT_KEY)
  } catch {
    // sessionStorage unavailable
  }
}

export const persistCheckoutPurchaseContext = (partial: CheckoutPurchaseContext) => {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_PURCHASE_CONTEXT_KEY)
    const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}

    window.sessionStorage.setItem(
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

export const readCheckoutPurchaseContext = (): CheckoutPurchaseContext => {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_PURCHASE_CONTEXT_KEY)

    if (!raw) {
      return {}
    }

    return JSON.parse(raw) as CheckoutPurchaseContext
  } catch {
    return {}
  }
}

export const normalizePaymentType = (value: string): string => {
  if (!isUsableContextValue(value)) {
    return NOT_AVAILABLE
  }

  const lower = value.toLowerCase()

  if (lower.includes('yape')) {
    return PAYMENT_TYPE_YAPE
  }

  if (
    lower.includes('efectivo') ||
    lower.includes('mercadopagooff') ||
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

export const normalizeShippingTier = (value: string): string => {
  if (!isUsableContextValue(value)) {
    return NOT_AVAILABLE
  }

  const lower = value.toLowerCase()

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

export const getListContextFromPurchaseContext = (
  productId?: string,
  slug?: string
): { listId: string; listName: string } | null => {
  const items = readCheckoutPurchaseContext().items

  if (!items?.length) {
    return null
  }

  const keys = [productId, slug]
    .filter(Boolean)
    .map((key) => key!.trim().toLowerCase())

  for (const item of items) {
    const itemKey = String(item.item_id ?? '')
      .trim()
      .toLowerCase()

    if (!itemKey || !keys.includes(itemKey)) {
      continue
    }

    const listId = String(item.item_list_id ?? '').trim()
    const listName = String(item.item_list_name ?? listId).trim()

    if (listId && listId !== NOT_AVAILABLE) {
      return {
        listId,
        listName: listName || listId,
      }
    }
  }

  return null
}

export const isCheckoutOrderPlacedPage = (pageUrl = window.location.href) => {
  try {
    const { pathname, hash } = new URL(pageUrl, window.location.origin)

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
  } catch {
    return false
  }
}

export const getOrderGroupFromUrl = (pageUrl = window.location.href) => {
  try {
    return new URL(pageUrl, window.location.origin).searchParams.get('og') || ''
  } catch {
    return ''
  }
}

export const hasFiredOrderPlacedEvent = (
  eventName: 'virtualPage' | 'purchase',
  orderGroup: string
) => {
  if (!orderGroup) {
    return false
  }

  const store = readFiredOrderPlacedStore()

  return store[eventName].has(orderGroup)
}

/** Atomically reserve an order-group slot so parallel handlers cannot double-fire. */
export const claimOrderPlacedEvent = (
  eventName: 'virtualPage' | 'purchase',
  orderGroup: string
) => {
  if (!orderGroup) {
    return false
  }

  try {
    const raw = window.localStorage.getItem(FIRED_ORDER_PLACED_KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as {
      virtualPage?: string[]
      purchase?: string[]
    }
    const existing = parsed[eventName]
    const list = Array.isArray(existing) ? existing.slice() : []

    if (list.indexOf(orderGroup) >= 0) {
      return false
    }

    list.push(orderGroup)
    parsed[eventName] = list

    window.localStorage.setItem(FIRED_ORDER_PLACED_KEY, JSON.stringify(parsed))

    return true
  } catch {
    return false
  }
}

export const markOrderPlacedEventFired = (
  eventName: 'virtualPage' | 'purchase',
  orderGroup: string
) => {
  if (!orderGroup || hasFiredOrderPlacedEvent(eventName, orderGroup)) {
    return
  }

  const store = readFiredOrderPlacedStore()
  store[eventName].add(orderGroup)
  writeFiredOrderPlacedStore(store)
}

export const getSuccessPageLocation = () =>
  `${window.location.origin}/checkout/compra-exitosa`

export const buildSuccessVirtualPagePayload = (orderGroup: string) => ({
  event: 'virtualPage',
  page_location: getSuccessPageLocation(),
  page_title: SUCCESS_PAGE_TITLE,
  checkout_screen: SUCCESS_CHECKOUT_SCREEN,
  order_group: orderGroup,
})

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

const isUsableContextValue = (value: string | undefined): value is string =>
  Boolean(value && value.trim() && value !== NOT_AVAILABLE)

const readLastArumaGtmEcommerceString = (
  eventName: string,
  field: string
): string => {
  window.dataLayer = window.dataLayer || []

  for (let index = window.dataLayer.length - 1; index >= 0; index -= 1) {
    const entry = window.dataLayer[index]

    if (entry?.arumaGtm !== true || entry.event !== eventName) {
      continue
    }

    const ecommerce = entry.ecommerce as Record<string, unknown> | undefined
    const value = ecommerce?.[field]

    if (typeof value === 'string' && isUsableContextValue(value)) {
      return normalizeText(value)
    }
  }

  return ''
}

const resolvePaymentTypeFromOrder = (order: OrderApiOrder): string => {
  const payment = order.paymentData?.payments?.[0]

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

  for (const transaction of order.paymentData?.transactions ?? []) {
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

  const paymentName = order.paymentNames?.[0]

  if (paymentName) {
    return normalizeText(paymentName)
  }

  return ''
}

const resolveShippingTierFromOrder = (order: OrderApiOrder): string => {
  const logisticsInfo = order.shippingData?.logisticsInfo ?? []

  for (const logistics of logisticsInfo) {
    const selectedSla = logistics.slas?.find(
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

export const getPaymentType = (order: OrderApiOrder | LoadedOrderPlacedOrder) => {
  const raw =
    resolvePaymentTypeFromOrder(order) ||
    readCheckoutPurchaseContext().payment_type ||
    readLastArumaGtmEcommerceString('add_payment_info', 'payment_type') ||
    ''

  const normalized = normalizePaymentType(raw)

  return normalized !== NOT_AVAILABLE ? normalized : NOT_AVAILABLE
}

export const getShippingTier = (order: OrderApiOrder | LoadedOrderPlacedOrder) => {
  const raw =
    resolveShippingTierFromOrder(order) ||
    readCheckoutPurchaseContext().shipping_tier ||
    readLastArumaGtmEcommerceString('add_shipping_info', 'shipping_tier') ||
    ''

  const normalized = normalizeShippingTier(raw)

  return normalized !== NOT_AVAILABLE ? normalized : NOT_AVAILABLE
}

export const getCurrency = (order: OrderApiOrder | LoadedOrderPlacedOrder) =>
  order.storePreferencesData?.currencyCode ||
  order.storePreferencesData?.currency ||
  'PEN'

export const getCoupon = (order: OrderApiOrder | LoadedOrderPlacedOrder) =>
  order.marketingData?.coupon || NOT_AVAILABLE

const fetchOrdersByOrderGroup = async (orderGroupId: string) => {
  try {
    const response = await fetch(
      `/api/checkout/pub/orders/order-group/${encodeURIComponent(orderGroupId)}`,
      { credentials: 'same-origin' }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    return Array.isArray(data) ? (data as OrderApiOrder[]) : null
  } catch (error) {
    log('order placed fetch failed', orderGroupId, error)
    return null
  }
}

const buildOrderFromOrders = (
  orders: OrderApiOrder[],
  orderGroup: string
): LoadedOrderPlacedOrder | null => {
  if (!orders.length) {
    return null
  }

  const primary = orders[0]
  const items: OrderApiItem[] = []

  for (const order of orders) {
    if (order.items?.length) {
      items.push(...order.items)
    }
  }

  if (!items.length) {
    return null
  }

  return {
    ...primary,
    items,
    orderGroup: primary.orderGroup || orderGroup,
    value: orders.reduce((sum, order) => sum + (order.value ?? 0), 0),
    totalizers: primary.totalizers ?? [],
    paymentData:
      orders.find((order) => order.paymentData)?.paymentData ??
      primary.paymentData,
    shippingData:
      orders.find((order) => order.shippingData)?.shippingData ??
      primary.shippingData,
    paymentNames:
      primary.paymentNames ??
      orders.find((order) => order.paymentNames?.length)?.paymentNames,
    marketingData: primary.marketingData,
    storePreferencesData: primary.storePreferencesData,
  }
}

export const loadOrderPlacedOrder = async (orderGroup: string) => {
  const orders = await fetchOrdersByOrderGroup(orderGroup)

  if (!orders?.length) {
    return null
  }

  return buildOrderFromOrders(orders, orderGroup)
}

const getTotalizerValue = (order: OrderApiOrder, id: string) => {
  const totalizer = order.totalizers?.find((entry) => entry.id === id)

  if (!totalizer?.value) {
    return 0
  }

  return totalizer.value / 100
}

export const getOrderTax = (order: OrderApiOrder | LoadedOrderPlacedOrder) =>
  getTotalizerValue(order, 'Tax')

export const getOrderShipping = (order: OrderApiOrder | LoadedOrderPlacedOrder) =>
  getTotalizerValue(order, 'Shipping')
