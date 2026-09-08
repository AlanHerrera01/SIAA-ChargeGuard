# Infraestructura como Código — ChargeGuard (WP-06)

Infraestructura en AWS gestionada con Terraform para el proyecto **ChargeGuard** (Everyday Agents, AWS Agents for Humans Hackathon 2026).

---

## 1. Estructura del proyecto

```text
infrastructure/
├── bootstrap/                   # Bucket de estado S3 + tabla de lock DynamoDB (backend local)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── versions.tf
│   └── .terraform.lock.hcl
├── modules/
│   ├── dynamodb/                # 3 tablas según contracts.md §4.1 (PAY_PER_REQUEST, deletion_protection false)
│   ├── s3/                      # Bucket chargeguard-evidence-${account_id} (BPA, SSE-S3, 30-day lifecycle)
│   ├── iam/                     # OIDC para GitHub Actions, roles de Lambda y AgentCore (mínimo privilegio)
│   ├── lambda_api/              # Backend Lambda (Zip) + API Gateway HTTP API con CORS
│   ├── eventbridge/             # Bus custom 'chargeguard-bus' + regla transaction.posted -> backend
│   ├── amplify/                 # AWS Amplify Hosting para frontend (Vite build, SPA fallback)
│   └── agentcore/               # Log group dedicado y fallback documentado para AgentCore Runtime
├── main.tf                      # Orquestación de los 7 módulos
├── variables.tf                 # Variables configurables sin defaults sensibles
├── outputs.tf                   # ARNs, nombres de tablas, bucket, roles y endpoint de API Gateway
├── versions.tf                  # Providers aws y archive con versiones pinneadas (~>) y default_tags
├── backend.tf                   # Definición del backend S3 para migración tras el bootstrap
├── backend.hcl.example          # Plantilla para terraform init -backend-config
├── terraform.tfvars.example     # Plantilla de variables
├── .terraform.lock.hcl          # Lockfile de providers versionado
└── README.md                    # Runbook de despliegue y teardown
```

---

## 2. Decisiones de Arquitectura

1. **Empaquetado de Lambda Backend (Zip vs Contenedor):**  
   Se implementó despliegue mediante archivo **Zip** (`archive_file`) con stub de arranque en Python 3.12.  
   *Motivos:*
   - Independencia y portabilidad: No requiere crear previamente un registro ECR ni realizar `docker push` de imágenes para poder ejecutar `terraform plan` o `terraform apply`.
   - Rendimiento y costos: Arranques en frío notablemente más rápidos para arquitecturas FastAPI/Mangum ligeras y costo $0 en reposo.
   - En el pipeline de CI/CD (`deploy-app.yml` en WP-07), el código real de `backend/` se empaquetará y actualizará sobre esta función sin modificar la infraestructura base.

2. **Soporte de AgentCore Runtime:**  
   Conforme a `docs/execution-plan-infra.md §5` y `docs/prompts-executor.md §6`, el runtime nativo de Bedrock AgentCore se encuentra en fase de adopción reciente y el provider `hashicorp/aws` aún no cuenta con recursos nativos para el agente.  
   *Estrategia de Fallback:* El agente se ejecuta en la Lambda del backend utilizando el rol dedicado de mínimo privilegio `chargeguard-agentcore-role` (o `chargeguard-lambda-exec-role`), el cual restringe la invocación al inference profile de Claude Sonnet 4.5 (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`) y Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`).

3. **Mínimo Privilegio en IAM:**  
   - El rol OIDC de GitHub Actions (`chargeguard-github-actions-role`) **no** utiliza `AdministratorAccess`. Sus políticas están acotadas por prefijos de recurso (`chargeguard-*`) para DynamoDB, S3, Lambda, API Gateway, EventBridge, CloudWatch Logs y Amplify.
   - La condición de confianza OIDC está restringida estrictamente a `repo:AlanHerrera01/SIAA-ChargeGuard:*` (con doble A) con audiencia `sts.amazonaws.com`.

