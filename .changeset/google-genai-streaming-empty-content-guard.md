---
"@langchain/google-genai": patch
---

fix(google-genai): guard streaming chunks when candidate has no content (e.g. safety/recitation filter triggered mid-stream)
