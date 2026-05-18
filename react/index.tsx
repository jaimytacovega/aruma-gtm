import { canUseDOM } from 'vtex.render-runtime'

import type {
  AddToCartData,
  PageViewData,
  PixelMessage,
  ProductViewData,
} from './typings/events'

function pushToDataLayer(payload: Record<string, unknown>) {
  if (!canUseDOM) {
    return
  }

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(payload)
  console.log(`[aruma-gtm] ${JSON.stringify(payload)}`)
}

export function handleEvents(e: PixelMessage) {
  switch (e.data.eventName) {
    case 'vtex:pageView': {
      const data = e.data as PageViewData

      pushToDataLayer({
        event: 'analytics_loaded',
        pageTitle: data.pageTitle,
        pageUrl: data.pageUrl,
      })

      break
    }

    case 'vtex:productView': {
      const data = e.data as ProductViewData

      pushToDataLayer({
        event: 'view_item',
        productId: data.product?.productId,
        productName: data.product?.productName,
        brand: data.product?.brand,
        categoryId: data.product?.categoryId,
        categories: data.product?.categories,
        skuId: data.product?.selectedSku?.itemId,
      })

      break
    }

    case 'vtex:addToCart': {
      const data = e.data as AddToCartData

      pushToDataLayer({
        event: 'add_to_cart',
        items: data.items,
      })

      break
    }

    default: {
      break
    }
  }
}

if (canUseDOM) {
  window.addEventListener('message', handleEvents)
}
