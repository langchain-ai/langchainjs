---
"langchain": patch
---

Send the error's message rather than its stack trace to the model when a tool call's arguments fail validation, so the server's file paths no longer reach the model provider.
