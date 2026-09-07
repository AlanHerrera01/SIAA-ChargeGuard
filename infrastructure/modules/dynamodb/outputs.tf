output "table_transactions_name" {
  description = "Name of the transactions DynamoDB table"
  value       = aws_dynamodb_table.transactions.name
}

output "table_transactions_arn" {
  description = "ARN of the transactions DynamoDB table"
  value       = aws_dynamodb_table.transactions.arn
}

output "table_cases_name" {
  description = "Name of the cases DynamoDB table"
  value       = aws_dynamodb_table.cases.name
}

output "table_cases_arn" {
  description = "ARN of the cases DynamoDB table"
  value       = aws_dynamodb_table.cases.arn
}

output "table_decisions_name" {
  description = "Name of the decisions DynamoDB table"
  value       = aws_dynamodb_table.decisions.name
}

output "table_decisions_arn" {
  description = "ARN of the decisions DynamoDB table"
  value       = aws_dynamodb_table.decisions.arn
}

output "table_arns" {
  description = "List of all ChargeGuard table ARNs"
  value = [
    aws_dynamodb_table.transactions.arn,
    aws_dynamodb_table.cases.arn,
    aws_dynamodb_table.decisions.arn,
  ]
}
