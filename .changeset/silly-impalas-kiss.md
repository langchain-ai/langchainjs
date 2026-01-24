---
"langchain": major
---

## Add state schema support to agents 
- Introduce `createAgentState` function replacing `createAgentAnnotationConditional`
- Migrate from Zod-based schemas to LangGraph's native `StateSchema`, `ReducedValue`, and `UntrackedValue` primitives
- Support both `StateSchema` and Zod v3/v4 objects as input schemas
- Automatically merge state fields from user-provided schemas and middleware
- Properly handle reducer metadata extraction from Zod v4 schemas via `schemaMetaRegistry`
- Generate separate input/output schemas to avoid channel conflicts with reducers
- Add comprehensive test coverage for state schema functionality



