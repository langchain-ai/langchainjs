---
"@langchain/core": patch
"@langchain/google": patch
"@langchain/google-genai": patch
---

Fix Gemini `thoughtSignature` getting corrupted or lost during streaming.

- `@langchain/core`: a repeated `thoughtSignature` was concatenated instead
  of kept as-is; it's now on the same allowlist as `id`/`name`.
- `@langchain/google` / `@langchain/google-genai`: a streamed delta
  continuing a tool call can omit `functionCall.id`; both now reuse the last
  real id seen instead of generating a fresh one, so continuations aren't
  orphaned.
