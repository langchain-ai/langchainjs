import { z } from "zod";
import {
  createMiddleware,
  createMiddlewareAgent,
  HumanMessage,
  AIMessage,
} from "langchain";
import { RemoveMessage } from "@langchain/core/messages";
import { REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

// Simple summarization middleware that summarizes long conversations
const summarizationMiddleware = createMiddleware({
  name: "SummarizationMiddleware",
  stateSchema: z.object({
    messageCount: z.number().default(0),
    lastSummary: z.string().optional(),
  }),
  contextSchema: z.object({
    maxMessagesBeforeSummary: z.number().default(10),
  }),
  beforeModel: async (state, runtime) => {
    const messageCount = state.messages.length;

    // Check if we need to summarize
    if (messageCount > runtime.context.maxMessagesBeforeSummary) {
      // Create a simple summary of the conversation
      const summary = `Previous conversation summary: ${messageCount} messages exchanged.`;

      // Keep only the last few messages plus the summary
      const recentMessages = state.messages.slice(
        -runtime.context.maxMessagesBeforeSummary
      );
      const summaryMessage = new HumanMessage(summary);
      return {
        messages: [
          new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
          summaryMessage,
          ...recentMessages,
        ],
        messageCount: recentMessages.length + 1,
        lastSummary: summary,
      };
    }

    // Update message count
    return {
      messageCount,
    };
  },
});

// Example usage
const agent = createMiddlewareAgent({
  model: "openai:gpt-4o-mini",
  contextSchema: z.object({
    userId: z.string(),
  }),
  tools: [],
  middlewares: [summarizationMiddleware] as const,
});

const config = {
  context: {
    userId: "user123",
    maxMessagesBeforeSummary: 3, // Summarize after 2 messages
  },
};

// Simulate a longer conversation
const messages = [
  new HumanMessage("I need help with my order #12345"),
  new AIMessage(
    "I'll help you with order #12345. Let me check the status for you."
  ),
  new HumanMessage("Also, I think I entered the wrong address"),
  new AIMessage(
    "I can help update your shipping address. What's the correct address?"
  ), // This triggers summarization
  new HumanMessage("It should be 123 Main St, San Francisco, CA 94105"),
  new AIMessage("I'll update that for you right away."),
  new HumanMessage("When will it ship?"),
];
const result = await agent.invoke({ messages }, config);

console.log("Message count:", result.messageCount);
console.log("First message:", result.messages.at(0)?.content);
