# Infraestructura y DevOps — guía de referencia (Ismael)

Mapa de todo lo construido en el track de infraestructura: dónde vive cada cosa en el repo, dónde verla en la consola de AWS, y los problemas difíciles que hubo que resolver.

Región: **us-east-1**. Todo el gasto verificado a la fecha: **prácticamente $0**.

Para obtener el ID de cuenta cuando lo necesites: `aws sts get-caller-identity --query Account --output text`

---

## 1. Qué se construyó

Nueve paquetes de trabajo, del 4 al 9 de septiembre:

| WP | Entrega | Dónde vive |
|---|---|---|
| 0 | Verificación de acceso a Bedrock y selección de modelo | `docs/execution-plan-infra.md` |
| 1 | Entorno local con Docker Compose + LocalStack | `docker-compose.yml`, `Makefile` |
| 2 | Datasets sintéticos deterministas | `datasets/` |
| 3 | Mock Banking API | `mock-services/bank/` |
| 4 | Mock Merchant Support API | `mock-services/merchant/` |
| 5 | Aprovisionamiento y carga de datos | `scripts/seed_local.py`, `scripts/demo_reset.py` |
| 6 | Infraestructura como código | `infrastructure/` |
| 7 | CI/CD con OIDC | `.github/workflows/` |
| 8 | Despliegue real en AWS y observabilidad | `docs/deployment.md` |
| 9 | Diagrama, runbook, guion y cierre | `docs/` |

El contrato que usan los demás tracks para programar contra tu infraestructura está en [`contracts.md`](./contracts.md).

---

## 2. Dónde ver cada cosa en la consola de AWS

Entra a la consola con la región **N. Virginia (us-east-1)** seleccionada.

### Cómputo

**Lambda** → [consola](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions)

| Función | Memoria | Timeout | Qué hace |
|---|---|---|---|
| `chargeguard-backend` | 1024 MB | 60 s | API FastAPI + los 4 agentes Strands. Usa Mangum como adaptador ASGI |
| `chargeguard-mock-bank` | 256 MB | 60 s | Feed sintético de transacciones (solo lectura) |
| `chargeguard-mock-merchant` | 256 MB | 30 s | Motor de disputas con estado en DynamoDB |

> El backend tiene 1024 MB porque en Lambda la CPU escala con la memoria: más memoria = arranque más rápido al importar el SDK de Strands. Usa ~163 MB de RAM real.

