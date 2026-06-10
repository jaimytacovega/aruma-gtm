/**
 * OrderForm item enrichment for checkout. Paste before 5_1_2__startCheckout.js.
 */
;((global) => {
  const NOT_AVAILABLE = '(not available)'
  const LOCATION_ID = 'Aruma'
  const catalogCache = new Map()

  const normalizeCatalogSlug = (slug) => (slug.endsWith('/p') ? slug : `${slug}/p`)

  const getSlugFromDetailUrl = (detailUrl) => {
    if (!detailUrl) {
      return ''
    }

    const path = detailUrl.startsWith('http')
      ? new URL(detailUrl, global.location.origin).pathname
      : detailUrl
    const match = path.match(/\/([^/]+)\/p\/?$/)

    return match?.[1] ?? ''
  }

  const parseCategoryParts = (categories) => {
    const path = categories?.[0] ?? ''
    const parts = path.split('/').filter(Boolean)

    if (parts.length > 0) {
      return parts
    }

    return (categories ?? []).map((category) => category.replace(/^\/|\/$/g, ''))
  }

  const clusterLabelIncludesMagentaPoints = (clusters) => {
    if (!clusters || typeof clusters !== 'object') {
      return false
    }

    return Object.values(clusters).some((label) =>
      String(label).toLowerCase().includes('magenta points')
    )
  }

  const isMagentaPointsProduct = (catalog) => {
    if (!catalog) {
      return false
    }

    const inMagentaCategory = parseCategoryParts(catalog.categories).some(
      (part) => part.trim().toLowerCase() === 'magenta points'
    )

    if (inMagentaCategory) {
      return true
    }

    return (
      clusterLabelIncludesMagentaPoints(catalog.productClusters) ||
      clusterLabelIncludesMagentaPoints(catalog.searchableClusters) ||
      clusterLabelIncludesMagentaPoints(catalog.clusterHighlights)
    )
  }

  const readSpecification = (product, ...names) => {
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

    const specNames = product.allSpecificationsNames ?? []
    const specValues = product.allSpecifications ?? []

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

  const readVegano = (product) => {
    const raw = readSpecification(product, 'Vegano', 'vegano').trim()

    if (!raw) {
      return ''
    }

    const normalized = raw.toLowerCase()

    if (normalized.includes('no es vegano')) {
      return 'No es vegano'
    }

    if (normalized === 'vegano') {
      return 'Vegano'
    }

    return ''
  }

  const fetchCatalogProduct = async (slug) => {
    const catalogSlug = normalizeCatalogSlug(slug)
    const cached = catalogCache.get(catalogSlug)

    if (cached) {
      return cached
    }

    const request = (async () => {
      const response = await fetch(
        `/api/catalog_system/pub/products/search/${encodeURIComponent(catalogSlug)}`,
        { credentials: 'same-origin' }
      )

      if (!response.ok) {
        throw new Error(`Catalog request failed for "${catalogSlug}".`)
      }

      const data = await response.json()

      if (!Array.isArray(data) || !data[0]) {
        throw new Error(`Catalog response for "${catalogSlug}" was empty.`)
      }

      return data[0]
    })()

    catalogCache.set(catalogSlug, request)

    try {
      return await request
    } catch (error) {
      catalogCache.delete(catalogSlug)
      throw error
    }
  }

  const getCommercialOffer = (catalog) =>
    catalog?.items?.[0]?.sellers?.[0]?.commertialOffer ?? null

  const resolveMagentaPointsPrice = (sellingPrice, listPrice, visiblePrice) => {
    const price =
      sellingPrice > 0
        ? sellingPrice
        : listPrice > 0
          ? listPrice
          : visiblePrice

    return Number(price.toFixed(2))
  }

  const buildViewItem = (visible, catalog) => {
    const categoryParts = parseCategoryParts(catalog?.categories)
    const offer = getCommercialOffer(catalog)
    const listPrice = offer?.ListPrice ?? visible.price
    const sellingPrice = offer?.Price ?? visible.price
    const discount =
      listPrice > sellingPrice
        ? Number((listPrice - sellingPrice).toFixed(2))
        : 0
    const isMagentaPoints = isMagentaPointsProduct(catalog)
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
        readSpecification(
          catalog,
          'TEXTURA',
          'TIPO DE PRODUCTO',
          'Textura/Acabado',
          'Textura',
          'Acabado'
        ) ||
        categoryParts[2] ||
        NOT_AVAILABLE,
      item_category4:
        readSpecification(catalog, 'CONTENIDO', 'Contenido') ||
        categoryParts[3] ||
        NOT_AVAILABLE,
      item_category5:
        readSpecification(
          catalog,
          'TIPO DE PIEL',
          'Tipo piel/cabello',
          'Tipo piel',
          'Tipo cabello'
        ) ||
        categoryParts[4] ||
        NOT_AVAILABLE,
      item_list_id: visible.listId,
      item_list_name: visible.listName,
      item_variant:
        readSpecification(
          catalog,
          'Necesidad/A prueba de agua',
          'Necesidad',
          'A prueba de agua'
        ) ||
        skuName ||
        NOT_AVAILABLE,
      location_id: LOCATION_ID,
      vegano: readVegano(catalog) || NOT_AVAILABLE,
      crueltyFree:
        readSpecification(
          catalog,
          'Cruelty free',
          'Cruelty Free',
          'Cruelty-free'
        ) || NOT_AVAILABLE,
      frecuency:
        readSpecification(
          catalog,
          'FRECUENCIA DE USO',
          'Frecuencia de uso',
          'Frecuencia',
          'Frecuency'
        ) || NOT_AVAILABLE,
      price: itemPrice,
      magentaPoints_price: magentaPointsPrice,
      quantity: visible.quantity,
    }
  }

  const getOrderFormItemUnitPrice = (item) => {
    const raw = item.sellingPrice ?? item.price ?? 0

    if (item.priceIsInt === false) {
      return raw
    }

    return raw / 100
  }

  const enrichOrderFormItems = async (orderItems, orderFormUtils) =>
    Promise.all(
      orderItems.map(async (orderItem, index) => {
        const { listId, listName } =
          orderFormUtils.getListContextForOrderItem(orderItem)
        const catalogSlug = getSlugFromDetailUrl(orderItem.detailUrl)
        const slug = catalogSlug || orderItem.productId
        let catalog = null

        if (catalogSlug) {
          try {
            catalog = await fetchCatalogProduct(catalogSlug)
          } catch {
            catalog = null
          }
        }

        return buildViewItem(
          {
            slug,
            name: orderItem.name,
            brand: orderItem.additionalInfo?.brandName ?? '',
            price: getOrderFormItemUnitPrice(orderItem),
            index: index + 1,
            listId,
            listName,
            quantity: orderItem.quantity,
          },
          catalog
        )
      })
    )

  global.createCheckoutCartItems = () => ({
    NOT_AVAILABLE,
    enrichOrderFormItems,
  })
})(window)
