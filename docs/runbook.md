# ChargeGuard — Live Demo Runbook & Emergency Fallback Procedures

> **Objetivo**: Garantizar que la demostración de ChargeGuard se complete con éxito en cualquier escenario de contingencia ante jueces o en grabación en vivo.

---

## 1. Jerarquía de Fallback (Plan A $\rightarrow$ Plan B $\rightarrow$ Plan C)

```
       ┌────────────────────────────────────────────────────────┐
       │   NIVEL 1: AWS REAL (PRODUCCIÓN EN LA NUBE)            │
       │   Amplify Hosting + API Gateway + Lambda + Bedrock     │
       └───────────────────────────┬────────────────────────────┘
                                   │  ¿Falla de red / AWS outage?
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │   NIVEL 2: DOCKER COMPOSE LOCAL (SELF-CONTAINED)       │
       │   LocalStack + Mocks + Backend + Frontend en localhost  │
       └───────────────────────────┬────────────────────────────┘
                                   │  ¿Falla de máquina local?
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │   NIVEL 3: VIDEO DEMO PREGRABADO (HD 1080p)            │
       │   Grabación completa de 5 minutos con audio sincronizado│
       └────────────────────────────────────────────────────────┘
```

---

## 2. Nivel 1: Procedimiento Estándar en AWS Real

### Endpoints Oficiales
- **Frontend**: `https://main.d24otvpswldjmf.amplifyapp.com`
- **API Gateway**: `https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com`
- **CloudWatch Dashboard**: AWS Console $\rightarrow$ CloudWatch $\rightarrow$ Dashboards $\rightarrow$ `ChargeGuard`

### Comprobación Pre-Demo (Healthcheck de 10 Segundos)
Ejecutar en terminal antes de presentar:
```bash
# 1. Verificar API Gateway Backend
curl -sI https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/health | grep -E "HTTP|200"

# 2. Verificar Mock Bank
curl -sI https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/bank/health | grep -E "HTTP|200"

# 3. Verificar Mock Merchant
curl -sI https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/merchant/health | grep -E "HTTP|200"
```
Si los tres responden `200 OK`, el stack en AWS está listo.

### Reset Rápido de Datos en AWS (Para repetir la demo)
Si ya se corrió una prueba y se necesita el estado inicial limpio:
```bash
python -c "
import urllib.request
for path in ['/mock/bank/demo/reset', '/mock/merchant/demo/reset']:
    req = urllib.request.Request('https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com' + path, method='POST')
    with urllib.request.urlopen(req) as resp:
        print(path, resp.status)
"
```

---

## 3. Matriz de Síntomas y Recuperación Rápida en AWS

| Síntoma Observado | Causa Probable | Acción de Recuperación Inmediata |
|---|---|---|
| **Pantalla en blanco o 404 al recargar ruta interna (`/disputes`)** | Falla de redirección SPA en CloudFront | Presionar `Ctrl + F5` en el navegador. La regla SPA de Amplify redirige a `/index.html`. Si persiste, navegar directamente a la raíz `https://main.d24otvpswldjmf.amplifyapp.com/`. |
| **Timeout (> 25 segundos) al simular la anomalía** | Cold start extremo de Lambda + Bedrock | La primera invocación de Lambda puede demorar ~8 segundos. Si la llamada excede el timeout de API Gateway (29s), disparar la petición una segunda vez: el contenedor ya estará caliente y responderá en < 6 segundos. |
| **Error 500 en `/transactions/webhook` o `/cases`** | Error no controlado en la Lambda | Consultar los logs en tiempo real vía AWS CLI:<br>`aws logs tail /aws/lambda/chargeguard-backend --since 2m --format short`<br>Si persiste más de 30 segundos, pasar de inmediato al **Nivel 2 (Local)**. |
| **Bedrock `ThrottlingException` o `AccessDeniedException`** | Límite de cuota o problema en credenciales | Cambiar inmediatamente al Nivel 2 en modo mock (`VITE_CHARGEGUARD_DATA_SOURCE=mock`) para mantener la interactividad visual sin dependencia de LLM remoto. |

---

## 4. Nivel 2: Conmutación a Docker Compose Local

Si la nube de AWS presenta latencia o caída de conectividad, conmutar al stack local en menos de 60 segundos:

### Paso 1: Levantar los contenedores locales
```bash
# Desde la raíz del repositorio:
make up-all

# Poblar tablas e imágenes de prueba en LocalStack:
make seed
```

### Paso 2: Abrir la interfaz local
1. Abrir navegador en: `http://localhost:5173`
2. El frontend correrá contra el backend local en el puerto `8000`.
3. Probar el flujo completo de simulación y resolución de la Decision Card.

### Modo Fallback de Emergencia Sin Backend (`mock` puro)
Si por cualquier motivo Docker no responde:
```bash
cd frontend
npm run dev
# Y abrir http://localhost:5173 con VITE_CHARGEGUARD_DATA_SOURCE=mock
```
La aplicación correrá de forma 100% autónoma en el navegador utilizando los datos sintéticos de [`chargeguardData.ts`](../frontend/src/mocks/chargeguardData.ts), permitiendo interactuar con todas las pantallas y la Decision Card.

---

## 5. Nivel 3: Conmutación al Video Pregrabado

Si ocurre una catástrofe total (corte de energía, fallo de hardware):
1. Abrir el archivo de video local de respaldo: `docs/demo-video-backup-1080p.mp4` (o enlace en YouTube privado/no listado).
2. Compartir pantalla reproduciendo el video en HD con el guion hablado en vivo siguiendo [`docs/demo-script.md`](./demo-script.md).
3. Explicar a los jueces la arquitectura y la contingencia: la reproducibilidad del código puede auditarse directamente clonando el repositorio.
