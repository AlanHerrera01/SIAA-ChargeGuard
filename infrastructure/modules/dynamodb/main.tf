resource "aws_dynamodb_table" "transactions" {
  name                        = "chargeguard-transactions"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "user_id"
  range_key                   = "sk"
  deletion_protection_enabled = false

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "merchant_id"
    type = "S"
  }

  global_secondary_index {
    name            = "merchant-index"
    hash_key        = "merchant_id"
    range_key       = "sk"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "cases" {
  name                        = "chargeguard-cases"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "case_id"
  deletion_protection_enabled = false

  attribute {
    name = "case_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "decisions" {
  name                        = "chargeguard-decisions"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "decision_id"
  deletion_protection_enabled = false

  attribute {
    name = "decision_id"
    type = "S"
  }

  attribute {
    name = "case_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "case-index"
    hash_key        = "case_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "pending-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }
}
