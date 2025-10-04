/**
 * Example demonstrating the Context Editing Middleware.
 *
 * This middleware automatically clears older tool results when the conversation
 * grows beyond a configurable token threshold, helping manage context size.
 */

import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import {
  createAgent,
  contextEditingMiddleware,
  ToolMessage,
  ClearToolUsesEdit,
} from "langchain";

/**
 * Define a simple search tool that returns large results
 */
const searchTool = tool(
  async ({ query }) => {
    /**
     * Simulate a large search result (each repeat is ~30 characters = ~7-8 tokens)
     * 100 repeats = ~750 tokens
     */
    return `Search results for "${query}":\n${"Lorem ipsum dolor sit amet consectetur. ".repeat(
      100
    )}`;
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

/**
 * Define a calculator tool
 */
const calculatorTool = tool(
  async ({ a, b }) => {
    return `The result of ${a} + ${b} is ${a + b}`;
  },
  {
    name: "calculator",
    description: "Perform simple calculations",
    schema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  }
);

/**
 * Create an agent with context editing middleware
 */
const agent = createAgent({
  model: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [searchTool, calculatorTool],
  middleware: [
    contextEditingMiddleware({
      edits: [
        new ClearToolUsesEdit({
          /**
           * Trigger clearing when context exceeds 500 tokens (low threshold for demo)
           */
          triggerTokens: 500,
          /**
           * Clear at least 100 tokens when triggered
           */
          clearAtLeast: 100,
          /**
           * Keep only the 1 most recent tool result
           */
          keep: 1,
          /**
           * Don't clear calculator tool results
           */
          excludeTools: ["calculator"],
          /**
           * Clear tool inputs as well to save more space
           */
          clearToolInputs: true,
        }),
      ],
      /**
       * Use approximate token counting (faster for demo)
       */
      tokenCountMethod: "approx",
    }),
  ],
  systemPrompt: "You are a helpful assistant. Use tools when needed.",
});

console.log("=== Context Editing Middleware Example ===\n");

/**
 * First turn: Search for React agents
 */
console.log("Turn 1: Searching for React agents...");
let result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "Search for 'React agents'",
    },
  ],
});

console.log(`- Accumulated ${result.messages.length} messages`);
console.log(
  `- Last message: ${result.messages[result.messages.length - 1].content
    .toString()
    .slice(0, 100)}...`
);

/**
 * Second turn: Search for LangChain
 * This should trigger context editing since we'll exceed 500 tokens
 */
console.log("\nTurn 2: Searching for LangChain...");
result = await agent.invoke({
  messages: result.messages.concat([
    new HumanMessage("Now search for 'LangChain'"),
  ]),
});

console.log(`- Accumulated ${result.messages.length} messages`);

/**
 * Third turn: One more search
 * This should definitely trigger clearing
 */
console.log("\nTurn 3: Searching for TypeScript...");
result = await agent.invoke({
  messages: result.messages.concat([
    new HumanMessage("Finally, search for 'TypeScript' and calculate 42 + 58"),
  ]),
});

console.log(`- Accumulated ${result.messages.length} messages`);
console.log(
  `\nFinal response: ${result.messages[result.messages.length - 1].content
    .toString()
    .slice(0, 150)}...`
);

/**
 * Check how many tool results were cleared
 */
const clearedMessages = result.messages.filter(
  (msg) =>
    ToolMessage.isInstance(msg) &&
    (msg.response_metadata as any)?.context_editing?.cleared
);

console.log("\n=== Context Editing Results ===");
console.log(`Total messages: ${result.messages.length}`);
console.log(`Tool results cleared: ${clearedMessages.length}`);

if (clearedMessages.length > 0) {
  console.log("\nCleared tool messages:");
  clearedMessages.forEach((msg, idx) => {
    const toolMsg = msg as typeof ToolMessage.prototype;
    console.log(
      `  ${idx + 1}. Tool call ID: ${toolMsg.tool_call_id}, Content: "${
        toolMsg.content
      }"`
    );
  });
} else {
  console.log(
    "\nNote: No tool results were cleared. Try lowering triggerTokens or adding more turns."
  );
}

/**
 * Final response:
 * ```
 * === Context Editing Middleware Example ===
 *
 * Turn 1: Searching for React agents...
 * - Accumulated 4 messages
 * - Last message: It seems that the search results for "React agents" returned generic placeholder text rather than sp...
 *
 * Turn 2: Searching for LangChain...
 * - Accumulated 8 messages
 *
 * Turn 3: Searching for TypeScript...
 * - Accumulated 13 messages
 *
 * Final response: The search for "TypeScript" again returned generic placeholder text, which is not informative.
 *
 * However, the calculation result for \( 42 + 58 \) is \...
 *
 * === Context Editing Results ===
 * Total messages: 13
 * Tool results cleared: 2
 *
 * Cleared tool messages:
 *   1. Tool call ID: call_M9KmodGVBjPktgjM8tkaNjWG, Content: "[cleared]"
 *   2. Tool call ID: call_jIMx9NyquDdVqjs0QjDT1EAI, Content: "[cleared]"
 * ```
 */
