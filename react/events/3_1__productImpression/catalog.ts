import { NOT_AVAILABLE, log } from '../../utils'

const LOCATION_ID = 'Aruma'

type CatalogOffer = {
  Price?: number
  ListPrice?: number
}

type CatalogSeller = {
  commertialOffer?: CatalogOffer
}

type CatalogItem = {
  itemId?: string
  name?: string
  sellers?: CatalogSeller[]
}

/** Product shape from `/api/catalog_system/pub/products/search/{slug}`. */
export type CatalogProduct = {
  productId?: string
  productName?: string
  brand?: string
  linkText?: string
  categories?: string[]
  items?: CatalogItem[]
  allSpecifications?: string[]
  allSpecificationsNames?: string[]
  [key: string]: unknown
}

export type ViewItem = {
  item_id: string
  item_name: string
  affiliation: string
  coupon: string
  discount: number
  index: number
  item_brand: string
  item_category: string
  item_category2: string
  item_category3: string
  item_category4: string
  item_category5: string
  item_list_id: string
  item_list_name: string
  item_variant: string
  location_id: string
  vegano: string
  crueltyFree: string
  frecuency: string
  price: number
  magentaPoints_price: number
  quantity: number
}

export type ViewItemListPayload = {
  event: 'view_item_list'
  ecommerce: {
    item_list_id: string
    item_list_name: string
    items: ViewItem[]
  }
}

export type ViewItemPayload = {
  event: 'view_item'
  ecommerce: {
    currency: string
    value: number
    magentaPoints_value: number
    items: [ViewItem]
  }
}

export type AddToCartPayload = {
  event: 'add_to_cart'
  ecommerce: {
    currency: string
    value: number
    magentaPoints_value: number
    items: ViewItem[]
  }
}

export type ViewCartPayload = {
  event: 'view_cart'
  ecommerce: {
    currency: string
    value: number
    magentaPoints_value: number
    items: ViewItem[]
  }
}

export type RemoveFromCartPayload = {
  event: 'remove_from_cart'
  ecommerce: {
    currency: string
    value: number
    magentaPoints_value: number
    items: ViewItem[]
  }
}

export type AddToWishlistPayload = {
  event: 'add_to_whislist'
  ecommerce: {
    currency: string
    value: number
    magentaPoints_value: number
    items: ViewItem[]
  }
}

export type SelectItemPayload = {
  event: 'select_item'
  ecommerce: {
    item_list_id: string
    item_list_name: string
    items: [ViewItem]
  }
}

type VisibleSnapshot = {
  slug: string
  name: string
  brand: string
  price: number
  listPrice?: number
  categories?: string[]
  index: number
  listId: string
  listName: string
}

const catalogCache = new Map<string, Promise<CatalogProduct>>()
export const clearCatalogCache = () => {
  catalogCache.clear()
}

const getCommercialOffer = (product: CatalogProduct | null) => {
  const item = product?.items?.[0]

  return item?.sellers?.[0]?.commertialOffer ?? null
}

const parseCategoryParts = (categories: string[] | undefined): string[] => {
  const path = categories?.[0] ?? ''
  const parts = path.split('/').filter(Boolean)

  if (parts.length > 0) {
    return parts
  }

  return (categories ?? []).map((category) => category.replace(/^\/|\/$/g, ''))
}

const MAGENTA_POINTS_CATEGORY = 'magenta points'

const categoriesIncludeMagentaPoints = (
  categories: string[] | undefined
): boolean =>
  parseCategoryParts(categories).some(
    (part) => part.trim().toLowerCase() === MAGENTA_POINTS_CATEGORY
  )

export const isMagentaPointsProduct = (
  catalog: CatalogProduct | null,
  categories?: string[]
): boolean => {
  if (categoriesIncludeMagentaPoints(categories)) {
    return true
  }

  if (!catalog) {
    return false
  }

  return categoriesIncludeMagentaPoints(catalog.categories)
}

