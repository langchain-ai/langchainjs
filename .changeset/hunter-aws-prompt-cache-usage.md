---
"@langchain/aws": patch
---

fix(aws): map Bedrock prompt cache usage metadata to input token details

Include `cacheReadInputTokens` and `cacheWriteInputTokens` from Bedrock Converse
responses in `usage_metadata.input_token_details` for both invoke and stream
metadata handling.
