variable "budget_limit_usd" {
  type        = string
  description = "Monthly budget limit in USD"
  default     = "40"
}

variable "subscriber_emails" {
  type        = list(string)
  description = "Email addresses to notify when budget thresholds are breached"
  default = [
    "christianamaguaproyectos@gmail.com",
    "avherrera3@espe.edu.ec"
  ]
}
