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

variable "github_access_token" {
  type        = string
  description = "GitHub Personal Access Token for AWS Amplify Hosting repository access"
  sensitive   = true
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
