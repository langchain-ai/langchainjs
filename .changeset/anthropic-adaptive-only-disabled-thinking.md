---
"@langchain/anthropic": patch
---

fix(anthropic): drop default disabled thinking for adaptive-only models

`ChatAnthropic` defaults `thinking` to `{ type: "disabled" }`, but adaptive-only models (`claude-fable-5`, `claude-mythos-5`, and the other 5-series / opus-4.7+ models) reject `thinking.type: "disabled"` with `400 invalid_request_error` — they default to adaptive mode when thinking is omitted. As a result `new ChatAnthropic({ model: "claude-fable-5" }).invoke(...)` failed on every default-configured request. The disabled thinking param is now dropped for these models so the API applies its adaptive default.
