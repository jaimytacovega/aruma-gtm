import { NOT_AVAILABLE } from '../utils'

const PROMOTION_CONTAINER_SELECTORS = [
    '[class*="sliderLayoutContainer--shopByCategory"]',
    '[class*="sliderLayoutContainer--slider-banners"]',
    '[class*="flexRowContent--banner-x3"]',
    '[class*="flexRowContent--PromoSectionBoxesSimple"]',
].join(', ')

type PromotionMeta = {
    carouselId: string
    creativeName: string
    creativeSlot: string
    promotionId: string
    promotionName: string
    href: string
    productSlug: string | null
    itemIndex: number
}

const normalizeText = (value: string | null | undefined): string =>
    value?.replace(/\s+/g, ' ').trim() || ''

const isTrackableCarouselSlide = (slide: HTMLElement): boolean => {
    const role = slide.getAttribute('role')

    if (role === 'none') {
        return false
    }

    if (slide.getAttribute('aria-hidden') === 'true') {
        return false
    }

    return !slide.className.includes('--hidden')
}

const getHrefFromElement = (element: HTMLElement): string => {
    const link = element.querySelector('a[href]')

    if (link instanceof HTMLAnchorElement) {
        return link.href
    }

    if (element instanceof HTMLAnchorElement) {
        return element.href
    }

    return ''
}

const getPathPromotionName = (href: string): string => {
    if (!href) {
        return NOT_AVAILABLE
    }

    try {
        const path = new URL(href, window.location.origin).pathname
        const segments = path.split('/').filter(Boolean)

        return segments[segments.length - 1] || NOT_AVAILABLE
    } catch {
        return NOT_AVAILABLE
    }
}

const getProductSlugFromHref = (href: string): string | null => {
    if (!href) {
        return null
    }

    try {
        const path = new URL(href, window.location.origin).pathname
        const match = path.match(/\/([^/]+)\/p\/?$/)

        return match?.[1] ?? null
    } catch {
        return null
    }
}

const getStablePromotionId = (
    element: HTMLElement,
    href: string,
    fallbackName: string
): string => {
    const image = element.querySelector('img[src]')

    if (image instanceof HTMLImageElement && image.src) {
        const match = image.src.match(/images\/([a-f0-9-]+)___/i)

        if (match?.[1]) {
            return match[1]
        }
    }

    const pathName = getPathPromotionName(href)

    if (pathName !== NOT_AVAILABLE) {
        return pathName
    }

    return fallbackName || NOT_AVAILABLE
}

const getLogKey = (meta: PromotionMeta): string =>
    `${meta.carouselId}:${meta.promotionId}`

const parseShopByCategorySlide = (
    slide: HTMLElement,
    index: number
): PromotionMeta | null => {
    if (!slide.querySelector('[class*="stackContainer--sliderTop"]')) {
        return null
    }

    const promotionName = normalizeText(
        slide.querySelector('[class*="sliderTop-titulo"]')?.textContent
    )

    if (!promotionName) {
        return null
    }

    const href = getHrefFromElement(slide)
    const dataIndex = slide.getAttribute('data-index')
    const slotIndex = dataIndex || String(index + 1)
    const promotionId = getStablePromotionId(slide, href, promotionName)

    return {
        carouselId: 'shopByCategory',
        creativeName: 'shopByCategory',
        creativeSlot: `shopByCategory-${slotIndex}`,
        promotionId,
        promotionName,
        href,
        productSlug: getProductSlugFromHref(href),
        itemIndex: Number(dataIndex) || index + 1,
    }
}

const parseSliderBannerSlide = (
    slide: HTMLElement,
    container: HTMLElement,
    index: number
): PromotionMeta | null => {
    const href = getHrefFromElement(slide)

    if (!href) {
        return null
    }

    const section = container.closest('section')
    const creativeName =
        normalizeText(
            section?.querySelector('[class*="sectionBlockTitle"]')?.textContent
        ) || 'slider-banners'
    const promotionName = getPathPromotionName(href)
    const dataIndex = slide.getAttribute('data-index')
    const slotIndex = dataIndex || String(index + 1)
    const promotionId = getStablePromotionId(slide, href, promotionName)

    return {
        carouselId: 'slider-banners',
        creativeName,
        creativeSlot: `slider-banners-${slotIndex}`,
        promotionId,
        promotionName,
        href,
        productSlug: getProductSlugFromHref(href),
        itemIndex: Number(dataIndex) || index + 1,
    }
}

