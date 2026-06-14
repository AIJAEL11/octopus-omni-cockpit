/**
 * HubSpace (Afero) Cloud API Client
 * Reverse-engineered from community integrations & live API testing
 * Controls Defiant smart plugs and other HubSpace devices via Afero cloud
 *
 * Verified API endpoints (2026-03-28):
 *  Auth:     POST accounts.hubspaceconnect.com/auth/realms/thd/protocol/openid-connect/token
 *  User:     GET  api2.afero.net/v1/users/me
 *  Devices:  GET  api2.afero.net/v1/accounts/{id}/devices?expansions=state,attributes
 *  Control:  POST api2.afero.net/v1/accounts/{id}/devices/{devId}/actions
 *            Body: {"type":"attribute_write","attrId":2,"data":"01"} (ON) / "00" (OFF)
 */

const AUTH_URL = 'https://accounts.hubspaceconnect.com/auth/realms/thd/protocol/openid-connect/token'
const API_BASE = 'https://api2.afero.net/v1'

/** Afero attribute IDs for common functions */
const ATTR_POWER = 2  // data "01"=ON, "00"=OFF

interface HubSpaceToken {
  access_token: string
  refresh_token: string
  expires_in: number
  obtained_at: number
}

interface AferoDeviceRaw {
  deviceId: string
  friendlyName?: string
  description?: string
  deviceTypeId?: string
  profileId?: string
  createdTimestamp?: number
  accountId?: string
  virtual?: boolean
  deviceState?: {
    available?: boolean
    visible?: boolean
    connected?: boolean
    direct?: boolean
    linked?: boolean
    updatedTimestamp?: number
  }
  attributes?: AferoAttribute[]
}

interface AferoAttribute {
  id: number
  data?: string
  value?: string
  updatedTimestamp?: number
}

export interface HubSpaceDevice {
  id: string
  deviceId: string
  name: string
  type: 'outlet' | 'light' | 'fan' | 'switch' | 'unknown'
  isOn: boolean
  online: boolean
  attributes: Record<string, unknown>
}

// Token cache (in-memory, per-process)
const tokenCache = new Map<string, HubSpaceToken>()

/**
 * Authenticate with HubSpace/Afero via OAuth2 password grant
 */
export async function hubspaceLogin(username: string, password: string): Promise<HubSpaceToken> {
  const cacheKey = username.toLowerCase()
  const cached = tokenCache.get(cacheKey)
  if (cached) {
    const elapsed = (Date.now() - cached.obtained_at) / 1000
    if (elapsed < cached.expires_in - 30) {
      return cached
    }
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'hubspace_android',
    username,
    password,
  })

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[HubSpace] Auth failed:', res.status, text)
    throw new Error(`HubSpace login failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const token: HubSpaceToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 120,
    obtained_at: Date.now(),
  }
  tokenCache.set(cacheKey, token)
  return token
}

/**
 * Get Afero account ID from the token
 */
async function getAccountId(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to get user info: ${res.status}`)
  const data = await res.json()
  const accountAccess = data.accountAccess || []
  if (accountAccess.length > 0) {
    return accountAccess[0].account?.accountId || accountAccess[0].accountId
  }
  throw new Error('No account found for HubSpace user')
}

/**
 * List all devices from HubSpace account
 * Uses /devices endpoint (NOT /metadevices which returns 404)
 */
