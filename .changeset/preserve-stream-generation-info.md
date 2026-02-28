---
"@langchain/core": patch
---

Fix a streaming callback path in `BaseChatModel` so `generationInfo` is merged into `response_metadata`, ensuring metadata like `finish_reason` and usage fields are preserved consistently.
