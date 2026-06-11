---
"@langchain/openai": patch
---

feat(openai): surface web/file search `in_progress` and `searching` status while streaming the Responses API

The Responses streaming converter previously only handled the `.completed` lifecycle event for built-in search tools, so streaming consumers could not tell when a search had started — only that one had finished. The `.in_progress` and `.searching` events are now converted to `generationInfo.tool_outputs` with the corresponding status, enabling live "searching…" UI.
