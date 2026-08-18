---
"@langchain/google-genai": minor
---

fix(google-genai): throw a typed, catchable `ContentBlockedError` instead of crashing (streaming) or silently returning empty content / an empty `generations` array (non-streaming) when Gemini returns a candidate with no content (safety/recitation block, malformed function call) or no candidates at all (blocked prompt).

**Migration:** if your code inspects a response for signs of a block — an empty `content`/`tool_calls`, `additional_kwargs.finishReason`, or an empty `generations` array from `.generate()`/`.batch()` — that code path is now unreachable; the call throws instead. Wrap it in `try/catch` and check `ContentBlockedError.isInstance(error)` (exposed from `@langchain/google-genai`), inspecting `error.finishReason` / `error.blockReason`.
