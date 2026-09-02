---
"@langchain/core": patch
---

fix(core): finalize streamed Anthropic server tool args

Keep Anthropic `web_search` server-tool arguments as the raw streamed JSON string until the stream has produced valid JSON, then expose the parsed JSON object in the standard `server_tool_call` content block.
