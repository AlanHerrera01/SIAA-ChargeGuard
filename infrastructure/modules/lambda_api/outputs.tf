output "lambda_function_name" {
  description = "Name of the backend Lambda function"
  value       = aws_lambda_function.backend.function_name
}

output "lambda_function_arn" {
  description = "ARN of the backend Lambda function"
  value       = aws_lambda_function.backend.arn
}

output "api_gateway_id" {
  description = "ID of the API Gateway HTTP API"
  value       = aws_apigatewayv2_api.http_api.id
}

output "api_gateway_endpoint" {
  description = "Base invocation URL for the API Gateway HTTP API"
  value       = aws_apigatewayv2_stage.default.invoke_url
}
