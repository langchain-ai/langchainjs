---
"langchain": patch
---

fix(langchain): StateSchema handling in AgentNode middleware
- Added `toPartialZodObject` helper that correctly handles both Zod objects and LangGraph's StateSchema when parsing middleware state in AgentNode .
