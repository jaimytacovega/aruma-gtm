import { log, NOT_AVAILABLE, pushToDataLayer } from '../../utils'
import type { OrderPlacedData, ProductOrder } from '../../typings/events'

import type { ViewItem } from '../3_1__productImpression/catalog'
import { enrichCartItemsWithStoredListContext } from '../cartItems'
import type { VtexCartItem } from '../cartItems'
import {
  claimOrderPlacedEvent,
  getCoupon,
  getCurrency,
  getOrderGroupFromUrl,
  getPaymentType,
  getPurchaseEcommerceTotals,
  getShippingTier,
  isCheckoutOrderPlacedPage,
  loadOrderPlacedOrder,
} from '../orderPlaced/orderPlacedUtils'
import type {
  LoadedOrderPlacedOrder,
  PixelPurchaseTotals,
} from '../orderPlaced/orderPlacedUtils'

let purchaseInFlight = false

const mapOrderApiItemToCartItem = (
  item: LoadedOrderPlacedOrder['items'][number]
): VtexCartItem => ({
  brand: item.brand || item.additionalInfo?.brandName || '',
  ean: '',
  category: '',
  detailUrl: item.detailUrl || '',
  imageUrl: '',
  name: item.name || '',
  price: item.sellingPrice ?? item.price ?? 0,
  priceIsInt: item.priceIsInt ?? true,
  productId: String(item.productId ?? ''),
  productRefId: '',
  quantity: item.quantity ?? 1,
  seller: '',
  sellerName: '',
  skuId: '',
  variant: '',
})

const mapProductOrderToCartItem = (product: ProductOrder): VtexCartItem => ({
  brand: product.brand,
  ean: product.ean,
  category: product.category,
  detailUrl: product.slug ? `/${product.slug}/p` : '',
  imageUrl: '',
  name: product.name,
  price: product.sellingPrice ?? product.price,
  priceIsInt: true,
  productId: product.id,
  productRefId: product.productRefId,
  quantity: product.quantity,
  seller: product.sellerId,
  sellerName: product.seller,
  skuId: product.sku,
  variant: product.skuName,
})

const getItemNetValue = (item: ViewItem) =>
  Number(((item.price - item.discount) * item.quantity).toFixed(2))

const buildItemsTotals = (items: Array<ViewItem & { quantity: number }>) => {
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

const pushPurchasePayload = async (
  orderGroup: string,
  currency: string,
  coupon: string,
  payment_type: string,
  shipping_tier: string,
  order: Parameters<typeof getPurchaseEcommerceTotals>[0],
  items: Array<ViewItem & { quantity: number }>,
  pixelTotals?: PixelPurchaseTotals
) => {
  const itemTotals = buildItemsTotals(items)
  const purchaseTotals = getPurchaseEcommerceTotals(
    order,
    itemTotals.value,
    pixelTotals
  )

  pushToDataLayer({
    event: 'purchase',
    ecommerce: {
      transaction_id: orderGroup,
      currency,
      value: purchaseTotals.value,
      magentaPoints_value: itemTotals.magentaPoints_value,
      tax: purchaseTotals.tax,
      shipping: purchaseTotals.shipping,
      coupon,
      shipping_tier,
      payment_type,
      items,
    },
  })
}

const runPurchaseFromLoadedOrder = async (order: LoadedOrderPlacedOrder) => {
  const orderGroup =
    getOrderGroupFromUrl() || order.orderGroup || order.id || order.orderFormId

  if (!orderGroup) {
    log('5_4_2__successPayment skip: missing order group')
    return
  }

  if (purchaseInFlight) {
    return
  }

  purchaseInFlight = true

  const items = await enrichCartItemsWithStoredListContext(
    order.items.map(mapOrderApiItemToCartItem),
    'purchase'
  )

  if (!claimOrderPlacedEvent('purchase', orderGroup)) {
    log('5_4_2__successPayment skip: already fired', orderGroup)
    purchaseInFlight = false
    return
  }

  await pushPurchasePayload(
    orderGroup,
    getCurrency(order),
    getCoupon(order),
    getPaymentType(order),
    getShippingTier(order),
    order,
    items
  )

  log('5_4_2__successPayment pushing purchase', orderGroup)
  purchaseInFlight = false
}

const runPurchaseFromPixelOrder = async (data: OrderPlacedData) => {
  const orderGroup = data.orderGroup || data.transactionId

  if (!orderGroup) {
    log('5_4_2__successPayment skip: pixel order missing group')
    return
  }

  if (purchaseInFlight) {
    return
  }

  purchaseInFlight = true

  const cartItems = (data.transactionProducts ?? []).map(mapProductOrderToCartItem)

  if (!cartItems.length) {
    log('5_4_2__successPayment skip: pixel order has no products', orderGroup)
    purchaseInFlight = false
    return
  }

  const items = await enrichCartItemsWithStoredListContext(
    cartItems,
    'purchase'
  )

  if (!claimOrderPlacedEvent('purchase', orderGroup)) {
    log('5_4_2__successPayment skip: already fired', orderGroup)
    purchaseInFlight = false
    return
  }

  const payment_type = getPaymentType({
    paymentData: {
      payments: (data.transactionPaymentType ?? []).map((payment) => ({
        paymentSystemName: payment.paymentSystemName,
        groupName: payment.group,
        group: payment.group,
      })),
    },
  })

  const shipping_tier = getShippingTier({
    shippingData: {
      logisticsInfo: (data.transactionShippingMethod ?? []).map((method) => ({
        selectedSla: method.selectedSla,
      })),
    },
  })

  await pushPurchasePayload(
    orderGroup,
    data.currency || data.transactionCurrency || 'PEN',
    data.coupon || NOT_AVAILABLE,
    payment_type,
    shipping_tier,
    {},
    items,
    {
      transactionTotal: data.transactionTotal,
      transactionTax: data.transactionTax,
      transactionShipping: data.transactionShipping,
      productTaxCents: (data.transactionProducts ?? []).reduce(
        (sum, product) => sum + (product.tax ?? 0),
        0
      ),
    }
  )

  log('5_4_2__successPayment pushing purchase from pixel', orderGroup)
  purchaseInFlight = false
}

export const successPayment = async (
  pageUrl = window.location.href,
  pixelOrder?: OrderPlacedData
) => {
  if (!isCheckoutOrderPlacedPage(pageUrl)) {
    return
  }

  if (pixelOrder) {
    await runPurchaseFromPixelOrder(pixelOrder)
    return
  }

  const orderGroup = getOrderGroupFromUrl(pageUrl)

  if (!orderGroup) {
    log('5_4_2__successPayment skip: missing og', pageUrl)
    return
  }

  const order = await loadOrderPlacedOrder(orderGroup)

  if (!order?.items?.length) {
    log('5_4_2__successPayment skip: no order items', orderGroup)
    return
  }

  await runPurchaseFromLoadedOrder(order)
}
