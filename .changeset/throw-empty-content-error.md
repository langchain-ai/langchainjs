---
"@langchain/google-genai": minor
---

fix(google-genai): throw a typed, catchable `EmptyContentError` instead of crashing (streaming) or silently returning empty content / an empty `generations` array (non-streaming) when Gemini returns a candidate with no content — whether from an explicit block (safety/recitation filter, rejected prompt) or the model just not producing usable output (a malformed function call, a thinking model exhausting its token budget).

**Migration:** if your code inspects a response for signs of missing content — an empty `content`/`tool_calls`, `additional_kwargs.finishReason`, or an empty `generations` array from `.generate()`/`.batch()` — that code path is now unreachable; the call throws instead. Wrap it in `try/catch` and check `EmptyContentError.isInstance(error)` (exposed from `@langchain/google-genai`), inspecting `error.finishReason` / `error.blockReason`.
