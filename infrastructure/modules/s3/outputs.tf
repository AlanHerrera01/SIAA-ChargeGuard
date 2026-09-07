output "bucket_name" {
  description = "Name of the ChargeGuard S3 evidence bucket"
  value       = aws_s3_bucket.evidence.bucket
}

output "bucket_arn" {
  description = "ARN of the ChargeGuard S3 evidence bucket"
  value       = aws_s3_bucket.evidence.arn
}

output "bucket_domain_name" {
  description = "Bucket domain name of the ChargeGuard S3 evidence bucket"
  value       = aws_s3_bucket.evidence.bucket_domain_name
}
