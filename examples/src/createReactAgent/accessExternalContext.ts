/**
 * Access External Context in Message Generation
 *
 * This allows the agent to incorporate external data sources, user information, and
 * environmental context when generating responses, making the agent aware of broader
 * application state.
 *
 * Why this is important:
 * - Personalization:
 *   Enables user-specific responses based on profile data, preferences, or session information
 * - Real-time Awareness:
 *   Incorporates live data from databases, APIs, or application state into decision-making
 * - Contextual Relevance:
 *   Ensures responses are appropriate for the current application context and user situation
 *
 * Example Scenario:
 * You're building an e-commerce assistant. When a user logs in, you set their user ID,
 * shopping preferences, and current cart contents as context variables. Now the agent
 * can provide personalized product recommendations and remember the user's preferred
 * brands without explicitly passing this data in every message.
 */

import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Global context storage for this example
 */
const userContext: {
  userId?: string;
  accountType?: string;
  preferences?: { theme: string; language: string };
} = {};

/**
 * Tool that uses external context
 */
const personalizedTool = tool(
  async (input: { query: string }) => {
    const userId = userContext.userId ?? "unknown";
    const preferences = userContext.preferences ?? {
      theme: "light",
      language: "en",
    };
    return `Personalized response for user ${userId} with preferences: ${JSON.stringify(
      preferences
    )}. Query: ${input.query}`;
  },
  {
    name: "personalized_search",
    description: "Search with user personalization",
    schema: z.object({ query: z.string() }),
  }
);

/**
 * Create agent that accesses external context in message generation
 */
const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [personalizedTool],
  prompt: async (state) => {
    // Access external context when generating messages
    const userId = userContext.userId ?? "unknown";
    const accountType = userContext.accountType ?? "free";

    return [
      {
        role: "system",
        content: `You are an assistant for user ${userId} with ${accountType} account.
                 Tailor your responses to their account level and preferences.`,
      },
      ...state.messages,
    ];
  },
});

/**
 * Usage with external context injection
 *
 * @param userId - The user ID
 * @param accountType - The account type
 * @param preferences - The user preferences
 * @param query - The user query
 * @returns The agent response
 */
async function handleUserRequest(
  userId: string,
  accountType: string,
  preferences: { theme: string; language: string },
  query: string
) {
  /**
   * Set external context before invoking agent
   */
  userContext.userId = userId;
  userContext.accountType = accountType;
  userContext.preferences = preferences;

  return agent.invoke({
    messages: [{ role: "user", content: query }],
  });
}

/**
 * Example usage
 */
const result = await handleUserRequest(
  "user123",
  "premium",
  { theme: "dark", language: "en" },
  "Find me the best restaurants nearby"
);

console.log(result);
