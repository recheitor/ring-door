# ring-door

Abrir el Ring Intercom desde el Apple Watch, y abrir al detectar dos timbrazos seguidos.

Son dos componentes independientes. No comparten código ni estado: solo las mismas
credenciales de Ring.

## Estado

| Componente | Estado |
|---|---|
| `watch-unlock` | **Desplegado** en https://watch-unlock.vercel.app/api/unlock — responde `200 {"ok":true}` |
| El atajo del reloj | Pendiente: [guía](deploy/ATAJO-APPLE-WATCH.md) (2 min en el iPhone) |
| `double-ring` | Código listo y probado contra Ring. Pendiente de máquina 24/7: [guía](deploy/ORACLE.md) |

Queda por confirmar si el portal es de tipo *ring-to-open* (ver **Avisos** al final):
el endpoint responde `ok`, pero falta comprobar en persona que la puerta abre sin que
nadie haya llamado antes.

| Carpeta | Qué hace | Dónde corre |
|---|---|---|
| `watch-unlock/` | Endpoint `POST /api/unlock` que abre la puerta | Vercel (serverless) |
| `double-ring/` | Abre la puerta al recibir 2 timbrazos en < 30 s | Máquina encendida 24/7 |
| `deploy/` | `cloud-init` para arrancar una VM de Oracle Always Free | — |

**`double-ring` no puede ir en Vercel ni Netlify.** Necesita un proceso permanentemente
conectado a Ring para recibir los eventos de "ding" por push, y las plataformas
serverless se apagan cuando no hay tráfico. Solo hace conexiones salientes, así que la
máquina no necesita URL pública, puertos abiertos ni túnel.

## Variables de entorno

| Variable | Usada por | Qué es |
|---|---|---|
| `RING_REFRESH_TOKEN` | ambos | Token de la cuenta Ring. Se genera una vez (ver abajo). |
| `UNLOCK_SECRET` | `watch-unlock` | Secreto que protege el endpoint. Largo y aleatorio. |
| `PRESSES` | `double-ring` | Nº de timbrazos para abrir. Por defecto `2`. |
| `WINDOW_MS` | `double-ring` | Ventana en ms. Por defecto `30000`. |
| `TOKEN_FILE` | `double-ring` | Dónde persistir el token rotado. Por defecto `/data/refresh-token`. |

El `RING_REFRESH_TOKEN` da acceso a la cuenta de Ring. Vive solo en las variables de
entorno de Vercel y en el `.env` del worker, que está en `.gitignore`. Nunca en el repo.

### Generar el token de Ring

En cualquier equipo con Node 20 o superior:

```bash
npx -p ring-client-api ring-auth-cli
```

Pide email, contraseña y el código 2FA, y devuelve un `refreshToken` largo.

Ring rota este token con el tiempo. El worker lo persiste automáticamente en
`TOKEN_FILE` cuando eso ocurre. `watch-unlock` no puede persistirlo (Vercel tiene el
sistema de archivos en solo lectura), así que si un día el endpoint empieza a dar 500,
regenera el token y actualiza la variable en Vercel.

## `watch-unlock` — desplegar en Vercel

Desde `watch-unlock/`, con las dos variables ya en el entorno del shell:

```bash
vercel link --yes
printf '%s' "$RING_REFRESH_TOKEN" | vercel env add RING_REFRESH_TOKEN production
printf '%s' "$UNLOCK_SECRET"      | vercel env add UNLOCK_SECRET production
vercel --prod --yes
```

Probar:

```bash
curl -X POST https://<proyecto>.vercel.app/api/unlock \
  -H "x-unlock-token: $UNLOCK_SECRET" -i
# 200 {"ok":true}
```

### El atajo del Apple Watch

**Guía completa: [`deploy/ATAJO-APPLE-WATCH.md`](deploy/ATAJO-APPLE-WATCH.md).**

No hace falta ninguna app ni Xcode. En el iPhone, app **Atajos** → **+** → acción
**Obtener contenido de la URL**, con la URL del endpoint, **Mostrar más** → Método
**POST**, y una cabecera `x-unlock-token` con el `UNLOCK_SECRET`.

El secreto va en la cabecera, nunca en la URL. El atajo aparece solo en la app Atajos
del Apple Watch; para un toque desde la esfera, añade la complicación "Atajos".

## `double-ring` — arrancar en una máquina 24/7

Sirve cualquier caja encendida: una VM de Oracle Always Free, una Raspberry Pi, un
mini-PC, o un Android viejo con Termux.

```bash
git clone https://github.com/recheitor/ring-door.git
cd ring-door/double-ring
cp .env.example .env
$EDITOR .env          # pega el RING_REFRESH_TOKEN
docker compose up -d
docker compose logs -f   # debe decir: Escuchando "..."
```

Sin Docker: `npm install && TOKEN_FILE=./refresh-token node worker.mjs`. Ojo con el
`TOKEN_FILE`: por defecto apunta a `/data/refresh-token`, que existe dentro del
contenedor pero probablemente no en la máquina.

### Oracle Always Free

**Guía completa paso a paso: [`deploy/ORACLE.md`](deploy/ORACLE.md).**

En corto: creas una VM Ubuntu con forma ARM Ampere A1, pegas
[`deploy/oracle-cloud-init.yaml`](deploy/oracle-cloud-init.yaml) en el campo
*cloud-init script*, y al arrancar entras por SSH y ejecutas `ring-setup`. Ese comando
pide el token, lo guarda y deja el contenedor corriendo.

Oracle reclama instancias inactivas, pero esta no lo está: mantiene una conexión viva
con Ring. No hace falta abrir ningún puerto de entrada.

## Avisos

- **Doble timbrazo significa que cualquiera que llame dos veces entra.** Si eso te
  preocupa, sube `PRESSES` a 3 o baja `WINDOW_MS` a 10000 para exigir un patrón más
  difícil de acertar por casualidad.
- Esto usa la **API no oficial de Ring** (`ring-client-api`, la misma que la app).
  Ring no la soporta y puede romperla en cualquier momento.
- **Porteros "ring-to-open":** en algunos edificios el desbloqueo remoto solo funciona
  justo después de que alguien llame. Si el endpoint responde `ok` pero la puerta no
  abre sin un timbrazo previo, el tuyo es de ese tipo: hay que pedir a soporte de Ring
  que marquen el dispositivo como *ring-to-open*. Al doble timbrazo no le afecta,
  porque ahí la llamada ya ha ocurrido.
