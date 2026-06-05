import { pushToDataLayer } from '../../utils'
import type { AddToWishlistData } from '../../typings/events'

import {
  buildAddToWishlistPayload,
  buildViewItem,
  fetchCatalogProduct,
} from '../3_1__productImpression/catalog'
import { resolveProductListFromDom } from '../productSummary'

const getCommercialOfferFromWishlist = (data: AddToWishlistData) =>
  data.items.selectedItem?.sellers?.[0]?.commertialOffer ??
  data.items.product.sku?.seller?.commertialOffer ??
  data.items.product.sku?.sellers?.[0]?.commertialOffer

const getPriceAndDiscountFromWishlist = (
  data: AddToWishlistData
): { price: number; listPrice: number } => {
  const offer = getCommercialOfferFromWishlist(data)
  const price = offer?.Price ?? 0
  const listPrice = offer?.ListPrice ?? price

  return { price, listPrice }
}

const addToWishlist = async (data: AddToWishlistData) => {
  const product = data.items.product
  const slug = product.linkText || product.productId

  if (!slug) {
    return
  }

  const domList = resolveProductListFromDom(slug)
  const listId = domList?.listId ?? data.list ?? 'listing'
  const listName = domList?.listName ?? data.list ?? 'List of products'
  const { price, listPrice } = getPriceAndDiscountFromWishlist(data)

  let catalog = null

  if (product.linkText) {
    try {
      catalog = await fetchCatalogProduct(product.linkText)
    } catch {
      catalog = null
    }
  }

  const item = buildViewItem(
    {
      slug,
      name: product.productName || slug,
      brand: product.brand || '',
      price,
      listPrice,
      categories: product.categories,
      index: domList?.index ?? 1,
      listId,
      listName,
    },
    catalog
  )

  const payload = buildAddToWishlistPayload([item], data.currency)

  pushToDataLayer(payload)
}

export { addToWishlist }
