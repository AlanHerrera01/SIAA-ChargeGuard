# Guía de Despliegue y Operaciones en AWS — ChargeGuard (WP-08)

Esta guía documenta la infraestructura desplegada, el orden de aprovisionamiento, los endpoints activos, los procedimientos de verificación End-to-End, rollback, destrucción y resolución de problemas para la demo en vivo de **ChargeGuard**.

---

## 1. Arquitectura y Recursos Desplegados en AWS

Todos los recursos se encuentran en la región **`us-east-1`** bajo la cuenta de AWS (`***560`):

| Componente | Recurso en AWS | Identificador / URL |
|---|---|---|
| **API Gateway** | HTTP API (`chargeguard-api`) | `https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com` |
| **Backend API & Multi-Agente** | AWS Lambda (`chargeguard-backend`) | Handler `backend.main.handler` (Python 3.12, 1024 MB RAM, 60s timeout) |
| **Mock Bank** | AWS Lambda (`chargeguard-mock-bank`) | `https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/bank` |
| **Mock Merchant** | AWS Lambda (`chargeguard-mock-merchant`) | `https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/merchant` |
| **Frontend Web** | AWS Amplify Hosting (`chargeguard-frontend`) | `https://main.d24otvpswldjmf.amplifyapp.com` (App ID: `d24otvpswldjmf`) |
| **Almacenamiento Transacciones** | DynamoDB (`chargeguard-transactions`) | PK: `user_id`, SK: `sk`, GSI: `merchant-index` (PAY_PER_REQUEST) |
| **Almacenamiento Casos** | DynamoDB (`chargeguard-cases`) | PK: `case_id`, GSIs: `user-index`, `status-index` (PAY_PER_REQUEST) |
| **Almacenamiento Decisiones & Mock State** | DynamoDB (`chargeguard-decisions`) | PK: `decision_id`, GSIs: `case-index`, `pending-index` (PAY_PER_REQUEST) |
| **Evidencias S3** | S3 Bucket (`chargeguard-evidence-***560`) | Cifrado SSE-S3, Block Public Access total, Expiración a 30 días |
| **EventBus** | EventBridge (`chargeguard-bus`) | Regla para eventos `transaction.posted` |
| **Presupuesto & Costos** | AWS Budgets (`chargeguard-monthly-budget`) | Límite mensual: **$40.00 USD**, Alertas por email al 50% y 80% |
| **Observabilidad** | CloudWatch Dashboard (`ChargeGuard`) | Métricas p95, errores, invocaciones y retención de logs a 7 días |

---

## 2. Terraform Outputs Reales

Ejecutado con backend remoto S3 y DynamoDB lock:

```hcl
account_id = "***560"

api_gateway_endpoint = "https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/"

dynamodb_tables = {
  cases = {
    arn  = "arn:aws:dynamodb:us-east-1:***560:table/chargeguard-cases"
    name = "chargeguard-cases"
  }
  decisions = {
    arn  = "arn:aws:dynamodb:us-east-1:***560:table/chargeguard-decisions"
    name = "chargeguard-decisions"
  }
  transactions = {
    arn  = "arn:aws:dynamodb:us-east-1:***560:table/chargeguard-transactions"
    name = "chargeguard-transactions"
  }
}

evidence_bucket = {
  arn  = "arn:aws:s3:::chargeguard-evidence-***560"
  name = "chargeguard-evidence-***560"
}

iam_roles = {
  agentcore      = "arn:aws:iam::***560:role/chargeguard-agentcore-role"
  github_actions = "arn:aws:iam::***560:role/chargeguard-github-actions-role"
  lambda_exec    = "arn:aws:iam::***560:role/chargeguard-lambda-exec-role"
}

amplify = {
  app_id      = "d24otvpswldjmf"
  default_domain = "d24otvpswldjmf.amplifyapp.com"
}
```

---

## 3. Prerrequisitos de Despliegue

1. **AWS CLI** configurado con permisos de administrador en la cuenta target:
   ```bash
   aws sts get-caller-identity
   ```
2. **Terraform >= 1.5.0** instalado.
3. **Docker** instalado y en ejecución (para empaquetar binarios compatibles con Linux x86_64).
4. **Node.js >= 20** y npm.
5. **Python >= 3.11** con el entorno virtual `.venv` activado.

---

## 4. Orden de Despliegue Paso a Paso

### Paso 1: Bootstrap del Estado Remoto
```bash
cd infrastructure/bootstrap
terraform init
terraform apply -auto-approve
cd ../..
```
Crea el bucket `chargeguard-tfstate-***` y la tabla `chargeguard-tflocks`.

### Paso 2: Aprovisionamiento de Infraestructura con Terraform
```bash
cd infrastructure
terraform init -backend-config=backend.hcl
terraform apply -auto-approve
cd ..
```
Aprovisiona las tablas DynamoDB, bucket S3 de evidencias, roles IAM, API Gateway HTTP, CloudWatch Dashboard y AWS Budget.

### Paso 3: Empaquetado y Despliegue de Lambdas
Construye los paquetes compatibles con Linux usando Docker y actualiza el código en AWS:
```bash
python scripts/package_lambdas.py

aws lambda update-function-code --function-name chargeguard-backend --zip-file fileb://backend_deploy.zip
aws lambda update-function-code --function-name chargeguard-mock-bank --zip-file fileb://mock_bank_deploy.zip
aws lambda update-function-code --function-name chargeguard-mock-merchant --zip-file fileb://mock_merchant_deploy.zip
```

