/**
 * Transient Message Transformations via Prompt Function
 *
 * This allows you to temporarily modify the message list before sending it to the LLM,
 * without persisting those changes to the conversation state. The transformations only
 * exist for that specific LLM call.
 *
 * IMPORTANT DISTINCTION - Prompt Function vs Pre-Model Hook:
 *
 * Prompt Function (this example):
 * - Executes: When the model is called
 * - Purpose: TEMPORARY transformations for this LLM call only
 * - State Changes: None - original state remains unchanged
 * - Use Cases: Reminders, temporary context, formatting hints
 *
 * Pre-Model Hook (see `preModelHook.ts` for an example):
 * - Executes: Before model node in the graph
 * - Purpose: PERMANENT transformations that modify state
 * - State Changes: Updates are saved to conversation state
 * - Use Cases: Message summarization, content filtering, persistent context injection
 *
 * Rule of Thumb:
 * - Temporary transformations → Use prompt function (this pattern)
 * - Permanent state changes → Use pre-model hook
 *
 * Common Prompt Function Patterns:
 * - Adding reminder messages at the end to reinforce key guidelines
 * - Injecting temporary context that's only relevant for the current turn
 * - Reformatting existing messages without changing the stored conversation
 *
 * Example Scenario:
 * You're building a customer service bot that needs to follow strict guidelines.
 * Rather than repeating these guidelines in every stored message, you temporarily
 * append a reminder before each LLM call to ensure compliance.
 */
import fs from "node:fs/promises";
import { createAgent, tool } from "langchain";
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
 * Create agent using `prompt` function for transient transformations
 */
const customerServiceAgent = createAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [escalateToHuman, checkRefundPolicy],
  prompt: async (state) => {
    /**
     * Start with the stored conversation messages from state
     * These are the permanent messages that get persisted.
     */
    const messages = [
      {
        role: "system",
        content: "You are a helpful customer service representative.",
      },
      ...state.messages,
    ];

    /**
     * Prompt function transformation: Add temporary reminder at the end
     *
     * Key Points:
     * - This runs when the model is called (not before)
     * - This is NOT stored in state - it's just for this LLM call
     * - State remains unchanged after this transformation
     * - Next time the agent runs, this gets added again transiently
     *
     * If you wanted this reminder to be permanent, you'd use a pre-model hook instead
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
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await customerServiceAgent.drawMermaidPng());

/**
 * Key Distinction Summary:
 *
 * `prompt` function (this example):
 * - Reminder message appears in every LLM call but is NEVER stored
 * - State remains clean and unchanged
 * - Temporary transformations only
 *
 * Pre-model hook (see `preModelHook.ts` for an example):
 * - Would actually modify and save the reminder to conversation state
 * - Permanent changes that persist across interactions
 * - Used for summarization, content filtering, etc.
 *
 * This keeps the permanent conversation clean while ensuring the LLM
 * always follows guidelines through temporary prompting.
 *
 * Example Output:
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
