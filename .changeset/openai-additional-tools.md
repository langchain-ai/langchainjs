---
"@langchain/openai": patch
---

feat(openai): support `additional_tools` on the Responses API. An `additional_tools` block on a `SystemMessage`, either bare in `content` or wrapped in a `non_standard` block, is sent verbatim as a top-level input item preceding the message.

`additional_tools` cannot work anywhere else, so it now throws instead of being dropped: on Chat Completions (set `useResponsesApi: true`), or on any message other than a `SystemMessage`. Assistant messages are exempt. A block dropped from system content on the Responses API now logs a warning.
