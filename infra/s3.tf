data "aws_caller_identity" "current" {}

locals {
  bucket_name = coalesce(var.bucket_name, "${var.project}-site-${data.aws_caller_identity.current.account_id}")
  origin_id   = "s3-${local.bucket_name}"
  # No domain yet: skip ACM/Route53 and serve straight off the *.cloudfront.net URL with
  # CloudFront's default certificate. Set var.domain_name later to turn these back on.
  has_domain = var.domain_name != ""
}

resource "aws_s3_bucket" "site" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Old versions are only for rollback, not an audit trail — don't keep them forever.
resource "aws_s3_bucket_lifecycle_configuration" "site" {
  bucket     = aws_s3_bucket.site.id
  depends_on = [aws_s3_bucket_versioning.site]

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    # Empty filter = applies to every object; required explicitly since provider v6 (AWS
    # provider warns and will error on this being implicit).
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Only CloudFront (via OAC) may read objects.
data "aws_iam_policy_document" "bucket" {
  statement {
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.bucket.json
}
