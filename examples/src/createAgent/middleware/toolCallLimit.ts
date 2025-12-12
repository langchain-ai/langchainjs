/**
 * Basic example demonstrating tool call limit middleware.
 *
 * This middleware helps prevent infinite loops or excessive tool usage
 * by limiting the number of tool calls an agent can make.
 */

import { z } from "zod";
import { createAgent, tool, toolCallLimitMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
const config = { configurable: { thread_id: "demo-thread" } };

/**
 * Define a simple search tool
 */
const searchTool = tool(
  async ({ query }) => {
    console.log(`Searching for: ${query}`);
    return `Results for: ${query}`;
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string(),
    }),
  }
);

/**
 * Create an agent with a tool call limit
 */
const agent = createAgent({
  model: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [searchTool],
  checkpointer: new MemorySaver(),
  middleware: [
    /**
     * Limit to 3 tool calls per conversation
     */
    toolCallLimitMiddleware({
      threadLimit: 3,
      /**
       * Gracefully end when limit is reached
       */
      exitBehavior: "end",
    }),
  ],
});

/**
 * Example conversation that would exceed the limit
 */
const result = await agent.invoke(
  {
    messages: [
      new HumanMessage(
        "Search for 'AI', 'ML', 'Deep Learning', 'Neural Networks', and 'LLMs'"
      ),
    ],
  },
  { configurable: { thread_id: "demo-thread" } }
);

console.log("\nAgent response:");
console.log(result.messages[result.messages.length - 1].content);

/**
 * Create an agent with a tool call limit
 */
const agent2 = createAgent({
  model: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [searchTool],
  checkpointer: new MemorySaver(),
  middleware: [
    /**
     * Limit to 3 tool calls per conversation
     */
    toolCallLimitMiddleware({
      threadLimit: 3,
      /**
       * Gracefully end when limit is reached
       */
      exitBehavior: "end",
    }),
  ],
});

const result2 = await agent.invoke(
  {
    messages: [new HumanMessage("Search for 'AI' and 'ML'")],
  },
  { configurable: { thread_id: "demo-thread" } }
);

console.log("\nAgent response:");
console.log(result2.messages[result2.messages.length - 1].content);
