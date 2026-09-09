variable "aws_region" {
  type        = string
  description = "AWS region for ChargeGuard resources"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (dev)"
  default     = "dev"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository formatted as owner/repo for OIDC trust and Amplify integration (e.g. AlanHerrera01/SIAA-ChargeGuard)"
}

variable "github_repo_oidc_subject" {
  type        = string
  description = "GitHub repository subject with immutable IDs for OIDC token verification (e.g. AlanHerrera01@107574787/SIAA-ChargeGuard@1356601608). Obtain via: gh api repos/<owner>/<repo> --jq '\"\\(.owner.login)@\\(.owner.id)/\\(.name)@\\(.id)\"'"
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock primary inference profile or model ID for autonomous reasoning"
  default     = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
}

variable "bedrock_model_id_fast" {
  type        = string
  description = "Bedrock fast inference profile or model ID for lightweight sub-agent tasks"
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "amplify_branch" {
  type        = string
  description = "Target Git branch for AWS Amplify Hosting"
  default     = "main"
}

variable "evidence_retention_days" {
  type        = number
  description = "Retention period in days for S3 evidence objects before automatic lifecycle expiration"
  default     = 30
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Allowed origins for API Gateway HTTP API CORS configuration"
  default     = ["*"]
}

variable "budget_limit_usd" {
  type        = string
  description = "Monthly AWS budget limit in USD"
  default     = "40"
}

variable "budget_subscriber_emails" {
  type        = list(string)
  description = "Email subscribers for AWS Budget threshold alerts"
  default = [
    "christianamaguaproyectos@gmail.com",
    "avherrera3@espe.edu.ec"
  ]
}
