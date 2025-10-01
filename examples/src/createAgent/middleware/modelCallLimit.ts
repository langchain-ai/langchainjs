import { createAgent, createMiddleware } from "langchain";
import { MemorySaver } from "/Users/christian.bromann/Sites/LangChain/langchainjs/libs/langchain/node_modules/@langchain/langgraph-checkpoint/index.js";

const checkpointer = new MemorySaver();
const config = {
  configurable: {
    thread_id: "test-123",
  },
};

const modelCallLimitMiddleware = createMiddleware({
  name: "ModelCallLimitMiddleware",
  beforeModel: async (state, runtime) => {
    console.log(
      "beforeModel",
      runtime.threadLevelCallCount,
      runtime.runModelCallCount
    );
    return {
      _privateState: {
        runModelCallCount: 123,
      },
    };
  },

  afterModel: async (state, runtime) => {
    console.log(
      "afterModel",
      runtime.threadLevelCallCount,
      runtime.runModelCallCount
    );
  },
});

const agent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  checkpointer,
  middleware: [modelCallLimitMiddleware] as const,
});

const result = await agent.invoke(
  {
    messages: ["Hello, how are you?"],
  },
  config
);

console.log(Object.keys(result)); // 0 0

const newAgent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  checkpointer,
  middleware: [modelCallLimitMiddleware] as const,
});

const newResult = await newAgent.invoke(
  {
    messages: ["Hello, how old are you?"],
  },
  config
);

console.log(Object.keys(newResult)); // 0 0
