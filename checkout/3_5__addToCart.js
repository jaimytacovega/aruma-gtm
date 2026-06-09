/**
 * Checkout cart (#/cart): add_to_cart when user clicks "+" to increase quantity.
 * Paste after checkoutOrderFormUtils.js.
 */
;((global) => {
  const PENDING_TIMEOUT_MS = 5000

  const INCREMENT_SELECTOR = [
    '.item-quantity-change-increment',
    'a.item-quantity-change-increment',
    'span.item-quantity-change-increment',
    '[class*="quantity-change-increment"]',
    'a[data-i18n="cart.increaseQuantity"]',
  ].join(', ')

  const CART_ROW_SELECTOR = 'tr.product-item, tr.item'

  const matchesIncrementButton = (element) => {
    if (!(element instanceof Element)) {
      return false
    }

    return element.matches(INCREMENT_SELECTOR)
  }

  const findIncrementButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesIncrementButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(INCREMENT_SELECTOR)
    }

    return null
  }

  const findCartRow = (element) => {
    if (!(element instanceof Element)) {
      return null
    }

    return element.closest(CART_ROW_SELECTOR)
  }

  const getSkuFromRow = (row) => {
    if (!row) {
      return ''
    }

    const direct = row.getAttribute('data-sku')

    if (direct) {
      return direct
    }

    const nested = row.querySelector('[data-sku]')

    return nested?.getAttribute('data-sku') ?? ''
  }

  const getRowIndex = (row) => {
    if (!row?.parentElement) {
      return -1
    }

    const rows = Array.from(row.parentElement.children).filter(
      (element) =>
        element instanceof Element &&
        (element.matches('tr.product-item') ||
          element.matches('tr.item') ||
          element.tagName === 'TR')
    )

    return rows.indexOf(row)
  }

  const snapshotQuantities = (orderForm) => {
    const bySku = new Map()
    const byIndex = new Map()

    ;(orderForm.items || []).forEach((item, index) => {
      bySku.set(String(item.id), item.quantity)
      byIndex.set(index, item.quantity)
    })

    return { bySku, byIndex }
  }

  global.create3_5__addToCart = ({
    isCheckoutCartPage,
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
  }) => {
    let pending = null
    let addToCartInFlight = false

    const clearPending = () => {
      if (pending?.timeoutId) {
        global.clearTimeout(pending.timeoutId)
      }

      pending = null
    }

    const buildAddToCartPayload = (items, currency) => {
      const totals = orderFormUtils.buildItemsEcommerceTotals(items)

      return {
        event: 'add_to_cart',
        ecommerce: {
          currency,
          value: totals.value,
          magentaPoints_value: totals.magentaPoints_value,
          items,
        },
      }
    }

    const findIncreasedItem = (snapshot, orderForm, hint) => {
      const items = orderForm.items || []

      if (hint.sku) {
        const item = items.find((line) => String(line.id) === hint.sku)
        const before = snapshot.bySku.get(hint.sku)

        if (item && before !== undefined && item.quantity > before) {
          return { item, addedQty: item.quantity - before }
        }
      }

      if (hint.rowIndex >= 0) {
        const item = items[hint.rowIndex]
        const before = snapshot.byIndex.get(hint.rowIndex)

        if (item && before !== undefined && item.quantity > before) {
          return { item, addedQty: item.quantity - before }
        }
      }

      const increases = items
        .map((item, index) => {
          const before = snapshot.byIndex.get(index)

          if (before !== undefined && item.quantity > before) {
            return { item, addedQty: item.quantity - before }
          }

          return null
        })
        .filter(Boolean)

      if (increases.length === 1) {
        return increases[0]
      }

      return null
    }

    const runAddToCart = async (orderForm) => {
      if (!pending || !isCheckoutCartPage() || addToCartInFlight) {
        return
      }

      const hint = {
        sku: pending.sku,
        rowIndex: pending.rowIndex,
      }
      const result = findIncreasedItem(pending.snapshot, orderForm, hint)

      if (!result || result.addedQty <= 0) {
        return
      }

      clearPending()
      addToCartInFlight = true

      try {
        const { item, addedQty } = result
        const currency = orderFormUtils.getCurrency(orderForm)
        const itemForEnrich = { ...item, quantity: addedQty }
        const items = await enrichOrderFormItems(
          [itemForEnrich],
          orderFormUtils
        )

        pushToDataLayer(buildAddToCartPayload(items, currency))
      } finally {
        addToCartInFlight = false
      }
    }

    const onIncrementClick = (event) => {
      if (!isCheckoutCartPage()) {
        return
      }

      const button = findIncrementButton(event)

      if (!button) {
        return
      }

      const row = findCartRow(button)
      const sku = getSkuFromRow(row)
      const rowIndex = row ? getRowIndex(row) : -1
      const checkout = global.vtexjs?.checkout

      if (!checkout?.getOrderForm) {
        return
      }

      checkout.getOrderForm().done((orderForm) => {
        clearPending()

        pending = {
          snapshot: snapshotQuantities(orderForm),
          sku,
          rowIndex,
          timeoutId: global.setTimeout(clearPending, PENDING_TIMEOUT_MS),
        }
      })
    }

    const onOrderFormUpdated = (_, orderForm) => {
      if (!isCheckoutCartPage() || !pending) {
        return
      }

      void runAddToCart(orderForm)
    }

    const attach = () => {
      global.document.addEventListener('click', onIncrementClick, true)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', onOrderFormUpdated)
      }
    }

    return attach
  }
})(window)
