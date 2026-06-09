/**
 * Checkout order placed (/checkout/orderPlaced/?og=...): virtualPage.
 * Paste before checkout-ui-custom.js.
 *
 * Note: Aruma loads order placed via the IO storefront (react pixel), not
 * checkout6-custom.js. The live handlers are react/events/5_4_1__successPaymentScreening.
 * This checkout module remains for hash-route / legacy checkout-only flows.
 */
;((global) => {
  const SUCCESS_PAGE_TITLE = 'Aruma - Checkout - Compra exitosa'
  const SUCCESS_CHECKOUT_SCREEN = 'success'

  global.create5_4_1__successPaymentScreening = ({
    pushToDataLayer,
    orderFormUtils,
    ensurePaymentScreening,
  }) => {
    const log = (...args) => {
      console.info('[aruma-gtm]', '5_4_1__successPaymentScreening', ...args)
    }

    let pushInFlight = false

    const ensurePriorCheckoutScreens = () => {
      if (typeof ensurePaymentScreening === 'function') {
        ensurePaymentScreening()
      }
    }

    const getSuccessPageLocation = () =>
      `${global.location.origin}/checkout/compra-exitosa`

    const pushSuccessPaymentVirtualPage = async (source) => {
      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        log('skip: not order placed page', { source })
        return
      }

      const orderGroup = orderFormUtils.getOrderGroupFromUrl()

      if (!orderGroup) {
        log('skip: missing og query param', { source })
        return
      }

      if (orderFormUtils.hasFiredOrderPlacedEvent('virtualPage', orderGroup)) {
        log('skip: already fired for order group', { source, orderGroup })
        return
      }

      if (pushInFlight) {
        log('skip: push already in flight', { source, orderGroup })
        return
      }

      pushInFlight = true

      let orderForm

      try {
        orderForm = await orderFormUtils.loadOrderPlacedOrderForm()
      } catch (error) {
        log('loadOrderPlacedOrderForm failed', { source, orderGroup, error })
        pushInFlight = false
        return
      }

      if (!orderForm?.items?.length) {
        log('skip: order group has no items yet', {
          source,
          orderGroup,
          itemCount: orderForm?.items?.length ?? 0,
        })
        pushInFlight = false
        return
      }

      ensurePriorCheckoutScreens()

      const payload = {
        event: 'virtualPage',
        page_location: getSuccessPageLocation(),
        page_title: SUCCESS_PAGE_TITLE,
        checkout_screen: SUCCESS_CHECKOUT_SCREEN,
        order_group: orderGroup,
      }

      log('pushing virtualPage', { source, orderGroup, payload })
      pushToDataLayer(payload)
      orderFormUtils.markOrderPlacedEventFired('virtualPage', orderGroup)
      pushInFlight = false
    }

    const onHashChange = () => {
      log('hashchange', {
        href: global.location.href,
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
      })

      if (!orderFormUtils.isCheckoutOrderPlacedPage()) {
        return
      }

      void pushSuccessPaymentVirtualPage('hashchange')
    }

    const sync = () => {
      void pushSuccessPaymentVirtualPage('sync')
    }

    const attach = () => {
      log('attach', {
        href: global.location.href,
        isOrderPlaced: orderFormUtils.isCheckoutOrderPlacedPage(),
        orderGroup: orderFormUtils.getOrderGroupFromUrl?.() ?? '',
      })

      orderFormUtils.setupOrderPlacedTransitionWatcher()

      if (typeof orderFormUtils.onOrderPlacedTransition === 'function') {
        orderFormUtils.onOrderPlacedTransition((source) => {
          void pushSuccessPaymentVirtualPage(`transition:${source}`)
        })
      }

      void pushSuccessPaymentVirtualPage('attach')

      global.addEventListener('hashchange', onHashChange)
      global.addEventListener('pageshow', () => {
        void pushSuccessPaymentVirtualPage('pageshow')
      })
    }

    return { attach, sync }
  }
})(window)
