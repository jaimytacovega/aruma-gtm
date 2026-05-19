import { pushToDataLayer } from '../../utils'

const SOCIALS_SCOPE_SELECTOR =
  '[class*="flexRowContent--container-loyalty-base-redes"]'

const SOCIAL_NETWORKS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /tiktok/i, name: 'TikTok' },
  { pattern: /instagram/i, name: 'Instagram' },
  { pattern: /linkedin/i, name: 'LinkedIn' },
  { pattern: /youtube/i, name: 'YouTube' },
  { pattern: /facebook/i, name: 'Facebook' },
]

const getSocialNetworkName = (anchor: HTMLAnchorElement): string => {
  const sources = [
    anchor.href,
    anchor.querySelector('img')?.src ?? '',
    anchor.getAttribute('title') ?? '',
  ].join(' ')

  for (const { pattern, name } of SOCIAL_NETWORKS) {
    if (pattern.test(sources)) {
      return name
    }
  }

  return ''
}

const footerSocials = (target: Element) => {
  const socialsScope = target.closest(SOCIALS_SCOPE_SELECTOR)
  if (!socialsScope) {
    return
  }

  const anchor =
    target.closest('a[class*="imageElementLink"]') ||
    target.closest('a[href*="tiktok"], a[href*="instagram"], a[href*="linkedin"], a[href*="youtube"], a[href*="facebook"]')

  if (!(anchor instanceof HTMLAnchorElement) || !socialsScope.contains(anchor)) {
    return
  }

  const cta = getSocialNetworkName(anchor)
  if (!cta) {
    return
  }

  pushToDataLayer({
    event: 'virtualEvent',
    portal: 'Aruma',
    subportal: 'Home',
    seccion: 'Footer',
    subseccion: 'Redes sociales',
    intencion: 'Seleccionar redes sociales',
    accion: 'Seleccionar elemento',
    elemento: 'Icono',
    cta,
  })
}

export { footerSocials }
