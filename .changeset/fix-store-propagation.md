---
"langchain": patch
---

fix(agents): propagate checkpointer and store assignments to internal graph in ReactAgent

Added `checkpointer` and `store` getter/setter pairs on `ReactAgent` that forward to the internal compiled graph. This fixes an issue where the LangGraph API server's checkpointer injection was silently ignored, causing thread state to be lost across server restarts.
