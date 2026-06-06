import { canUseDOM } from 'vtex.render-runtime'

import { NOT_AVAILABLE, log, pushToDataLayer } from '../../utils'
import {
    buildViewItem,
    fetchCatalogProduct,
    prefetchCatalogProduct,
} from '../3_1__productImpression/catalog'
import type { ViewItem } from '../3_1__productImpression/catalog'
import {
    PROMOTION_CONTAINER_SELECTORS,
    collectPromotionElements,
    getHrefFromElement,
    getLogKey,
    isTrackableCarouselSlide,
    parsePromotionMeta,
} from '../promotionMeta'
import type { PromotionMeta } from '../promotionMeta'

const DESKTOP_VISIBILITY_THRESHOLD = 0.25
const MOBILE_VISIBILITY_THRESHOLD = 0.75
const MOBILE_MAX_WIDTH = 768
const SLIDE_SELECTOR = '[class*="slider-layout-0-x-slide"]'
const MUTATION_DEBOUNCE_MS = 200
const PROMOTION_OBSERVE_DELAY_MS = 2000

const observedPromotions = new Set<Element>()
const loggedPromotionKeys = new Set<string>()
const pendingPromotionKeys = new Set<string>()

let intersectionObserver: IntersectionObserver | null = null
let domObserver: MutationObserver | null = null
let trackingActive = false
let promotionAnalyticsReady = false
let mutationDebounceTimer: number | null = null
let observeStartTimer: number | null = null
let observeWaitFrame: number | null = null
const observedPromotionContainers = new Set<Element>()

const hasAnalyticsLoaded = (): boolean => {
    const dataLayer = window.dataLayer

    if (!Array.isArray(dataLayer)) {
        return false
    }

    for (let index = dataLayer.length - 1; index >= 0; index--) {
        const entry = dataLayer[index]

        if (
            entry &&
            typeof entry === 'object' &&
            (entry as { event?: string }).event === 'analytics_loaded'
        ) {
            return true
        }
    }

    return false
}

const isMobileViewport = (): boolean =>
    window.innerWidth < MOBILE_MAX_WIDTH

const getVisibilityThreshold = (): number =>
    isMobileViewport() ? MOBILE_VISIBILITY_THRESHOLD : DESKTOP_VISIBILITY_THRESHOLD

const isCenterInViewport = (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    return (
        centerX >= 0 &&
        centerX <= window.innerWidth &&
        centerY >= 0 &&
        centerY <= window.innerHeight
    )
}

const isVtexSlideVisible = (element: HTMLElement): boolean => {
    const slide = element.closest(SLIDE_SELECTOR)

    if (!slide) {
        return true
    }

    if (!(slide instanceof HTMLElement)) {
        return false
    }

    return isTrackableCarouselSlide(slide)
}

const isPromotionVisible = (
    element: HTMLElement,
    intersectionRatio?: number
): boolean => {
    if (!promotionAnalyticsReady) {
        return false
    }

    if (!isVtexSlideVisible(element)) {
        return false
    }

    const ratio =
        typeof intersectionRatio === 'number'
            ? intersectionRatio
            : getVisibleAreaRatio(element)

    if (ratio < getVisibilityThreshold()) {
        return false
    }

    if (isMobileViewport() && !isCenterInViewport(element)) {
        return false
    }

    return true
}

const getVisibleAreaRatio = (element: Element): number => {
    const rect = element.getBoundingClientRect()

    if (rect.width === 0 || rect.height === 0) {
        return 0
    }

    const visibleWidth =
        Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
    const visibleHeight =
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)

    if (visibleWidth <= 0 || visibleHeight <= 0) {
        return 0
    }

    return (visibleWidth * visibleHeight) / (rect.width * rect.height)
}

const getPromotionElementDebugInfo = (element: HTMLElement) => ({
    tagName: element.tagName,
    className: element.className,
    role: element.getAttribute('role'),
    dataIndex: element.getAttribute('data-index'),
    ariaHidden: element.getAttribute('aria-hidden'),
    href: getHrefFromElement(element),
})

const pushViewPromotion = async (
    meta: PromotionMeta,
    element: HTMLElement
) => {
    const ecommerce: {
        creative_name: string
        creative_slot: string
        promotion_id: string
        promotion_name: string
        items?: ViewItem[]
    } = {
        creative_name: meta.creativeName,
        creative_slot: meta.creativeSlot,
        promotion_id: meta.promotionId,
        promotion_name: meta.promotionName,
    }

    if (meta.productSlug) {
        try {
            prefetchCatalogProduct(meta.productSlug)
            const catalog = await fetchCatalogProduct(meta.productSlug)
            const item = buildViewItem(
                {
                    slug: meta.productSlug,
                    name: catalog?.productName ?? meta.productSlug,
                    brand: catalog?.brand ?? NOT_AVAILABLE,
                    price: 0,
                    listPrice: 0,
                    categories: catalog?.categories ?? [],
                    listId: meta.creativeName,
                    listName: meta.promotionName,
                    index: meta.itemIndex,
                },
                catalog
            )

            ecommerce.items = [item]
        } catch (error) {
            log('view_promotion catalog fetch failed', error)
        }
    }

    pushToDataLayer({
        event: 'view_promotion',
        ecommerce,
    })
}

