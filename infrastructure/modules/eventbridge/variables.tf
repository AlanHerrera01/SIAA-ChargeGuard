variable "lambda_function_arn" {
  type        = string
  description = "ARN of the Lambda function to trigger on transaction.posted events"
}

variable "lambda_function_name" {
  type        = string
  description = "Name of the Lambda function for permission granting"
}
