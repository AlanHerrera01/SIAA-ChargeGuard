resource "aws_cloudwatch_event_bus" "chargeguard" {
  name = "chargeguard-bus"
}

resource "aws_cloudwatch_event_rule" "transaction_posted" {
  name           = "chargeguard-transaction-posted"
  event_bus_name = aws_cloudwatch_event_bus.chargeguard.name
  description    = "Triggers ChargeGuard agent workflow when a banking transaction is posted"

  event_pattern = jsonencode({
    "source" : ["chargeguard.bank"],
    "detail-type" : ["transaction.posted"]
  })
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule           = aws_cloudwatch_event_rule.transaction_posted.name
  event_bus_name = aws_cloudwatch_event_bus.chargeguard.name
  target_id      = "ChargeGuardBackendTarget"
  arn            = var.lambda_function_arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.transaction_posted.arn
}
