---
"langchain": patch
---

Skip thought summaries when `ProviderStrategy.parse` looks for structured output. Gemini returns thought summaries as text blocks flagged with `thought`, so they are indistinguishable from the real payload by `type` alone. `parse` took the first text block and stopped, so it read the summary — prose, never valid JSON — and returned `undefined` while the structured block sat untouched behind it.
