import { pushToDataLayer } from '../../utils'

const FOOTER_SCOPE_SELECTOR = [
  '[class*="flexCol--links-footer"]',
  '[class*="flexCol--menu-mobile"]',
  '[class*="footer-option-pay-2"]',
].join(', ')

const FOOTER_CLICKABLE_SELECTOR =
  'a, span[class*="styledLink--footer-menu-title"]'

const getStyledLinkCta = (element: HTMLElement): string => {
  const content = element.querySelector('[class*="styledLinkContent"]')

  if (content instanceof HTMLElement) {
    const clone = content.cloneNode(true) as HTMLElement
    clone
      .querySelectorAll('[class*="accordionIcon"]')
      .forEach((node) => node.remove())

    const text = clone.textContent?.replace(/\s+/g, ' ').trim()
    if (text) {
      return text
    }
  }

  return element.textContent?.replace(/\s+/g, ' ').trim() || ''
}

const isLibroReclamacionesLink = (anchor: HTMLAnchorElement): boolean => {
  if (
    anchor.className.includes('libro-de-reclamos') ||
    anchor.className.includes('imagen-reclamaciones')
  ) {
    return true
  }

  const img = anchor.querySelector('img')

  return Boolean(
    img?.className.includes('libro-de-reclamos') ||
      img?.src.includes('libro-reclamos')
  )
}

const getAnchorCta = (anchor: HTMLAnchorElement): string => {
  if (isLibroReclamacionesLink(anchor)) {
    return 'Libro de reclamaciones'
  }

  const fromContent = getStyledLinkCta(anchor)
  if (fromContent) {
    return fromContent
  }

  const title = anchor.getAttribute('title')?.trim()
  if (title) {
    return title
  }

  const imgAlt = anchor.querySelector('img')?.getAttribute('alt')?.trim()
  if (imgAlt) {
    return imgAlt
  }

  return anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
}

const footerFunctionalOptions = (target: Element) => {
  const footerScope = target.closest(FOOTER_SCOPE_SELECTOR)
  if (!footerScope) {
    return
  }

  const clickable =
    target.closest(FOOTER_CLICKABLE_SELECTOR) ||
    target.closest('a[class*="imageElementLink"]')

  if (!(clickable instanceof HTMLElement) || !footerScope.contains(clickable)) {
    return
  }

  const cta =
    clickable instanceof HTMLAnchorElement
      ? getAnchorCta(clickable)
      : getStyledLinkCta(clickable)

  if (!cta) {
    return
  }

  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Home',
    seccion: 'Footer',
    subseccion: 'Opciones generales',
    intencion: 'Seleccionar opciones generales',
    accion: 'Seleccionar elemento',
    elemento: 'Boton',
    cta,
  })
}

export { footerFunctionalOptions }
