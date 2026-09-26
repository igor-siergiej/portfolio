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
  description = <<-DESC
    GitHub's OIDC sub-claim prefix for the repo allowed to assume the deploy role. The
    tutorial value is 'owner/repo', but GitHub issues an immutable, ID-suffixed subject
    ('owner@<owner-id>/repo@<repo-id>') for any repository created on or after 15 July
    2026, and for any repository renamed or transferred after that date. A rename is not
    what causes it — creation date alone is enough. Older repositories can also opt in.

    A wrong value makes every AssumeRoleWithWebIdentity call fail with 'Not authorized
    to perform sts:AssumeRoleWithWebIdentity' — a message that says nothing about
    repository names. The default was read from the live repo; to re-verify, run:

        gh api repos/OWNER/REPO/actions/oidc/customization/sub

    and copy `sub_claim_prefix` here verbatim, minus its leading 'repo:'
    (e.g. 'igor-siergiej@79415930/portfolio@1312344887'). Only if
    `use_immutable_subject` is false does plain 'owner/repo' apply.
  DESC
  type        = string
  default     = "igor-siergiej@79415930/portfolio@1389815265"
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
    error_message = "tfstate_bucket can't be blank — it must name the same bucket as backend.tf's `bucket` value. Both are committed with that name (this variable's default, and the literal in backend.tf); backend.tf can't reference variables, so pointing this stack at a different bucket means editing both by hand."
  }
}

variable "existing_oidc_provider_arn" {
  description = "ARN of an already-created GitHub Actions OIDC provider to reuse instead of creating a new one. AWS allows only one provider per URL per account, and taisei-karate owns it in this account. Leave empty only in an account that has none."
  type        = string
  default     = "arn:aws:iam::777799876926:oidc-provider/token.actions.githubusercontent.com"
}

variable "enable_monitoring" {
  description = "Provisions the SNS alert topic and CloudWatch alarms in monitoring.tf. AWS emails a subscription confirmation on first apply — an unconfirmed subscription delivers nothing."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Address subscribed to the SNS alert topic (monitoring.tf). AWS emails a confirmation on first apply; until it's clicked the subscription delivers nothing."
  type        = string
  default     = "igorsiergiej@gmail.com"
}
