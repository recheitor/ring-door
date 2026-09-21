import { RingApi } from 'ring-client-api'
import { timingSafeEqual } from 'node:crypto'

// Cache a nivel de módulo: reutiliza la conexión entre invocaciones "calientes"
let cached

async function getIntercom() {
  if (!cached) {
    cached = (async () => {
      const api = new RingApi({ refreshToken: process.env.RING_REFRESH_TOKEN })
      const locations = await api.getLocations()
      const location = locations.find((l) => l.intercoms.length)
      if (!location) {
        api.disconnect()
        throw new Error('No se encontró ningún Ring Intercom en la cuenta')
      }
      return { api, intercom: location.intercoms[0] }
    })()
  }
  return cached
}

function secretMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!process.env.UNLOCK_SECRET || !process.env.RING_REFRESH_TOKEN) {
    return res.status(500).json({ error: 'server_not_configured' })
  }
  if (!secretMatches(req.headers['x-unlock-token'], process.env.UNLOCK_SECRET)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  try {
    const { intercom } = await getIntercom()
    await intercom.unlock()
    return res.status(200).json({ ok: true })
  } catch (err) {
    cached = undefined // fuerza reconexión en el siguiente intento
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
