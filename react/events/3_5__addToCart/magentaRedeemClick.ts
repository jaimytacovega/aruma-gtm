import { log } from '../../utils'
import type { AddToCartData } from '../../typings/events'

import type { VtexCartItem } from '../cartItems'

const PENDING_TIMEOUT_MS = 8000
const POLL_INTERVAL_MS = 250

const MAGENTA_REDEEM_BUTTON_SELECTOR = [
  '[class*="flexColChild--buyButtonPdp"] button.vtex-button',
  '[class*="flexRowContent--productMagenta"] button.vtex-button',
].join(', ')

type OrderFormSnapshot = {
  bySku: Map<string, number>
}

type VtexOrderFormItem = {
  id?: string
  productId?: string
  name?: string
  detailUrl?: string
  quantity?: number
  sellingPrice?: number
  price?: number
  priceIsInt?: boolean
  additionalInfo?: { brandName?: string }
}

type VtexOrderForm = {
  items?: VtexOrderFormItem[]
  storePreferencesData?: {
    currencyCode?: string
    currency?: string
  }
}

type VtexJsCheckout = {
  getOrderForm?: () => {
    done: (callback: (orderForm: VtexOrderForm) => void) => {
      fail: (callback: () => void) => void
    }
  }
}

let captureAttached = false
let pendingRedeem: {
  snapshot: OrderFormSnapshot
  slugHint: string
  timeoutId: number
} | null = null
let redeemInFlight = false

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim().toLowerCase() || ''

const getSlugFromPathname = (): string => {
  const match = window.location.pathname.match(/\/([^/]+)\/p\/?$/)

  return match?.[1] ?? ''
}

const snapshotQuantities = (orderForm: VtexOrderForm): OrderFormSnapshot => {
  const bySku = new Map<string, number>()

  for (const item of orderForm.items ?? []) {
    const skuKey = String(item.id ?? '')

    if (skuKey) {
      bySku.set(skuKey, item.quantity ?? 0)
    }
  }

  return { bySku }
}

const ORDER_FORM_API = '/api/checkout/pub/orderForm'

const getOrderFormViaVtexjs = (): Promise<VtexOrderForm | null> => {
  const checkout = (window as Window & { vtexjs?: { checkout?: VtexJsCheckout } })
    .vtexjs?.checkout

  if (!checkout?.getOrderForm) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    checkout
      .getOrderForm!()
      .done((orderForm) => resolve(orderForm))
      .fail(() => resolve(null))
  })
}