### Paso 4: Poblar Tablas y Evidencias en AWS (Seed)
Ejecuta el script idempotente apuntando a AWS real (con `AWS_ENDPOINT_URL` vacío):
```bash
python -c "import os; os.environ['AWS_ENDPOINT_URL']=''; os.environ['S3_BUCKET_EVIDENCE']='chargeguard-evidence-***560'; os.environ['DATASET_DIR']='datasets'; from scripts.seed_local import main; raise SystemExit(main())"
```
Resultado: 37 transacciones insertadas en `chargeguard-transactions`, 58 archivos subidos a S3 en `invoices/`, `emails/` y `terms/`.

### Paso 5: Compilación y Despliegue del Frontend en AWS Amplify
```bash
cd frontend
npm ci
npm run build
cd ..
python scripts/deploy_amplify.py
```

---

## 5. Verificación End-to-End (E2E)

### Caso de Prueba: Detección de Cobro Duplicado en Spotify (`txn_0035`)
1. **Notificación desde el Mock Bank**:
   ```bash
   curl -X POST "https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/bank/transactions/notify" \
     -H "Content-Type: application/json" \
     -d '{"transaction_id": "txn_0035"}'
   ```
   Respuesta esperada: `HTTP 200 {"delivered": true, "status_code": 202}`

2. **Ejecución del Agente en AWS Lambda**:
   El webhook procesa la transacción:
   - Detección: `DUPLICATE_CHARGE` (cobro duplicado de $10.99 a 8 minutos de `txn_0034`).
   - Evidencias: Facturas `inv_0034.pdf` e `inv_0035.pdf` recopiladas.
   - Disputa enviada a Mock Merchant: `dsp_53995c3d5bd3`.
   - Contraoferta del comercio: Crédito de cortesía por **$6.59**.
   - Estado del caso: `awaiting_human`.

3. **Verificación de Persistencia Multi-Contenedor (DynamoDB)**:
   Consultar directamente el mock merchant en cualquier momento sin riesgo de 404 por cold start:
   ```bash
   curl -s "https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/merchant/disputes/dsp_53995c3d5bd3"
   ```

4. **Resolución Humana**:
   ```bash
   curl -X POST "https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/decisions/case_81827dca/resolve" \
     -H "Content-Type: application/json" \
     -d '{"decision": "accept_offer"}'
   ```
   Resultado: Caso cerrado como `resolved`, estado en comercio `resolved_accepted` y reembolso de `$6.59` emitido.

5. **Visualización en Frontend**:
   Abrir `https://main.d24otvpswldjmf.amplifyapp.com` en modo incógnito:
   - Métrica en vivo: "Total recuperado: $6.59".
   - Disputas resueltas: 1/1.
   - Visualización de la anomalía y timeline completo.

---

## 6. Procedimiento de Rollback

Si una versión de código de Lambda o frontend presenta defectos:
1. **Lambda Backend o Mocks**:
   - Re-desplegar la versión anterior del zip mediante AWS CLI o restaurar la versión anterior en AWS Lambda Console:
     ```bash
     aws lambda update-function-code --function-name chargeguard-backend --zip-file fileb://backend_deploy_previous.zip
     ```
2. **Frontend en Amplify**:
   - Iniciar un deployment del zip previo con `scripts/deploy_amplify.py` o restaurar el Job ID previo desde la consola de Amplify.

---

## 7. Procedimiento de Destrucción (Tear Down)

Para eliminar por completo todos los recursos aprovisionados y evitar costos remanentes:
```bash
# 1. Vaciar el bucket de evidencias S3 (necesario antes de destruirlo)
aws s3 rm s3://chargeguard-evidence-***560 --recursive

# 2. Destruir la infraestructura principal con Terraform
cd infrastructure
terraform destroy -auto-approve

# 3. Vaciar y destruir el bucket de bootstrap (si se desea eliminar todo el estado)
aws s3 rm s3://chargeguard-tfstate-***560 --recursive
cd bootstrap
terraform destroy -auto-approve
```

---

## 8. Guía de Solución de Problemas para la Demo en Vivo

| Síntoma | Causa Probable | Solución Inmediata |
|---|---|---|
| **Frontend muestra pantalla en blanco** | Assets JS/CSS no accesibles o regla de rewrite interceptando | Verificar `curl -sI https://main.d24otvpswldjmf.amplifyapp.com/assets/index-...js`. Si falla, ejecutar `python scripts/deploy_amplify.py` que asegura permisos POSIX `0o100644`. |
| **504 Gateway Timeout en API Gateway** | Ejecución de Lambda excedió 30s durante cold start | El backend está optimizado a 1024 MB de memoria (~1 vCPU completa) para correr en <15s. Si ocurre en el primer request frío, reintentar la solicitud (el contenedor ya estará caliente y responderá en ~6-8s). |
| **Error 404 en Mock Merchant al consultar disputa** | Pérdida de estado en memoria entre contenedores | Resuelto de forma permanente: el mock merchant persiste en DynamoDB `chargeguard-decisions` bajo la partición `merchant_dispute`. |
| **Notificación del Banco falla con 500** | Webhook URL incorrecta en el mock bank | Verificar `BACKEND_WEBHOOK_URL` en `chargeguard-mock-bank`. Debe ser `https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/transactions/webhook`. |
| **CloudWatch Logs** | Inspección inmediata de trazas | Ver logs en tiempo real: `aws logs tail /aws/lambda/chargeguard-backend --follow`. |
