---
langchain: patch
"@langchain/mcp-adapters": patch
---

Further refinements and improvements to createAgent with middleware:

- updated createAgent symbol documentation
- improved type handling for invoke and stream invocation parameter
- acknowledge middleware context schema's that are optional or have default values as actually optional
- improvements to HITL middleware: support for multiple tool interrupts at the same time
- updates `@langchain/mcp-adapters` examples to use the new createAgent primitive from langchain
