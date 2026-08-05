---
"@langchain/anthropic": minor
---

feat(anthropic): support programmatic tool calling

- Auto-detect `advanced-tool-use-2025-11-20` beta header when tools have `allowed_callers` referencing code execution
- Add `reuseLastContainer` constructor option for automatic container reuse across turns
- Preserve `caller` field on tool_use content blocks through round-trip message conversion
