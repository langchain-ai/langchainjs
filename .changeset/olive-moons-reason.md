---
"@langchain/google-genai": patch
---

Report Gemini reasoning (thinking) tokens in `usage_metadata`

`convertUsageMetadata` never read `thoughtsTokenCount`, so reasoning tokens were
missing from `output_token_details.reasoning` and excluded from `output_tokens`.
Because Gemini reports thinking tokens separately from `candidatesTokenCount`,
this left `input_tokens + output_tokens` short of `total_tokens` on any thinking
model. Streaming now converts the reasoning count to a per-chunk delta so
concatenated chunks do not sum the cumulative totals.

Also fixes an operator precedence bug in the `gemini-3-pro-preview` bracket
tracking, where `?? 0 - 200000` parsed as `?? -200000` and reported the entire
prompt token count as the amount over 200k.
