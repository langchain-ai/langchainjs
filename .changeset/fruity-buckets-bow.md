---
"langchain": patch
---

**WHAT:**  
Fix `ToolNode` throwing an unhandled error when an agent calls a non-existent tool name (e.g. due to LLM hallucination). This now routes the error through `handleToolErrors`, producing a `ToolMessage` instead of crashing the agent.

**WHY:**  
LLMs frequently hallucinate tool names. Previously, missing tool names caused an immediate throw before error handling, preventing agent retries and breaking multi-turn tool workflows. This patch aligns behavior with LangGraph Python and makes agents more robust.

**HOW (user impact):**  
No code changes required for consumers. After upgrading, agents will return a `ToolMessage` for missing tools instead of throwing—allowing LLMs to self-correct. Existing `handleToolErrors=false` behavior and interrupts are preserved.