# El atajo del Apple Watch

Dos minutos en el iPhone. No hace falta ninguna app, ni Xcode, ni cuenta de
desarrollador. Se sincroniza solo al reloj.

## Datos que vas a necesitar

| Campo | Valor |
|---|---|
| URL | `https://watch-unlock.vercel.app/api/unlock` |
| Método | `POST` |
| Cabecera — clave | `x-unlock-token` |
| Cabecera — valor | tu `UNLOCK_SECRET` |

## Pasos

1. iPhone → app **Atajos** → **+** (arriba a la derecha).
2. **Añadir acción** → busca **"Obtener contenido de la URL"** y selecciónala.
3. Pega la **URL** en el campo de texto.
4. Toca **▸ Mostrar más** para desplegar las opciones.
5. **Método:** cámbialo de `GET` a **`POST`**.
6. **Cabeceras** → **Añadir nueva cabecera**:
   - Campo izquierdo (clave): `x-unlock-token`
   - Campo derecho (valor): el secreto
7. *(Opcional pero recomendable)* Añade debajo la acción **"Mostrar notificación"**
   para que el reloj te confirme con un `{"ok":true}` que la orden salió.
8. Arriba, toca el nombre del atajo y llámalo **"Abrir portal"**. **Listo**.

El secreto va en la **cabecera**, nunca en la URL. Una URL puede acabar en historiales
y registros; una cabecera, no.

## Usarlo desde el reloj

- **App Atajos del reloj:** aparece solo, sin hacer nada. Puede tardar un minuto en
  sincronizar.
- **Desde la esfera (un toque):** edita la esfera → añade la complicación **Atajos** →
  elige "Abrir portal".
- **Con la voz:** *"Oye Siri, abrir portal"*.

## Si no funciona

| Qué ves | Qué pasa |
|---|---|
| `forbidden` | El secreto no coincide. Revisa que no se haya colado un espacio al pegarlo. |
| `method_not_allowed` | Se quedó en `GET`. Vuelve al paso 5. |
| Un error 500 | El token de Ring caducó. Hay que regenerarlo (ver el README). |
| `{"ok":true}` pero la puerta no abre | Tu portero es "ring-to-open": ver el README. |
