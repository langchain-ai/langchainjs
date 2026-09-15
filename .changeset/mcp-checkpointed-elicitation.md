---
"@langchain/mcp-adapters": minor
---

Pause modern tool calls with LangGraph interrupts for form or URL input.
Checkpoint each completed request round with automatic retries disabled, and
validate resume answers against the pending keys and requested schemas.
Graph calls require connection-level headers; legacy elicitation keeps its callbacks.
