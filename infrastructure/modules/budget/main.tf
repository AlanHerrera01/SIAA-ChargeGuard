resource "aws_budgets_budget" "chargeguard" {
  name              = "chargeguard-monthly-budget"
  budget_type       = "COST"
  limit_amount      = var.budget_limit_usd
  limit_unit        = "USD"
  time_period_start = "2026-09-01_00:00"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.subscriber_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.subscriber_emails
  }
}
