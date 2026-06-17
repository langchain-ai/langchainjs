---
"@langchain/openai": patch
---

feat(openai): surface built-in tool progress (`in_progress`, `searching`, `generating`) while streaming the Responses API

The Responses streaming converter previously only handled the `.completed` lifecycle event for built-in search tools, and dropped the image generation lifecycle entirely, so streaming consumers could not tell when a search or image generation had started — only that one had finished. The web/file search `.in_progress` / `.searching` events and the image generation `.in_progress` / `.generating` / `.completed` events are now converted to `generationInfo.tool_outputs` with the corresponding status, enabling live "searching…" / "generating image…" UI.
