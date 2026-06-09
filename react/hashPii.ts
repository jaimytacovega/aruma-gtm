import { canUseDOM } from 'vtex.render-runtime'

import { log, NOT_AVAILABLE } from './utils'

import type { MagentaUserProperties } from './events/magentaProfile'

const sha256Hex = async (value: string): Promise<string> => {
    if (!canUseDOM || !window.crypto?.subtle) {
        log('hashPii: Web Crypto unavailable')
        return NOT_AVAILABLE
    }

    const buffer = await window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value)
    )

    return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

export const hashEmailForAnalytics = async (email: string): Promise<string> => {
    const trimmed = email.trim()

    if (!trimmed || trimmed === NOT_AVAILABLE) {
        return NOT_AVAILABLE
    }

    return sha256Hex(trimmed.toLowerCase())
}

export const hashUserIdForAnalytics = async (
    userId: string
): Promise<string> => {
    const trimmed = userId.trim()

    if (!trimmed || trimmed === NOT_AVAILABLE) {
        return NOT_AVAILABLE
    }

    return sha256Hex(trimmed)
}

export const withHashedUserPii = async (
    properties: MagentaUserProperties
): Promise<MagentaUserProperties> => ({
    ...properties,
    userID: await hashUserIdForAnalytics(properties.userID),
    correo: await hashEmailForAnalytics(properties.correo),
})