const tryLogVisiblePromotion = (
    element: HTMLElement,
    intersectionRatio?: number
) => {
    if (!isPromotionVisible(element, intersectionRatio)) {
        return
    }

    const meta = parsePromotionMeta(element)

    if (!meta) {
        return
    }

    const key = getLogKey(meta)

    if (loggedPromotionKeys.has(key) || pendingPromotionKeys.has(key)) {
        return
    }

    pendingPromotionKeys.add(key)
    loggedPromotionKeys.add(key)

    void pushViewPromotion(meta, element).finally(() => {
        pendingPromotionKeys.delete(key)
    })
}

const observePromotion = (element: HTMLElement) => {
    if (!intersectionObserver || observedPromotions.has(element)) {
        return
    }

    observedPromotions.add(element)
    intersectionObserver.observe(element)
}

const attachPromotionContainerObserver = (container: Element) => {
    if (!domObserver || observedPromotionContainers.has(container)) {
        return
    }

    observedPromotionContainers.add(container)
    domObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-hidden'],
    })
}

const discoverPromotionContainers = () => {
    document
        .querySelectorAll(PROMOTION_CONTAINER_SELECTORS)
        .forEach((container) => {
            attachPromotionContainerObserver(container)
        })
}

const scanForPromotions = () => {
    discoverPromotionContainers()
    collectPromotionElements().forEach((element) => {
        observePromotion(element)
    })
}

const recheckPromotionsInContainer = (container: Element) => {
    collectPromotionElements()
        .filter((element) => container.contains(element))
        .forEach((element) => {
            tryLogVisiblePromotion(element)
        })
}

const isPromotionMutationTarget = (target: Node): boolean => {
    if (!(target instanceof Element)) {
        return false
    }

    if (target.matches(PROMOTION_CONTAINER_SELECTORS)) {
        return true
    }

    return Boolean(target.closest(PROMOTION_CONTAINER_SELECTORS))
}

const schedulePromotionMutationSync = (container?: Element) => {
    if (mutationDebounceTimer !== null) {
        window.clearTimeout(mutationDebounceTimer)
    }

    mutationDebounceTimer = window.setTimeout(() => {
        mutationDebounceTimer = null
        scanForPromotions()

        if (container) {
            recheckPromotionsInContainer(container)
        }
    }, MUTATION_DEBOUNCE_MS)
}

const handleIntersection: IntersectionObserverCallback = (entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) {
            continue
        }

        const element = entry.target

        if (!(element instanceof HTMLElement)) {
            continue
        }

        tryLogVisiblePromotion(element, entry.intersectionRatio)
    }
}

const disconnectPromotionImpression = () => {
    if (mutationDebounceTimer !== null) {
        window.clearTimeout(mutationDebounceTimer)
        mutationDebounceTimer = null
    }

    if (observeStartTimer !== null) {
        window.clearTimeout(observeStartTimer)
        observeStartTimer = null
    }

    if (observeWaitFrame !== null) {
        window.cancelAnimationFrame(observeWaitFrame)
        observeWaitFrame = null
    }

    intersectionObserver?.disconnect()
    domObserver?.disconnect()
    intersectionObserver = null
    domObserver = null
    observedPromotions.clear()
    loggedPromotionKeys.clear()
    pendingPromotionKeys.clear()
    observedPromotionContainers.clear()
    trackingActive = false
    promotionAnalyticsReady = false
}

const startPromotionObservation = () => {
    if (!canUseDOM || promotionAnalyticsReady) {
        return
    }

    promotionAnalyticsReady = true

    intersectionObserver = new IntersectionObserver(handleIntersection, {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        root: null,
        rootMargin: '0px',
    })

    domObserver = new MutationObserver((mutations) => {
        let promotionContainer: Element | undefined

        for (const mutation of mutations) {
            if (
                mutation.type === 'childList' &&
                mutation.target === document.body
            ) {
                discoverPromotionContainers()
                schedulePromotionMutationSync()
                continue
            }

            if (!isPromotionMutationTarget(mutation.target)) {
                continue
            }

            if (
                mutation.type === 'attributes' &&
                (mutation.attributeName === 'class' ||
                    mutation.attributeName === 'aria-hidden')
            ) {
                const target = mutation.target

                if (target instanceof Element) {
                    promotionContainer =
                        target.closest(PROMOTION_CONTAINER_SELECTORS) ||
                        target
                }

                schedulePromotionMutationSync(promotionContainer)
                return
            }

            for (const node of Array.from(mutation.addedNodes)) {
                if (!isPromotionMutationTarget(node)) {
                    continue
                }

                promotionContainer =
                    node instanceof Element
                        ? node.closest(PROMOTION_CONTAINER_SELECTORS) || node
                        : undefined

                schedulePromotionMutationSync(promotionContainer)
                return
            }
        }
    })

    domObserver.observe(document.body, {
        childList: true,
        subtree: true,
    })

    discoverPromotionContainers()
    scanForPromotions()
}

const schedulePromotionObservation = () => {
    observeStartTimer = window.setTimeout(() => {
        observeStartTimer = null
        startPromotionObservation()
    }, PROMOTION_OBSERVE_DELAY_MS)
}

const waitForAnalyticsLoaded = (onReady: () => void) => {
    if (hasAnalyticsLoaded()) {
        onReady()
        return
    }

    observeWaitFrame = window.requestAnimationFrame(() => {
        observeWaitFrame = null
        waitForAnalyticsLoaded(onReady)
    })
}

const connectViewPromotion = () => {
    if (!canUseDOM || trackingActive) {
        return
    }

    trackingActive = true

    waitForAnalyticsLoaded(schedulePromotionObservation)
}

const promotionImpression = () => {
    if (!canUseDOM) {
        return
    }

    disconnectPromotionImpression()
    connectViewPromotion()
}

export { promotionImpression, disconnectPromotionImpression }
