---
"@langchain/aws": patch
---

Report Bedrock thinking tokens as `output_token_details.reasoning`

`ChatBedrockConverse` now accepts `additionalModelResponseFieldPaths` (constructor and call option, matching `additional_model_response_field_paths` in Python) and forwards it to Converse and ConverseStream. When the response includes Anthropic's native usage (`additionalModelResponseFields.usage.output_tokens_details.thinking_tokens`, returned when requesting `["/usage"]`), the count is mapped to `usage_metadata.output_token_details.reasoning` for `invoke()`, `.stream()` and `streamEvents()`. `output_tokens` is unchanged, and nothing changes when the field is absent.