4. **Variables Obligatorias y Despliegue de Frontend (AWS Amplify):**
   - `github_repo`: Es una variable obligatoria sin valor por defecto (`AlanHerrera01/SIAA-ChargeGuard`).
   - El frontend de AWS Amplify se despliega de manera desacoplada mediante `scripts/deploy_amplify.py`, utilizando las APIs nativas de despliegue por artefacto (`aws amplify create-deployment` y `start-deployment`). Esto elimina la necesidad de tokens personales de acceso (PAT) o credenciales adicionales de GitHub en la infraestructura de Terraform.

---

## 3. Guía de Ejecución y Despliegue

### Requisitos previos
- Terraform `>= 1.5.0, < 2.0.0`.
- AWS CLI v2 autenticado contra la cuenta AWS del proyecto (`aws sts get-caller-identity`).

### Paso 1: Aprovisionar el Bootstrap (Solo una vez)

El bootstrap crea el bucket S3 para el estado remoto y la tabla DynamoDB para los bloqueos concurrentes. Se ejecuta con backend local:

```bash
cd infrastructure/bootstrap
terraform init
terraform plan
terraform apply  # NOTA: En WP-06 no se aplica; se aplicará en WP-08 tras revisión del equipo
```

Guarde la salida de los outputs:
- `state_bucket_name`: `chargeguard-tfstate-<ACCOUNT_ID>`
- `dynamodb_lock_table_name`: `chargeguard-tflocks`

### Paso 2: Inicializar la infraestructura principal con Backend Remoto

Desde el directorio raíz `infrastructure/`:

1. Cree el archivo `backend.hcl` basado en la plantilla:
   ```bash
   cp backend.hcl.example backend.hcl
   ```
   Asegúrese de reemplazar `<ACCOUNT_ID>` con el ID real de la cuenta AWS.

2. Descomente el bloque `backend "s3"` en `infrastructure/backend.tf`.

3. Inicialice Terraform conectando con el backend remoto:
   ```bash
   terraform init -backend-config=backend.hcl
   ```

### Paso 3: Generar y Revisar el Plan de Infraestructura

```bash
terraform plan
```

Verifique que se proyecten los 30 recursos:
- 3 tablas DynamoDB (`chargeguard-transactions`, `chargeguard-cases`, `chargeguard-decisions`)
- 1 bucket S3 de evidencia (`chargeguard-evidence-<ACCOUNT_ID>`) con BPA, SSE-S3 y lifecycle de 30 días
- Proveedor OIDC de GitHub + 3 roles IAM (`chargeguard-github-actions-role`, `chargeguard-lambda-exec-role`, `chargeguard-agentcore-role`)
- 1 función Lambda backend + CloudWatch Log Group (retención 7 días)
- 1 API Gateway HTTP API + Stage `$default` + Rutas `ANY /` y `ANY /{proxy+}` + Permiso de invocación
- 1 Bus EventBridge `chargeguard-bus` + Regla `chargeguard-transaction-posted` + Permiso de invocación
- 1 App AWS Amplify Hosting + Rama `main` conectada al repositorio
- 1 CloudWatch Log Group para AgentCore (retención 7 días)

### Paso 4: Aplicar la Infraestructura (Programado para WP-08)

> **IMPORTANTE:** Conforme a las reglas de WP-06, **NO se ejecuta `terraform apply`** en esta fase. El `apply` se realizará en WP-08 tras revisión formal del equipo.

```bash
# Solo ejecutar en WP-08:
terraform apply
```

---

## 4. Runbook de Teardown (Destrucción limpia)

Para eliminar todos los recursos y evitar consumo de créditos cuando no esté en uso:

1. **Destruir la infraestructura de la aplicación:**
   ```bash
   cd infrastructure
   terraform destroy -auto-approve
   ```
   *Nota:* El bucket de evidencia tiene `force_destroy = true`, por lo que se destruirá limpiamente incluso si contiene archivos cargados durante pruebas.

2. **Destruir el estado remoto (opcional, si se desea resetear la cuenta por completo):**
   ```bash
   # Vaciar manualmente el bucket de estado si tiene versiones anteriores:
   aws s3 rb s3://chargeguard-tfstate-<ACCOUNT_ID> --force

   cd infrastructure/bootstrap
   terraform destroy -auto-approve
   ```
