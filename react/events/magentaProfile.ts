import { log, NOT_AVAILABLE } from '../utils'

const MAGENTA_PROFILE_CACHE_KEY = 'magenta_profile_cache'
const PROFILE_POLL_MS = 500
const PROFILE_MAX_WAIT_MS = 15000

type MagentaLevelProgram = {
  name?: string
}

type MagentaCustomer = {
  docNumber?: string
  email?: string
  birthDate?: string
  levelProgram?: MagentaLevelProgram
  availablePoints?: number
}

type MagentaProfileData = {
  profileStatus?: string
  document?: string
  email?: string
  birthDate?: string
  nivelMagenta?: string
  customer?: MagentaCustomer[]
}

type MagentaProfileCache = {
  data?: MagentaProfileData | { data?: MagentaProfileData }
  timestamp?: number
  expiresAt?: number
}

const calculateAge = (birthDate: string): number | null => {
  const born = new Date(birthDate)

  if (Number.isNaN(born.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const monthDiff = today.getMonth() - born.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    age -= 1
  }

  return age >= 0 ? age : null
}

const resolveProfileData = (
  root: MagentaProfileCache['data']
): MagentaProfileData | null => {
  if (!root || typeof root !== 'object') {
    return null
  }

  if ('data' in root && root.data && typeof root.data === 'object') {
    return root.data
  }

  return root as MagentaProfileData
}

const readMagentaProfileCache = (): MagentaProfileData | null => {
  try {
    const raw = window.localStorage.getItem(MAGENTA_PROFILE_CACHE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as MagentaProfileCache

    return resolveProfileData(parsed.data)
  } catch {
    return null
  }
}

const isMagentaProfileReady = (profile: MagentaProfileData | null) => {
  if (!profile) {
    return false
  }

  if (profile.profileStatus && profile.profileStatus !== 'Success') {
    return false
  }

  const customer = profile.customer?.[0]

  return Boolean(
    profile.nivelMagenta ||
      customer?.levelProgram?.name ||
      typeof customer?.availablePoints === 'number' ||
      customer?.birthDate ||
      profile.birthDate
  )
}

export type MagentaUserProperties = {
  userID: string
  correo: string
  edadUsuario: string | number
  magentaUser: string
  magentaPointsUser: string | number
}

export const getMagentaUserProperties = (
  fallback: { document?: string; email?: string } = {}
): MagentaUserProperties => {
  const profile = readMagentaProfileCache()
  const customer = profile?.customer?.[0]
  const birthDate = customer?.birthDate || profile?.birthDate || ''
  const age = birthDate ? calculateAge(birthDate) : null

  const magentaUser =
    profile?.nivelMagenta ||
    customer?.levelProgram?.name ||
    NOT_AVAILABLE

  const availablePoints = customer?.availablePoints

  return {
    userID:
      customer?.docNumber ||
      profile?.document ||
      fallback.document ||
      NOT_AVAILABLE,
    correo:
      customer?.email || profile?.email || fallback.email || NOT_AVAILABLE,
    edadUsuario: age ?? NOT_AVAILABLE,
    magentaUser,
    magentaPointsUser:
      typeof availablePoints === 'number' ? availablePoints : NOT_AVAILABLE,
  }
}

let profileWaitTimeoutId: number | null = null
let profileStorageListenerAttached = false

const clearProfileWait = () => {
  if (profileWaitTimeoutId !== null) {
    window.clearTimeout(profileWaitTimeoutId)
    profileWaitTimeoutId = null
  }
}

export const waitForMagentaUserProperties = (
  fallback: { document?: string; email?: string },
  onReady: (properties: MagentaUserProperties) => void
) => {
  clearProfileWait()

  const startedAt = Date.now()

  const finish = (source: string) => {
    clearProfileWait()
    const properties = getMagentaUserProperties(fallback)

    log('magentaProfile ready', source, properties)
    onReady(properties)
  }

  const poll = () => {
    const profile = readMagentaProfileCache()

    if (isMagentaProfileReady(profile)) {
      finish('cache')
      return
    }

    if (Date.now() - startedAt >= PROFILE_MAX_WAIT_MS) {
      log('magentaProfile timeout', MAGENTA_PROFILE_CACHE_KEY)
      finish('timeout')
      return
    }

    profileWaitTimeoutId = window.setTimeout(poll, PROFILE_POLL_MS)
  }

  if (!profileStorageListenerAttached) {
    window.addEventListener('storage', (event) => {
      if (event.key !== MAGENTA_PROFILE_CACHE_KEY || !event.newValue) {
        return
      }

      const profile = readMagentaProfileCache()

      if (isMagentaProfileReady(profile) && profileWaitTimeoutId !== null) {
        finish('storage')
      }
    })

    profileStorageListenerAttached = true
  }

  poll()
}
