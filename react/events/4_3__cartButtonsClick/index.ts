import { pushToDataLayer } from '../../utils'

const CART_FINALIZE_SELECTOR =
  '#cart-to-orderform, a[data-event="cartToOrderform"]'
const CART_CONTINUE_SHOPPING_SELECTOR = '.boton-seguir-comprando a'

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() || ''

const pushCartButtonEvent = (cta: string) => {
  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Carrito',
    seccion: 'Carrito',
    subseccion: 'Carrito',
    intencion: cta,
    accion: 'Seleccionar elemento',
    elemento: 'Boton',
    cta,
  })
}

const cartButtonsClick = (target: Element) => {
  const finalizeButton = target.closest(CART_FINALIZE_SELECTOR)

  if (finalizeButton instanceof HTMLAnchorElement) {
    const cta = normalizeText(finalizeButton.textContent) || 'Finalizar compra'

    pushCartButtonEvent(cta)

    return
  }

  const continueShoppingButton = target.closest(CART_CONTINUE_SHOPPING_SELECTOR)

  if (!(continueShoppingButton instanceof HTMLAnchorElement)) {
    return
  }

  const cta =
    normalizeText(continueShoppingButton.querySelector('p')?.textContent) ||
    normalizeText(continueShoppingButton.textContent) ||
    'Seguir comprando'

  pushCartButtonEvent(cta)
}

export { cartButtonsClick }
