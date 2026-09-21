# Levantar el doble timbrazo en Oracle Always Free

Unos 15 minutos, casi todo esperando. Al final tendrás una VM gratuita y permanente
que abre la puerta cuando alguien llama dos veces.

## 1. Crear la cuenta

https://www.oracle.com/cloud/free/

Pide una **tarjeta de crédito como verificación de identidad**. No cobra nada mientras
te quedes en los recursos "Always Free", y estos no se salen. Al terminar el registro,
la cuenta entra en un periodo de prueba de 30 días con crédito; cuando expira, los
recursos Always Free **siguen funcionando** gratis. Elige como región una cercana
(Madrid, París, Fráncfort) — no se puede cambiar después.

## 2. Crear la instancia

Menú ☰ → **Compute** → **Instances** → **Create instance**.

- **Name:** `ring-door`
- **Image and shape** → **Edit**:
  - **Image:** Canonical Ubuntu (la 22.04 o 24.04, cualquiera vale)
  - **Shape** → **Change shape** → pestaña **Ampere** → `VM.Standard.A1.Flex`
  - Ajusta a **1 OCPU y 6 GB de RAM** (sobra de largo, y cabe en el free tier)
- **Networking:** deja lo que venga por defecto. **No hace falta abrir ningún puerto:**
  el worker solo hace conexiones salientes.
- **Add SSH keys:** elige **Generate a key pair for me** y **descarga la clave privada**.
  Es la única oportunidad de hacerlo; sin ella no podrás entrar.
- **Show advanced options** (abajo del todo) → pestaña **Management** →
  **Cloud-init script**: pega ahí el contenido completo de
  [`oracle-cloud-init.yaml`](oracle-cloud-init.yaml).

**Create.** Tarda un par de minutos en quedar *Running*. Apunta la **Public IP address**.

> **Si sale "Out of host capacity":** las instancias ARM gratuitas se agotan a menudo en
> las regiones populares. No es un error tuyo. Reintenta más tarde, o prueba otro
> *Availability Domain* en el desplegable. Suele entrar a la primera fuera de horas punta.

## 3. Entrar y arrancar

Desde tu Mac, con la clave que descargaste:

```bash
chmod 400 ~/Downloads/ssh-key-*.key          # permisos, si no SSH la rechaza
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP_PUBLICA>
```

El cloud-init tarda ~2 min en terminar tras el primer arranque. Si al entrar el comando
siguiente no existe todavía, espera un poco y reintenta. Luego:

```bash
ring-setup
```

Te pedirá el `RING_REFRESH_TOKEN`, lo guardará, construirá el contenedor y te enseñará
los logs. Cuando veas esto, está funcionando:

```
Escuchando "Entrada principal". Abrir con 2 timbrazos en 30s.
```

`Ctrl-C` sale de los logs sin parar el contenedor. Ya puedes cerrar el SSH: el worker
sigue corriendo, y `restart: unless-stopped` lo levanta solo si la VM se reinicia.

## 4. Comprobarlo

Baja al portal y llama a tu piso **dos veces, con menos de 30 s entre llamada y
llamada**. La puerta debería abrirse a la segunda.

Para mirar qué pasó:

```bash
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<IP_PUBLICA>
cd /opt/ring-door/double-ring && sudo docker compose logs --tail 50
```

Cada timbrazo escribe una línea `ding (1/2)`, `ding (2/2)`, y luego
`✅ Puerta abierta (doble timbrazo)`.

## Mantenimiento

| Qué | Comando (dentro de `/opt/ring-door/double-ring`) |
|---|---|
| Ver logs en vivo | `sudo docker compose logs -f` |
| Parar el doble timbrazo | `sudo docker compose stop` |
| Volver a arrancarlo | `sudo docker compose up -d` |
| Cambiar a 3 timbrazos | añade `PRESSES=3` al `.env` y `sudo docker compose up -d` |
| Actualizar el código | `git pull && sudo docker compose up -d --build` |

El token rotado se guarda en el volumen `ring-data`, así que sobrevive a reinicios y
reconstrucciones del contenedor. No hace falta tocarlo nunca más.

## Si deja de funcionar

Lo más probable es que Ring haya invalidado el token (pasa si cierras sesión en todos
los dispositivos desde la app). Regenera con `npx -p ring-client-api ring-auth-cli`,
y luego en la VM:

```bash
cd /opt/ring-door/double-ring
rm .env && sudo docker compose down -v   # -v borra también el token viejo del volumen
ring-setup                                # pide el token nuevo y arranca
```

Oracle reclama instancias **inactivas**, pero esta no lo está: mantiene una conexión
permanente con Ring y el propio contenedor cuenta como uso. No te la van a quitar.
