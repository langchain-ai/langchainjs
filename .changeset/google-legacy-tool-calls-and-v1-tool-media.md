---
"@langchain/google": patch
---

fix(google): send tool calls from AIMessages whose content has no functionCall parts, and keep media next to v1 tool responses

An AIMessage built by hand or by another provider carries its calls only in `tool_calls`, and the legacy converter dropped them, so Gemini received a function response with no matching call. The converter now builds functionCall parts from `tool_calls` when the content has none; a Gemini AIMessage still sends each call once. In the v1 path, images, audio and files returned by a tool are sent as parts next to the function response again, as in the legacy path, instead of being dropped.
