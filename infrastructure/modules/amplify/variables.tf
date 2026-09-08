

variable "branch_name" {
  type        = string
  description = "Git branch for Amplify Hosting"
  default     = "main"
}

variable "api_gateway_url" {
  type        = string
  description = "Base invocation URL for the backend API Gateway HTTP API"
}
