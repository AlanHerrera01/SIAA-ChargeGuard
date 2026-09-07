output "account_id" {
  description = "Target AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "dynamodb_tables" {
  description = "DynamoDB table names and ARNs"
  value = {
    transactions = {
      name = module.dynamodb.table_transactions_name
      arn  = module.dynamodb.table_transactions_arn
    }
    cases = {
      name = module.dynamodb.table_cases_name
      arn  = module.dynamodb.table_cases_arn
    }
    decisions = {
      name = module.dynamodb.table_decisions_name
      arn  = module.dynamodb.table_decisions_arn
    }
  }
}

output "evidence_bucket" {
  description = "S3 evidence bucket details"
  value = {
    name = module.s3.bucket_name
    arn  = module.s3.bucket_arn
  }
}

output "iam_roles" {
  description = "IAM role ARNs for CI/CD and services"
  value = {
    github_actions = module.iam.github_actions_role_arn
    lambda_exec    = module.iam.lambda_exec_role_arn
    agentcore      = module.iam.agentcore_role_arn
  }
}

output "api_gateway_endpoint" {
  description = "HTTP API Gateway endpoint URL for ChargeGuard backend"
  value       = module.lambda_api.api_gateway_endpoint
}

output "event_bus" {
  description = "EventBridge custom bus details"
  value = {
    name = module.eventbridge.event_bus_name
    arn  = module.eventbridge.event_bus_arn
  }
}

output "amplify" {
  description = "Amplify frontend hosting details"
  value = {
    app_id         = module.amplify.app_id
    default_domain = module.amplify.default_domain
    frontend_url   = module.amplify.frontend_url
  }
}
