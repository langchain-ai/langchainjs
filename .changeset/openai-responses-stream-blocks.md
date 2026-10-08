---
"@langchain/openai": patch
---

fix(openai): native Responses `streamEvents()` now keeps reasoning items (with `id` and `encrypted_content`), built-in tool calls and citations, so a streamed turn replays without stored items. Replaying v1 messages from OpenAI now rebuilds built-in web, file and tool search calls as native Responses items instead of function calls, and sends their text citations back as annotations. `response.output_item.done` events for reasoning and tool items and `response.output_text.annotation.added` now arrive as content blocks instead of `provider` events.
