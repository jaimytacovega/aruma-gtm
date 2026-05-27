import { pushToDataLayer, log } from '../../utils'
import type { ProductClickData, ProductSummary } from '../../typings/events'

import {
  buildSelectItemPayload,
  buildViewItem,
  fetchCatalogProduct,
} from '../3_1__productImpression/catalog'
const getPriceFromProduct = (product: ProductSummary): number =>
  product.sku?.seller?.commertialOffer?.Price ??
  product.sku?.sellers?.[0]?.commertialOffer?.Price ??
  0

const productClick = async (data: ProductClickData) => {
  const slug = data.product.linkText || data.product.productId

  if (!slug) {
    return
  }

  const listName = data.list || 'List of products'
  const listId = data.list || 'listing'
  const product = {
    slug,
    name: data.product.productName || slug,
    brand: data.product.brand || '',
    price: getPriceFromProduct(data.product),
    index: data.position ?? 0,
    listId,
    listName,
  }
  let catalog = null

  if (data.product.linkText) {
    try {
      catalog = await fetchCatalogProduct(data.product.linkText)
    } catch (error) {
      log('catalog product click fetch failed', error)
    }
  }

  const item = buildViewItem(product, catalog)
  const payload = buildSelectItemPayload(item)

//   log('payload', payload)
  pushToDataLayer(payload, true)
}

export { productClick }