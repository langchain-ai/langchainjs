---
"@langchain/mistralai": patch
---

fix(mistralai): send reasoning thinking chunks back to Mistral

Assistant messages from reasoning models (such as `zai-glm-5-3`) contain `thinking` chunks, which made the next call throw `Mistral only supports types "text" or "image_url"`. They are now sent back as Mistral thinking chunks, with streamed fragments merged into one. The generation text also no longer comes back empty when a response starts with a thinking chunk.
