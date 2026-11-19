---
"@langchain/openai": patch
---

feat(openai): support GPT-6.2 Astra and Sol

- Upgrade the `openai` SDK to ^7.58.0, which adds the GPT-6.2 model IDs
- Refresh model profiles from models.dev, adding `gpt-6.2-astra` and `gpt-6.2-sol` and removing `gpt-image-1`, which models.dev no longer lists
