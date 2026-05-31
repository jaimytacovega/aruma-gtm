/**
 * Checkout profile: Factura (#is-corporate-client) virtualEvent when it becomes active.
 * Paste before checkout-ui-custom.js.
 */
;((global) => {
  const CORPORATE_BUTTON_SELECTOR = '#is-corporate-client'

  const isCheckoutProfilePage = () =>
    global.location.pathname.includes('/checkout') &&
    global.location.hash.includes('/profile')

  global.create5_1_3__companyInfo = ({ pushToDataLayer, normalizeText }) => {
    let domObserver = null
    let classObserver = null
    let watchedButton = null
    let wasActive = false

    const getButtonCta = (button) =>
      normalizeText(button.textContent) || 'Factura'

    const pushCompanyInfoEvent = (cta) => {
      pushToDataLayer({
        event: 'virtualEvent',
        portal: 'Aruma',
        subportal: 'Checkout',
        seccion: 'Identificación',
        subseccion: 'Datos de empresa',
        intencion: cta,
        accion: 'Seleccionar elemento',
        elemento: 'Boton',
        cta,
      })
    }

    const syncCorporateButtonState = (button) => {
      if (!isCheckoutProfilePage()) {
        return
      }

      const isActive = button.classList.contains('active')

      if (isActive && !wasActive) {
        pushCompanyInfoEvent(getButtonCta(button))
      }

      wasActive = isActive
    }

    const unwatchCorporateButton = () => {
      if (classObserver) {
        classObserver.disconnect()
        classObserver = null
      }

      watchedButton = null
      wasActive = false
    }

    const watchCorporateButton = (button) => {
      if (!(button instanceof HTMLElement) || button === watchedButton) {
        return
      }

      unwatchCorporateButton()
      watchedButton = button
      wasActive = button.classList.contains('active')

      classObserver = new MutationObserver(() => {
        syncCorporateButtonState(button)
      })

      classObserver.observe(button, {
        attributes: true,
        attributeFilter: ['class'],
      })

      button.addEventListener('click', () => {
        global.setTimeout(() => {
          syncCorporateButtonState(button)
        }, 0)
      })
    }

    const findAndWatchCorporateButton = () => {
      if (!isCheckoutProfilePage()) {
        unwatchCorporateButton()
        return
      }

      const button = document.querySelector(CORPORATE_BUTTON_SELECTOR)

      if (button instanceof HTMLElement) {
        watchCorporateButton(button)
      }
    }

    const attach = () => {
      findAndWatchCorporateButton()

      if (!domObserver) {
        domObserver = new MutationObserver(() => {
          findAndWatchCorporateButton()
        })

        domObserver.observe(document.body, {
          childList: true,
          subtree: true,
        })
      }

      global.addEventListener('hashchange', () => {
        unwatchCorporateButton()
        findAndWatchCorporateButton()
      })
    }

    return attach
  }
})(window)
