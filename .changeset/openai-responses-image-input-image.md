---
"@langchain/openai": patch
---

Convert standard `image` data content blocks to the Responses API native `input_image` shape. When `useResponsesApi` is active (the default for reasoning models such as the `gpt-5.x` / `o`-series), a user message carrying a LangChain standard image block (`{ type: 'image', source_type: 'base64' | 'url' | 'id', ... }`) was routed through the Chat Completions converter, producing an `image_url` part that the Responses API rejects with `400 Invalid value: 'image_url'. Supported values are ... 'input_image' ...`. This mirrors the existing `file` → `input_file` special-case (the image counterpart of #9895).
