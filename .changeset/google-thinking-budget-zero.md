---
"@langchain/google": patch
---

fix(google): send thinkingLevel LOW instead of MINIMAL to Gemini 3 models that reject MINIMAL (e.g. gemini-3.7-flash, gemini-3.8-flash), so `thinkingBudget: 0` and `reasoningEffort: "minimal"` no longer 400
