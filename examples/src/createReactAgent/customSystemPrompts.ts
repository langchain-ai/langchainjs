/**
 * Custom System Prompts
 *
 * System prompts can be customized by populating templates with variables from
 * external context, state, or memory. You create a template string and fill in
 * the variables when creating the agent.
 *
 * The variables can come from:
 * - External context (user info, session data, app state)
 * - Thread state (conversation history, inferred preferences)
 * - Long-term memory (stored user data, past interactions)
 *
 * Example Scenario:
 * A customer service agent needs to know the user's account tier, support history,
 * and current product context to provide appropriate assistance.
 */

import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * External context that would come from your application
 */
const userContext = {
  userId: "user123",
  accountTier: "premium",
  supportHistory: "2 previous tickets resolved",
  currentProduct: "Enterprise CRM",
  preferredLanguage: "English",
};

/**
 * Example tool for the customer service scenario
 */
const checkAccount = tool(
  async (input: { action: string }) => {
    return `Account action: ${input.action} for ${userContext.accountTier} user`;
  },
  {
    name: "check_account",
    description: "Check account information or perform account actions",
    schema: z.object({
      action: z.string().describe("The account action to perform"),
    }),
  }
);

/**
 * Template-based prompt with variables from external context
 * This is the most common pattern - populate a template with context variables
 */
const customerServiceAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [checkAccount],
  prompt: `You are a customer service representative for our software company.

Customer Context:
- User ID: ${userContext.userId}
- Account Tier: ${userContext.accountTier}
- Support History: ${userContext.supportHistory}
- Current Product: ${userContext.currentProduct}
- Preferred Language: ${userContext.preferredLanguage}

Guidelines:
- Address the customer appropriately for their ${userContext.accountTier} tier
- Reference their product (${userContext.currentProduct}) when relevant
- Be aware of their support history: ${userContext.supportHistory}
- Communicate in ${userContext.preferredLanguage}`,
});

/**
 * Dynamic template function - Use when variables come from state or need computation
 * This pattern is useful when variables need to be determined at runtime
 */
const contextAwareAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [checkAccount],
  prompt: async (state) => {
    // Variables could come from state analysis, external APIs, or databases
    const messageCount = state.messages.length;
    const isFirstInteraction = messageCount <= 1;
    const urgencyLevel = isFirstInteraction ? "standard" : "priority";

    return [
      {
        role: "system",
        content: `You are a customer service representative.

Customer: ${userContext.userId} (${userContext.accountTier} tier)
Product: ${userContext.currentProduct}
Support History: ${userContext.supportHistory}
Current Session: ${messageCount} messages, ${urgencyLevel} urgency

${
  isFirstInteraction
    ? "This is their first message. Greet them warmly."
    : "Continue the conversation with appropriate context."
}`,
      },
      ...state.messages,
    ];
  },
});

/**
 * Example: Static template with context variables
 */
console.log("=== Static Template Example ===");
const result = await customerServiceAgent.invoke({
  messages: [{ role: "user", content: "I need help with my account" }],
});
console.log(result.messages[result.messages.length - 1].content);

/**
 * Example: Dynamic template with state-based variables
 */
console.log("\n=== Dynamic Template Example ===");
const response2 = await contextAwareAgent.invoke({
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi! How can I help you today?" },
    { role: "user", content: "I have a billing question" },
  ],
});
console.log(response2.messages[response2.messages.length - 1].content);

/**
 * Expected output:
 *
 * === Static Template Example ===
 * Absolutely, I'd be happy to assist you with your account, user123. Since you are a premium
 * tier customer, you have access to extensive support options. Could you please provide me with
 * more information about the issue you are facing with your Enterprise CRM account? This will
 * help me assist you better.
 *
 * === Dynamic Template Example ===
 * Of course, I'd be happy to assist with any billing inquiries you have. Could you please provide
 * more details about your question?
 */
