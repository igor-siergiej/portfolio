# Operational alerting: an email-subscribed SNS topic plus CloudWatch alarms on the traffic
# shapes that mean something is wrong or someone is hammering the distribution. Alarms
# notify; they do not block. A sustained flood still needs a manual response.
#
# There is deliberately no CloudTrail trail here, and no flag to create one.
# taisei-karate's trail is account-wide and already captures this account's management
# events, and AWS bills only one free copy of management events per account — a second
# trail would pay twice for identical data plus its own S3 storage. If this project ever
# needs an audit trail that outlives the taisei stack, that is a deliberate change adding
# real HCL (trail + log bucket + bucket policy), not a flag flip.

locals {
  monitoring_enabled = var.enable_monitoring ? 1 : 0
}

# One topic, in us-east-1, because both alarms below are CloudFront alarms and CloudFront
# publishes metrics only to us-east-1. A CloudWatch alarm can only target an SNS topic in
# its own region, so the day this stack grows a regional alarm (S3, Lambda, API Gateway —
# all eu-west-2 here) it needs a second topic in eu-west-2 to notify. Until then a regional
# topic would be a subscription nobody confirms guarding a queue nothing writes to, and a
# permanently pending confirmation is what trains people to ignore the one that matters.
#
# Expect one confirmation email on the first apply — unconfirmed, it delivers nothing.
#
# depends_on the terraform role policy (oidc.tf): a CI apply that grants this role its
# sns:*/cloudwatch:* permissions and then immediately creates these resources would race IAM
# propagation without it.
resource "aws_sns_topic" "alerts_use1" {
  provider   = aws.us_east_1
  count      = local.monitoring_enabled
  name       = "${var.project}-alerts-use1"
  depends_on = [aws_iam_role_policy.terraform]
}

resource "aws_sns_topic_subscription" "alerts_use1_email" {
  provider  = aws.us_east_1
  count     = local.monitoring_enabled
  topic_arn = aws_sns_topic.alerts_use1[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# A static site behind CloudFront should essentially never 5xx. Sustained errors mean the
# S3 origin or the OAC bucket policy is broken — i.e. the site is down.
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  provider            = aws.us_east_1
  count               = local.monitoring_enabled
  alarm_name          = "${var.project}-cloudfront-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "CloudFront 5xx rate above 1% for 10 minutes — origin or bucket policy is broken."
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.alerts_use1[0].arn]
  ok_actions    = [aws_sns_topic.alerts_use1[0].arn]
}

# Nothing rate-limits the cached static paths (no WAF by design), so an L7 flood runs up
# CloudFront request and data-transfer charges. Shield Standard absorbs L3/L4; this catches
# the request flood so it can be met with a manual response.
resource "aws_cloudwatch_metric_alarm" "cloudfront_requests" {
  provider            = aws.us_east_1
  count               = local.monitoring_enabled
  alarm_name          = "${var.project}-cloudfront-request-flood"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Requests"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Sum"
  threshold           = 50000
  alarm_description   = "More than 50k CloudFront requests in 5 minutes — far above normal portfolio traffic."
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.alerts_use1[0].arn]
}
