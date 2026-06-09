import { log, pushToDataLayer } from '../../utils'

import {
  buildSuccessVirtualPagePayload,
  claimOrderPlacedEvent,
  getOrderGroupFromUrl,
  isCheckoutOrderPlacedPage,
  loadOrderPlacedOrder,
} from '../orderPlaced/orderPlacedUtils'

let pushInFlight = false

export const successPaymentScreening = async (pageUrl = window.location.href) => {
  if (!isCheckoutOrderPlacedPage(pageUrl)) {
    return
  }

  const orderGroup = getOrderGroupFromUrl(pageUrl)

  if (!orderGroup) {
    log('5_4_1__successPaymentScreening skip: missing og', pageUrl)
    return
  }

  if (pushInFlight) {
    return
  }

  pushInFlight = true

  const order = await loadOrderPlacedOrder(orderGroup)

  if (!order?.items?.length) {
    log('5_4_1__successPaymentScreening skip: no order items', orderGroup)
    pushInFlight = false
    return
  }

  if (!claimOrderPlacedEvent('virtualPage', orderGroup)) {
    log('5_4_1__successPaymentScreening skip: already fired', orderGroup)
    pushInFlight = false
    return
  }

  const payload = buildSuccessVirtualPagePayload(orderGroup)

  log('5_4_1__successPaymentScreening pushing virtualPage', orderGroup)
  pushToDataLayer(payload)
  pushInFlight = false
}
