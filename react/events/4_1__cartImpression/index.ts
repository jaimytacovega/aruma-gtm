import { pushToDataLayer } from '../../utils'
import type { ViewCartData } from '../../typings/events'

import { buildViewCartPayload } from '../3_1__productImpression/catalog'
import { enrichCartItemsWithStoredListContext } from '../cartItems'

const cartImpression = async (data: ViewCartData) => {
  const items = await enrichCartItemsWithStoredListContext(
    data.items,
    'view cart'
  )

  const payload = buildViewCartPayload(items, data.currency)

  pushToDataLayer(payload)
}

export { cartImpression }
