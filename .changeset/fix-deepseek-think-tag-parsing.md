---
"@langchain/deepseek": minor
---

fix(deepseek): disable <think> tag parsing by default, add enableThinkTagParsing option

`<think>...</think>` tag parsing in `_streamResponseChunks` (added in #9726) is
now disabled by default and opt-in via `enableThinkTagParsing: true`. The
official DeepSeek API (`api.deepseek.com`) returns reasoning content in the
dedicated `reasoning_content` field (already handled by `ChatOpenAICompletions`). When this parsing is enabled by default, it
incorrectly strips `<think>` tags from normal content produced by non-reasoning
models like `deepseek-chat` (`deepseek-v4-flash` with thinking disabled), or deepseek-v4-flash/deepseek-v4-pro with thinking disabled, moving that content into `reasoning_content` and leaving the response content corrupted.

When using third-party proxies or older API endpoints that embed reasoning in
`<think>` tags, set `enableThinkTagParsing: true`.
