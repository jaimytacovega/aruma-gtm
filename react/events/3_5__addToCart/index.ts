import { log } from '../../utils'
import type { AddToCartData } from '../../typings/events'

import {
  buildAddToCartPayload,
  buildViewItem,
  fetchCatalogProduct,
} from '../3_1__productImpression/catalog'

const getSlugFromDetailUrl = (detailUrl: string): string => {
  const path = detailUrl.startsWith('http')
    ? new URL(detailUrl, window.location.origin).pathname
    : detailUrl
  const match = path.match(/\/([^/]+)\/p\/?$/)

  return match?.[1] ?? ''
}

const getCartItemUnitPrice = (
  cartItem: AddToCartData['items'][number]
): number => {
  if (cartItem.priceIsInt) {
    return cartItem.price / 100
  }

  return cartItem.price
}

const addToCart = async (data: AddToCartData) => {
  const items = await Promise.all(
    data.items.map(async (cartItem, index) => {
      const catalogSlug = getSlugFromDetailUrl(cartItem.detailUrl)
      const slug = catalogSlug || cartItem.productId

      let catalog = null

      if (catalogSlug) {
        try {
          catalog = await fetchCatalogProduct(catalogSlug)
        } catch (error) {
          log('add to cart catalog error', error)
        }
      }

      const item = buildViewItem(
        {
          slug,
          name: cartItem.name,
          brand: cartItem.brand,
          price: getCartItemUnitPrice(cartItem),
          index: index + 1,
          listId: 'add_to_cart',
          listName: 'Add to cart',
        },
        catalog
      )

      return {
        ...item,
        quantity: cartItem.quantity,
      }
    })
  )

  const payload = buildAddToCartPayload(items, data.currency)

  log('add_to_cart payload', payload)
}

export { addToCart }
