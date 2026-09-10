---
"@langchain/mcp-adapters": major
---

Add the canonical `MCPAdapter({ servers })` API, retaining `MultiServerMCPClient` as a deprecated alias. Require Zod4, replace duplicated notification schemas with SDK types, and validate hook modifications after awaiting sync or async callbacks. Reject conflicting configuration spellings and unknown output-handling keys. Preserve callbacks and OAuth providers in configuration snapshots.

Notification options are isolated per event. Legacy servers named `servers` and explicitly undefined output destinations remain supported.
