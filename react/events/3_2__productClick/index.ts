import { pushToDataLayer, log } from '../../utils'
import {
  saveListContextForProduct,
  savePendingNavigationListContext,
} from '../../listContextStore'
import type { ProductClickData, ProductSummary } from '../../typings/events'

import {
  buildSelectItemPayload,
  buildViewItem,
  fetchCatalogProduct,
} from '../3_1__productImpression/catalog'
import {
  buildVisibleProduct,
  getProductCardFromInteractionTarget,
  getProductCardFromTarget,
  isSearchAutocompleteProductCard,
  resolveProductListFromDom,
} from '../productSummary'
import type { VisibleProduct } from '../productSummary'
import { isGoPersonalProduct } from '../goPersonal'

const getPriceFromProduct = (product: ProductSummary): number =>
  product.sku?.seller?.commertialOffer?.Price ??
  product.sku?.sellers?.[0]?.commertialOffer?.Price ??
  0

let searchAutocompleteClickAttached = false
let goPersonalClickAttached = false

const persistProductListContext = (visible: VisibleProduct, productId?: string) => {
  const context = {
    slug: visible.slug,
    productId: productId || undefined,
    listId: visible.listId,
    listName: visible.listName,
  }

  saveListContextForProduct(context)
  savePendingNavigationListContext(context)
}

const fireSelectItemFromVisible = async (
  visible: VisibleProduct,
  productId?: string
): Promise<void> => {
  persistProductListContext(visible, productId)

  let catalog = null

  try {
    catalog = await fetchCatalogProduct(visible.slug)
  } catch (error) {
    log('catalog product click fetch failed', error)
  }

  const item = buildViewItem(visible, catalog)

  persistProductListContext(visible, String(item.item_id ?? productId ?? ''))

  const payload = buildSelectItemPayload(item)

  pushToDataLayer(payload)
}

export const fireSelectItemFromProductCard = async (
  card: HTMLElement
): Promise<void> => {
  const visible = buildVisibleProduct(card)

  if (!visible) {
    return
  }

  await fireSelectItemFromVisible(visible)
}

/** vtex:productClick does not run for search-bar autocomplete product links. */
export const setupSearchAutocompleteProductClick = (): void => {
  if (searchAutocompleteClickAttached || typeof document === 'undefined') {
    return
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) {
        return
      }

      const card = getProductCardFromTarget(event.target)

      if (!card || !isSearchAutocompleteProductCard(card)) {
        return
      }

      void fireSelectItemFromProductCard(card)
    },
    true
  )
  searchAutocompleteClickAttached = true
}

/** GoPersonal shelves inject async and do not emit vtex:productClick. */
export const setupGoPersonalProductClick = (): void => {
  if (goPersonalClickAttached || typeof document === 'undefined') {
    return
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) {
        return
      }

      const card = getProductCardFromInteractionTarget(event.target)

      if (!card || !isGoPersonalProduct(card)) {
        return
      }

      void fireSelectItemFromProductCard(card)
    },
    true
  )
  goPersonalClickAttached = true
}

const productClick = async (data: ProductClickData) => {
  const slug = data.product.linkText || data.product.productId

  if (!slug) {
    return
  }

  const domList = resolveProductListFromDom(slug)
  const listId = domList?.listId ?? data.list ?? 'listing'
  const listName = domList?.listName ?? data.list ?? 'List of products'
  const productId = String(data.product.productId ?? '')

  await fireSelectItemFromVisible(
    {
      slug,
      name: data.product.productName || slug,
      brand: data.product.brand || '',
      price: getPriceFromProduct(data.product),
      index: domList?.index ?? data.position ?? 0,
      listId,
      listName,
    },
    productId
  )
}

export { productClick }
