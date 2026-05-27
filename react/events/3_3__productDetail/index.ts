import { log, pushToDataLayer } from '../../utils'
import type { ProductViewData } from '../../typings/events'

import {
    buildViewItem,
    buildViewItemPayload,
    fetchCatalogProduct,
} from '../3_1__productImpression/catalog'

const getPriceFromProduct = (data: ProductViewData): number =>
    data.product.selectedSku?.sellers?.[0]?.commertialOffer?.Price ??
    data.product.items?.[0]?.sellers?.[0]?.commertialOffer?.Price ??
    0

const productDetail = async (data: ProductViewData) => {
    const slug = data.product.linkText || data.product.productId

    if (!slug) {
        log('vtex:productView error', 'Missing product slug and product id.')
        return
    }

    let catalog = null

    if (data.product.linkText) {
        try {
            catalog = await fetchCatalogProduct(data.product.linkText)
        } catch (error) {
            log('vtex:productView catalog error', error)
        }
    }

    const item = buildViewItem(
        {
            slug,
            name: data.product.productName || slug,
            brand: data.product.brand || '',
            price: getPriceFromProduct(data),
            index: 1,
            listId: 'product_detail',
            listName: 'Product Detail',
        },
        catalog
    )

    const payload = buildViewItemPayload(item, data.currency)

    pushToDataLayer(payload)
}

export {
    productDetail,
}