const getOrderFormViaApi = async (): Promise<VtexOrderForm | null> => {
  try {
    const response = await fetch(ORDER_FORM_API, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as VtexOrderForm
  } catch {
    return null
  }
}

const getOrderForm = async (): Promise<VtexOrderForm | null> => {
  const fromVtexjs = await getOrderFormViaVtexjs()

  if (fromVtexjs) {
    return fromVtexjs
  }

  return getOrderFormViaApi()
}

const getCurrency = (orderForm: VtexOrderForm): string =>
  orderForm.storePreferencesData?.currencyCode ||
  orderForm.storePreferencesData?.currency ||
  'PEN'

const mapOrderFormItemToCartItem = (item: VtexOrderFormItem): VtexCartItem => ({
  brand: item.additionalInfo?.brandName || '',
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
  skuId: String(item.id ?? ''),
  variant: '',
})

const itemMatchesSlugHint = (item: VtexOrderFormItem, slugHint: string): boolean => {
  if (!slugHint) {
    return false
  }

  const slugKey = slugHint.toLowerCase()
  const detailUrl = String(item.detailUrl ?? '').toLowerCase()

  return detailUrl.includes(`/${slugKey}/p`)
}

const findIncreasedItem = (
  snapshot: OrderFormSnapshot,
  orderForm: VtexOrderForm,
  slugHint: string
): { item: VtexOrderFormItem; addedQty: number } | null => {
  const increases: Array<{ item: VtexOrderFormItem; addedQty: number }> = []

  for (const item of orderForm.items ?? []) {
    const skuKey = String(item.id ?? '')
    const before = snapshot.bySku.get(skuKey)
    const quantity = item.quantity ?? 0

    if (!skuKey || quantity <= 0) {
      continue
    }

    if (before === undefined) {
      increases.push({ item, addedQty: quantity })
      continue
    }

    if (quantity > before) {
      increases.push({ item, addedQty: quantity - before })
    }
  }

  if (!increases.length) {
    return null
  }

  if (slugHint) {
    const slugMatch = increases.find((entry) =>
      itemMatchesSlugHint(entry.item, slugHint)
    )

    if (slugMatch) {
      return slugMatch
    }
  }

  if (increases.length === 1) {
    return increases[0]
  }

  return null
}

const clearPendingRedeem = () => {
  if (pendingRedeem?.timeoutId) {
    window.clearTimeout(pendingRedeem.timeoutId)
  }

  pendingRedeem = null
}

const isMagentaRedeemButton = (target: Element): boolean => {
  const button = target.closest(MAGENTA_REDEEM_BUTTON_SELECTOR)

  if (!(button instanceof HTMLButtonElement)) {
    return false
  }

  if (button.hasAttribute('disabled') || button.disabled) {
    return false
  }

  const label = button.querySelector('.vtex-button__label')
  const text = normalizeText(label?.textContent || button.textContent)

  return text === 'canjear'
}

const runRedeemAddToCart = async (
  onAddToCart: (data: AddToCartData) => void | Promise<void>,
  orderFormOverride?: VtexOrderForm | null
) => {
  if (!pendingRedeem || redeemInFlight) {
    return
  }

  const orderForm = orderFormOverride ?? (await getOrderForm())

  if (!orderForm) {
    return
  }

  const result = findIncreasedItem(
    pendingRedeem.snapshot,
    orderForm,
    pendingRedeem.slugHint
  )

  if (!result || result.addedQty <= 0) {
    return
  }

  clearPendingRedeem()
  redeemInFlight = true

  try {
    const cartItem = mapOrderFormItemToCartItem({
      ...result.item,
      quantity: result.addedQty,
    })

    const data: AddToCartData = {
      event: 'addToCart',
      eventName: 'vtex:addToCart',
      currency: getCurrency(orderForm),
      items: [cartItem],
    }

    log('magenta redeem add_to_cart', data)
    await onAddToCart(data)
  } finally {
    redeemInFlight = false
  }
}

const watchOrderFormAfterRedeemClick = (
  onAddToCart: (data: AddToCartData) => void | Promise<void>
) => {
  const startedAt = Date.now()

  const poll = async () => {
    if (!pendingRedeem) {
      return
    }

    await runRedeemAddToCart(onAddToCart)

    if (!pendingRedeem) {
      return
    }

    if (Date.now() - startedAt >= PENDING_TIMEOUT_MS) {
      log('magenta redeem add_to_cart timeout')
      clearPendingRedeem()
      return
    }

    window.setTimeout(() => {
      void poll()
    }, POLL_INTERVAL_MS)
  }

  void poll()
}

const onMagentaRedeemClick = async (
  onAddToCart: (data: AddToCartData) => void | Promise<void>
) => {
  if (pendingRedeem || redeemInFlight) {
    return
  }

  const orderForm = (await getOrderForm()) ?? { items: [] }

  if (!orderForm.items?.length) {
    log('magenta redeem add_to_cart: empty cart snapshot, waiting for update')
  }

  pendingRedeem = {
    snapshot: snapshotQuantities(orderForm),
    slugHint: getSlugFromPathname(),
    timeoutId: window.setTimeout(() => {
      log('magenta redeem add_to_cart timeout')
      clearPendingRedeem()
    }, PENDING_TIMEOUT_MS),
  }

  watchOrderFormAfterRedeemClick(onAddToCart)
}

const bindOrderFormUpdatedListener = (
  onAddToCart: (data: AddToCartData) => void | Promise<void>
) => {
  const jQuery = (
    window as Window & {
      jQuery?: (
        target: Window
      ) => {
        on: (
          event: string,
          handler: (event: unknown, orderForm: VtexOrderForm) => void
        ) => void
      }
    }
  ).jQuery

  if (!jQuery) {
    return
  }

  jQuery(window).on('orderFormUpdated.vtex', (_event, orderForm) => {
    void runRedeemAddToCart(onAddToCart, orderForm)
  })
}

/** Magenta PDP "Canjear" uses a custom add-to-cart path — no vtex:addToCart pixel. */
export const setupMagentaRedeemAddToCartCapture = (
  onAddToCart: (data: AddToCartData) => void | Promise<void>
): void => {
  if (captureAttached || typeof document === 'undefined') {
    return
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) {
        return
      }

      if (!isMagentaRedeemButton(event.target)) {
        return
      }

      void onMagentaRedeemClick(onAddToCart)
    },
    true
  )

  bindOrderFormUpdatedListener(onAddToCart)
  captureAttached = true
}
