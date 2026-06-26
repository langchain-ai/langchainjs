---
"@langchain/openai": patch
---

fix(openai): drop reasoning content blocks in legacy Chat Completions serializer

When an assistant message carrying a `reasoning` content block (e.g. replayed from a LangGraph checkpoint, or produced when reasoning was enabled then disabled) is sent through the Chat Completions API without `response_metadata.output_version === "v1"`, the legacy content path forwarded the block verbatim. OpenAI rejects it with `400 Invalid value: 'reasoning'. Supported values are: 'text', 'image_url', 'input_audio', 'refusal', ...`. Reasoning blocks are now dropped on this path, matching how `tool_use` blocks are already handled and how the v1 content path already filters to text.
