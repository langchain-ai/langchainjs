---
"@langchain/google-genai": patch
---

fix(google-genai): serialize standard v1 `reasoning` content blocks back to Gemini thought parts instead of throwing "Unknown content type reasoning", so multi-turn agents replaying v1 message history (for example langgraph checkpoints) no longer crash on the second model call
