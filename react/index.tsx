import { canUseDOM } from 'vtex.render-runtime'

import type {
    AddToCartData,
    AddToWishlistData,
    PageViewData,
    PixelMessage,
    ProductClickData,
    ProductViewData,
    RemoveToCartData,
    ViewCartData,
} from './typings/events'

import { pushToDataLayer, log } from './utils'

import { homeHeaderGeneralOptions } from './events/2_1_1__homeHeaderGeneralOptions'
import { homeHeaderMenu } from './events/2_1_2__homeHeaderMenu'
import { footerFunctionalOptions } from './events/2_2_1__footerFunctionalOptions'
import { footerSocials } from './events/2_2_2__footerSocials'
import { registerLoginModal } from './events/2_3_1_1__registerLoginModal'
import { registerRecoverPassword } from './events/2_3_1_2__registerRecoverPassword'
import { registerPickButtons } from './events/2_3_1_3__registerPickButtons'
import { registerProductImpression } from './events/3_1__productImpression'
import { setupProductClickCapture } from './events/productSummary'
import { fetchCatalogProduct } from './events/3_1__productImpression/catalog'
import {
    productClick,
    setupSearchAutocompleteProductClick,
} from './events/3_2__productClick'
import { productDetail } from './events/3_3__productDetail'
import { addToWishlist } from './events/3_4__addToWishlist'
import { addToCart } from './events/3_5__addToCart'
import { cartImpression } from './events/4_1__cartImpression'
import { removeFromCart } from './events/4_2__removeFromCart'

let domClickListenerAttached = false

const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target

    if (!(target instanceof Element)) {
        return
    }

    // 2.1.1 Home Header General Options
    homeHeaderGeneralOptions(target)

    // 2.1.2 Home Header Menu
    homeHeaderMenu(target)

    // TODO: 2.1.3 Home Header Search
    
    // 2.2.1 Footer Functional Options
    footerFunctionalOptions(target)

    // 2.2.2 Footer Socials
    footerSocials(target)

    // 2.3.1.2 Recover password (login modal)
    registerRecoverPassword(target)

    // 2.3.1.3 Login modal buttons (Ingresar / Crear cuenta)
    registerPickButtons(target)
}

/** VTEX has no pixel event for arbitrary DOM clicks — use delegation on document. */
const setupDomClickListeners = () => {
    if (!canUseDOM || domClickListenerAttached) {
        return
    }

    document.addEventListener('click', handleDocumentClick)
    setupProductClickCapture()
    setupSearchAutocompleteProductClick()
    domClickListenerAttached = true
}

export const handleEvents = (e: PixelMessage) => {
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
            registerLoginModal()

            // 3.1 Product Impression
            // After analytics_loaded — avoid product seen before page context on first paint
            registerProductImpression()

            break
        }

        case 'vtex:productClick': {
            const data = e.data as ProductClickData

            // log('vtex:productClick', data)
            // log('vtex:productClick linkText', data.product.linkText)

            if (data.product.linkText) {
                void fetchCatalogProduct(data.product.linkText)
                    .then((catalog) => {
                        log('vtex:productClick catalog', catalog)
                    })
                    .catch((error) => {
                        log('vtex:productClick catalog error', error)
                    })
            }
            
            // 3.2 Product Click
            productClick(data)
            break
        }

        case 'vtex:productView': {
            const data = e.data as ProductViewData

            void productDetail(data)
            break
        }

        case 'vtex:addToWishlist': {
            const data = e.data as AddToWishlistData

            addToWishlist(data)
            break
        }

        case 'vtex:addToCart': {
            const data = e.data as AddToCartData

            addToCart(data)
            break
        }

        // // Uncomment when minicart is part of markins
        // case 'vtex:viewCart': {
        //     const data = e.data as ViewCartData

        //     cartImpression(data)
        //     break
        // }

        case 'vtex:removeFromCart': {
            const data = e.data as RemoveToCartData

            // TODO: 4.2 Only on storefront minicart
            removeFromCart(data)
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
    setupProductClickCapture()
    setupSearchAutocompleteProductClick()

    // 2.3.1.1 Register Login Modal
    registerLoginModal()
}
