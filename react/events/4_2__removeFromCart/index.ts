import { pushToDataLayer } from '../../utils'
import type { RemoveToCartData } from '../../typings/events'

import { buildRemoveFromCartPayload } from '../3_1__productImpression/catalog'
import { enrichCartItemsWithStoredListContext } from '../cartItems'

const removeFromCart = async (data: RemoveToCartData) => {
  const items = await enrichCartItemsWithStoredListContext(
    data.items,
    'remove from cart'
  )

  const payload = buildRemoveFromCartPayload(items, data.currency)

  pushToDataLayer(payload)
}

export { removeFromCart }
