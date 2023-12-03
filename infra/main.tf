variable "prefix" {
  type    = string
  default = "shmuelk-job-alerts"
}
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = "eu-west-3"
}

resource "aws_sqs_queue" "job_alerts" {
  name = var.prefix
}

resource "aws_s3_bucket" "job_alerts_bucket" {
  bucket = var.prefix
}


resource "aws_iam_user" "job_alerts_user" {
  name = var.prefix
}

resource "aws_iam_policy" "job_alerts_sqs_policy" {
  name        = "${var.prefix}_sqs"
  description = "A policy that grants access to the job alerts SQS queue"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action   = "sqs:*",
        Effect   = "Allow",
        Resource = aws_sqs_queue.job_alerts.arn
      }
    ]
  })
}

resource "aws_iam_policy" "job_alerts_s3_policy" {
  name        = "${var.prefix}_s3"
  description = "A policy that grants access to the job alerts S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "s3:*",
        Effect = "Allow",
        Resource = [
          "${aws_s3_bucket.job_alerts_bucket.arn}/*",
          aws_s3_bucket.job_alerts_bucket.arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "ses_send_email_policy" {
  name        = "${var.prefix}_ses_send_email"
  description = "Policy to allow sending emails via SES"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ],
        Effect   = "Allow",
        Resource = "*" // This applies to all SES resources
      }
    ]
  })
}


resource "aws_iam_user_policy_attachment" "ses_send_email_attach" {
  user       = aws_iam_user.job_alerts_user.name
  policy_arn = aws_iam_policy.ses_send_email_policy.arn
}


resource "aws_iam_user_policy_attachment" "bucket_attach" {
  user       = aws_iam_user.job_alerts_user.name
  policy_arn = aws_iam_policy.job_alerts_s3_policy.arn
}

resource "aws_iam_user_policy_attachment" "sqs_attach" {
  user       = aws_iam_user.job_alerts_user.name
  policy_arn = aws_iam_policy.job_alerts_sqs_policy.arn
}
