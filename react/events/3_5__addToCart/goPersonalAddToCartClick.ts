import { saveListContextForProduct } from '../../listContextStore'
import { log } from '../../utils'
import type { AddToCartData } from '../../typings/events'

import type { VtexCartItem } from '../cartItems'
import {
  buildGoPersonalVisibleProduct,
  getGoPersonalProductId,
  GOPERSONAL_ROOT_SELECTOR,
  isGoPersonalProduct,
} from '../goPersonal'

const PENDING_TIMEOUT_MS = 8000
const POLL_INTERVAL_MS = 250

const GOPERSONAL_ADD_BTN_SELECTOR = '[class*="gs_add_cart_btn"]'

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

type PendingAdd = {
  snapshot: OrderFormSnapshot
  productId: string
  slugHint: string
  card: HTMLElement
  startedAt: number
}

let captureAttached = false
let pendingAdd: PendingAdd | null = null
let addInFlight = false

const getGoPersonalAddButton = (target: Element): HTMLElement | null => {
  const button = target.closest(GOPERSONAL_ADD_BTN_SELECTOR)

  if (!(button instanceof HTMLElement)) {
    return null
  }

  if (!button.closest(GOPERSONAL_ROOT_SELECTOR)) {
    return null
  }

  return button
}

const getGoPersonalCardFromButton = (button: HTMLElement): HTMLElement | null => {
  const card = button.closest('.slid-child-wrap')

  if (card instanceof HTMLElement && isGoPersonalProduct(card)) {
    return card
  }

  return null
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

const mapOrderFormItemToCartItem = (
  item: VtexOrderFormItem,
  quantity: number
): VtexCartItem => ({
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
  quantity,
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

const itemMatchesProductId = (
  item: VtexOrderFormItem,
  productId: string
): boolean => Boolean(productId && String(item.productId ?? '') === productId)

const findIncreasedItem = (
  snapshot: OrderFormSnapshot,
  orderForm: VtexOrderForm,
  productId: string,
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

  if (productId) {
    const productMatch = increases.find((entry) =>
      itemMatchesProductId(entry.item, productId)
    )

    if (productMatch) {
      return productMatch
    }
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

const buildCartItemFromGoPersonalCard = (card: HTMLElement): VtexCartItem | null => {
  const visible = buildGoPersonalVisibleProduct(card)
  const productId = getGoPersonalProductId(card)

  if (!visible || !productId) {
    return null
  }

  const link = card.querySelector('a[href*="/p"]')
  const detailUrl =
    link instanceof HTMLAnchorElement
      ? link.pathname
      : `/${visible.slug}/p`
  const imageUrl =
    card.querySelector('img')?.getAttribute('src') ??
    card.querySelector('img')?.getAttribute('data-src') ??
    ''

  return {
    brand: visible.brand,
    ean: '',
    category: '',
    detailUrl,
    imageUrl,
    name: visible.name,
    price: Math.round(visible.price * 100),
    priceIsInt: true,
    productId,
    productRefId: productId,
    quantity: 1,
    seller: '1',
    sellerName: '',
    skuId: productId,
    variant: visible.name,
  }
}

const saveGoPersonalListContext = (card: HTMLElement): void => {
  const visible = buildGoPersonalVisibleProduct(card)

  if (!visible) {
    return
  }

  saveListContextForProduct({
    slug: visible.slug,
    productId: getGoPersonalProductId(card),
    listId: visible.listId,
    listName: visible.listName,
  })
}

const clearPendingAdd = () => {
  pendingAdd = null
}

const fireGoPersonalAddToCart = async (
  onAddToCart: (data: AddToCartData) => void | Promise<void>,
  cartItem: VtexCartItem,
  currency: string
) => {
  const data: AddToCartData = {
    event: 'addToCart',
    eventName: 'vtex:addToCart',
    currency,
    items: [cartItem],
  }

  log('gopersonal add_to_cart', data)
  await onAddToCart(data)
}

const runGoPersonalAddToCart = async (
  onAddToCart: (data: AddToCartData) => void | Promise<void>,
  orderFormOverride?: VtexOrderForm | null
) => {
  if (!pendingAdd || addInFlight) {
    return
  }

  const orderForm = orderFormOverride ?? (await getOrderForm())
  const { productId, slugHint, card } = pendingAdd

  if (orderForm) {
    const result = findIncreasedItem(
      pendingAdd.snapshot,
      orderForm,
      productId,
      slugHint
    )

    if (result && result.addedQty > 0) {
      clearPendingAdd()
      addInFlight = true

      try {
        const cartItem = mapOrderFormItemToCartItem(result.item, result.addedQty)

        await fireGoPersonalAddToCart(onAddToCart, cartItem, getCurrency(orderForm))
      } finally {
        addInFlight = false
      }

      return
    }
  }
}

const watchOrderFormAfterGoPersonalClick = (
  onAddToCart: (data: AddToCartData) => void | Promise<void>
) => {
  const poll = async () => {
    if (!pendingAdd) {
      return
    }

    const startedAt = pendingAdd.startedAt

    await runGoPersonalAddToCart(onAddToCart)

    if (!pendingAdd) {
      return
    }

    if (Date.now() - startedAt >= PENDING_TIMEOUT_MS) {
      const card = pendingAdd.card
      const fallbackItem = buildCartItemFromGoPersonalCard(card)

      clearPendingAdd()

      if (!fallbackItem) {
        log('gopersonal add_to_cart timeout: missing dom fallback')
        return
      }

      addInFlight = true

      try {
        const orderForm = (await getOrderForm()) ?? { items: [] }

        await fireGoPersonalAddToCart(
          onAddToCart,
          fallbackItem,
          getCurrency(orderForm)
        )
      } finally {
        addInFlight = false
      }

      return
    }

    window.setTimeout(() => {
      void poll()
    }, POLL_INTERVAL_MS)
  }

  void poll()
}

const onGoPersonalAddClick = async (
  onAddToCart: (data: AddToCartData) => void | Promise<void>,
  button: HTMLElement
) => {
  if (pendingAdd || addInFlight) {
    return
  }

  const card = getGoPersonalCardFromButton(button)

  if (!card) {
    return
  }

  const visible = buildGoPersonalVisibleProduct(card)
  const productId = getGoPersonalProductId(card)

  if (!visible || !productId) {
    log('gopersonal add_to_cart skip: missing product metadata')
    return
  }

  saveGoPersonalListContext(card)

  const orderForm = (await getOrderForm()) ?? { items: [] }

  pendingAdd = {
    snapshot: snapshotQuantities(orderForm),
    productId,
    slugHint: visible.slug,
    card,
    startedAt: Date.now(),
  }

  watchOrderFormAfterGoPersonalClick(onAddToCart)
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
    void runGoPersonalAddToCart(onAddToCart, orderForm)
  })
}

/** GoPersonal carousel "Añadir" — custom gsAddToCart, no vtex:addToCart pixel. */
export const setupGoPersonalAddToCartCapture = (
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

      const button = getGoPersonalAddButton(event.target)

      if (!button) {
        return
      }

      void onGoPersonalAddClick(onAddToCart, button)
    },
    true
  )

  bindOrderFormUpdatedListener(onAddToCart)
  captureAttached = true
}
