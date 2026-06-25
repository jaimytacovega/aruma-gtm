import { pushToDataLayer } from '../../utils'
import type { AddToCartData } from '../../typings/events'

import { buildAddToCartPayload } from '../3_1__productImpression/catalog'
import { enrichCartItemsWithStoredListContext } from '../cartItems'

import { setupGoPersonalAddToCartCapture } from './goPersonalAddToCartClick'
import { setupMagentaRedeemAddToCartCapture } from './magentaRedeemClick'

const addToCart = async (data: AddToCartData) => {
  const items = await enrichCartItemsWithStoredListContext(
    data.items,
    'add to cart'
  )

  const payload = buildAddToCartPayload(items, data.currency)

  pushToDataLayer(payload)
}

export {
  addToCart,
  setupGoPersonalAddToCartCapture,
  setupMagentaRedeemAddToCartCapture,
}
