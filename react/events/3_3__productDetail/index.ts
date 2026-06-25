import { log, NOT_AVAILABLE, pushToDataLayer } from '../../utils'
import type { ProductViewData } from '../../typings/events'
import {
    getListContextFromStore,
    getPendingNavigationListContext,
    isGenericListContext,
    isUnavailableListContext,
} from '../../listContextStore'

import {
    buildViewItem,
    buildViewItemPayload,
    fetchCatalogProduct,
    isMagentaPointsProduct,
} from '../3_1__productImpression/catalog'
import { MAGENTA_POINTS_LIST_LABEL } from '../productSummary'

const getSlugFromDetailUrl = (detailUrl: string): string => {
    if (!detailUrl) {
        return ''
    }

    const path = detailUrl.startsWith('http')
        ? new URL(detailUrl, window.location.origin).pathname
        : detailUrl
    const match = path.match(/\/([^/]+)\/p\/?$/)

    return match?.[1] ?? ''
}

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

const resolveProductListContext = (
    slug: string,
    productId: string | undefined,
    isMagentaPoints: boolean
): { listId: string; listName: string } => {
    const fallback = {
        listId: NOT_AVAILABLE,
        listName: NOT_AVAILABLE,
    }

    const fromPendingNav = getPendingNavigationListContext(
        slug,
        productId,
        fallback
    )

    if (!isUnavailableListContext(fromPendingNav)) {
        return fromPendingNav
    }

    const fromStore = getListContextFromStore(slug, productId, fallback)

    if (
        !isGenericListContext(fromStore) &&
        !isUnavailableListContext(fromStore)
    ) {
        return fromStore
    }

    if (isMagentaPoints) {
        return {
            listId: MAGENTA_POINTS_LIST_LABEL,
            listName: MAGENTA_POINTS_LIST_LABEL,
        }
    }

    return fallback
}

const productDetail = async (data: ProductViewData) => {
    const slug =
        data.product.linkText ||
        getSlugFromDetailUrl(data.product.detailUrl) ||
        data.product.productId

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

    const resolvedSlug =
        catalog?.linkText ??
        data.product.linkText ??
        getSlugFromDetailUrl(data.product.detailUrl) ??
        slug
    const resolvedProductId =
        String(catalog?.productId ?? data.product.productId ?? '').trim() ||
        undefined
    const isMagentaPoints = isMagentaPointsProduct(
        catalog,
        data.product.categories
    )
    const { listId, listName } = resolveProductListContext(
        resolvedSlug,
        resolvedProductId,
        isMagentaPoints
    )
    const { price, listPrice } = getPriceAndDiscountFromProduct(data)

    const item = buildViewItem(
        {
            slug: resolvedSlug,
            name: data.product.productName || resolvedSlug,
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
