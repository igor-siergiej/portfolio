# GitHub Actions OIDC federation → short-lived deploy role (no stored AWS keys).
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.project}-gha-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  statement {
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.project}-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

# Terraform CI: broader permissions than gha-deploy (manages IAM/CloudFront/ACM/Route53,
# not just S3+CloudFront invalidation), so it's a separate role — gha-deploy stays
# narrowly scoped to the app-deploy job only.
#
# Cannot reuse data.aws_iam_policy_document.assume: that document only allows the
# `repo:...:ref:refs/heads/main` sub claim, which push-triggered gha-deploy always
# presents. This role is also assumed from the `plan` job on pull_request, where GitHub's
# OIDC token sub claim is `repo:<owner>/<repo>:pull_request` instead — a different value,
# not a ref at all. Confirmed the hard way: reusing `assume` here 403'd every PR-triggered
# AssumeRoleWithWebIdentity call in production before this was added.
data "aws_iam_policy_document" "assume_terraform" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main", # apply job (push to main)
        "repo:${var.github_repo}:pull_request",        # plan job (pull_request)
      ]
    }
  }
}

resource "aws_iam_role" "terraform" {
  name               = "${var.project}-gha-terraform"
  assume_role_policy = data.aws_iam_policy_document.assume_terraform.json
}

data "aws_iam_policy_document" "terraform" {
  # Every `terraform plan`/`apply` refreshes every resource in this state file (S3,
  # CloudFront, IAM roles, the OIDC provider itself) regardless of which resource actually
  # changed, and the AWS provider's exact set of read calls per resource isn't practical to
  # enumerate from the outside — production plan failures surfaced missing Get/List/Describe
  # actions one at a time. So read-only access for CloudFront/IAM is granted broadly here;
  # every mutating action (Create/Update/Delete/Put) stays in its own narrowly-scoped
  # statement below. S3 reads are scoped separately (see SiteBucketRead) since, unlike those
  # services, both S3 resources here have ARNs known up front — an account-wide
  # s3:Get*/List* would grant read access to every object in every bucket in the account,
  # not just this project's.
  statement {
    sid = "ReadOnly"
    actions = [
      "cloudfront:Get*",
      "cloudfront:List*",
      "cloudfront:Describe*",
      "iam:Get*",
      "iam:List*",
      "acm:Describe*",
      "acm:List*",
      "route53:Get*",
      "route53:List*",
    ]
    resources = ["*"]
  }

  # ACM: cert ARN is unknown before creation, so Resource "*" — same pattern as CloudFront
  # above.
  statement {
    sid = "Acm"
    actions = [
      "acm:RequestCertificate",
      "acm:DeleteCertificate",
      "acm:AddTagsToCertificate",
    ]
    resources = ["*"]
  }

  # Route53: hosted zone ID is unknown before creation (Resource "*"), but record changes
  # and reads are scoped to hosted zones generally — AWS assigns zone IDs, so this can't be
  # pinned to this project's zone specifically without a circular dependency.
  statement {
    sid = "Route53"
    actions = [
      "route53:CreateHostedZone",
      "route53:DeleteHostedZone",
      "route53:ChangeTagsForResource",
      "route53:ChangeResourceRecordSets",
    ]
    resources = ["*"]
  }

  # The site bucket itself: create (for a from-scratch apply), versioning, lifecycle,
  # policy, public-access-block. Object-level actions are separate below.
  statement {
    sid = "SiteBucket"
    actions = [
      "s3:CreateBucket",
      "s3:PutBucketVersioning",
      "s3:PutLifecycleConfiguration",
      "s3:PutBucketPolicy",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketTagging",
    ]
    resources = [aws_s3_bucket.site.arn]
  }

  # Reads for the site bucket only — deliberately not folded into the account-wide
  # ReadOnly statement above (see its comment). Covers every Get*/List* the AWS provider
  # calls while refreshing aws_s3_bucket* (versioning, lifecycle, policy, public-access
  # block, accelerate/encryption/replication config, etc.) without granting access to any
  # other bucket in the account.
  statement {
    sid       = "SiteBucketRead"
    actions   = ["s3:Get*", "s3:List*"]
    resources = [aws_s3_bucket.site.arn, "${aws_s3_bucket.site.arn}/*"]
  }

  # Terraform doesn't normally touch site bucket objects (the deploy job's `s3 sync`
  # does), but a destroy/recreate needs delete rights on whatever's left.
  statement {
    sid       = "SiteBucketObjects"
    actions   = ["s3:DeleteObject", "s3:DeleteObjectVersion"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }

  # tfstate bucket predates this config (see backend.tf) so it isn't a managed resource
  # here — its ARN is built from var.tfstate_bucket, which must be set (via
  # terraform.tfvars) to the same bucket name as backend.tf's literal `bucket` value;
  # backend.tf can't reference variables, so the two have to be kept in sync by hand.
  # Kept explicit and self-contained (not folded into the generic ReadOnly statement
  # above) since state read/write is a distinct, security-sensitive concern from the
  # infra it describes.
  statement {
    sid     = "TfState"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [
      "arn:aws:s3:::${var.tfstate_bucket}",
      "arn:aws:s3:::${var.tfstate_bucket}/*",
    ]
  }

  # CloudFront: distribution/OAC/response-headers-policy/function CRUD. Resource "*" —
  # AWS assigns the ID, so it can't be named before it exists.
  statement {
    sid = "CloudFront"
    actions = [
      "cloudfront:CreateDistribution",
      "cloudfront:UpdateDistribution",
      "cloudfront:DeleteDistribution",
      "cloudfront:TagResource",
      "cloudfront:UntagResource",
      "cloudfront:CreateOriginAccessControl",
      "cloudfront:UpdateOriginAccessControl",
      "cloudfront:DeleteOriginAccessControl",
      "cloudfront:CreateResponseHeadersPolicy",
      "cloudfront:UpdateResponseHeadersPolicy",
      "cloudfront:DeleteResponseHeadersPolicy",
      "cloudfront:CreateFunction",
      "cloudfront:UpdateFunction",
      "cloudfront:DeleteFunction",
      "cloudfront:PublishFunction",
    ]
    resources = ["*"]
  }

  # IAM: scoped to this project's own role names — and this role's own future edits, since
  # its name (${project}-gha-terraform) matches the same pattern.
  # Deliberately no create/update/delete for the OIDC provider itself (oidc.tf, this
  # file) — read access comes from the ReadOnly statement above, but letting
  # gha-terraform modify its own trust anchor would be a materially worse escalation than
  # this role-creation surface; if the provider ever needs to change, that goes through a
  # manual/admin apply (see infra/README.md's note on importing a pre-existing provider).
  statement {
    sid = "Iam"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:TagRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project}-*"]
  }
}

resource "aws_iam_role_policy" "terraform" {
  name   = "${var.project}-terraform"
  role   = aws_iam_role.terraform.id
  policy = data.aws_iam_policy_document.terraform.json
}
