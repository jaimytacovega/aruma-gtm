import { log, pushToDataLayer } from '../../utils'
import type { AddToCartData } from '../../typings/events'

import { buildAddToCartPayload } from '../3_1__productImpression/catalog'
import { enrichCartItems } from '../cartItems'

const addToCart = async (data: AddToCartData) => {
  const items = await enrichCartItems(
    data.items,
    'add_to_cart',
    'Add to cart',
    'add to cart'
  )

  const payload = buildAddToCartPayload(items, data.currency)

  pushToDataLayer(payload)
}

export { addToCart }
