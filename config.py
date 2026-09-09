import os

MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
)

MODEL_ID_FAST = os.getenv(
    "BEDROCK_MODEL_ID_FAST",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
)