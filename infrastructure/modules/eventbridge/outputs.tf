output "event_bus_name" {
  description = "Name of the ChargeGuard custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.chargeguard.name
}

output "event_bus_arn" {
  description = "ARN of the ChargeGuard custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.chargeguard.arn
}

output "rule_transaction_posted_arn" {
  description = "ARN of the transaction.posted EventBridge rule"
  value       = aws_cloudwatch_event_rule.transaction_posted.arn
}
