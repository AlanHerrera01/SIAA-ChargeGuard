# -----------------------------------------------------------------------------
# 1. GitHub Actions OIDC Provider & Deployment Role
# -----------------------------------------------------------------------------
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c5860a5f6d3b797e16109a1cc1a30f6b492ee0d"
  ]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    effect  = "Allow"
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
        "repo:${var.github_repo}:*",
        "repo:${var.github_repo_oidc_subject}:*",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "chargeguard-github-actions-role"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "github_actions_permissions" {
  # DynamoDB scoped access
  statement {
    sid    = "DynamoDBScopedAccess"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:CreateTable",
      "dynamodb:UpdateTable",
      "dynamodb:DeleteTable",
      "dynamodb:ListTables",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DescribeTimeToLive",
      "dynamodb:UpdateTimeToLive",
      "dynamodb:ListTagsOfResource",
      "dynamodb:TagResource",
      "dynamodb:UntagResource"
    ]
    resources = [
      "arn:aws:dynamodb:${var.aws_region}:${var.account_id}:table/chargeguard-*"
    ]
  }

  # S3 scoped access
  statement {
    sid    = "S3ScopedAccess"
    effect = "Allow"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:GetBucketLocation",
      "s3:GetBucketPolicy",
      "s3:GetBucketAcl",
      "s3:GetBucketVersioning",
      "s3:GetBucketLifecycleConfiguration",
      "s3:GetEncryptionConfiguration",
      "s3:GetBucketPublicAccessBlock",
      "s3:PutBucketPolicy",
      "s3:PutBucketAcl",
      "s3:PutBucketVersioning",
      "s3:PutBucketLifecycleConfiguration",
      "s3:PutEncryptionConfiguration",
      "s3:PutBucketPublicAccessBlock",
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      "arn:aws:s3:::chargeguard-*",
      "arn:aws:s3:::chargeguard-*/*"
    ]
  }

  # Lambda scoped access
  statement {
    sid    = "LambdaScopedAccess"
    effect = "Allow"
    actions = [
      "lambda:CreateFunction",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:DeleteFunction",
      "lambda:ListFunctions",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:GetPolicy",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:ListTags"
    ]
    resources = [
      "arn:aws:lambda:${var.aws_region}:${var.account_id}:function:chargeguard-*"
    ]
  }

  # API Gateway scoped access
  statement {
    sid    = "ApiGatewayScopedAccess"
    effect = "Allow"
    actions = [
      "apigateway:GET",
      "apigateway:POST",
      "apigateway:PUT",
      "apigateway:PATCH",
      "apigateway:DELETE"
    ]
    resources = [
      "arn:aws:apigateway:${var.aws_region}::/apis",
      "arn:aws:apigateway:${var.aws_region}::/apis/*"
    ]
  }

  # EventBridge scoped access
  statement {
    sid    = "EventBridgeScopedAccess"
    effect = "Allow"
    actions = [
      "events:CreateEventBus",
      "events:DeleteEventBus",
      "events:DescribeEventBus",
      "events:PutRule",
      "events:DeleteRule",
      "events:DescribeRule",
      "events:PutTargets",
      "events:RemoveTargets",
      "events:ListTargetsByRule",
      "events:TagResource",
      "events:UntagResource",
      "events:ListTagsForResource"
    ]
    resources = [
      "arn:aws:events:${var.aws_region}:${var.account_id}:event-bus/chargeguard-*",
      "arn:aws:events:${var.aws_region}:${var.account_id}:rule/chargeguard-*"
    ]
  }

  # CloudWatch Logs
  statement {
    sid    = "LogsScopedAccess"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:DescribeLogGroups",
      "logs:PutRetentionPolicy",
      "logs:DeleteRetentionPolicy",
      "logs:ListTagsForResource",
      "logs:TagResource",
      "logs:UntagResource"
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/lambda/chargeguard-*",
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/bedrock/agentcore/chargeguard*"
    ]
  }

  # Amplify scoped access
  statement {
    sid    = "AmplifyScopedAccess"
    effect = "Allow"
    actions = [
      "amplify:GetApp",
      "amplify:CreateApp",
      "amplify:UpdateApp",
      "amplify:DeleteApp",
      "amplify:CreateBranch",
      "amplify:GetBranch",
      "amplify:UpdateBranch",
      "amplify:DeleteBranch",
      "amplify:CreateDeployment",
      "amplify:StartDeployment",
      "amplify:StartJob",
      "amplify:GetJob",
      "amplify:ListJobs",
      "amplify:TagResource",
      "amplify:UntagResource",
      "amplify:ListTagsForResource"
    ]
    resources = [
      "arn:aws:amplify:${var.aws_region}:${var.account_id}:apps/*",
      "arn:aws:amplify:${var.aws_region}:${var.account_id}:apps/*/branches/*",
      "arn:aws:amplify:${var.aws_region}:${var.account_id}:apps/*/branches/*/deployments/*"
    ]
  }

  # IAM PassRole for ChargeGuard execution roles
  statement {
    sid    = "IamPassRoleScoped"
    effect = "Allow"
    actions = [
      "iam:PassRole",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies"
    ]
    resources = [
      "arn:aws:iam::${var.account_id}:role/chargeguard-*"
    ]
  }
}

