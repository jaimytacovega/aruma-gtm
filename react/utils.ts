import { canUseDOM } from 'vtex.render-runtime'

const log = (...args: unknown[]) => console.info('[aruma-gtm]', ...args)

function pushToDataLayer(payload: Record<string, unknown>) {
    if (!canUseDOM) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(payload)
    log(JSON.stringify(payload))
}

export {
    pushToDataLayer,
    log,
}