---
"@langchain/google": patch
---

fix(google): set `toolConfig.includeServerSideToolInvocations` when a tools array mixes built-in tools (e.g. `googleSearch`, `codeExecution`) with function-declaration tools

Gemini rejects such a mix with a 400 (`Please enable tool_config.include_server_side_tool_invocations...`) unless this flag is set. Only Gemini 3+ models support mixing built-in and function-calling tools at all; earlier generations reject the combination outright regardless of this flag.
