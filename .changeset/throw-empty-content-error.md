---
"@langchain/google-genai": minor
---

fix(google-genai): throw a typed, catchable `EmptyContentError` instead of silently returning empty content / an empty `generations` array when a non-streaming call (`.invoke()`, `.generate()`, `.batch()`) gets back a Gemini candidate with no content — whether from an explicit block (safety/recitation filter, rejected prompt) or the model just not producing usable output (a malformed function call, a thinking model exhausting its token budget). The streaming path (`.stream()`) is unaffected by this behavior change; it now safely skips a contentless chunk instead of throwing a raw `TypeError`, matching its prior (pre-crash) behavior.

**Migration:** if your non-streaming code inspects a response for signs of missing content — an empty `content`/`tool_calls`, `additional_kwargs.finishReason`, or an empty `generations` array from `.generate()`/`.batch()` — that code path is now unreachable; the call throws instead. Wrap it in `try/catch` and check `EmptyContentError.isInstance(error)` (exposed from `@langchain/google-genai`), inspecting `error.finishReason` / `error.blockReason`.
