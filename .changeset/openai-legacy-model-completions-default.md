---
"@langchain/openai": minor
---

`ChatOpenAI` now defaults unknown and newly released OpenAI models to the Responses API instead of requiring an updated allowlist for each new release. A frozen list of legacy model families (GPT-3.5 through GPT-5.5, the o-series, chat-only audio/search models, and their date snapshots) still defaults to Chat Completions, and fine-tuned `ft:` models are routed by their base model. Previously, `useResponsesApi: false` could not force Chat Completions for models matched by the routing heuristic; an explicit `useResponsesApi` value now always wins over the model heuristic, while required Responses-only features (built-in/custom tools and Responses-only kwargs) still route to the Responses API.
