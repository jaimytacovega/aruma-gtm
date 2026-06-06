import { NOT_AVAILABLE, log, pushToDataLayer } from '../../utils'
import {
    buildViewItem,
    fetchCatalogProduct,
} from '../3_1__productImpression/catalog'
import type { ViewItem } from '../3_1__productImpression/catalog'
import {
    findPromotionElementFromTarget,
    parsePromotionMeta,
} from '../promotionMeta'
import type { PromotionMeta } from '../promotionMeta'

const pushSelectPromotion = async (meta: PromotionMeta) => {
    const ecommerce: {
        creative_name: string
        creative_slot: string
        promotion_id: string
        promotion_name: string
        items?: ViewItem[]
    } = {
        creative_name: meta.creativeName,
        creative_slot: meta.creativeSlot,
        promotion_id: meta.promotionId,
        promotion_name: meta.promotionName,
    }

    if (meta.productSlug) {
        try {
            const catalog = await fetchCatalogProduct(meta.productSlug)
            const item = buildViewItem(
                {
                    slug: meta.productSlug,
                    name: catalog?.productName ?? meta.productSlug,
                    brand: catalog?.brand ?? NOT_AVAILABLE,
                    price: 0,
                    listPrice: 0,
                    categories: catalog?.categories ?? [],
                    listId: meta.creativeName,
                    listName: meta.promotionName,
                    index: meta.itemIndex,
                },
                catalog
            )

            ecommerce.items = [item]
        } catch (error) {
            log('select_promotion catalog fetch failed', error)
        }
    }

    pushToDataLayer({
        event: 'select_promotion',
        ecommerce,
    })
}

const promotionClick = (target: Element) => {
    const element = findPromotionElementFromTarget(target)

    if (!element) {
        return
    }

    const meta = parsePromotionMeta(element)

    if (!meta) {
        return
    }

    void pushSelectPromotion(meta)
}

export { promotionClick }
