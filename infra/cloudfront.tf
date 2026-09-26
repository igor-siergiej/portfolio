resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}


resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "${var.project}-security-headers"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    xss_protection {
      protection = true
      mode_block = true
      override   = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000 # 2 years
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = var.price_class
  comment             = var.project
  aliases             = local.has_domain ? [var.domain_name, "www.${var.domain_name}"] : []

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # Managed-CachingOptimized. Per-object Cache-Control set on upload.
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # This is a static multi-page site, not a client-routed SPA: an unknown path is a real
  # 404, not a client-side route to hand to index.html. The private bucket's OAC-only
  # policy also means a genuinely missing key comes back from S3 as 403 (no s3:ListBucket
  # to distinguish "denied" from "not found"), so both codes route to the same 404 page.
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # No domain yet: fall back to CloudFront's default *.cloudfront.net certificate — an
  # ACM cert can't be issued or validated without a domain to put DNS records on. Once
  # var.domain_name is set, this switches to the ACM cert instead.
  viewer_certificate {
    cloudfront_default_certificate = local.has_domain ? null : true
    acm_certificate_arn            = local.has_domain ? aws_acm_certificate_validation.site[0].certificate_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : null
  }
}
