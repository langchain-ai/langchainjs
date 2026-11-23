# Model-call budget

`modelCallBudgetMiddleware({ runLimit: 8 })` allows eight working model turns and
one additional tool-free final response if the agent has not already finished.
Each model request receives a transient system-prompt addition with used/remaining
turns. `modelBudgetUsed` also exposes consumption in graph state.

```typescript
import { createAgent, modelCallBudgetMiddleware } from "langchain";

const agent = createAgent({
  model,
  tools,
  middleware: [modelCallBudgetMiddleware({ runLimit: 8 })],
});
```

Use the same middleware with `createDeepAgent({ middleware: [...] })`. Configure
subagents separately: this does not impose a shared budget across subagents.

- Zero starts with finalization; negative, fractional, and unsafe integers fail.
- New invocations reset the counter; interrupted graph resumes retain state.
- A working turn may call several parallel tools. Their results reach the final
  response. Direct-return tools can finish the agent earlier.
- The final request removes all tools, forced tool choice, and structured-output
  configuration. It returns plain text, not a structured response. Unexpected
  tool calls fail before any tool executes.
- Place this middleware last among model-request modifiers to prevent subsequent
  middleware from reintroducing tools or structured output.
- This counts agent model turns, not tokens, dollars, elapsed time, tool calls,
  provider retries, or auxiliary model calls made by other middleware. Finalization
  is outside `runLimit`; this is not a billing cap or security boundary.
- Hard call/recursion limits must leave room for finalization.

The existing `modelCallLimitMiddleware` remains unchanged: it stops with an error
or an artificial message instead of making a final synthesis call.
