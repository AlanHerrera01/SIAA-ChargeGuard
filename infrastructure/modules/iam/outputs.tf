output "github_actions_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions via OIDC"
  value       = aws_iam_role.github_actions.arn
}

output "github_actions_role_name" {
  description = "Name of the IAM role assumed by GitHub Actions"
  value       = aws_iam_role.github_actions.name
}

output "lambda_exec_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_exec.arn
}

output "lambda_exec_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.lambda_exec.name
}

output "agentcore_role_arn" {
  description = "ARN of the AgentCore Runtime role"
  value       = aws_iam_role.agentcore.arn
}

output "agentcore_role_name" {
  description = "Name of the AgentCore Runtime role"
  value       = aws_iam_role.agentcore.name
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  value       = aws_iam_openid_connect_provider.github.arn
}
