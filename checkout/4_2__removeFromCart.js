/**
 * Checkout cart (#/cart): remove_from_cart on "-" decrement or "Eliminar" remove link.
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

  const REMOVE_SELECTOR = [
    'a.item-link-remove',
    '.item-link-remove',
    'a[id^="item-remove-"]',
  ].join(', ')

  const CART_ROW_SELECTOR = 'tr.product-item, tr.item'

  const matchesDecrementButton = (element) => {
    if (!(element instanceof Element)) {
      return false
    }

    return element.matches(DECREMENT_SELECTOR)
  }

  const matchesRemoveLink = (element) => {
    if (!(element instanceof Element)) {
      return false
    }

    return element.matches(REMOVE_SELECTOR)
  }

  const findCartActionTarget = (event) => {
    if (typeof event.composedPath === 'function') {
      const fromPath = event.composedPath().find((node) => {
        if (!(node instanceof Element)) {
          return false
        }

        return matchesRemoveLink(node) || matchesDecrementButton(node)
      })

      if (fromPath instanceof Element) {
        if (matchesRemoveLink(fromPath)) {
          return { element: fromPath, mode: 'remove' }
        }

        return { element: fromPath, mode: 'decrement' }
      }
    }

    if (event.target instanceof Element) {
      const removeLink = event.target.closest(REMOVE_SELECTOR)

      if (removeLink) {
        return { element: removeLink, mode: 'remove' }
      }

      const decrementButton = event.target.closest(DECREMENT_SELECTOR)

      if (decrementButton) {
        return { element: decrementButton, mode: 'decrement' }
      }
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

    const removedQtyForMissingItem = (before, mode) =>
      mode === 'remove' ? before : 1

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
            return {
              item: orderItem,
              removedQty: removedQtyForMissingItem(before, hint.mode),
            }
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
            return {
              item: orderItem,
              removedQty: removedQtyForMissingItem(before, hint.mode),
            }
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
          return {
            item: orderItem,
            removedQty: removedQtyForMissingItem(before, hint.mode),
          }
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
        mode: pending.mode,
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

    const onCartRemoveClick = (event) => {
      if (!isCheckoutCartPage()) {
        return
      }

      const action = findCartActionTarget(event)

      if (!action) {
        return
      }

      const row = findCartRow(action.element)
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
          mode: action.mode,
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
      global.document.addEventListener('click', onCartRemoveClick, true)

      if (global.jQuery) {
        global.jQuery(global).on('orderFormUpdated.vtex', onOrderFormUpdated)
      }
    }

    return attach
  }
})(window)
