# CI/CD Pipelines — ChargeGuard (WP-07)

Este directorio define los flujos automatizados de Integración Continua y Despliegue Continuo (CI/CD) en **GitHub Actions** para **ChargeGuard**, autenticados mediante **AWS IAM OIDC** sin credenciales permanentes almacenadas en secrets.

---

## 1. Qué corre cuándo

| Workflow | Disparador | Condición de ejecución | Acción |
|---|---|---|---|
| **`ci.yml`** | `pull_request` contra `main` | Cada PR hacia `main` (usa `paths-filter` por job) | • `lint-test-python`: ruff + pytest en datasets, mocks y scripts.<br>• `terraform`: fmt check + validate en bootstrap e infraestructura.<br>• `frontend`: npm ci + build (skip limpio si no existe `package.json`). |
| **`deploy-infra.yml`** | `push` a `main` | Cambios en `infrastructure/**` | Ejecuta `terraform plan` con rol OIDC y luego `apply` **gateado por el environment `production`** con aprobador requerido. |
| **`deploy-app.yml`** | `push` a `main` | Cambios en `backend/**`, `agents/**` o `frontend/**` | Empaqueta y despliega el código en la Lambda `chargeguard-backend` y dispara la release en AWS Amplify Hosting. |

### Optimizaciones y Reglas
- **Permissions mínimas**: Solo `id-token: write` y `contents: read`.
- **CERO secretos de AWS**: El ARN del rol se almacena como variable de repositorio (`vars.AWS_ROLE_ARN`).
- **Concurrencia**:
  - `ci.yml`: `group: ci-${{ github.ref }}`, `cancel-in-progress: true` (cancela runs anteriores al empujar nuevos commits).
  - `deploy-infra.yml`: `group: deploy-infra`, `cancel-in-progress: false` (evita que dos merges concurrentes pisen un `apply`).
  - `deploy-app.yml`: `group: deploy-app`, `cancel-in-progress: false`.
- **Paths Filter & Caching**: Los jobs de CI solo se ejecutan cuando cambian los archivos de su dominio respectivo y utilizan caché de `pip` y `npm`. Tiempo de ejecución estimado: `< 2 minutos`.

---

## 2. Configuración del Rol OIDC en GitHub

En WP-06 se aprovisionó el rol IAM `chargeguard-github-actions-role` con la relación de confianza restringida a `repo:AlanHerrera01/SIAA-ChargeGuard:*` y permisos acotados sobre los recursos del proyecto.

### Variables de Repositorio requeridas (vars, no secrets)

Configure las siguientes variables en **Settings > Secrets and variables > Actions > Variables** (o mediante `gh` CLI):

```bash
# 1. ARN del rol IAM asumido por GitHub Actions
gh variable set AWS_ROLE_ARN --body "arn:aws:iam::<ACCOUNT_ID>:role/chargeguard-github-actions-role"

# 2. Región principal de AWS (por defecto us-east-1)
gh variable set AWS_REGION --body "us-east-1"

# 3. ID de la aplicación Amplify (generado tras el apply de infrastructure/ en WP-08)
gh variable set AMPLIFY_APP_ID --body "<AMPLIFY_APP_ID>"
```

### Configuración del Environment de Aprobación para Infraestructura

Para gatear `terraform apply` en `deploy-infra.yml`:
1. En GitHub, ir a **Settings > Environments > New environment**.
2. Nombrar el environment exactamente: `production`.
3. Activar **Required reviewers** y asignar al menos a un integrante del equipo (ej. Alan o Ismael).
4. Guardar los cambios. Cualquier push a `main` generará el plan automáticamente y esperará la aprobación humana antes de ejecutar `terraform apply`.

---

## 3. Protección de la Rama `main`

Para cumplir las reglas innegociables del proyecto:
- Todo cambio requiere Pull Request obligatorio (prohibidos los commits directos a `main`).
- Al menos 1 aprobación requerida de otro integrante.
- Checks de CI en verde obligatorios antes del merge.

### Comando con `gh` CLI para aplicar la protección

Ejecute el siguiente comando desde la raíz del proyecto para aplicar la configuración completa de protección sobre `main`:

```bash
gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/AlanHerrera01/SIAA-ChargeGuard/branches/main/protection \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Detect Changed Paths",
      "Lint & Test Python",
      "Terraform Validate",
      "Frontend Build"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
```

Para verificar que la protección quedó activa:

```bash
gh api /repos/AlanHerrera01/SIAA-ChargeGuard/branches/main/protection --jq '{required_reviews: .required_pull_request_reviews.required_approving_review_count, checks: .required_status_checks.contexts}'
```
