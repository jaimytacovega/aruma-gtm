/**
 * Checkout cart (#/cart): remove_from_cart when user clicks "-" to decrease quantity.
 * Paste after 3_5__addToCart.js.
 */
;((global) => {
  const PENDING_TIMEOUT_MS = 5000

  const DECREMENT_SELECTOR = [
    '.item-quantity-change-decrement',
    'a.item-quantity-change-decrement',
    'span.item-quantity-change-decrement',
    '[class*="quantity-change-decrement"]',
    'a[data-i18n="cart.decreaseQuantity"]',
  ].join(', ')

  const CART_ROW_SELECTOR = 'tr.product-item, tr.item'

  const matchesDecrementButton = (element) => {
    if (!(element instanceof Element)) {
      return false
    }

    return element.matches(DECREMENT_SELECTOR)
  }

  const findDecrementButton = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event
        .composedPath()
        .find((node) => matchesDecrementButton(node))

      if (fromPath) {
        return fromPath
      }
    }

    if (event.target instanceof Element) {
      return event.target.closest(DECREMENT_SELECTOR)
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

  const getOrderItemFromForm = (orderForm, sku, rowIndex) => {
    const items = orderForm.items || []

    if (sku) {
      const item = items.find((line) => String(line.id) === sku)

      if (item) {
        return item
      }
    }

    if (rowIndex >= 0) {
      return items[rowIndex] ?? null
    }

    return null
  }

  global.create4_2__removeFromCart = ({
    isCheckoutCartPage,
    pushToDataLayer,
    enrichOrderFormItems,
    orderFormUtils,
  }) => {
    let pending = null
    let removeFromCartInFlight = false

    const clearPending = () => {
      if (pending?.timeoutId) {
        global.clearTimeout(pending.timeoutId)
      }

      pending = null
    }

    const buildRemoveFromCartPayload = (items, currency) => {
      const totals = orderFormUtils.buildItemsEcommerceTotals(items)

      return {
        event: 'remove_from_cart',
        ecommerce: {
          currency,
          value: totals.value,
          magentaPoints_value: totals.magentaPoints_value,
          items,
        },
      }
    }

    const findDecreasedItem = (snapshot, orderForm, hint, orderItem) => {
      const items = orderForm.items || []

      if (hint.sku) {
        const before = snapshot.bySku.get(hint.sku)
        const item = items.find((line) => String(line.id) === hint.sku)

        if (before !== undefined) {
          if (item && item.quantity < before) {
            return { item, removedQty: before - item.quantity }
          }

          if (!item && before > 0 && orderItem) {
            return { item: orderItem, removedQty: 1 }
          }
        }
      }

      if (hint.rowIndex >= 0 && orderItem) {
        const before = snapshot.byIndex.get(hint.rowIndex)
        const item = items[hint.rowIndex]

        if (before !== undefined) {
          if (item && item.quantity < before) {
            return { item, removedQty: before - item.quantity }
          }

          if (!item && before > 0) {
            return { item: orderItem, removedQty: 1 }
          }
        }
      }

      const decreases = items
        .map((item, index) => {
          const before = snapshot.byIndex.get(index)

          if (before !== undefined && item.quantity < before) {
            return { item, removedQty: before - item.quantity }
          }

          return null
        })
        .filter(Boolean)

      if (decreases.length === 1) {
        return decreases[0]
      }

      if (orderItem && hint.sku) {
        const before = snapshot.bySku.get(hint.sku)
        const stillThere = items.some((line) => String(line.id) === hint.sku)

        if (before !== undefined && before > 0 && !stillThere) {
          return { item: orderItem, removedQty: 1 }
        }
      }

      return null
    }

    const runRemoveFromCart = async (orderForm) => {
      if (!pending || !isCheckoutCartPage() || removeFromCartInFlight) {
        return
      }

      const hint = {
        sku: pending.sku,
        rowIndex: pending.rowIndex,
      }
      const result = findDecreasedItem(
        pending.snapshot,
        orderForm,
        hint,
        pending.orderItem
      )

      if (!result || result.removedQty <= 0) {
        return
      }

      clearPending()
      removeFromCartInFlight = true

      try {
        const { item, removedQty } = result
        const currency = orderFormUtils.getCurrency(orderForm)
        const itemForEnrich = { ...item, quantity: removedQty }
        const items = await enrichOrderFormItems(
          [itemForEnrich],
          orderFormUtils
        )

        pushToDataLayer(buildRemoveFromCartPayload(items, currency))
      } finally {
        removeFromCartInFlight = false
      }
    }

    const onDecrementClick = (event) => {
      if (!isCheckoutCartPage()) {
        return
      }

      const button = findDecrementButton(event)

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
          orderItem: getOrderItemFromForm(orderForm, sku, rowIndex),
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

      void runRemoveFromCart(orderForm)
    }

    const attach = () => {
      global.document.addEventListener('click', onDecrementClick, true)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', onOrderFormUpdated)
      }
    }

    return attach
  }
})(window)
