output "app_id" {
  description = "ID of the Amplify application"
  value       = aws_amplify_app.frontend.id
}

output "app_arn" {
  description = "ARN of the Amplify application"
  value       = aws_amplify_app.frontend.arn
}

output "default_domain" {
  description = "Default Amplify domain for the application"
  value       = aws_amplify_app.frontend.default_domain
}

output "frontend_url" {
  description = "Live frontend URL hosted on Amplify"
  value       = "https://${var.branch_name}.${aws_amplify_app.frontend.default_domain}"
}
