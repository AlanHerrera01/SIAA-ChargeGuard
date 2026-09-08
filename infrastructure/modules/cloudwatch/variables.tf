variable "aws_region" {
  type        = string
  description = "AWS region for CloudWatch dashboard metrics"
  default     = "us-east-1"
}

variable "backend_function_name" {
  type        = string
  description = "Name of the backend Lambda function"
}

variable "mock_bank_function_name" {
  type        = string
  description = "Name of the mock bank Lambda function"
}

variable "mock_merchant_function_name" {
  type        = string
  description = "Name of the mock merchant Lambda function"
}

variable "api_gateway_name" {
  type        = string
  description = "Name of the API Gateway HTTP API"
  default     = "chargeguard-api"
}

variable "bedrock_model_id" {
  type        = string
  description = "Primary Bedrock model ID"
}
