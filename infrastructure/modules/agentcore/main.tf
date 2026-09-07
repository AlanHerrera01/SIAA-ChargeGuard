resource "aws_cloudwatch_log_group" "agentcore" {
  name              = "/aws/bedrock/agentcore/chargeguard"
  retention_in_days = 7
}