export async function hubspaceListDevices(username: string, password: string): Promise<HubSpaceDevice[]> {
  const token = await hubspaceLogin(username, password)
  const accountId = await getAccountId(token.access_token)

  const res = await fetch(`${API_BASE}/accounts/${accountId}/devices?expansions=state,attributes`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to list devices: ${res.status} - ${text}`)
  }

  const rawDevices: AferoDeviceRaw[] = await res.json()
  console.log(`[HubSpace] Found ${rawDevices.length} raw devices`)

  return rawDevices
    .filter(d => d.friendlyName && d.friendlyName.trim() !== '' && !d.virtual)
    .map(d => parseDevice(d))
}

/**
 * Control a HubSpace device (on/off) via /actions endpoint
 * Sends attribute_write action for attrId 2 (power)
 */
export async function hubspaceControlDevice(
  username: string,
  password: string,
  deviceId: string,
  action: 'on' | 'off' | 'toggle',
  currentState?: boolean
): Promise<{ success: boolean; newState: boolean }> {
  const token = await hubspaceLogin(username, password)
  const accountId = await getAccountId(token.access_token)

  let targetState: boolean
  if (action === 'toggle') {
    if (currentState === undefined) {
      // Read current state first
      const dev = await fetchSingleDevice(token.access_token, accountId, deviceId)
      const powerAttr = dev?.attributes?.find((a: AferoAttribute) => a.id === ATTR_POWER)
      const isCurrentlyOn = powerAttr?.data === '01'
      targetState = !isCurrentlyOn
    } else {
      targetState = !currentState
    }
  } else {
    targetState = action === 'on'
  }

  const actionPayload = {
    type: 'attribute_write',
    attrId: ATTR_POWER,
    data: targetState ? '01' : '00',
  }

  const res = await fetch(`${API_BASE}/accounts/${accountId}/devices/${deviceId}/actions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(actionPayload),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[HubSpace] Control failed:', res.status, text)
    throw new Error(`HubSpace control failed: ${res.status}`)
  }

  const result = await res.json()
  console.log(`[HubSpace] Device ${deviceId} → ${targetState ? 'ON' : 'OFF'} (requestId: ${result.requestId})`)
  return { success: true, newState: targetState }
}

/**
 * Get current state of a HubSpace device
 */
export async function hubspaceGetDeviceState(
  username: string,
  password: string,
  deviceId: string
): Promise<{ isOn: boolean; online: boolean; attributes: Record<string, unknown> }> {
  const token = await hubspaceLogin(username, password)
  const accountId = await getAccountId(token.access_token)
  const dev = await fetchSingleDevice(token.access_token, accountId, deviceId)

  const powerAttr = dev.attributes?.find((a: AferoAttribute) => a.id === ATTR_POWER)
  const isOn = powerAttr?.data === '01'
  const online = dev.deviceState?.available === true || dev.deviceState?.direct === true

  const attrs: Record<string, unknown> = {}
  if (dev.attributes) {
    for (const a of dev.attributes) {
      attrs[`attr_${a.id}`] = a.value ?? a.data
    }
  }

  return { isOn, online, attributes: attrs }
}

/**
 * Fetch a single device with attributes
 */
async function fetchSingleDevice(accessToken: string, accountId: string, deviceId: string): Promise<AferoDeviceRaw> {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/devices/${deviceId}?expansions=state,attributes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to get device: ${res.status}`)
  return res.json()
}

/**
 * Parse raw Afero device into our HubSpaceDevice format
 */
function parseDevice(d: AferoDeviceRaw): HubSpaceDevice {
  const attrs = d.attributes || []
  const powerAttr = attrs.find(a => a.id === ATTR_POWER)
  const isOn = powerAttr?.data === '01'
  const online = d.deviceState?.available === true || d.deviceState?.direct === true

  // Determine type — most HubSpace devices from Defiant are outlets/plugs
  // Could extend later with profileId mapping
  let type: HubSpaceDevice['type'] = 'outlet'

  // If device has many attributes beyond basic power, might be light/fan
  const hasHighAttrs = attrs.some(a => a.id >= 100 && a.id < 200) // brightness range
  if (hasHighAttrs) type = 'light'

  const attrMap: Record<string, unknown> = {}
  for (const a of attrs) {
    attrMap[`attr_${a.id}`] = a.value ?? a.data
  }

  return {
    id: d.deviceId,
    deviceId: d.deviceId,
    name: d.friendlyName || d.description || 'HubSpace Device',
    type,
    isOn,
    online,
    attributes: attrMap,
  }
}

/**
 * Invalidate cached token (e.g., when credentials change)
 */
export function hubspaceInvalidateToken(username: string) {
  tokenCache.delete(username.toLowerCase())
}
