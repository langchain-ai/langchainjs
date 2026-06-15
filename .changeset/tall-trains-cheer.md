---
"@langchain/google-genai": patch
---

Improve ChatGoogleGenerativeAI error handling for prompts that omit HumanMessage by failing fast with a clear SDK-side validation message before any provider request is made.
