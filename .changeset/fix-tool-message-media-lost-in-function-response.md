---
"@langchain/google": patch
---

fix: keep image/audio/video content in ToolMessages as sibling Gemini parts instead of losing it inside functionResponse.response.result JSON (#10297)
