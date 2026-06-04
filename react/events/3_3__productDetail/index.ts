import { getListFromLastSelectItem, log, pushToDataLayer } from '../../utils'
import type { ProductViewData } from '../../typings/events'

import {
    buildViewItem,
    buildViewItemPayload,
    fetchCatalogProduct,
} from '../3_1__productImpression/catalog'

const getCommercialOfferFromProduct = (data: ProductViewData) =>
    data.product.selectedSku?.sellers?.[0]?.commertialOffer ??
    data.product.items?.[0]?.sellers?.[0]?.commertialOffer

const getPriceAndDiscountFromProduct = (
    data: ProductViewData
): { price: number; listPrice: number; discount: number } => {
    const offer = getCommercialOfferFromProduct(data)
    const price = offer?.Price ?? 0
    const listPrice = offer?.ListPrice ?? price
    const discount =
        listPrice > price ? Number((listPrice - price).toFixed(2)) : 0

    return { price, listPrice, discount }
}

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

    const { listId, listName } = getListFromLastSelectItem(
        slug,
        data.product.productId
    )
    const { price, listPrice } = getPriceAndDiscountFromProduct(data)

    const item = buildViewItem(
        {
            slug,
            name: data.product.productName || slug,
            brand: data.product.brand || '',
            price,
            listPrice,
            categories: data.product.categories,
            index: 1,
            listId,
            listName,
        },
        catalog
    )

    const payload = buildViewItemPayload(item, data.currency)

    pushToDataLayer(payload)
}

export {
    productDetail,
}