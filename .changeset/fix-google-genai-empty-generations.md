---
'@langchain/google-genai': patch
'@langchain/core': patch
---

Fix crash when Google GenAI returns empty or blocked responses. The provider now throws a descriptive error including the block reason and safety ratings instead of returning an empty generations array that causes a downstream `Cannot read properties of undefined` crash.
