resource "aws_cloudwatch_dashboard" "chargeguard" {
  dashboard_name = "ChargeGuard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2
        properties = {
          markdown = "# ChargeGuard — Autonomous Subscription Dispute Observability\nReal-time health, Lambda execution telemetry, API traffic, and Amazon Bedrock metrics."
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.backend_function_name, { "stat" : "Sum", "label" : "Backend Invocations", "color" : "#1f77b4" }],
            [".", "Errors", ".", ".", { "stat" : "Sum", "label" : "Backend Errors", "color" : "#d62728" }],
            [".", "Throttles", ".", ".", { "stat" : "Sum", "label" : "Backend Throttles", "color" : "#ff7f0e" }],
            [".", "Invocations", "FunctionName", var.mock_bank_function_name, { "stat" : "Sum", "label" : "Mock Bank Invocations", "color" : "#2ca02c" }],
            [".", "Invocations", "FunctionName", var.mock_merchant_function_name, { "stat" : "Sum", "label" : "Mock Merchant Invocations", "color" : "#9467bd" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Invocations, Errors & Throttles"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 2
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.backend_function_name, { "stat" : "p95", "label" : "Backend Duration p95", "color" : "#d62728" }],
            ["...", { "stat" : "p50", "label" : "Backend Duration p50", "color" : "#1f77b4" }],
            ["...", { "stat" : "Average", "label" : "Backend Duration Avg", "color" : "#2ca02c" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Backend Lambda Execution Duration (ms)"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.api_gateway_name, { "stat" : "Sum", "label" : "Requests Count" }],
            [".", "4xx", ".", ".", { "stat" : "Sum", "label" : "4xx Client Errors", "color" : "#ff7f0e" }],
            [".", "5xx", ".", ".", { "stat" : "Sum", "label" : "5xx Server Errors", "color" : "#d62728" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway HTTP Requests & HTTP Errors"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 8
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Bedrock", "Invocations", "ModelId", var.bedrock_model_id, { "stat" : "Sum", "label" : "Bedrock Invocations", "color" : "#1f77b4" }],
            [".", "InvocationServerErrors", ".", ".", { "stat" : "Sum", "label" : "Server Errors", "color" : "#d62728" }],
            [".", "InvocationClientErrors", ".", ".", { "stat" : "Sum", "label" : "Client Errors", "color" : "#ff7f0e" }],
            [".", "ModelLatency", ".", ".", { "stat" : "p95", "label" : "Model Latency p95", "color" : "#9467bd" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Amazon Bedrock Autonomous Inference Telemetry"
          period  = 60
        }
      }
    ]
  })
}
