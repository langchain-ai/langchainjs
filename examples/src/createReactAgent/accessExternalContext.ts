/**
 * Access External Context for Runtime Parameters
 *
 * Context contains runtime parameters like user ID, database connections, and static
 * configuration that affects how the agent behaves. This context can influence the
 * system prompt and tool behavior.
 *
 * Context vs State Distinction:
 * - Context: Static runtime parameters (user ID, DB connections, config)
 *   - Set once per session/request
 *   - Doesn't change during conversation
 *   - Used to look up user info, configure behavior
 *
 * - State: Dynamic conversation data (messages, memory, session variables)
 *   - Modified over time during interaction
 *   - Persists and evolves through the conversation
 *   - Managed by the agent framework
 *
 * Example Scenario:
 * A support agent that needs the current user's ID to look up their account details
 * and tailor responses. The user ID is static context, but the conversation messages
 * are dynamic state.
 */

import fs from "node:fs/promises";
import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Runtime context - static parameters set per session
 */
const runtimeContext: {
  userId?: string;
  username?: string;
  dbConnection?: string;
  userTier?: string;
} = {};

/**
 * Simulated database lookup using context
 */
function getUserDetails(userId: string) {
  // In a real app, this would query your database using the connection from context
  const userDatabase = {
    user123: { username: "john_doe", tier: "premium", joinDate: "2023-01-15" },
    user456: { username: "jane_smith", tier: "basic", joinDate: "2023-06-20" },
    user789: {
      username: "bob_wilson",
      tier: "enterprise",
      joinDate: "2022-03-10",
    },
  };

  return (
    userDatabase[userId as keyof typeof userDatabase] || {
      username: "unknown",
      tier: "basic",
      joinDate: "unknown",
    }
  );
}

/**
 * Tool that uses runtime context for personalized behavior
 */
const accountInfoTool = tool(
  async (input: { action: string }) => {
    const userId = runtimeContext.userId ?? "unknown";
    const userDetails = getUserDetails(userId);

    return `Account ${input.action} for ${userDetails.username} (${userDetails.tier} tier, member since ${userDetails.joinDate})`;
  },
  {
    name: "account_info",
    description: "Get account information for the current user",
    schema: z.object({
      action: z.string().describe("Action to perform: check, update, etc."),
    }),
  }
);

/**
 * Create agent that uses runtime context to customize behavior
 */
const supportAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [accountInfoTool],
  prompt: async (state) => {
    // Access runtime context to customize system prompt
    const userId = runtimeContext.userId ?? "unknown";
    const userDetails = getUserDetails(userId);

    return [
      {
        role: "system",
        content: `You are a customer support agent helping ${userDetails.username}.

User Context (from runtime parameters):
- User ID: ${userId}
- Account Tier: ${userDetails.tier}
- Member Since: ${userDetails.joinDate}

Tailor your responses based on their ${userDetails.tier} tier. Enterprise users get priority treatment, premium users get detailed explanations, basic users get simple guidance.`,
      },
      ...state.messages,
    ];
  },
});

/**
 * Function to handle user requests with runtime context
 * @param userId - Static user identifier from session/auth
 * @param query - User's message (this becomes part of dynamic state)
 */
async function handleSupportRequest(userId: string, query: string) {
  // Set runtime context (static for this session)
  runtimeContext.userId = userId;

  return supportAgent.invoke({
    messages: [{ role: "user", content: query }],
  });
}

/**
 * Example: Different users get different treatment based on context
 */
console.log("=== Premium User Request ===");
const premiumResult = await handleSupportRequest(
  "user123", // Premium user ID
  "I'm having trouble with my account settings"
);
console.log(
  "Response:",
  premiumResult.messages[premiumResult.messages.length - 1].content
);

console.log("\n=== Basic User Request ===");
const basicResult = await handleSupportRequest(
  "user456", // Basic user ID
  "I'm having trouble with my account settings"
);
console.log(
  "Response:",
  basicResult.messages[basicResult.messages.length - 1].content
);

console.log("\n=== Enterprise User Request ===");
const enterpriseResult = await handleSupportRequest(
  "user789", // Enterprise user ID
  "I'm having trouble with my account settings"
);
console.log(
  "Response:",
  enterpriseResult.messages[enterpriseResult.messages.length - 1].content
);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await supportAgent.visualize());

/**
 * Example Output:
 * === Premium User Request ===
 * Response: I'm sorry to hear that you're experiencing trouble with your account settings, John.
 * As a premium user, you are entitled to a detailed explanation and solution to your problem.
 * Could you please elaborate more on the issue? Providing specific details such as the feature
 * you're having trouble with, or any error messages you're seeing, will assist me greatly in
 * pinpointing and resolving your issue.
 *
 * === Basic User Request ===
 * Response: Sure, I'd be happy to help. Could you please tell me more about the issues you're
 * facing with your account settings?
 *
 * === Enterprise User Request ===
 * Response: I'm sorry to hear you're having trouble with your account settings, Bob. As an enterprise
 * user, you are given priority assistance. Could you please provide more details about the issue?
 * It will allow me to assist you more effectively.
 */
