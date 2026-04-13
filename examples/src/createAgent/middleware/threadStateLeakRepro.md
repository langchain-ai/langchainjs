# Thread State Leak Repro (Cross-thread `beforeAgent` state)

This is the minimal shape that reproduced the issue locally:

1. Middleware A defines `stateSchema` with reducer key `contentStrategy`.
2. Middleware B (`documents`) runs `beforeAgent` and does **not** set `contentStrategy`.
3. Middleware C (`entity extraction`) runs `beforeAgent` and reads/writes `contentStrategy`.
4. Agent uses a checkpointer.
5. Invoke same agent instance with `thread-a`, then `thread-b`.

```ts
import { z } from "zod";
import {
  createAgent,
  createMiddleware,
  HumanMessage,
  AIMessage,
} from "langchain";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { FakeToolCallingChatModel } from "../../../libs/langchain/src/agents/tests/utils.js";

const seenEntityStates: Record<string, string | undefined> = {};

const stateOnly = createMiddleware({
  name: "StateOnly",
  stateSchema: new StateSchema({
    contentStrategy: new ReducedValue(z.string(), {
      inputSchema: z.string().optional(),
      reducer: (_current, next) => next,
    }),
  }),
});

const documents = createMiddleware({
  name: "Documents",
  beforeAgent: async (state) => {
    // Expect unset at start of each run
    console.log("documents sees:", state.contentStrategy);
  },
});

const entityExtraction = createMiddleware({
  name: "EntityExtraction",
  beforeAgent: async (state, runtime) => {
    const threadId = runtime.configurable?.thread_id as string;
    seenEntityStates[threadId] = (state as { contentStrategy?: string })
      .contentStrategy;

    if (threadId === "thread-a") {
      return { contentStrategy: "thread-a-only-value" };
    }
  },
});

const model = new FakeToolCallingChatModel({
  responses: [new AIMessage("Response A"), new AIMessage("Response B")],
});

const agent = createAgent({
  model,
  tools: [],
  middleware: [stateOnly, documents, entityExtraction],
  checkpointer: new MemorySaver(),
});

await agent.invoke(
  { messages: [new HumanMessage("first")] },
  { configurable: { thread_id: "thread-a" } }
);
await agent.invoke(
  { messages: [new HumanMessage("second")] },
  { configurable: { thread_id: "thread-b" } }
);

console.log(seenEntityStates);
// Repro signal:
// seenEntityStates["thread-b"] === "thread-a-only-value"
```

Notes:
- I used `MemorySaver` for local repro; your report mentioned Postgres checkpointer.
- The leak showed up in this shape when a middleware without `stateSchema` reads/writes the reducer key.
