---
"@langchain/ollama": patch
---

Check message and content block types when converting messages for Ollama

`convertToOllamaMessages` now picks each message's converter with the message
classes' `isInstance` type guards instead of comparing `_getType()`, and checks
human-message content blocks before reading them. Valid messages convert
exactly as before. Malformed human content blocks now fail with a clear error:
an `image_url` block without an `image_url` throws
`Unsupported content type: image_url` instead of a `TypeError`, and a `text`
block whose `text` is not a string throws `Unsupported content type: text`
instead of sending a non-string `content` to Ollama.
