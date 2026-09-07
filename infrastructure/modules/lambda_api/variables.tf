variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "lambda_role_arn" {
  type        = string
  description = "ARN of the IAM execution role for the Lambda backend function"
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "List of allowed CORS origins for API Gateway HTTP API (Amplify frontend domain)"
  default     = ["*"]
}

variable "dynamodb_table_transactions" {
  type        = string
  description = "Name of the transactions DynamoDB table"
}

variable "dynamodb_table_cases" {
  type        = string
  description = "Name of the cases DynamoDB table"
}

variable "dynamodb_table_decisions" {
  type        = string
  description = "Name of the decisions DynamoDB table"
}

variable "evidence_bucket_name" {
  type        = string
  description = "Name of the S3 evidence bucket"
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock primary inference profile or model ID"
}

variable "bedrock_model_id_fast" {
  type        = string
  description = "Bedrock fast inference profile or model ID"
}
