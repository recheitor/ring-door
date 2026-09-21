import { RingApi } from 'ring-client-api'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const TOKEN_FILE = process.env.TOKEN_FILE || '/data/refresh-token'
const WINDOW_MS = Number(process.env.WINDOW_MS ?? 30_000) // ventana: 30 s
const PRESSES = Number(process.env.PRESSES ?? 2) // nº de timbrazos

// Usa el token persistido si existe (Ring rota el token con el tiempo)
const refreshToken = existsSync(TOKEN_FILE)
  ? readFileSync(TOKEN_FILE, 'utf8').trim()
  : process.env.RING_REFRESH_TOKEN

if (!refreshToken) {
  console.error('Falta RING_REFRESH_TOKEN')
  process.exit(1)
}

const api = new RingApi({ refreshToken })

// Persiste el nuevo token cuando Ring lo rota, para no perder el acceso
api.onRefreshTokenUpdated.subscribe(({ newRefreshToken }) => {
  try {
    writeFileSync(TOKEN_FILE, newRefreshToken)
    console.log('Token de Ring actualizado y guardado')
  } catch (e) {
    console.error('No se pudo guardar el token:', e)
  }
})

const locations = await api.getLocations()
const location = locations.find((l) => l.intercoms.length)
if (!location) {
  console.error('No se encontró ningún Ring Intercom en la cuenta')
  process.exit(1)
}
const intercom = location.intercoms[0]
console.log(
  `Escuchando "${intercom.name}". Abrir con ${PRESSES} timbrazos en ${WINDOW_MS / 1000}s.`,
)

let presses = []
intercom.onDing.subscribe(() => {
  const now = Date.now()
  presses = presses.filter((t) => now - t < WINDOW_MS)
  presses.push(now)
  console.log(`ding (${presses.length}/${PRESSES})`)
  if (presses.length >= PRESSES) {
    presses = []
    intercom
      .unlock()
      .then(() => console.log('✅ Puerta abierta (doble timbrazo)'))
      .catch((e) => console.error('Error al abrir:', e))
  }
})

// Cierre limpio: libera la conexión con Ring al parar el contenedor
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\nRecibido ${signal}, cerrando...`)
    api.disconnect()
    process.exit(0)
  })
}

// Mantener el proceso vivo
process.stdin.resume()
