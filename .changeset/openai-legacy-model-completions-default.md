---
"@langchain/openai": major
---

`ChatOpenAI` now defaults to the Responses API for every model outside a frozen list of legacy Chat Completions models, so new OpenAI models (e.g. `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6.1-terra`) no longer need a release to route correctly.

Breaking changes:

- Unknown and custom model names (OpenAI-compatible servers, proxies, deployment aliases) now default to the Responses API. Pass `useResponsesApi: false` to keep Chat Completions.
- An explicit `useResponsesApi: false` now always wins over model-based routing. Responses-only features (built-in/custom tools, Responses-only kwargs) still use the Responses API.

GPT-3.5 through GPT-5.5, the o-series, chat-latest snapshots, audio and search models, their date snapshots, and `ft:` models built on them still default to Chat Completions.
