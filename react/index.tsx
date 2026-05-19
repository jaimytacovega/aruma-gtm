import { canUseDOM } from 'vtex.render-runtime'

import type {
    AddToCartData,
    PageViewData,
    PixelMessage,
    ProductViewData,
} from './typings/events'

import { pushToDataLayer } from './utils'

import { homeHeaderGeneralOptions } from './events/2_1_1__homeHeaderGeneralOptions'
import { homeHeaderMenu } from './events/2_1_2__homeHeaderMenu'


let domClickListenerAttached = false

function handleDocumentClick(event: MouseEvent) {
    const target = event.target

    if (!(target instanceof Element)) {
        return
    }

    // 2.1.1 Home Header General Options
    homeHeaderGeneralOptions(target, 'header-magenta-button ')
    homeHeaderGeneralOptions(target, 'header-login ')
    homeHeaderGeneralOptions(target, 'storesaruma ')

    // 2.1.2 Home Header Menu
    homeHeaderMenu(target)
}

/** VTEX has no pixel event for arbitrary DOM clicks — use delegation on document. */
function setupDomClickListeners() {
    if (!canUseDOM || domClickListenerAttached) {
        return
    }

    document.addEventListener('click', handleDocumentClick)
    domClickListenerAttached = true
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

            // Re-run after each route change (VTEX SPA). Delegation on document is enough,
            // but pageView is the right hook if you add per-page DOM setup later.
            setupDomClickListeners()

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
    setupDomClickListeners()
}
