import { createAgent } from "langchain";
import { modelCallLimitMiddleware } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Model Call Limit Middleware Example
 *
 * This example demonstrates how to use the modelCallLimitMiddleware to control
 * the number of model calls in your agent, both at the thread level (across
 * multiple invocations) and run level (within a single invocation).
 */

// Create a simple tool that encourages the agent to make multiple calls
const searchTool = tool(
  async ({ query }) => {
    return `Search results for "${query}": Found 10 items. You may want to search for more related topics.`;
  },
  {
    name: "search",
    description: "Search for information on the web",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// Example 1: Run-level limit with "end" behavior (graceful exit)
console.log("=== Example 1: Run-level limit (graceful exit) ===");
const agentWithRunLimit = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [searchTool],
  middleware: [
    modelCallLimitMiddleware({
      runLimit: 1, // Allow only 1 model call per run
      exitBehavior: "end", // Gracefully end when limit is reached
    }),
  ],
});

const result1 = await agentWithRunLimit.invoke({
  messages: ["Search for 'LangChain' and tell me what you found."],
});

const lastMessage1 = result1.messages.at(-1);
console.log(`Final message type: ${lastMessage1?.constructor.name}`);
console.log(`Content: ${lastMessage1?.content}`);
console.log(`Total messages: ${result1.messages.length}\n`);

// Example 2: Thread-level limit across multiple invocations
console.log("=== Example 2: Thread-level limit across invocations ===");
const checkpointer = new MemorySaver();
const threadConfig = {
  configurable: {
    thread_id: "conversation-123",
  },
};

const agentWithThreadLimit = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  checkpointer,
  middleware: [
    modelCallLimitMiddleware({
      threadLimit: 2, // Allow only 2 model calls across entire thread
      exitBehavior: "end",
    }),
  ],
});

// First invocation (call #1)
const result2a = await agentWithThreadLimit.invoke(
  { messages: ["What is 2+2?"] },
  threadConfig
);
const lastMsg2a = result2a.messages.at(-1);
console.log(
  `Call 1 (${lastMsg2a?.constructor.name}): ${lastMsg2a?.content.slice(
    0,
    50
  )}...`
);

// Second invocation (call #2)
const result2b = await agentWithThreadLimit.invoke(
  { messages: ["What is 3+3?"] },
  threadConfig
);
const lastMsg2b = result2b.messages.at(-1);
console.log(
  `Call 2 (${lastMsg2b?.constructor.name}): ${lastMsg2b?.content.slice(
    0,
    50
  )}...`
);

// Third invocation (would be call #3, but limit is 2)
const result2c = await agentWithThreadLimit.invoke(
  { messages: ["What is 4+4?"] },
  threadConfig
);
const lastMsg2c = result2c.messages.at(-1);
console.log(
  `Call 3 - BLOCKED (${lastMsg2c?.constructor.name}): ${lastMsg2c?.content}`
);
console.log();

// Example 3: Runtime configuration override
console.log("=== Example 3: Runtime configuration override ===");
const agentWithDefaults = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  middleware: [
    modelCallLimitMiddleware({
      runLimit: 10, // Default: generous limit
    }),
  ],
});

// First call with default limit - should complete successfully
const result3a = await agentWithDefaults.invoke({
  messages: ["Tell me a short joke."],
});
const lastMsg3a = result3a.messages.at(-1);
console.log(
  `Default limit (10): Success - ${lastMsg3a?.constructor.name} responded`
);

// Second call with strict runtime override via configurable context
const result3b = await agentWithDefaults.invoke(
  { messages: ["Tell me another joke."] },
  {
    configurable: {
      runLimit: 0, // Override to block all calls for this specific run
      exitBehavior: "end",
    },
  }
);
const lastMsg3b = result3b.messages.at(-1);
console.log(
  `Runtime override (0): ${lastMsg3b?.constructor.name} - "${lastMsg3b?.content}"`
);
console.log();

// Example 4: Error behavior (throw instead of graceful exit)
console.log("=== Example 4: Error behavior (throw on limit) ===");
const agentWithThrow = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [],
  middleware: [
    modelCallLimitMiddleware({
      runLimit: 0, // Don't allow any model calls
      exitBehavior: "throw", // Throw an error instead of ending gracefully
    }),
  ],
});

try {
  await agentWithThrow.invoke({
    messages: ["Hello, how are you?"],
  });
  console.error("❌ ERROR: No error was thrown!");
} catch (error) {
  console.log("✓ Error thrown as expected:", (error as Error).message);
}

console.log("\n✅ All examples completed!");
