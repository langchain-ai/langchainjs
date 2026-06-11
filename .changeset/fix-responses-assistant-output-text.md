---
"@langchain/openai": patch
---

fix(openai): emit `output_text` for assistant text blocks in the Responses converter

`convertStandardContentMessageToResponsesInput` serialized assistant `text` and `text-plain` content blocks as `input_text`, which the Responses API rejects for assistant-role messages (it requires `output_text`/`refusal`). This surfaced on multi-turn conversations once a text-bearing assistant turn was re-sent. Assistant text/text-plain now emit `output_text` (matching the legacy converter path); user and system roles continue to use `input_text`. Fixes #9879.
