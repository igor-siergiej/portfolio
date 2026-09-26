output "bucket_name" {
  description = "Set as GitHub repo variable S3_BUCKET."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "Set as GitHub repo variable CLOUDFRONT_DISTRIBUTION_ID."
  value       = aws_cloudfront_distribution.site.id
}

output "deploy_role_arn" {
  description = "Set as GitHub repo variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.deploy.arn
}

output "terraform_role_arn" {
  description = "Set as GitHub repo variable AWS_TERRAFORM_ROLE_ARN."
  value       = aws_iam_role.terraform.arn
}

output "aws_region" {
  description = "Set as GitHub repo variable AWS_REGION."
  value       = var.aws_region
}

output "cloudfront_url" {
  description = "Live site URL."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "route53_name_servers" {
  description = "Set these as the NS records at your domain registrar to delegate the domain. Null until var.domain_name is set."
  value       = local.has_domain ? aws_route53_zone.site[0].name_servers : null
}
