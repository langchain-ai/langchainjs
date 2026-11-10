---
"@langchain/google": patch
---

fix(google): surface model refusals as `ModelRefusalError`

Blocked prompts throw `PromptRefusedError`, which matches `ModelRefusalError.isInstance`, including when streaming. A streamed safety stop keeps the text already streamed and ends with a refusal block, and refusal blocks are dropped when history is sent back.
