import { log, NOT_AVAILABLE } from '../../utils'

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

type VisibleSnapshot = {
  slug: string
  name: string
  brand: string
  price: number
  index: number
  listId: string
  listName: string
}

const catalogCache = new Map<string, Promise<CatalogProduct | null>>()
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

export const prefetchCatalogProduct = (slug: string): void => {
  if (!slug) {
    return
  }

  void fetchCatalogProduct(slug)
}

export const fetchCatalogProduct = async (
  slug: string
): Promise<CatalogProduct | null> => {
  if (!slug) {
    return null
  }

  const cached = catalogCache.get(slug)

  if (cached) {
    return cached
  }

  const request = (async () => {
    try {
      const response = await fetch(
        `/api/catalog_system/pub/products/search/${encodeURIComponent(slug)}`,
        { credentials: 'same-origin' }
      )

      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as CatalogProduct[]
      // log('catalog data', data)

      return Array.isArray(data) ? data[0] ?? null : null
    } catch {
      return null
    }
  })()

  catalogCache.set(slug, request)

  return request
}

export const buildViewItem = (
  visible: VisibleSnapshot,
  catalog: CatalogProduct | null
): ViewItem => {
  const categoryParts = parseCategoryParts(catalog?.categories)
  const offer = getCommercialOffer(catalog)
  const listPrice = offer?.ListPrice ?? visible.price
  const sellingPrice = offer?.Price ?? visible.price
  const discount =
    listPrice > sellingPrice
      ? Number((listPrice - sellingPrice).toFixed(2))
      : 0
  const skuName = catalog?.items?.[0]?.name ?? ''

  return {
    item_id: catalog?.productId ?? visible.slug,
    item_name: catalog?.productName ?? visible.name,
    affiliation:
      readSpecification(catalog, 'Tipo de producto', 'Tipo de Producto') ||
      categoryParts[0] ||
      NOT_AVAILABLE,
    coupon: NOT_AVAILABLE,
    discount,
    index: visible.index,
    item_brand: catalog?.brand ?? visible.brand,
    item_category:
      readSpecification(catalog, 'USO', 'Modo de uso', 'Modo de Uso') ||
      categoryParts[0] ||
      NOT_AVAILABLE,
    item_category2:
      readSpecification(catalog, 'INGREDIENTES') || categoryParts[1] || NOT_AVAILABLE,
    item_category3:
      readSpecification(catalog, 'TIPO DE PRODUCTO', 'Textura/Acabado', 'Textura', 'Acabado') ||
      categoryParts[2] ||
      NOT_AVAILABLE,
    item_category4:
      readSpecification(catalog, 'CONTENIDO', 'Contenido') || categoryParts[3] || NOT_AVAILABLE,
    item_category5:
      readSpecification(
        catalog,
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
    price: sellingPrice,
    magentaPoints_price: 0,
    quantity: 1,
  }
}

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
