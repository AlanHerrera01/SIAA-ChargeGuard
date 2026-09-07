output "state_bucket_name" {
  description = "Name of the S3 bucket created for Terraform remote state"
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket created for Terraform remote state"
  value       = aws_s3_bucket.tfstate.arn
}

output "dynamodb_lock_table_name" {
  description = "Name of the DynamoDB table created for Terraform state locking"
  value       = aws_dynamodb_table.tflocks.name
}

output "dynamodb_lock_table_arn" {
  description = "ARN of the DynamoDB table created for Terraform state locking"
  value       = aws_dynamodb_table.tflocks.arn
}

output "backend_config_hcl_snippet" {
  description = "Snippet to use in backend.hcl or for terraform init -backend-config"
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.tfstate.bucket}"
    key            = "dev/terraform.tfstate"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.tflocks.name}"
    encrypt        = true
  EOT
}
