output "budget_name" {
  description = "Name of the configured AWS budget"
  value       = aws_budgets_budget.chargeguard.name
}
