import { log } from '../../utils'
import type { OrderPlacedData } from '../../typings/events'

import { successPaymentScreening } from '../5_4_1__successPaymentScreening'
import { successPayment } from '../5_4_2__successPayment'

import {
  clearAwaitingOrderPlaced,
  hasAwaitingOrderPlaced,
  isCheckoutOrderPlacedPage,
} from './orderPlacedUtils'

/** Order placed runs on the IO storefront pixel, not checkout6-custom.js. */
export const handleOrderPlacedPage = async (
  pageUrl = window.location.href,
  pixelOrder?: OrderPlacedData
) => {
  if (!isCheckoutOrderPlacedPage(pageUrl)) {
    return
  }

  // Require checkout payment submit (session flag) or vtex:orderPlaced pixel.
  if (!pixelOrder && !hasAwaitingOrderPlaced()) {
    log('handleOrderPlacedPage skip: no active purchase session', pageUrl)
    return
  }

  log('handleOrderPlacedPage', pageUrl)

  await Promise.all([
    successPaymentScreening(pageUrl),
    successPayment(pageUrl, pixelOrder),
  ])

  clearAwaitingOrderPlaced()
}
