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

# REQUIRED — do not delete. Astro builds directory-format output: `/about` is the object
# `about/index.html`, `/projects/shoppingo` is `projects/shoppingo/index.html`. A CloudFront
# S3 REST origin does not resolve directory indexes (default_root_object only covers `/`),
# so without this rewrite a request for `/about` asks S3 for the key `about`, the OAC-only
# bucket policy answers 403, and the custom_error_response below serves /404.html. Every
# route on the site except `/` and the handful of real files at the root (/rss.xml,
# /cv.pdf, /robots.txt, /sitemap*.xml) would render the 404 page.
#
# `astro preview` resolves directory indexes itself, so the e2e suite passes with or
# without this. Only the post-deploy smoke test in ci-cd.yml notices it missing, and
# only on the next site deploy — a terraform apply that removes it breaks production
# until then.
resource "aws_cloudfront_function" "directory_index" {
  name    = "${var.project}-directory-index"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
        var request = event.request;
        if (request.uri.endsWith('/')) {
            request.uri += 'index.html';
        } else if (!request.uri.includes('.')) {
            request.uri += '/index.html';
        }
        return request;
    }
  JS
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

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.directory_index.arn
    }
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
