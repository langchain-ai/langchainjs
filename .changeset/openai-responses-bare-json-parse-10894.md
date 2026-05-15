---
"@langchain/openai": patch
---

fix(openai): guard bare `JSON.parse` in Responses API converter against trailing characters

`convertResponsesDeltaToChatGenerationChunk` previously called `JSON.parse(msg.text)` directly when `response.text.format.type === "json_schema"`. Some models (observed with `gpt-5-mini` on `service_tier: "auto"`) intermittently emit trailing characters after a valid JSON object, causing a `SyntaxError` that propagates as an unhandled exception and kills the entire streaming response. The parse is now wrapped in a `try`/`catch`: on failure, `additional_kwargs.parsed` is left undefined, the rest of the message converts normally, and the caller can fall back to `msg.text` or retry. Closes #10894.
