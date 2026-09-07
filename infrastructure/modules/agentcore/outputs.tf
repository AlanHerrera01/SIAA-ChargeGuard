output "log_group_arn" {
  description = "ARN of the AgentCore CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.agentcore.arn
}

output "log_group_name" {
  description = "Name of the AgentCore CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.agentcore.name
}
