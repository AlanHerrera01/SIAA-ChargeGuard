data "aws_caller_identity" "current" {}

# 1. DynamoDB: 3 tables per docs/contracts.md §4.1
module "dynamodb" {
  source = "./modules/dynamodb"

  environment = var.environment
}

# 2. S3: Evidence bucket with public access block, SSE-S3, 30-day lifecycle
module "s3" {
  source = "./modules/s3"

  account_id     = data.aws_caller_identity.current.account_id
  retention_days = var.evidence_retention_days
}

# 3. IAM: GitHub Actions OIDC role, Lambda execution role, AgentCore runtime role
module "iam" {
  source = "./modules/iam"

  aws_region               = var.aws_region
  account_id               = data.aws_caller_identity.current.account_id
  github_repo              = var.github_repo
  github_repo_oidc_subject = var.github_repo_oidc_subject
  dynamodb_table_arns      = module.dynamodb.table_arns
  evidence_bucket_arn      = module.s3.bucket_arn
  bedrock_model_id         = var.bedrock_model_id
  bedrock_model_id_fast    = var.bedrock_model_id_fast
}

# 4. Lambda & API Gateway: Backend HTTP API with CORS
module "lambda_api" {
  source = "./modules/lambda_api"

  environment                 = var.environment
  lambda_role_arn             = module.iam.lambda_exec_role_arn
  cors_allow_origins          = var.cors_allow_origins
  dynamodb_table_transactions = module.dynamodb.table_transactions_name
  dynamodb_table_cases        = module.dynamodb.table_cases_name
  dynamodb_table_decisions    = module.dynamodb.table_decisions_name
  evidence_bucket_name        = module.s3.bucket_name
  bedrock_model_id            = var.bedrock_model_id
  bedrock_model_id_fast       = var.bedrock_model_id_fast
}

# 5. EventBridge: Custom bus and rule for transaction.posted triggering the backend
module "eventbridge" {
  source = "./modules/eventbridge"

  lambda_function_arn  = module.lambda_api.lambda_function_arn
  lambda_function_name = module.lambda_api.lambda_function_name
}

# 6. Amplify: Frontend hosting with Vite build and SPA routing
module "amplify" {
  source = "./modules/amplify"

  branch_name     = var.amplify_branch
  api_gateway_url = module.lambda_api.api_gateway_endpoint
}

# 7. AgentCore: Architectural preparation and dedicated CloudWatch log group
module "agentcore" {
  source = "./modules/agentcore"

  environment        = var.environment
  agentcore_role_arn = module.iam.agentcore_role_arn
}

# 8. CloudWatch: Observability dashboard for Lambda, API Gateway, and Bedrock metrics
module "cloudwatch" {
  source = "./modules/cloudwatch"

  aws_region                  = var.aws_region
  backend_function_name       = module.lambda_api.lambda_function_name
  mock_bank_function_name     = module.lambda_api.mock_bank_function_name
  mock_merchant_function_name = module.lambda_api.mock_merchant_function_name
  api_gateway_name            = module.lambda_api.api_gateway_id
  bedrock_model_id            = var.bedrock_model_id
}

# 9. AWS Budget: $40 USD monthly limit with 50% and 80% email alerts
module "budget" {
  source = "./modules/budget"

  budget_limit_usd  = var.budget_limit_usd
  subscriber_emails = var.budget_subscriber_emails
}
