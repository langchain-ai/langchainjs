---
"langchain": patch
---

fix(agents): avoid nullish jumpTo updates from middleware no-op returns

Middleware hook outputs are now treated as sparse updates so no-op hooks do not emit `jumpTo` writes. This prevents concurrent graph update errors in structured output retry flows with multiple `afterModel` middleware hooks while preserving explicit jump routing behavior.