const parseBannerX3Item = (
    banner: HTMLElement,
    index: number
): PromotionMeta | null => {
    const promotionName = normalizeText(
        banner.querySelector('[class*="banner-x3-titulo"]')?.textContent
    )

    if (!promotionName) {
        return null
    }

    const href = getHrefFromElement(banner)
    const promotionId = getStablePromotionId(banner, href, promotionName)

    return {
        carouselId: 'banner-x3',
        creativeName: 'banner-x3',
        creativeSlot: `banner-x3-${index + 1}`,
        promotionId,
        promotionName,
        href,
        productSlug: getProductSlugFromHref(href),
        itemIndex: index + 1,
    }
}

const parsePromoSectionBox = (
    link: HTMLAnchorElement,
    index: number
): PromotionMeta | null => {
    const href = link.href

    if (!href) {
        return null
    }

    const promotionName = getPathPromotionName(href)
    const promotionId = getStablePromotionId(link, href, promotionName)

    return {
        carouselId: 'PromoSectionBoxesSimple',
        creativeName: 'PromoSectionBoxesSimple',
        creativeSlot: `PromoSectionBoxesSimple-${index + 1}`,
        promotionId,
        promotionName,
        href,
        productSlug: getProductSlugFromHref(href),
        itemIndex: index + 1,
    }
}

const collectShopByCategorySlides = (container: HTMLElement): HTMLElement[] => {
    const slides: HTMLElement[] = []

    container
        .querySelectorAll('[class*="slide--shopByCategory"]')
        .forEach((slide) => {
            if (
                slide instanceof HTMLElement &&
                isTrackableCarouselSlide(slide)
            ) {
                slides.push(slide)
            }
        })

    return slides
}

const collectSliderBannerSlides = (container: HTMLElement): HTMLElement[] => {
    const slides: HTMLElement[] = []

    container
        .querySelectorAll('[class*="slide--slider-banners"]')
        .forEach((slide) => {
            if (
                slide instanceof HTMLElement &&
                isTrackableCarouselSlide(slide) &&
                slide.querySelector('a[href]')
            ) {
                slides.push(slide)
            }
        })

    return slides
}

const collectBannerX3Items = (row: HTMLElement): HTMLElement[] => {
    const banners: HTMLElement[] = []

    row.querySelectorAll('[class*="stackContainer--banner-x3"]').forEach(
        (banner) => {
            if (banner instanceof HTMLElement) {
                banners.push(banner)
            }
        }
    )

    return banners
}

const collectPromoSectionBoxes = (row: HTMLElement): HTMLElement[] => {
    const links: HTMLElement[] = []

    row.querySelectorAll('a[href]').forEach((link) => {
        if (
            link instanceof HTMLAnchorElement &&
            link.querySelector('img[src]')
        ) {
            links.push(link)
        }
    })

    return links
}

const collectPromotionElements = (): HTMLElement[] => {
    const elements: HTMLElement[] = []

    document
        .querySelectorAll('[class*="sliderLayoutContainer--shopByCategory"]')
        .forEach((container) => {
            if (container instanceof HTMLElement) {
                elements.push.apply(
                    elements,
                    collectShopByCategorySlides(container)
                )
            }
        })

    document
        .querySelectorAll('[class*="sliderLayoutContainer--slider-banners"]')
        .forEach((container) => {
            if (container instanceof HTMLElement) {
                elements.push.apply(
                    elements,
                    collectSliderBannerSlides(container)
                )
            }
        })

    document
        .querySelectorAll('[class*="flexRowContent--banner-x3"]')
        .forEach((row) => {
            if (row instanceof HTMLElement) {
                elements.push.apply(elements, collectBannerX3Items(row))
            }
        })

    document
        .querySelectorAll('[class*="flexRowContent--PromoSectionBoxesSimple"]')
        .forEach((row) => {
            if (row instanceof HTMLElement) {
                elements.push.apply(elements, collectPromoSectionBoxes(row))
            }
        })

    return elements
}

