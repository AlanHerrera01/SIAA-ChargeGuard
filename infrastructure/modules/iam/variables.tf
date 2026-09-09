variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "account_id" {
  type        = string
  description = "AWS Account ID"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository formatted as owner/repo (e.g. AlanHerrera01/SIAA-ChargeGuard)"
}

variable "github_repo_oidc_subject" {
  type        = string
  description = "GitHub repository subject with immutable IDs for OIDC token verification (e.g. AlanHerrera01@107574787/SIAA-ChargeGuard@1356601608). Obtain via: gh api repos/<owner>/<repo> --jq '\"\\(.owner.login)@\\(.owner.id)/\\(.name)@\\(.id)\"'"
}

variable "dynamodb_table_arns" {
  type        = list(string)
  description = "List of DynamoDB table ARNs that Lambda and AgentCore need access to"
}

variable "evidence_bucket_arn" {
  type        = string
  description = "ARN of the S3 evidence bucket"
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock primary inference profile or model ID"
  default     = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
}

variable "bedrock_model_id_fast" {
  type        = string
  description = "Bedrock fast inference profile or model ID"
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
