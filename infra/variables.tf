variable "aws_region" {
  description = "Region for the S3 bucket and IAM resources (CloudFront is global)."
  type        = string
  default     = "eu-west-2"
}

variable "project" {
  description = "Project name, used to prefix resource names."
  type        = string
  default     = "portfolio"
}

variable "bucket_name" {
  description = "S3 bucket name. Leave empty to derive a globally-unique name from project + account id."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub's OIDC sub-claim prefix for the repo allowed to assume the deploy role. Normally 'owner/repo', but a renamed repo gets an immutable ID-suffixed subject instead — verify with `gh api repos/OWNER/REPO/actions/oidc/customization/sub` before applying, or every AssumeRoleWithWebIdentity call returns 'Not authorized'."
  type        = string
  default     = "igor-siergiej/portfolio"
}

variable "price_class" {
  description = "CloudFront price class (PriceClass_100 = NA+EU, cheapest)."
  type        = string
  default     = "PriceClass_100"
}

variable "domain_name" {
  description = "Domain to host in Route 53 (delegate NS records here from the registrar). Empty (the default) skips ACM and Route 53 entirely and serves the site off its *.cloudfront.net URL with CloudFront's default certificate."
  type        = string
  default     = ""
}

variable "tfstate_bucket" {
  description = "S3 bucket holding this project's Terraform state (must already exist — create it manually before the first `terraform init`; must match backend.tf's `bucket` value exactly)."
  type        = string
  default     = "portfolio-tfstate-777799876926"

  validation {
    condition     = length(var.tfstate_bucket) > 0
    error_message = "tfstate_bucket must be set (in terraform.tfvars) to the same bucket name as backend.tf's `bucket` value — it can't be left blank."
  }
}

variable "existing_oidc_provider_arn" {
  description = "ARN of an already-created GitHub Actions OIDC provider to reuse instead of creating a new one. AWS allows only one provider per URL per account, and taisei-karate owns it in this account. Leave empty only in an account that has none."
  type        = string
  default     = "arn:aws:iam::777799876926:oidc-provider/token.actions.githubusercontent.com"
}

variable "enable_monitoring" {
  description = "Provisions the SNS alert topics and CloudWatch alarms in monitoring.tf. AWS emails a subscription confirmation on first apply — unconfirmed subscriptions deliver nothing."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Address subscribed to the SNS alert topic (monitoring.tf). AWS emails a confirmation on first apply; until it's clicked the subscription delivers nothing."
  type        = string
  default     = "igorsiergiej@gmail.com"
}
