variable "github_repo" {
  type        = string
  description = "GitHub repository for Amplify (e.g. AlanHerrera01/SIA-ChargeGuard)"
  default     = "AlanHerrera01/SIA-ChargeGuard"
}

variable "branch_name" {
  type        = string
  description = "Git branch for Amplify Hosting"
  default     = "main"
}

variable "api_gateway_url" {
  type        = string
  description = "Base invocation URL for the backend API Gateway HTTP API"
}
