variable "account_id" {
  type        = string
  description = "AWS Account ID used to create a globally unique evidence bucket"
}

variable "retention_days" {
  type        = number
  description = "Days before S3 evidence objects expire"
  default     = 30
}
