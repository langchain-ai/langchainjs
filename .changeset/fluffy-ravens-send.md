---
"@langchain/openai": patch
---

fix(openai): resolve encrypted content with zdr when streaming

OpenAI recently changed the disposition of `encrypted_content` to contain the canonical payload on the final `done` event. Encrypted content also does not need to be a parameter in the `include` call options in order to propagate.
