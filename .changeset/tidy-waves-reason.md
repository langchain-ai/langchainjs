---
"@langchain/deepseek": patch
---

Expose DeepSeek-R1 `reasoning_content` in non-streaming responses.

Non-streaming `invoke()` previously dropped the model's reasoning, so callers
saw an inconsistent shape depending on whether they used `stream()` (which
already surfaced `reasoning_content`) or `invoke()`. The change copies the
provider's `reasoning_content`/`reasoning` field into
`response_metadata.additional_kwargs.reasoning_content`, and also extracts an
inline `<think>...</think>` block into the same key so both DeepSeek-R1
response styles are represented consistently.
