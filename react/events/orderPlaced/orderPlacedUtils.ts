import { log, NOT_AVAILABLE } from '../../utils'

const FIRED_ORDER_PLACED_KEY = 'aruma-gtm:fired-order-placed-events'
export const AWAITING_ORDER_PLACED_KEY = 'aruma-gtm:awaiting-order-placed'
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
  totalizers?: Array<{ id: string; value: number }>
  paymentData?: {
    payments?: Array<{
      paymentSystemName?: string
      groupName?: string
      paymentSystem?: string | number
    }>
  }
  shippingData?: {
    logisticsInfo?: Array<{
      selectedSlaId?: string
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
  } catch {
    // sessionStorage unavailable
  }
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

const getTotalizerValue = (order: OrderApiOrder, id: string) => {
  const totalizer = order.totalizers?.find((entry) => entry.id === id)

  if (!totalizer?.value) {
    return 0
  }

  return totalizer.value / 100
}

export const getPaymentType = (order: OrderApiOrder | LoadedOrderPlacedOrder) => {
  const payment = order.paymentData?.payments?.[0]

  if (payment?.paymentSystemName) {
    return normalizeText(payment.paymentSystemName)
  }

  if (payment?.groupName) {
    return normalizeText(payment.groupName)
  }

  if (payment?.paymentSystem) {
    return String(payment.paymentSystem)
  }

  return NOT_AVAILABLE
}

export const getShippingTier = (order: OrderApiOrder | LoadedOrderPlacedOrder) => {
  const logisticsInfo = order.shippingData?.logisticsInfo ?? []

  for (const logistics of logisticsInfo) {
    const selectedSla = logistics.slas?.find(
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
    paymentData: primary.paymentData,
    shippingData: primary.shippingData,
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

export const getOrderTax = (order: OrderApiOrder | LoadedOrderPlacedOrder) =>
  getTotalizerValue(order, 'Tax')

export const getOrderShipping = (order: OrderApiOrder | LoadedOrderPlacedOrder) =>
  getTotalizerValue(order, 'Shipping')
