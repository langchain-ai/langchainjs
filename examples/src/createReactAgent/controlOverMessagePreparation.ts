/**
 * Explicit control over message preparation
 *
 * This allows you to temporarily modify the message list before sending it to the LLM,
 * without persisting those changes to the conversation state. The transformations only
 * exist for that specific LLM call.
 *
 * When to use this vs storing in state:
 * - Use this for: Temporary reminders, contextual hints, formatting that you don't want
 *   cluttering the permanent conversation history
 * - Store in state: Important information, user messages, assistant responses, tool results
 *   that should be part of the ongoing conversation
 *
 * Common patterns:
 * - Adding reminder messages at the end to reinforce key guidelines
 * - Injecting temporary context that's only relevant for the current turn
 * - Reformatting existing messages without changing the stored conversation
 *
 * Example Scenario:
 * You're building a customer service bot that needs to follow strict guidelines.
 * Rather than repeating these guidelines in every stored message, you temporarily
 * append a reminder before each LLM call to ensure compliance.
 */
import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Customer service tools
 */
const escalateToHuman = tool(
  async (input: { reason: string }) => {
    return `Escalated to human agent. Reason: ${input.reason}`;
  },
  {
    name: "escalate_to_human",
    description: "Escalate the conversation to a human agent",
    schema: z.object({
      reason: z.string().describe("Reason for escalation"),
    }),
  }
);

const checkRefundPolicy = tool(
  async () => {
    return "Refund policy: 30-day return window for most items, original receipt required";
  },
  {
    name: "check_refund_policy",
    description: "Get current refund policy information",
  }
);

/**
 * Create agent that adds transient reminder messages
 */
const customerServiceAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [escalateToHuman, checkRefundPolicy],
  prompt: async (state) => {
    /**
     * Start with the stored conversation messages
     */
    const messages = [
      {
        role: "system",
        content: "You are a helpful customer service representative.",
      },
      ...state.messages,
    ];

    /**
     * TRANSIENT TRANSFORMATION: Add temporary reminder at the end
     * This is NOT stored in state - it's just for this LLM call
     */
    messages.push({
      role: "system",
      content: `IMPORTANT REMINDERS (do not repeat these to the customer):
• Always be polite and empathetic
• If a customer is angry, acknowledge their frustration first
• Never promise refunds without checking policy first
• Escalate if the customer uses profanity or threats
• Current time: ${new Date().toLocaleTimeString()}`,
    });

    return messages;
  },
});

/**
 * Example: Multiple interactions showing transient transformations
 */
console.log("=== First Customer Interaction ===");
const result1 = await customerServiceAgent.invoke({
  messages: [
    { role: "user", content: "I'm really angry! My order was damaged!" },
  ],
});
console.log(
  "Assistant:",
  result1.messages[result1.messages.length - 1].content
);

/**
 * Check what's actually stored in state (no reminder message)
 */
console.log("\n=== What's stored in conversation state ===");
console.log("Message count in state:", result1.messages.length);
const lastMessage = result1.messages[result1.messages.length - 1];

/**
 * Notice: The temporary reminder is NOT in the stored messages
 */
console.log("Last stored message role:", lastMessage.getType());

/**
 * Second interaction - reminder gets added again transiently
 */
console.log("\n=== Second Customer Interaction ===");
const result2 = await customerServiceAgent.invoke({
  messages: [
    ...result1.messages, // Previous conversation
    { role: "user", content: "Can I get a refund?" },
  ],
});
console.log(
  "Assistant:",
  result2.messages[result2.messages.length - 1].content
);

/**
 * Key Point: The reminder message appears in every LLM call but is never
 * stored in the conversation history. This keeps the permanent conversation
 * clean while ensuring the LLM always follows guidelines.
 *
 * Expected output:
 * === First Customer Interaction ===
 * Assistant: I'm really sorry to hear that your order arrived damaged. I completely understand your
 * frustration and I'm here to assist you. In order to proceed, can you please provide me with your
 * order details?
 *
 * === What's stored in conversation state ===
 * Message count in state: 2
 * Last stored message role: ai
 *
 * === Second Customer Interaction ===
 * Assistant: Yes, we can surely go about arranging a refund for you. Our policy allows for returns
 * within a 30-day window for most items, as long as you have the original receipt. Can you confirm
 * if you are within this period and if you have the receipt?
 */