resource "aws_iam_role_policy" "github_actions" {
  name   = "chargeguard-github-actions-policy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_permissions.json
}

# -----------------------------------------------------------------------------
# 2. Lambda Execution Role
# -----------------------------------------------------------------------------
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "chargeguard-lambda-exec-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_permissions" {
  # CloudWatch Logs
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/lambda/chargeguard-*:*"
    ]
  }

  # DynamoDB access to the 3 ChargeGuard tables and their GSIs
  statement {
    sid    = "DynamoDBTableAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem"
    ]
    resources = flatten([
      for arn in var.dynamodb_table_arns : [
        arn,
        "${arn}/index/*"
      ]
    ])
  }

  # S3 access to the ChargeGuard evidence bucket
  statement {
    sid    = "S3EvidenceAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket"
    ]
    resources = [
      var.evidence_bucket_arn,
      "${var.evidence_bucket_arn}/*"
    ]
  }

  # Bedrock Model Invocations: strictly limited to Sonnet 4.5, Haiku 4.5 & foundation routing
  statement {
    sid    = "BedrockModelInvocation"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:aws:bedrock:${var.aws_region}:${var.account_id}:inference-profile/${var.bedrock_model_id}",
      "arn:aws:bedrock:${var.aws_region}:${var.account_id}:inference-profile/${var.bedrock_model_id_fast}",
      "arn:aws:bedrock:*::foundation-model/*"
    ]
  }
}

resource "aws_iam_role_policy" "lambda_exec" {
  name   = "chargeguard-lambda-exec-policy"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

# -----------------------------------------------------------------------------
# 3. AgentCore Runtime Role (Least Privilege)
# -----------------------------------------------------------------------------
data "aws_iam_policy_document" "agentcore_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "bedrock.amazonaws.com",
        "lambda.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "agentcore" {
  name               = "chargeguard-agentcore-role"
  assume_role_policy = data.aws_iam_policy_document.agentcore_assume.json
}

data "aws_iam_policy_document" "agentcore_permissions" {
  statement {
    sid    = "AgentCoreLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/bedrock/agentcore/chargeguard*:*",
      "arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/lambda/chargeguard-*:*"
    ]
  }

  statement {
    sid    = "AgentCoreBedrockAccess"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:aws:bedrock:${var.aws_region}:${var.account_id}:inference-profile/${var.bedrock_model_id}",
      "arn:aws:bedrock:${var.aws_region}:${var.account_id}:inference-profile/${var.bedrock_model_id_fast}",
      "arn:aws:bedrock:*::foundation-model/*"
    ]
  }

  statement {
    sid    = "AgentCoreDynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = flatten([
      for arn in var.dynamodb_table_arns : [
        arn,
        "${arn}/index/*"
      ]
    ])
  }

  statement {
    sid    = "AgentCoreS3Access"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      var.evidence_bucket_arn,
      "${var.evidence_bucket_arn}/*"
    ]
  }
}

resource "aws_iam_role_policy" "agentcore" {
  name   = "chargeguard-agentcore-policy"
  role   = aws_iam_role.agentcore.id
  policy = data.aws_iam_policy_document.agentcore_permissions.json
}
