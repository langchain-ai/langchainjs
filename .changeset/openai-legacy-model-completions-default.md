---
"@langchain/openai": major
---

`ChatOpenAI` now defaults to the Responses API for every model outside a frozen list of legacy Chat Completions models, so new OpenAI models (e.g. `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6.1-terra`) no longer need a release to route correctly.

Breaking changes:

- GPT-5 through GPT-5.5 (`gpt-5`, `gpt-5-mini`, `gpt-5.1`, `gpt-5.4`, `gpt-5.5`, ...) now default to the Responses API instead of Chat Completions.
- Unknown and custom model names (OpenAI-compatible servers, proxies, deployment aliases) now default to the Responses API. Pass `useResponsesApi: false` to keep Chat Completions.
- An explicit `useResponsesApi: false` now always wins over model-based routing. Responses-only features (built-in/custom tools, Responses-only kwargs) still use the Responses API.

GPT-3.5, GPT-4, GPT-4o, GPT-4.1, GPT-4.5, the o-series, chat-latest snapshots, audio and search models, their date snapshots, and `ft:` models built on them still default to Chat Completions.
