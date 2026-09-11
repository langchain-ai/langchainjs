---
"@langchain/mcp-adapters": major
---

Always use native LangChain content blocks and remove the `useStandardContentBlocks` toggle; preserve structured output, resource provenance and protocol metadata in artifacts. Preserve native ToolMessage/Command results and graph interrupts. Expose semantic tool error envelopes through ToolException and retain transport causes. Resource conversion no longer performs implicit reads.

Validate effective post-hook arguments against the original server JSON Schema without mutating descriptors. Keep model schema projection separate from invocation authority and avoid narrowing unions to their final branch.

Isolate catalogs and connections by effective headers and OAuth provider identity. Deduplicate acquisitions, install handlers before connection, clean up failed handshakes/discovery, and settle every owned close. Delegate tools/resources/templates pagination to the SDK and propagate discovery errors instead of returning empty catalogs. Test SDK 1.30 stdio alongside SDK 2 HTTP/SSE servers; protocol negotiation remains unchanged.
