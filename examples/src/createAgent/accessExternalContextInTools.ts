/**
 * Access External Context in Tools for User-Specific Data
 *
 * Tools can access runtime context (like user ID) to lookup user-specific data
 * from databases or APIs. This enables secure, personalized tool behavior.
 *
 * Key Benefits:
 * - User-Specific Data Access: Tools lookup data belonging to the authenticated user
 * - Security Through Context: User ID from context ensures tools only access authorized data
 * - Database Integration: Context provides connection details and user identity for queries
 *
 * Common Pattern:
 * 1. User ID passed in context from authentication/session
 * 2. Tool accesses context to get user ID
 * 3. Tool queries database using user ID to get user-specific data
 * 4. Tool returns personalized results
 *
 * Example Scenario:
 * An e-commerce assistant where tools need to access a user's purchase history,
 * saved items, or account details. The user ID from context ensures each user
 * only sees their own data, providing both personalization and security.
 */

import fs from "node:fs/promises";
import {
  createAgent,
  tool,
  setContextVariable,
  getContextVariable,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Simulated database with user-specific data
 */
const userPurchasesDB = {
  user123: [
    {
      id: "p1",
      item: "Wireless Headphones",
      date: "2024-01-15",
      price: 199.99,
    },
    { id: "p2", item: "Phone Case", date: "2024-02-03", price: 29.99 },
    { id: "p3", item: "Laptop Stand", date: "2024-02-20", price: 89.99 },
  ],
  user456: [
    { id: "p4", item: "Bluetooth Speaker", date: "2024-01-20", price: 79.99 },
    { id: "p5", item: "Charging Cable", date: "2024-02-15", price: 19.99 },
  ],
  user789: [
    { id: "p6", item: "Monitor", date: "2024-01-05", price: 349.99 },
    { id: "p7", item: "Keyboard", date: "2024-01-06", price: 129.99 },
    { id: "p8", item: "Mouse", date: "2024-01-06", price: 69.99 },
    { id: "p9", item: "Webcam", date: "2024-02-10", price: 159.99 },
  ],
};

/**
 * Tool that accesses user-specific data via context
 */
const getUserPurchasesTool = tool(
  async (input: { limit?: number }) => {
    /**
     * Access user ID from context - this ensures security and personalization
     */
    const userId = getContextVariable("userId");

    if (!userId) {
      return "Error: User not authenticated. Please log in to view purchases.";
    }

    console.log(`Looking up purchases for user: ${userId}`);

    // Query database using user ID from context
    const userPurchases =
      userPurchasesDB[userId as keyof typeof userPurchasesDB] || [];

    if (userPurchases.length === 0) {
      return "No purchases found for your account.";
    }

    // Apply limit if specified
    const purchases = input.limit
      ? userPurchases.slice(0, input.limit)
      : userPurchases;

    const purchaseList = purchases
      .map((p) => `• ${p.item} - $${p.price} (${p.date})`)
      .join("\n");

    return `Your recent purchases:\n${purchaseList}`;
  },
  {
    name: "get_user_purchases",
    description: "Get the authenticated user's purchase history",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of purchases to return"),
    }),
  }
);

/**
 * Tool for user-specific account information
 */
const getAccountInfoTool = tool(
  async () => {
    const userId = getContextVariable("userId");

    if (!userId) {
      return "Error: User not authenticated.";
    }

    console.log(`Getting account info for user: ${userId}`);

    /**
     * Simulate account lookup
     */
    const accountInfo = {
      user123: { name: "John Doe", memberSince: "2023-01-15", totalOrders: 3 },
      user456: {
        name: "Jane Smith",
        memberSince: "2023-06-20",
        totalOrders: 2,
      },
      user789: {
        name: "Bob Wilson",
        memberSince: "2022-03-10",
        totalOrders: 4,
      },
    };

    const userAccount = accountInfo[userId as keyof typeof accountInfo];

    if (!userAccount) {
      return "Account information not found.";
    }

    return `Account: ${userAccount.name}\nMember since: ${userAccount.memberSince}\nTotal orders: ${userAccount.totalOrders}`;
  },
  {
    name: "get_account_info",
    description: "Get the authenticated user's account information",
    schema: z.object({}),
  }
);

/**
 * Create e-commerce assistant agent
 */
const ecommerceAgent = createAgent({
  llm: new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }),
  tools: [getUserPurchasesTool, getAccountInfoTool],
  prompt:
    "You are a helpful e-commerce assistant. You can help users check their purchase history and account information. Always use the available tools to provide accurate, personalized information.",
});

/**
 * Function to handle authenticated user requests
 * @param userId - The user ID
 * @param query - The user query
 */
async function handleUserRequest(userId: string, query: string) {
  // Set user ID in context - this would typically come from authentication/session
  setContextVariable("userId", userId);

  console.log(`\n--- Handling request for user: ${userId} ---`);
  console.log(`Query: ${query}`);

  const result = await ecommerceAgent.invoke({
    messages: [{ role: "user", content: query }],
  });

  console.log("Response:", result.messages[result.messages.length - 1].content);
}

/**
 * Example: User checking their purchase history
 */
console.log("=== Purchase History Lookup ===");
await handleUserRequest("user123", "Can you show me my recent purchases?");

/**
 * Example: User checking account information
 */
console.log("\n=== Account Information Lookup ===");
await handleUserRequest("user456", "What's my account information?");

/**
 * Example: User with more purchase history
 */
console.log("\n=== Limited Purchase History ===");
await handleUserRequest("user789", "Show me my last 2 purchases");

/**
 * Example: Unauthenticated request (no user ID in context)
 */
console.log("\n=== Unauthenticated Request ===");
await handleUserRequest("", "Show me my purchases");

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await ecommerceAgent.drawMermaidPng());

/**
 * Example Output:
 * === Purchase History Lookup ===
 *
 * --- Handling request for user: user123 ---
 * Query: Can you show me my recent purchases?
 * Looking up purchases for user: user123
 * Response: Here are your recent purchases:
 *
 * 1. **Wireless Headphones** - $199.99 (Purchased on 2024-01-15)
 * 2. **Phone Case** - $29.99 (Purchased on 2024-02-03)
 * 3. **Laptop Stand** - $89.99 (Purchased on 2024-02-20)
 *
 * === Account Information Lookup ===
 *
 * --- Handling request for user: user456 ---
 * Query: What's my account information?
 * Getting account info for user: user456
 * Response: Here is your account information:
 *
 * - **Name:** Jane Smith
 * - **Member since:** June 20, 2023
 * - **Total orders:** 2
 *
 * === Limited Purchase History ===
 *
 * --- Handling request for user: user789 ---
 * Query: Show me my last 2 purchases
 * Looking up purchases for user: user789
 * Response: Here are your last two purchases:
 *
 * 1. **Keyboard** - $129.99 (Purchased on 2024-01-06)
 * 2. **Monitor** - $349.99 (Purchased on 2024-01-05)
 *
 * === Unauthenticated Request ===
 *
 * --- Handling request for user:  ---
 * Query: Show me my purchases
 * Response: It seems that you're not currently logged in. Please log in to your account to view
 * your purchase history. If you need further assistance, feel free to ask!
 */
