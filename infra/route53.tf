# Skipped entirely while no domain is set (local.has_domain, see s3.tf).
resource "aws_route53_zone" "site" {
  count = local.has_domain ? 1 : 0

  name = var.domain_name
}

resource "aws_route53_record" "apex_a" {
  count = local.has_domain ? 1 : 0

  zone_id = aws_route53_zone.site[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  count = local.has_domain ? 1 : 0

  zone_id = aws_route53_zone.site[0].zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_a" {
  count = local.has_domain ? 1 : 0

  zone_id = aws_route53_zone.site[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_aaaa" {
  count = local.has_domain ? 1 : 0

  zone_id = aws_route53_zone.site[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