const readSpecification = (
  product: CatalogProduct | null,
  ...names: string[]
): string => {
  if (!product) {
    return ''
  }

  for (const name of names) {
    const direct = product[name]

    if (Array.isArray(direct) && direct[0]) {
      return String(direct[0])
    }

    if (typeof direct === 'string' && direct) {
      return direct
    }
  }

  const specNames = product.allSpecificationsNames
  const specValues = product.allSpecifications

  if (!specNames?.length || !specValues?.length) {
    return ''
  }

  for (const name of names) {
    const index = specNames.findIndex(
      (specName) => specName.toLowerCase() === name.toLowerCase()
    )

    if (index >= 0 && specValues[index]) {
      return String(specValues[index])
    }
  }

  return ''
}

const VEGANO_SPEC_NAMES = ['Vegano', 'vegano']
const VEGANO_VALUE = 'Vegano'
const NOT_VEGANO_VALUE = 'No es vegano'

const readVegano = (product: CatalogProduct | null): string => {
  const raw = readSpecification(product, ...VEGANO_SPEC_NAMES).trim()
  // log('product', product)

  if (!raw) {
    return ''
  }

  const normalized = raw.toLowerCase()

  if (normalized.includes('no es vegano')) {
    return NOT_VEGANO_VALUE
  }

  if (normalized === 'vegano') {
    return VEGANO_VALUE
  }

  return ''
}

const normalizeCatalogSlug = (slug: string): string => {
  if (slug.endsWith('/p')) {
    return slug
  }

  return `${slug}/p`
}

export const prefetchCatalogProduct = (slug: string): void => {
  if (!slug) {
    return
  }

  void fetchCatalogProduct(slug).catch((error) => {
    log('catalog prefetch failed', error)
  })
}

export const fetchCatalogProduct = async (
  slug: string
): Promise<CatalogProduct> => {
  if (!slug) {
    throw new Error('Catalog product fetch requires a non-empty slug.')
  }

  const catalogSlug = normalizeCatalogSlug(slug)
  const cached = catalogCache.get(catalogSlug)

  if (cached) {
    return cached
  }

  const request = (async () => {
    try {
      const response = await fetch(
        `/api/catalog_system/pub/products/search/${encodeURIComponent(catalogSlug)}`,
        { credentials: 'same-origin' }
      )

      if (!response.ok) {
        throw new Error(
          `Catalog request failed for "${catalogSlug}" with status ${response.status} ${response.statusText}.`
        )
      }

      const data = (await response.json()) as CatalogProduct[]

      if (!Array.isArray(data)) {
        throw new Error(`Catalog response for "${catalogSlug}" was not an array.`)
      }

      const product = data[0]

      if (!product) {
        throw new Error(`Catalog response for "${catalogSlug}" returned no products.`)
      }

      return product
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }

      throw new Error(
        `Catalog request failed for "${catalogSlug}" with an unknown error.`
      )
    }
  })()

  catalogCache.set(catalogSlug, request)

  try {
    return await request
  } catch (error) {
    catalogCache.delete(catalogSlug)
    throw error
  }
}

const resolveMagentaPointsPrice = (
  sellingPrice: number,
  listPrice: number,
  visiblePrice: number
): number => {
  const price =
    sellingPrice > 0
      ? sellingPrice
      : listPrice > 0
        ? listPrice
        : visiblePrice

  return Number(price.toFixed(2))
}

