import { z } from "zod";
import { RemoveMessage } from "@langchain/core/messages";
import { createAgent, tool, createMiddleware, AIMessage } from "langchain";

const structuredOutputMiddleware = createMiddleware({
  name: "structuredOutputMiddleware",
  afterModel: async (state) => {
    const messages = [...state.messages];
    const lastMessage = messages.at(-1);

    if (!AIMessage.isInstance(lastMessage)) {
      return state;
    }

    // Handle tool-based structured output (e.g., Anthropic)
    const extractToolCall = lastMessage.tool_calls?.find((tc) =>
      tc.name.startsWith("extract-")
    );
    if (extractToolCall) {
      // Modify the structured output args in tool_calls
      const modifiedToolCalls = lastMessage.tool_calls!.map((tc) => {
        if (tc.name.startsWith("extract-")) {
          return {
            ...tc,
            args: {
              ...tc.args,
              email: "modified@example.com",
            },
          };
        }
        return tc;
      });

      // Also modify the content array if it contains tool_use blocks
      let modifiedContent = lastMessage.content;
      if (Array.isArray(lastMessage.content)) {
        modifiedContent = lastMessage.content.map((block) => {
          if (
            typeof block === "object" &&
            block !== null &&
            "type" in block &&
            block.type === "tool_use" &&
            "name" in block &&
            typeof block.name === "string" &&
            block.name.startsWith("extract-")
          ) {
            return {
              ...block,
              input: {
                ...(block.input as Record<string, any>),
                email: "modified@example.com",
              },
            };
          }
          return block;
        });
      }

      return {
        messages: [
          new RemoveMessage({ id: lastMessage.id as string }),
          new AIMessage({
            ...lastMessage,
            content: modifiedContent,
            tool_calls: modifiedToolCalls,
          }),
        ],
      };
    }

    // Handle native JSON schema output (e.g., OpenAI)
    if (
      lastMessage.tool_calls?.length === 0 &&
      typeof lastMessage.content === "string" &&
      lastMessage.content.startsWith("{") &&
      lastMessage.content.endsWith("}")
    ) {
      const origContent = JSON.parse(lastMessage.content);
      return {
        messages: [
          new RemoveMessage({ id: lastMessage.id as string }),
          new AIMessage({
            content: JSON.stringify({
              ...origContent,
              email: "modified@example.com",
            }),
          }),
        ],
      };
    }

    return state;
  },
});

const getUserDetails = tool(
  async ({ userId }) => ({
    userId,
    name: "John Doe",
    email: "john.doe@example.com",
  }),
  {
    name: "getUserDetails",
    schema: z.object({
      userId: z.string(),
    }),
  }
);

const agent = createAgent({
  model: "openai:gpt-4o", // to test native schema output
  //   model: "anthropic:claude-3-7-sonnet-latest", // to test tool output
  middleware: [structuredOutputMiddleware] as const,
  tools: [getUserDetails],
  responseFormat: z.object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
  }),
});

const result = await agent.invoke({
  messages: [
    { role: "user", content: "Get user details for user with id '123'" },
  ],
});

console.log(result.structuredResponse);
/**
 * Outputs:
 * {
 *   userId: "123",
 *   name: "John Doe",
 *   email: "modified@example.com",
 * }
 */
