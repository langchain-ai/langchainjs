---
"@langchain/openai": patch
---

fix(openai): guard bare `JSON.parse` in Responses API converter against trailing non-whitespace characters

`convertResponsesDeltaToChatGenerationChunk` previously called `JSON.parse(msg.text)` directly when `response.text.format.type === "json_schema"`. Some models (observed with `gpt-5-mini` on `service_tier: "auto"`) intermittently emit trailing non-whitespace characters (extra tokens, control characters) after a valid JSON object, causing a `SyntaxError` that propagates as an unhandled exception and kills the entire streaming response mid-flight. The parse is now wrapped in a `try`/`catch`: on failure, `additional_kwargs.parsed` is left undefined, the stream completes normally, and the existing `withStructuredOutput` pipeline handles the typed failure — `includeRaw: true` returns `{ raw, parsed: null }` via its `withFallbacks` wrapper, `includeRaw: false` throws a typed `OutputParserException` that the caller can catch and retry. Closes #10894.
