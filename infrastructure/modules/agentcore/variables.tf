variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "agentcore_role_arn" {
  type        = string
  description = "ARN of the AgentCore Runtime IAM role"
}
