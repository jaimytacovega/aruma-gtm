import { log } from '../../utils'
import type { ViewCartData } from '../../typings/events'

import { buildViewCartPayload } from '../3_1__productImpression/catalog'
import { enrichCartItems } from '../cartItems'

const cartImpression = async (data: ViewCartData) => {
  const items = await enrichCartItems(
    data.items,
    'view_cart',
    'View cart',
    'view cart'
  )

  const payload = buildViewCartPayload(items, data.currency)

  log('view_cart payload', payload)
}

export { cartImpression }
