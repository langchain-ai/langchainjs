---
"@langchain/core": minor
"@langchain/openai": minor
"@langchain/anthropic": minor
"@langchain/aws": minor
---

feat: stream tool-call args as `tool-call-delta` slices

Tool-call and server-tool-call args now stream as `tool-call-delta` events, which carry only the new slice of the args, instead of `block-delta` snapshots of the args so far. A large tool call now costs about the same bytes on the wire as the same length of text.

- This covers the compat bridge (any model that only implements `_streamResponseChunks`), the OpenAI-compatible converter (OpenAI Completions, Groq, Mistral, IBM, OpenRouter, Perplexity, DeepSeek, Fireworks, Together AI and xAI Completions), OpenAI and xAI Responses, Anthropic (client and server tool calls) and Bedrock Converse. Google and Ollama still send one complete snapshot per call.
- A tool call's `id`, `name` and `index` go on `content-block-start`, which carries no args. An `id` or `name` that arrives later reaches consumers on `content-block-finish`.
- If you read raw events and their `block-delta` `fields.args` mid-stream, or write agent stream transformers that do, read `tool-call-delta` instead. `await stream`, `.toolCalls` and the assembled message are unchanged.
- Upgrade your clients first. Older clients mishandle `tool-call-delta`. You need `@langchain/langgraph-sdk` TODO or later; `@langchain/react`, `@langchain/vue`, `@langchain/svelte` or `@langchain/angular` TODO or later; and `langchain-core` TODO or later for Python clients.
- To hold back, pin `@langchain/core` below 1.3.0. That also keeps you on `@langchain/openai`, `@langchain/anthropic`, `@langchain/aws` and `@langchain/xai` versions that send snapshots.
