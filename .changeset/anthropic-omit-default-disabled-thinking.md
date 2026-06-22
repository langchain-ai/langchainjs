---
"@langchain/anthropic": patch
---

Stop sending `thinking: { type: "disabled" }` on `ChatAnthropic` requests when the user never configured thinking. The disabled value is now only emitted when it is explicitly set, so adaptive-only models (e.g. `claude-fable-5`) that reject an explicit `thinking.type: "disabled"` no longer fail with a 400 on a default `ChatAnthropic` instance.
