import { log } from '../utils'
import type { AddToCartData } from '../typings/events'

import { buildViewItem, fetchCatalogProduct } from './3_1__productImpression/catalog'

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