const getPromotionIndex = (element: HTMLElement): number => {
    if (element.closest('[class*="sliderLayoutContainer--shopByCategory"]')) {
        const container = element.closest(
            '[class*="sliderLayoutContainer--shopByCategory"]'
        )

        if (container instanceof HTMLElement) {
            return collectShopByCategorySlides(container).indexOf(element)
        }
    }

    if (element.closest('[class*="sliderLayoutContainer--slider-banners"]')) {
        const container = element.closest(
            '[class*="sliderLayoutContainer--slider-banners"]'
        )

        if (container instanceof HTMLElement) {
            return collectSliderBannerSlides(container).indexOf(element)
        }
    }

    if (element.closest('[class*="flexRowContent--banner-x3"]')) {
        const row = element.closest('[class*="flexRowContent--banner-x3"]')

        if (row instanceof HTMLElement) {
            return collectBannerX3Items(row).indexOf(element)
        }
    }

    if (element.closest('[class*="flexRowContent--PromoSectionBoxesSimple"]')) {
        const row = element.closest(
            '[class*="flexRowContent--PromoSectionBoxesSimple"]'
        )

        if (row instanceof HTMLElement) {
            return collectPromoSectionBoxes(row).indexOf(element)
        }
    }

    return 0
}

const parsePromotionMeta = (element: HTMLElement): PromotionMeta | null => {
    const index = getPromotionIndex(element)

    if (element.closest('[class*="sliderLayoutContainer--shopByCategory"]')) {
        return parseShopByCategorySlide(element, index)
    }

    const sliderBannersContainer = element.closest(
        '[class*="sliderLayoutContainer--slider-banners"]'
    )

    if (
        sliderBannersContainer instanceof HTMLElement &&
        element.matches('[class*="slide--slider-banners"]')
    ) {
        return parseSliderBannerSlide(
            element,
            sliderBannersContainer,
            index
        )
    }

    if (element.closest('[class*="flexRowContent--banner-x3"]')) {
        return parseBannerX3Item(element, index)
    }

    if (
        element instanceof HTMLAnchorElement &&
        element.closest('[class*="flexRowContent--PromoSectionBoxesSimple"]')
    ) {
        return parsePromoSectionBox(element, index)
    }

    return null
}

const findPromotionElementFromTarget = (
    target: Element
): HTMLElement | null => {
    const clickedLink = target.closest('a[href]')

    if (!(clickedLink instanceof HTMLAnchorElement)) {
        return null
    }

    const shopSlide = clickedLink.closest('[class*="slide--shopByCategory"]')

    if (
        shopSlide instanceof HTMLElement &&
        shopSlide.closest('[class*="sliderLayoutContainer--shopByCategory"]') &&
        shopSlide.querySelector('[class*="stackContainer--sliderTop"]')
    ) {
        return shopSlide
    }

    const sliderBannerSlide = clickedLink.closest(
        '[class*="slide--slider-banners"]'
    )

    if (
        sliderBannerSlide instanceof HTMLElement &&
        sliderBannerSlide.closest(
            '[class*="sliderLayoutContainer--slider-banners"]'
        )
    ) {
        return sliderBannerSlide
    }

    const bannerX3 = clickedLink.closest('[class*="stackContainer--banner-x3"]')

    if (
        bannerX3 instanceof HTMLElement &&
        bannerX3.closest('[class*="flexRowContent--banner-x3"]')
    ) {
        return bannerX3
    }

    if (
        clickedLink.closest('[class*="flexRowContent--PromoSectionBoxesSimple"]') &&
        clickedLink.querySelector('img[src]')
    ) {
        return clickedLink
    }

    return null
}

export type { PromotionMeta }
export {
    PROMOTION_CONTAINER_SELECTORS,
    collectPromotionElements,
    findPromotionElementFromTarget,
    getHrefFromElement,
    getLogKey,
    isTrackableCarouselSlide,
    parsePromotionMeta,
}