export const buildViewItem = (
  visible: VisibleSnapshot,
  catalog: CatalogProduct | null
): ViewItem => {
  const categoryParts = parseCategoryParts(catalog?.categories)
  const offer = getCommercialOffer(catalog)
  const listPrice = offer?.ListPrice ?? visible.listPrice ?? visible.price
  const sellingPrice = offer?.Price ?? visible.price
  const discount =
    listPrice > sellingPrice
      ? Number((listPrice - sellingPrice).toFixed(2))
      : 0
  const isMagentaPoints = isMagentaPointsProduct(catalog, visible.categories)
  const magentaPointsPrice = isMagentaPoints
    ? resolveMagentaPointsPrice(sellingPrice, listPrice, visible.price)
    : 0
  const itemPrice = isMagentaPoints
    ? 0
    : Number((sellingPrice + discount).toFixed(2))
  const itemDiscount = isMagentaPoints ? 0 : discount
  const skuName = catalog?.items?.[0]?.name ?? ''

  return {
    item_id: catalog?.productId ?? visible.slug,
    item_name: catalog?.productName ?? visible.name,
    affiliation:
      readSpecification(catalog, 'Tipo de producto', 'Tipo de Producto') ||
      categoryParts[0] ||
      NOT_AVAILABLE,
    coupon: NOT_AVAILABLE,
    discount: itemDiscount,
    index: visible.index,
    item_brand: catalog?.brand ?? visible.brand,
    item_category:
      readSpecification(catalog, 'USO', 'Modo de uso', 'Modo de Uso') ||
      categoryParts[0] ||
      NOT_AVAILABLE,
    item_category2:
      readSpecification(catalog, 'INGREDIENTES') || categoryParts[1] || NOT_AVAILABLE,
    item_category3:
      readSpecification(catalog, 'TEXTURA', 'TIPO DE PRODUCTO', 'Textura/Acabado', 'Textura', 'Acabado') ||
      categoryParts[2] ||
      NOT_AVAILABLE,
    item_category4:
      readSpecification(catalog, 'CONTENIDO', 'Contenido') || categoryParts[3] || NOT_AVAILABLE,
    item_category5:
      readSpecification(
        catalog,
        'TIPO DE PIEL',
        'Tipo piel/cabello',
        'Tipo piel',
        'Tipo cabello'
      ) || categoryParts[4] || NOT_AVAILABLE,
    item_list_id: visible.listId,
    item_list_name: visible.listName,
    item_variant:
      readSpecification(
        catalog,
        'Necesidad/A prueba de agua',
        'Necesidad',
        'A prueba de agua'
      ) || skuName || NOT_AVAILABLE,
    location_id: LOCATION_ID,
    vegano: readVegano(catalog) || NOT_AVAILABLE,
    crueltyFree: readSpecification(
      catalog,
      'Cruelty free',
      'Cruelty Free',
      'Cruelty-free'
    ) || NOT_AVAILABLE,
    frecuency: readSpecification(
      catalog,
      'FRECUENCIA DE USO',
      'Frecuencia de uso',
      'Frecuencia',
      'Frecuency'
    ) || NOT_AVAILABLE,
    price: itemPrice,
    magentaPoints_price: magentaPointsPrice,
    quantity: 1,
  }
}

const getItemNetValue = (item: ViewItem): number =>
  Number(((item.price - item.discount) * item.quantity).toFixed(2))

export const buildViewItemListPayload = (
  items: ViewItem[],
  item_list_id: string,
  item_list_name: string
): ViewItemListPayload => ({
  event: 'view_item_list',
  ecommerce: {
    item_list_id,
    item_list_name,
    items,
  },
})

export const buildSelectItemPayload = (item: ViewItem): SelectItemPayload => ({
  event: 'select_item',
  ecommerce: {
    item_list_id: item.item_list_id,
    item_list_name: item.item_list_name,
    items: [item],
  },
})

export const buildViewItemPayload = (
  item: ViewItem,
  currency: string
): ViewItemPayload => ({
  event: 'view_item',
  ecommerce: {
    currency,
    value: getItemNetValue(item),
    magentaPoints_value: item.magentaPoints_price * item.quantity,
    items: [item],
  },
})

const buildCartEcommerce = (items: ViewItem[], currency: string) => {
  const value = items.reduce((sum, item) => sum + getItemNetValue(item), 0)
  const magentaPoints_value = items.reduce(
    (sum, item) => sum + item.magentaPoints_price * item.quantity,
    0
  )

  return {
    currency,
    value: Number(value.toFixed(2)),
    magentaPoints_value,
    items,
  }
}

export const buildAddToCartPayload = (
  items: ViewItem[],
  currency: string
): AddToCartPayload => ({
  event: 'add_to_cart',
  ecommerce: buildCartEcommerce(items, currency),
})

export const buildViewCartPayload = (
  items: ViewItem[],
  currency: string
): ViewCartPayload => ({
  event: 'view_cart',
  ecommerce: buildCartEcommerce(items, currency),
})

export const buildRemoveFromCartPayload = (
  items: ViewItem[],
  currency: string
): RemoveFromCartPayload => ({
  event: 'remove_from_cart',
  ecommerce: buildCartEcommerce(items, currency),
})

export const buildAddToWishlistPayload = (
  items: ViewItem[],
  currency: string
): AddToWishlistPayload => ({
  event: 'add_to_whislist',
  ecommerce: buildCartEcommerce(items, currency),
})
