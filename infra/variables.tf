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
  description = "owner/repo allowed to assume the deploy role via GitHub OIDC."
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
  default     = ""

  validation {
    condition     = length(var.tfstate_bucket) > 0
    error_message = "tfstate_bucket must be set (in terraform.tfvars) to the same bucket name as backend.tf's `bucket` value — it can't be left blank."
  }
}
