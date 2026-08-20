---
"@langchain/core": patch
"@langchain/google-genai": patch
---

Fix `llmOutput` token usage on the streaming paths

`_streamIterator` reassigned `llmOutput` on every chunk, so the value that
survived was the final chunk's usage. That is correct for providers that report
cumulative totals on a last usage chunk, but for providers emitting per-chunk
deltas it truncated the result to the final delta — a streamed Gemini call
reported 3 total tokens instead of 458. It now derives the counts from the
concatenated chunk, which is already summed correctly for both conventions.

`ChatGoogleGenerativeAI._generate` also returned
`llmOutput: { estimatedTokenUsage: {} }` on its streaming branch: an object that
was declared, never populated, and keyed differently from the non-streaming path
of the same class. It now reports the real counts under `tokenUsage`, matching
`mapGenerateContentResultToChatResult`.

Callback-based token tracking reads `llmOutput`, so both paths previously
under-reported usage while `message.usage_metadata` was correct.
