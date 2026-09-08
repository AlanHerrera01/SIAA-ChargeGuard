# The placeholder lives at backend/main.py so it and the real deployment share one
# handler path. deploy-app.yml ships the repo layout because backend/main.py resolves
# agents/, config.py and datasets/ relative to its own parent directory.
data "archive_file" "bootstrap" {
  type        = "zip"
  output_path = "${path.module}/bootstrap.zip"

  source {
    content  = <<-EOT
      import json

      def handler(event, context):
          return {
              "statusCode": 200,
              "headers": {
                  "Content-Type": "application/json"
              },
              "body": json.dumps({
                  "status": "ok",
                  "service": "chargeguard-backend",
                  "message": "ChargeGuard Backend Lambda Bootstrap Active"
              })
          }
    EOT
    filename = "backend/main.py"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/aws/lambda/chargeguard-backend"
  retention_in_days = 7
}

resource "aws_lambda_function" "backend" {
  function_name    = "chargeguard-backend"
  role             = var.lambda_role_arn
  handler          = "backend.main.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      ENVIRONMENT                 = var.environment
      DYNAMODB_TABLE_TRANSACTIONS = var.dynamodb_table_transactions
      DYNAMODB_TABLE_CASES        = var.dynamodb_table_cases
      DYNAMODB_TABLE_DECISIONS    = var.dynamodb_table_decisions
      S3_BUCKET_EVIDENCE          = var.evidence_bucket_name
      BEDROCK_MODEL_ID            = var.bedrock_model_id
      BEDROCK_MODEL_ID_FAST       = var.bedrock_model_id_fast
    }
  }

  depends_on = [aws_cloudwatch_log_group.backend]
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = "chargeguard-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