**API Gateway** → [consola](https://us-east-1.console.aws.amazon.com/apigateway/main/apis?region=us-east-1)

API `chargeguard-api` (HTTP API v2, ID `6zx34nx8v7`). Rutas: `/cases/*`, `/subscriptions`, `/transactions/*`, `/decisions/{id}/resolve`, `/mock/bank/*`, `/mock/merchant/*`.

### Datos

**DynamoDB** → [tablas](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#tables)

| Tabla | Clave | Índices | Contenido |
|---|---|---|---|
| `chargeguard-transactions` | `user_id` + `sk` | `merchant-index` | Las 37 transacciones sintéticas |
| `chargeguard-cases` | `case_id` | `user-index`, `status-index` | Casos de disputa |
| `chargeguard-decisions` | `decision_id` | `case-index`, `pending-index` | Decisiones, eventos y disputas del comercio |

Todas en **PAY_PER_REQUEST**: cuestan $0 cuando nadie las usa.

**S3** → [buckets](https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1)

- `chargeguard-evidence-<ACCOUNT_ID>` — 58 objetos: `invoices/` (37 PDFs), `emails/` (15 EML), `terms/` (6 PDFs). Cifrado SSE-S3, acceso público bloqueado en los cuatro flags, expiración a 30 días.
- `chargeguard-tfstate-<ACCOUNT_ID>` — estado remoto de Terraform, versionado y cifrado.

### Frontend

**Amplify** → [consola](https://us-east-1.console.aws.amazon.com/amplify/home?region=us-east-1#/)

App `chargeguard-frontend` (ID `d24otvpswldjmf`), rama `main`.
URL pública: https://main.d24otvpswldjmf.amplifyapp.com

> Amplify **no** está conectado al repositorio de GitHub (`repository: null`, `autoBuild: false`). Se despliega subiendo el artefacto ya compilado con `scripts/deploy_amplify.py`. Fue una decisión deliberada: ver la sección 4.

### Observabilidad y costos

**CloudWatch Dashboard** → [ChargeGuard](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ChargeGuard)
Invocaciones, errores y latencia p95 de las tres Lambdas.

**Log groups** → [logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups) — retención de **7 días** en los cuatro (`/aws/lambda/chargeguard-*` y `/aws/bedrock/agentcore/chargeguard`). Sin retención infinita: eso cuesta.

**Budgets** → [consola](https://us-east-1.console.aws.amazon.com/billing/home#/budgets)
`chargeguard-monthly-budget`: tope de **$40/mes**, con alertas por correo al **50%** y **80%** a Ismael y Alan.

### Seguridad

**IAM Roles** → [consola](https://us-east-1.console.aws.amazon.com/iam/home#/roles)

| Rol | Para qué |
|---|---|
| `chargeguard-github-actions-role` | Que GitHub Actions despliegue sin credenciales permanentes (OIDC) |
| `chargeguard-lambda-exec-role` | Permisos de las Lambdas: logs, DynamoDB, S3 y Bedrock |
| `chargeguard-agentcore-role` | Preparado para AgentCore Runtime (ver sección 4) |

**No existe ningún usuario IAM con llaves de larga vida para el despliegue.** Todo pasa por OIDC.

---

## 3. Comandos de verificación rápida

```bash
# ¿Está todo vivo?
API=https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com
curl -s $API/health
curl -s $API/mock/bank/health
curl -s $API/mock/merchant/health

# ¿Cuánto llevamos gastado este mes?
aws ce get-cost-and-usage --time-period Start=2026-09-01,End=2026-09-30 \
  --granularity MONTHLY --metrics UnblendedCost \
  --query 'ResultsByTime[0].Total.UnblendedCost'

# ¿Hay algo que cobre estando quieto? (todo debe dar 0)
aws ec2 describe-nat-gateways --query 'length(NatGateways)'
aws rds describe-db-instances --query 'length(DBInstances)'
aws elbv2 describe-load-balancers --query 'length(LoadBalancers)'

# ¿Cuántos datos hay cargados?
aws dynamodb scan --table-name chargeguard-transactions --select COUNT --query Count
aws s3 ls s3://chargeguard-evidence-<ACCOUNT_ID>/ --recursive --summarize | tail -2

# ¿Consumo de Bedrock? (el único costo variable real)
aws cloudwatch get-metric-statistics --namespace AWS/Bedrock \
  --metric-name Invocations --start-time 2026-09-01T00:00:00Z \
  --end-time 2026-09-30T00:00:00Z --period 2592000 --statistics Sum
```

---

## 4. Los cinco problemas difíciles y cómo se resolvieron

Esto es lo que conviene poder explicar: no *qué* se construyó, sino *qué se rompió y por qué*.

### 4.1 Claude Sonnet 5 no era invocable

El equipo creía que faltaba usar el inference profile con prefijo `us.`. Verificando por CLI resultó que el perfil aparecía como `ACTIVE` en `list-inference-profiles` **y aun así** `converse` devolvía `AccessDeniedException`: aparecer en la lista significa que el perfil existe en la región, no que la cuenta pueda invocarlo. Y el plan B documentado (Sonnet 4) estaba **retirado por legacy**.

**Resultado:** se migró a `us.anthropic.claude-sonnet-4-5-20250929-v1:0`, verificado por CLI antes de escribir una línea de código de agentes.

### 4.2 El estado en memoria habría roto el demo en Lambda

El backend y el mock del comercio guardaban casos y disputas en diccionarios de Python. Funciona perfecto con `uvicorn`, pero en Lambda **cada contenedor tiene su propia memoria**: crear una disputa en un contenedor y consultarla en otro devuelve 404, y los arranques en frío borran todo.

**Resultado:** ambos persisten en DynamoDB (`backend/storage.py` con `DynamoJsonMapping`). Verificado con 15 peticiones en paralelo: **15 de 15 respondieron 200, cero 404**.

### 4.3 El pipeline rozaba el límite de API Gateway

El flujo completo de agentes tardaba **27.6 s** contra el límite **duro de 30 s** de API Gateway. Margen: 2.4 segundos. Con un arranque en frío (+3 s) lo superaba — y ya se capturó una corrida de 31.9 s.

**Resultado:** tres medidas. Los sub-agentes mecánicos (evidencias y redacción) pasaron a **Claude Haiku 4.5**, que medí ~2× más rápido; se eliminaron los retardos artificiales del comercio vía `MERCHANT_DEMO_SPEED`; y el calentamiento de la Lambda se volvió **obligatorio** en el runbook. Resultado: **22.5 s**, con 7.5 s de margen. La calidad de salida se verificó intacta antes de dar el cambio por bueno.

### 4.4 El CI/CD nunca funcionó, y el motivo no era el evidente

`deploy-app.yml` falló 3 de 3 veces con *"Not authorized to perform sts:AssumeRoleWithWebIdentity"*. Todo lo obvio estaba correcto: nombre del repo, audiencia, proveedor OIDC, ARN del rol, permisos `id-token: write`, sin SCPs.

La respuesta estaba en **CloudTrail**, que registra el `sub` real que envía GitHub:

```
GitHub envía:   repo:AlanHerrera01@107574787/SIAA-ChargeGuard@1356601608:ref:refs/heads/main
El rol esperaba: repo:AlanHerrera01/SIAA-ChargeGuard:*
```

GitHub usa **immutable subject claims**: inserta los IDs numéricos de dueño y repositorio, un formato que se activa típicamente **tras renombrar un repositorio** — que es justo lo que pasó con SIA → SIAA.

**Resultado:** la política de confianza acepta ambos formatos. `RoleLastUsed` pasó de `None` a una fecha real: el rol se asumió por primera vez y el deploy corrió en verde.

### 4.5 AgentCore Runtime: decisión consciente, no omisión

La API de control plane **sí** responde en la cuenta (`list-agent-runtimes` devuelve `200 OK`). Lo que no existe son recursos nativos en el provider `hashicorp/aws`, así que adoptarlo obligaba a provisionar por CLI, fuera de Terraform, rompiendo el principio de 100% IaC.

**Resultado:** el sistema multi-agente corre dentro de la Lambda del backend, y la decisión está documentada en el `README.md` **con la razón real**. El rol de ejecución y el log group quedaron creados por si se retoma.

> Si un juez pregunta por AgentCore, esta es la respuesta honesta y verificable. No decir que "no estaba disponible": está, y se puede comprobar en un comando.

---

## 5. Decisiones de arquitectura que conviene poder defender

| Decisión | Por qué |
|---|---|
| **Todo serverless y on-demand** | Cero costo cuando nadie usa el sistema. Sin NAT Gateways, sin RDS, sin EC2 — nada que cobre estando quieto |
| **Datasets deterministas con semilla fija** | El mismo `--seed 42` produce archivos byte a byte idénticos, PDFs incluidos. Un demo reproducible no puede depender del azar |
| **La verdad de las anomalías en archivo aparte** | `ground_truth.json` no lo sirve ninguna API. Si la etiqueta viajara dentro de la transacción, el agente no detectaría nada: la leería |
| **`extra="forbid"` en los modelos Pydantic de los mocks** | Si alguien mete un campo de anomalía al dataset, la API **falla al arrancar** en vez de filtrarlo en silencio. Defensa estructural, no una promesa |
| **Máquina de estados del comercio calculada desde `created_at`** | Sin workers en segundo plano: el mismo registro y el mismo instante producen siempre la misma línea de tiempo. Verificado con 30 consultas seguidas |
| **OIDC en vez de llaves de AWS en GitHub** | Cero secretos de larga vida en el repositorio o en los secrets de GitHub |
| **Amplify desconectado de GitHub** | Conectarlo exige un token con permisos de admin **sobre el repositorio**, que es de Alan. Desplegar el artefacto por CLI usa el rol OIDC que ya existe y evita que un token personal quede en texto plano dentro del estado de Terraform |

---

## 6. Guía de emergencia

Si algo falla durante la demo, el procedimiento está en [`runbook.md`](./runbook.md): jerarquía de respaldos **AWS real → Docker Compose local → video pregrabado**, con comandos de diagnóstico.

Los dos síntomas más probables:

- **HTTP 504 o cuelgue**: la Lambda estaba fría y superó los 30 s. **El caso probablemente sí se creó** — recarga el dashboard antes de reintentar, o vas a generar casos duplicados.
- **Sin tarjeta ámbar**: el caso fue consumido. Regenerarlo está en [`guia-pruebas-equipo.md`](./guia-pruebas-equipo.md).

---

## 7. Cómo destruir todo cuando termine el hackathon

```bash
cd infrastructure
terraform destroy
```

Los buckets tienen `force_destroy` y las tablas no tienen protección de borrado: el stack se elimina limpio. El bucket del estado de Terraform y su tabla de locks viven en `infrastructure/bootstrap/` y se destruyen aparte, al final.

El procedimiento completo está en [`deployment.md`](./deployment.md).
