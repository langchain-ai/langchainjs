---
"@langchain/core": patch
---

fix(core): once a stream has ended, tool-call arguments must be complete JSON; a call cut off mid-arguments now lands in `invalid_tool_calls` instead of running with half its input
