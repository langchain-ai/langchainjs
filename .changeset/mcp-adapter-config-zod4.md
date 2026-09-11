---
"@langchain/mcp-adapters": major
---

Add the canonical `MCPAdapter({ servers })` API, retaining `MultiServerMCPClient` as a deprecated alias. Require Zod4, replace duplicated notification schemas with SDK types, and validate hook modifications after awaiting sync or async callbacks. Reject conflicting configuration spellings and unknown output-handling keys. Preserve callbacks and OAuth providers in configuration snapshots.

Notification options are isolated per event. Legacy servers named `servers` and explicitly undefined output destinations remain supported.

Parse configuration into connections with a required transport discriminator. Infer adapter-owned configuration and hook types from Zod schemas, and merge object-shaped argument overrides without mutating the original request.

Parse error formatting data without asserting a Zod error version, check hook content/artifact elements, and validate required OAuth methods without replacing the provider. Remove type assertions from tool invocation and schema traversal.

Preserve arbitrary LangGraph task inputs in hooks; type hook state as `unknown` so applications narrow their own state without assuming a record.
