---
"langchain": minor
---

Add opt-in middleware `tracePolicy` support for transforming hook span input and output payloads, plus `configureTracePolicy` for a process-wide default and re-exports of LangGraph's `TracePolicy` and `omitPayload`. The temporary LangGraph.js #2794 dependency must be replaced with its published version before release.
