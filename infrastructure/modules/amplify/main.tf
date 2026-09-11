resource "aws_amplify_app" "frontend" {
  name        = "chargeguard-frontend"
  platform    = "WEB"
  description = "ChargeGuard Everyday Autonomous Subscription Dispute Agent Frontend"

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
  EOT

  environment_variables = {
    VITE_BACKEND_API_URL         = trimsuffix(var.api_gateway_url, "/")
    VITE_MOCK_BANK_API_URL       = "${trimsuffix(var.api_gateway_url, "/")}/mock/bank"
    VITE_MOCK_MERCHANT_API_URL   = "${trimsuffix(var.api_gateway_url, "/")}/mock/merchant"
    VITE_CHARGEGUARD_DATA_SOURCE = "api"
    VITE_DEMO_USER_ID            = "usr_demo"
  }

  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|webp|avif|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.branch_name
  stage       = "DEVELOPMENT"
}
