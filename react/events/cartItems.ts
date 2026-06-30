import { getListContextFromPurchaseContext } from './orderPlaced/orderPlacedUtils'
import {
  isGenericListContext,
  saveListContextForProduct,
} from '../listContextStore'
import { getListFromLastSelectItem, log, NOT_AVAILABLE } from '../utils'
import type { AddToCartData } from '../typings/events'

import {
  buildViewItem,
  fetchCatalogProduct,
  isMagentaPointsProduct,
} from './3_1__productImpression/catalog'
import type { ViewItem } from './3_1__productImpression/catalog'
import { MAGENTA_POINTS_LIST_LABEL, resolveProductListFromDom } from './productSummary'

export type VtexCartItem = AddToCartData['items'][number]

const getSlugFromDetailUrl = (detailUrl: string): string => {
  const path = detailUrl.startsWith('http')
    ? new URL(detailUrl, window.location.origin).pathname
    : detailUrl
  const match = path.match(/\/([^/]+)\/p\/?$/)

  return match?.[1] ?? ''
}

export const getSlugFromCartItem = (cartItem: VtexCartItem): string => {
  const catalogSlug = getSlugFromDetailUrl(cartItem.detailUrl)

  return catalogSlug || cartItem.productId
}

const getCartItemUnitPrice = (cartItem: VtexCartItem): number => {
  if (cartItem.priceIsInt) {
    return cartItem.price / 100
  }

  return cartItem.price
}

export const enrichCartItems = async (
  cartItems: VtexCartItem[],
  listId: string,
  listName: string,
  logContext: string
) =>
  Promise.all(
    cartItems.map(async (cartItem, index) => {
      const catalogSlug = getSlugFromDetailUrl(cartItem.detailUrl)
      const slug = catalogSlug || cartItem.productId

      let catalog = null

      if (catalogSlug) {
        try {
          catalog = await fetchCatalogProduct(catalogSlug)
        } catch (error) {
          log(`${logContext} catalog error`, error)
        }
      }

      const item = buildViewItem(
        {
          slug,
          name: cartItem.name,
          brand: cartItem.brand,
          price: getCartItemUnitPrice(cartItem),
          index: index + 1,
          listId,
          listName,
        },
        catalog
      )

      return {
        ...item,
        quantity: cartItem.quantity,
      }
    })
  )

const resolveMagentaPointsListContext = async (
  cartItem: VtexCartItem
): Promise<{ listId: string; listName: string } | null> => {
  const catalogSlug = getSlugFromDetailUrl(cartItem.detailUrl)
  const categories = cartItem.category ? [cartItem.category] : undefined

  if (!catalogSlug) {
    return null
  }

  try {
    const catalog = await fetchCatalogProduct(catalogSlug)

    if (isMagentaPointsProduct(catalog, categories)) {
      return {
        listId: MAGENTA_POINTS_LIST_LABEL,
        listName: MAGENTA_POINTS_LIST_LABEL,
      }
    }
  } catch (error) {
    log('resolve list context catalog error', error)
  }

  return null
}

const isMagentaPointsListContext = (listId: string): boolean =>
  listId.trim().toLowerCase() === 'magenta points'

const resolveListContextForCartItem = async (
  cartItem: VtexCartItem
): Promise<{ listId: string; listName: string }> => {
  const slug = getSlugFromCartItem(cartItem)
  const fromPurchaseContext = getListContextFromPurchaseContext(
    cartItem.productId,
    slug
  )

  if (fromPurchaseContext) {
    return fromPurchaseContext
  }

  const fromMagentaPoints = await resolveMagentaPointsListContext(cartItem)

  if (fromMagentaPoints) {
    return fromMagentaPoints
  }

  const fromHistory = getListFromLastSelectItem(slug, cartItem.productId)

  if (
    !isMagentaPointsListContext(fromHistory.listId) &&
    !isGenericListContext(fromHistory) &&
    fromHistory.listId !== NOT_AVAILABLE
  ) {
    return fromHistory
  }

  const fromDom = resolveProductListFromDom(slug)

  if (fromDom && !isGenericListContext(fromDom)) {
    return fromDom
  }

  if (fromDom) {
    return fromDom
  }

  return fromHistory
}

/** Per-item list context from impression / select_item (dataLayer + localStorage). */
export const enrichCartItemsWithStoredListContext = async (
  cartItems: VtexCartItem[],
  logContext: string
) => {
  const items: Array<ViewItem & { quantity: number }> = []

  for (const cartItem of cartItems) {
    const slug = getSlugFromCartItem(cartItem)
    const { listId, listName } = await resolveListContextForCartItem(cartItem)

    saveListContextForProduct({
      slug,
      productId: cartItem.productId,
      listId,
      listName,
    })

    const enriched = await enrichCartItems(
      [cartItem],
      listId,
      listName,
      logContext
    )

    for (const item of enriched) {
      items.push(item)
    }
  }

  return items
}
