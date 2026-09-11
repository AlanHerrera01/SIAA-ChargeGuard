# Guía de pruebas para el equipo — antes de grabar el video

Todo está desplegado y funcionando en AWS. Esta guía es para que cada uno pruebe el sistema completo **antes** de la grabación, sin romper el caso preparado.

Última verificación end-to-end: **9 de septiembre de 2026**.

---

## ⚠️ Lee esto primero

Hay **un caso ya preparado** en producción, listo para el video:

```
case_ef61fe39 · Spotify · cobro duplicado de $10.99 · contraoferta de $6.59
Estado: awaiting_human  (esperando la decisión humana)
```

**No aprees ni rechaces esa oferta si solo estás probando.** Ese clic es el clímax del video: si lo consumes antes, hay que regenerar el caso. Al final de esta guía está el comando para volver a armarlo.

---

## Acceso

**No hace falta cuenta, contraseña ni login.** El demo es público.

| Qué | Dónde |
|---|---|
| Aplicación web | https://main.d24otvpswldjmf.amplifyapp.com |
| API del backend | `https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com` |
| Usuario del demo | `usr_demo` (precargado, no se escribe en ningún lado) |

Los datos son **100% sintéticos**: ningún dato real de personas, bancos ni comercios.

---

## Qué deberías ver (checklist de prueba)

### 1. Dashboard

Abre https://main.d24otvpswldjmf.amplifyapp.com

- [ ] Carga en menos de 2 segundos
- [ ] Aparece una **tarjeta ámbar** con el badge *"Requiere acción"*
- [ ] Dice **"Spotify espera decisión"** y muestra la oferta de **$6.59**
- [ ] Hay un botón **"Abrir disputa"**

Si la tarjeta ámbar no aparece, el caso fue consumido. Ve a *Cómo volver a armar el demo* al final.

### 2. Suscripciones

Ve a la pestaña **Subscriptions**. Deberías ver las 6 suscripciones reales del dataset:

| Suscripción | Plan | Monto | Estado |
|---|---|---|---|
| Netflix | Standard | $15.49 | activa |
| Dropbox | Plus | $11.99 | activa |
| Spotify | Premium | $10.99 | activa |
| Notion | Plus | $12.00 | activa |
| FitLife Gym | Monthly Access | $39.99 | **cancelada** |
| SafeVault | Personal | $2.99 | activa |

- [ ] Aparecen las 6, con esos montos exactos

### 3. Timeline del caso

Haz clic en **"Abrir disputa"** desde el dashboard.

- [ ] Se ve el recorrido completo que hizo el agente, en orden:
  1. **Anomalía detectada** — cobro duplicado el 2026-09-03
  2. **Evidencias reunidas** — facturas `inv_0034.pdf` e `inv_0035.pdf`
  3. **Disputa presentada** — carta redactada al soporte de Spotify
  4. **Respuesta del comercio** — contraoferta de $6.59

### 4. Decision Card (lo más importante del proyecto)

En la vista del caso:

- [ ] Aparece la tarjeta de decisión con la recomendación del agente
- [ ] Botón verde: **Aceptar oferta ($6.59)**
- [ ] Botón secundario: **Rechazar y exigir reembolso total ($10.99)**

**Aquí es donde el agente se detiene.** Es el punto que diferencia el proyecto: el agente investiga, negocia y prepara todo solo, pero **nunca acepta ni rechaza dinero sin autorización humana**.

Si vas a probar el clic, hazlo — pero después **vuelve a armar el demo** (abajo).

---

## Probar el flujo completo desde cero

Si quieres ver al agente trabajando en vivo (detección → evidencias → disputa → negociación), esto genera **un caso nuevo** sin tocar el preparado:

```bash
API=https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com

# Netflix: subida de precio silenciosa de $15.49 a $19.99
curl -X POST $API/cases/analyze \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"txn_0031"}'
```

Tarda unos **20-25 segundos**: son 4 agentes llamando a Claude en Bedrock, más la negociación con el comercio. Es normal, no está colgado.

Las tres anomalías sembradas en el dataset:

| Transacción | Anomalía | Historia |
|---|---|---|
| `txn_0031` | Subida de precio | Netflix pasa de $15.49 a $19.99 **sin avisar por correo** |
| `txn_0035` | Cobro duplicado | Spotify cobra $10.99 dos veces con 8 minutos de diferencia |
| `txn_0032` | Cobro tras cancelar | FitLife cobra $39.99 seis días después de la cancelación |

> **Ojo con FitLife:** ese comercio está configurado para **negar** el reclamo si rechazas su contraoferta. No es un error, es a propósito: demuestra que el agente no siempre gana.

---

## Cómo volver a armar el demo

Si consumiste el caso o quieres empezar limpio:

```bash
API=https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com

# 1. Calentar la Lambda — OBLIGATORIO, no opcional
curl -s $API/health > /dev/null
curl -s $API/health > /dev/null

# 2. Generar el caso de Spotify
curl -X POST $API/cases/analyze \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"txn_0035"}'

# 3. Recargar el dashboard: debe salir la tarjeta ámbar con $6.59
```

**El paso 1 no es opcional.** Si la Lambda está fría, el arranque suma ~3 segundos al pipeline y puede acercarse al límite de 30 segundos de API Gateway. Con la Lambda caliente el flujo tarda ~22 s y sobra margen.

---

## Probarlo en tu máquina (opcional)

```bash
git clone https://github.com/AlanHerrera01/SIAA-ChargeGuard.git
cd SIAA-ChargeGuard
cp .env.example .env
docker compose --profile app up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| Mock Bank | http://localhost:8001 |
| Mock Merchant | http://localhost:8002 |

Para el backend necesitas credenciales de AWS con acceso a Bedrock en tu `.env`. Si solo quieres ver la interfaz, el frontend funciona sin eso.

---

## Si algo falla

| Síntoma | Qué significa | Qué hacer |
|---|---|---|
| El dashboard carga pero sin tarjeta ámbar | El caso fue consumido | Volver a armar el demo (arriba) |
| `curl` devuelve 504 o se queda colgado | La Lambda estaba fría y superó los 30 s | **No repitas el comando de inmediato:** el caso probablemente sí se creó. Recarga el dashboard primero |
| Cualquier endpoint devuelve 5xx | Fallo real | Avisar a Ismael con la URL y la hora exacta |
| El sitio no carga | Amplify caído | `docs/runbook.md` tiene el plan de contingencia |

El procedimiento completo de emergencia para el día del video está en [`runbook.md`](./runbook.md), con la jerarquía de respaldos: **AWS real → Docker local → video pregrabado**.

---

## Antes de grabar

- [ ] Todos probaron el flujo y vieron la Decision Card
- [ ] El caso `case_ef61fe39` está armado en `awaiting_human`
- [ ] La Lambda está caliente (2 × `/health` justo antes)
- [ ] El guion está a mano: [`demo-script.md`](./demo-script.md)
- [ ] Pestañas abiertas y limpias, sin sesiones de prueba a medias
