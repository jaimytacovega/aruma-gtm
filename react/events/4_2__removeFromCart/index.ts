import { log, pushToDataLayer } from '../../utils'
import type { RemoveToCartData } from '../../typings/events'

import { buildRemoveFromCartPayload } from '../3_1__productImpression/catalog'
import { enrichCartItems } from '../cartItems'

const removeFromCart = async (data: RemoveToCartData) => {
  const items = await enrichCartItems(
    data.items,
    'remove_from_cart',
    'Remove from cart',
    'remove from cart'
  )

  const payload = buildRemoveFromCartPayload(items, data.currency)

  pushToDataLayer(payload)
}

export { removeFromCart }
