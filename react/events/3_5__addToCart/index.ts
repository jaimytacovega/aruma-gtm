import { getListFromLastSelectItem, pushToDataLayer } from '../../utils'
import type { AddToCartData } from '../../typings/events'

import { buildAddToCartPayload } from '../3_1__productImpression/catalog'
import type { ViewItem } from '../3_1__productImpression/catalog'
import { enrichCartItems, getSlugFromCartItem } from '../cartItems'

const addToCart = async (data: AddToCartData) => {
  const items: Array<ViewItem & { quantity: number }> = []

  for (const cartItem of data.items) {
    const slug = getSlugFromCartItem(cartItem)
    const { listId, listName } = getListFromLastSelectItem(
      slug,
      cartItem.productId
    )
    const enriched = await enrichCartItems(
      [cartItem],
      listId,
      listName,
      'add to cart'
    )

    for (const item of enriched) {
      items.push(item)
    }
  }

  const payload = buildAddToCartPayload(items, data.currency)

  pushToDataLayer(payload)
}

export { addToCart }
