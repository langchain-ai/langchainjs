import * as z from "zod";
import { createAgent, HumanMessage, AIMessage, tool } from "langchain";
import { bigToolMiddleware } from "langchain/middleware";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Capture the raw requests to verify the tools are being selected correctly
 */
const requestBodies: any[] = [];
const llm = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-20250514",
  clientOptions: {
    fetch: (url, options) => {
      requestBodies.push(JSON.parse(options?.body as string));
      return fetch(url, options);
    },
  },
});

// Example usage
const agent = createAgent({
  llm,
  tools: [
    tool(
      ({ a, b, operation }: { a: number; b: number; operation: string }) => {
        if (operation === "add") {
          return a + b;
        } else if (operation === "multiply") {
          return a * b;
        } else if (operation === "subtract") {
          return a - b;
        } else if (operation === "divide") {
          return a / b;
        } else {
          return "Unknown operation";
        }
      },
      {
        name: "calculator",
        description: "Perform basic math operations",
        schema: z.object({
          a: z.number(),
          b: z.number(),
          operation: z.enum(["add", "multiply", "subtract", "divide"]),
        }),
      }
    ),
    tool(
      () => {
        return "Database query result: 42";
      },
      {
        name: "database",
        description: "Query a database",
        schema: z.object({
          query: z.string(),
        }),
      }
    ),
  ],
  middleware: [
    bigToolMiddleware({
      strategy: "custom",
      customSelector: (tools, query) => {
        if (query.includes("calculator")) {
          return tools.filter((tool) => tool.name === "calculator");
        } else if (query.includes("database")) {
          return tools.filter((tool) => tool.name === "database");
        }

        return [];
      },
      maxTools: 1,
    }),
  ] as const,
});

// Usage example with a long chat history for testing caching
const result = await agent.invoke({
  messages: [new HumanMessage("Calculate 10 + 20")],
});
console.log(
  "Calculate 10 + 20\nAgent response:",
  result.messages.at(-1)?.content,
  `\nAll available tools: ${requestBodies
    .pop()
    .tools.map((tool: { name: string }) => tool.name)}`
);

const result2 = await agent.invoke({
  messages: [new HumanMessage("Query the database for 42")],
});
console.log(
  "\nQuery the database for 42\nAgent response:",
  result2.messages.at(-1)?.content,
  `\nAll available tools: ${requestBodies
    .pop()
    .tools.map((tool: { name: string }) => tool.name)}`
);
