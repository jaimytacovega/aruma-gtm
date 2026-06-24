import { pushToDataLayer } from '../../utils'
import { cancelPendingImpressions } from '../3_1__productImpression'

const MENU_NAV_SELECTOR = '[class*="menuContainerNav--sticky-header-menu"]'
const MENU_ITEM_SELECTOR = 'a, span[class*="styledLink"]'

const getMenuItemCta = (element: HTMLElement): string => {
  return (
    element
      .querySelector('[class*="styledLinkContent"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ||
    element.textContent?.replace(/\s+/g, ' ').trim() ||
    ''
  )
}

const homeHeaderMenu = (target: Element) => {
  const menuNav = target.closest(MENU_NAV_SELECTOR)
  if (!menuNav) return

  const menuItem = target.closest(MENU_ITEM_SELECTOR)
  if (!(menuItem instanceof HTMLElement) || !menuNav.contains(menuItem)) return

  const cta = getMenuItemCta(menuItem)
  if (!cta) return

  cancelPendingImpressions()

  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Home',
    seccion: 'Header',
    subseccion: 'Menu',
    intencion: 'Seleccionar menu',
    accion: 'Seleccionar elemento',
    elemento: 'Boton',
    cta,
  })
}

export { homeHeaderMenu }
