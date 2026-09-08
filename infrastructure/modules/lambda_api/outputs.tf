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

output "mock_bank_function_name" {
  description = "Name of the mock bank Lambda function"
  value       = aws_lambda_function.mock_bank.function_name
}

output "mock_bank_function_arn" {
  description = "ARN of the mock bank Lambda function"
  value       = aws_lambda_function.mock_bank.arn
}

output "mock_bank_url" {
  description = "Public URL for Mock Bank API endpoints"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/mock/bank"
}

output "mock_merchant_function_name" {
  description = "Name of the mock merchant Lambda function"
  value       = aws_lambda_function.mock_merchant.function_name
}

output "mock_merchant_function_arn" {
  description = "ARN of the mock merchant Lambda function"
  value       = aws_lambda_function.mock_merchant.arn
}

output "mock_merchant_url" {
  description = "Public URL for Mock Merchant API endpoints"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/mock/merchant"
}

