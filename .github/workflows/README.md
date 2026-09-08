# CI/CD Pipelines — ChargeGuard (WP-07)

Este directorio define los flujos automatizados de Integración Continua y Despliegue Continuo (CI/CD) en **GitHub Actions** para **ChargeGuard**, autenticados mediante **AWS IAM OIDC** sin credenciales permanentes almacenadas en secrets.

---

## 1. Qué corre cuándo

| Workflow | Disparador | Condición de ejecución | Acción |
|---|---|---|---|
| **`ci.yml`** | `pull_request` contra `main` | Cada PR hacia `main` (usa `paths-filter` por job) | • `lint-test-python`: ruff + pytest en datasets, mocks y scripts.<br>• `terraform`: fmt check + validate en bootstrap e infraestructura.<br>• `frontend`: npm ci + build (skip limpio si no existe `package.json`). |
| **`deploy-infra.yml`** | `push` a `main` | Cambios en `infrastructure/**` | Job único `deploy` gateado por el environment **`production`** (required reviewer). Valida `backend.hcl` y `AMPLIFY_GITHUB_TOKEN`, asume el rol OIDC, corre `terraform plan` y `terraform apply` en el runner efímero sin subir artefactos de plan públicos. |
| **`deploy-app.yml`** | `push` a `main` | Cambios en `backend/**`, `agents/**` o `frontend/**` | Empaqueta y despliega el código en la Lambda `chargeguard-backend` y dispara la release en AWS Amplify Hosting vía `aws amplify start-job`. |

### Optimizaciones y Reglas de Seguridad
- **Permissions mínimas por workflow**:
  - `ci.yml`: Únicamente `contents: read` (no interactúa con AWS ni genera tokens de identidad).
  - `deploy-infra.yml` y `deploy-app.yml`: `id-token: write` (para intercambio STS OIDC) y `contents: read`.
- **CERO secretos de AWS**: El ARN del rol IAM se almacena como variable de repositorio (`vars.AWS_ROLE_ARN`).
- **Sin artefactos de plan expuestos**: `deploy-infra.yml` ejecuta `plan` y `apply` en el mismo job sobre el runner efímero. No se utiliza `upload-artifact` para el archivo `tfplan`, previniendo la exposición pública de variables sensibles (como tokens de acceso) en repositorios públicos.
- **Fail-fast estricto**: `deploy-infra.yml` falla inmediatamente con error explícito si `infrastructure/backend.hcl` o el secreto `AMPLIFY_GITHUB_TOKEN` no están presentes, impidiendo degradaciones silenciosas o states locales descartados.
- **Concurrencia**:
  - `ci.yml`: `group: ci-${{ github.ref }}`, `cancel-in-progress: true` (cancela runs obsoletos al hacer push a la misma rama).
  - `deploy-infra.yml`: `group: deploy-infra`, `cancel-in-progress: false` (evita que dos merges concurrentes pisen un apply en curso).
  - `deploy-app.yml`: `group: deploy-app`, `cancel-in-progress: false`.
- **Paths Filter & Caching**: Los jobs de CI solo se ejecutan cuando cambian los archivos de su dominio respectivo y utilizan caché de `pip` y `npm`. Tiempo de ejecución estimado: `< 2 minutos`.

---

## 2. Dependencia Inicial: El Primer `terraform apply` es Local

> [!IMPORTANT]
> **El PRIMER `terraform apply` debe ejecutarse manualmente desde una máquina local con credenciales de AWS.**
> 
> El rol IAM OIDC (`chargeguard-github-actions-role`) que GitHub Actions necesita para autenticarse es aprovisionado por la propia infraestructura de Terraform en el módulo `iam`. Por definición, GitHub Actions **no puede** asumir un rol que todavía no existe en AWS.
>
> **Flujo de Bootstrap inicial**:
> 1. Aplicar `infrastructure/bootstrap/` localmente para crear el bucket S3 de estado remoto y la tabla DynamoDB de locks.
> 2. Crear `infrastructure/backend.hcl` apuntando al bucket y tabla creados.
> 3. Ejecutar el primer `terraform init` y `terraform apply` desde la máquina local proporcionando `github_repo` y `github_access_token`.
> 4. Una vez creado el stack en AWS (incluyendo el rol OIDC y su trust policy), configurar las variables en GitHub y habilitar a CI/CD para que tome el relevo de los despliegues posteriores.

---

## 3. Configuración de Variables y Secretos en GitHub

### Variables de Repositorio (vars, no secrets)

Configure las siguientes variables en **Settings > Secrets and variables > Actions > Variables** (o mediante `gh` CLI):

```bash
# 1. ARN del rol IAM asumido por GitHub Actions (creado en el primer apply)
gh variable set AWS_ROLE_ARN --body "arn:aws:iam::<ACCOUNT_ID>:role/chargeguard-github-actions-role"

# 2. Región principal de AWS (por defecto us-east-1)
gh variable set AWS_REGION --body "us-east-1"

# 3. ID de la aplicación Amplify (generado tras el apply de infrastructure/ en WP-08)
gh variable set AMPLIFY_APP_ID --body "<AMPLIFY_APP_ID>"
```

### Secretos de Repositorio (Secrets)

Configure el Personal Access Token de GitHub en **Settings > Secrets and variables > Actions > Secrets**:

```bash
# Token clásico de GitHub con scopes repo y admin:repo_hook
gh secret set AMPLIFY_GITHUB_TOKEN --body "ghp_xxxxxxxxxxxxxxxxxxxx"
```

---

## 4. Configuración del Environment de Aprobación para Infraestructura

Para gatear `terraform apply` en `deploy-infra.yml`:
1. En GitHub, ir a **Settings > Environments > New environment**.
2. Nombrar el environment exactamente: `production`.
3. Activar **Required reviewers** y asignar al menos a un integrante del equipo (ej. Alan o Ismael).
4. Guardar los cambios. Cualquier push a `main` que modifique `infrastructure/**` pausará el job de despliegue esperando la aprobación humana antes de ejecutar `terraform plan` y `terraform apply`.

---

## 5. Contrato de empaquetado de la Lambda

`deploy-app.yml` sube un zip que **replica la estructura del repositorio**, no el contenido de `backend/` aplanado:

```
backend/main.py     config.py     agents/     datasets/     <dependencias pip>
```

Es obligatorio porque `backend/main.py` calcula `project_root` como el directorio padre de su propio padre y desde ahí resuelve `agents/`, `config.py` y `datasets/`. Si se aplanara `backend/*` en la raíz del zip, `project_root` apuntaría a `/var` y la función fallaría en la primera invocación con `ModuleNotFoundError` y `FileNotFoundError`.

Por eso el handler es **`backend.main.handler`**, tanto en el placeholder de Terraform como en el despliegue real. Si se cambia uno hay que cambiar el otro, o el siguiente `terraform apply` revierte la configuración y rompe la función.

> [!IMPORTANT]
> **FastAPI no corre en Lambda sin adaptador.** `backend/main.py` debe exponer un `handler` a nivel de módulo:
> ```python
> from mangum import Mangum
> handler = Mangum(app)
> ```
> con `mangum` en `backend/requirements.txt`. Sin eso, API Gateway devuelve 502 en cada petición. El workflow verifica que exista ese `handler` y **aborta el despliegue** si falta, en vez de publicar una función rota.

El workflow también aborta si falta `agents/`, `config.py`, `datasets/` o `backend/requirements.txt`, porque son dependencias de ejecución: sin ellas el despliegue "tiene éxito" y la función revienta en la primera petición.

---

## 6. Protección de la Rama `main`

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
