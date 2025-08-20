/**
 * Pre-Model Hook for Permanent Message Transformations
 *
 * Pre-model hooks execute before the model node in the graph and can make
 * PERMANENT changes to the conversation state. Unlike prompt functions,
 * these transformations are saved and persist across interactions.
 *
 * IMPORTANT DISTINCTION - Pre-Model Hook vs Prompt Function:
 *
 * Pre-Model Hook (this example):
 * - Executes: Before model node in the graph
 * - Purpose: PERMANENT transformations that modify state
 * - State Changes: Updates are saved to conversation state
 * - Use Cases: Message summarization, content filtering, persistent context injection
 *
 * Prompt Function (see `controlOverMessagePreparation.ts` for an example):
 * - Executes: When the model is called
 * - Purpose: TEMPORARY transformations for this LLM call only
 * - State Changes: None - original state remains unchanged
 * - Use Cases: Reminders, temporary context, formatting hints
 *
 * Rule of Thumb:
 * - Permanent state changes → Use pre-model hook (this pattern)
 * - Temporary transformations → Use prompt function
 *
 * Common Pre-Model Hook Patterns:
 * - Summarizing long conversation history to save tokens
 * - Filtering out sensitive information permanently
 * - Adding persistent context that should be part of the conversation
 * - Content moderation and safety filtering
 *
 * Example Scenario:
 * You're building a support bot that needs to summarize long conversations
 * to stay within token limits. When the conversation gets too long, you want
 * to permanently replace older messages with a summary, keeping the
 * conversation history manageable while preserving important context.
 */

import fs from "node:fs/promises";
import { BaseMessage, createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Support tools
 */
const createTicket = tool(
  async (input: { issue: string; priority: string }) => {
    return `Created support ticket: ${input.issue} (Priority: ${input.priority})`;
  },
  {
    name: "create_ticket",
    description: "Create a support ticket",
    schema: z.object({
      issue: z.string().describe("Description of the issue"),
      priority: z.string().describe("Priority level: low, medium, high"),
    }),
  }
);

/**
 * Summarize messages
 * @param messages - The messages to summarize
 * @returns The summarized messages
 */
function summarizeMessages(messages: BaseMessage[]) {
  const messagesToSummarize = messages.slice(0, -4); // Keep last 4 messages
  const recentMessages = messages.slice(-4);

  /**
   * Create summary of older messages
   */
  const conversationSummary = messagesToSummarize
    .map((msg) => {
      const messageType = msg.getType() || "unknown";
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return `${messageType}: ${content}`;
    })
    .join("\n");

  /**
   * Create a permanent summary message that will be stored in state
   */
  const summaryMessage = {
    role: "system",
    content: `[CONVERSATION SUMMARY - Previous ${messagesToSummarize.length} messages]:\n${conversationSummary}\n\n[END SUMMARY - Current conversation continues below]`,
  };

  /**
   * Replace old messages with summary
   */
  const newMessages = [summaryMessage, ...recentMessages];

  console.log(
    `📝 Pre-model hook: Summarized ${messagesToSummarize.length} old messages`
  );
  console.log(`📊 Message count: ${messages.length} → ${newMessages.length}`);

  /**
   * Return modified state - this will be SAVED permanently
   */
  return newMessages;
}

/**
 * Create agent with pre-model hook for permanent transformations
 */
const supportAgent = createAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [createTicket],
  preModelHook: (state) => {
    const messages = [...state.messages];
    const MAX_MESSAGES = 6; // Keep conversation manageable

    /**
     * If conversation is getting too long, summarize older messages
     */
    if (messages.length > MAX_MESSAGES) {
      return {
        ...state,
        messages: summarizeMessages(messages),
      };
    }

    /**
     * No changes needed
     */
    return state;
  },
  prompt:
    "You are a helpful technical support agent. Keep track of the conversation context.",
});

/**
 * Example: Demonstrating permanent state changes via pre-model hook
 */
console.log("=== Building up a long conversation ===");

/**
 * Start with initial messages to trigger summarization
 */
const initialMessages = [
  { role: "user", content: "Hi, I'm having trouble with my laptop" },
  {
    role: "assistant",
    content: "I'd be happy to help! What specific issues are you experiencing?",
  },
  { role: "user", content: "It's running very slowly and freezing" },
  {
    role: "assistant",
    content: "Let's troubleshoot this. How long has this been happening?",
  },
  { role: "user", content: "About a week now, getting worse each day" },
  { role: "assistant", content: "Have you tried restarting recently?" },
  { role: "user", content: "Yes, multiple times but it doesn't help" },
];

console.log(`Starting with ${initialMessages.length} messages`);

/**
 * This interaction will trigger the pre-model hook to summarize
 */
console.log("\n=== Adding message that triggers summarization ===");
const result = await supportAgent.invoke({
  messages: [
    ...initialMessages,
    { role: "user", content: "What should I do next?" },
  ],
});

console.log(
  `\nAfter pre-model hook: ${result.messages.length} messages in state`
);
console.log("\n=== What's permanently stored in state ===");
result.messages.forEach((msg: BaseMessage, i: number) => {
  const messageType = msg.getType() || "unknown";
  const content =
    typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
  const preview = content.substring(0, 60) + (content.length > 60 ? "..." : "");
  console.log(`${i + 1}. [${messageType}] ${preview}`);
});

const lastMessage = result.messages[result.messages.length - 1];
const lastContent =
  typeof lastMessage.content === "string"
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
console.log(`\nAssistant response: ${lastContent}`);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await supportAgent.drawMermaidPng());

/**
 * Key Distinction Summary:
 *
 * Pre-model hook (this example):
 * - Summary message is PERMANENTLY stored in conversation state
 * - Old messages are PERMANENTLY removed from state
 * - State is modified and saved before model execution
 * - Changes persist across all future interactions
 *
 * Prompt function (alternative approach):
 * - Would only temporarily add summary for the LLM call
 * - Original messages would remain in state unchanged
 * - No permanent state modifications
 * - Summary would need to be regenerated each time
 *
 * This approach permanently optimizes conversation length while preserving
 * important context through summarization.
 *
 * Example Output:
 * === Building up a long conversation ===
 * Starting with 7 messages
 *
 * === Adding message that triggers summarization ===
 * 📝 Pre-model hook: Summarized 4 old messages
 * 📊 Message count: 8 → 5
 *
 * After pre-model hook: 10 messages in state
 *
 * === What's permanently stored in state ===
 * 1. [human] Hi, I'm having trouble with my laptop
 * 2. [ai] I'd be happy to help! What specific issues are you experienc...
 * 3. [human] It's running very slowly and freezing
 * 4. [ai] Let's troubleshoot this. How long has this been happening?
 * 5. [human] About a week now, getting worse each day
 * 6. [ai] Have you tried restarting recently?
 * 7. [human] Yes, multiple times but it doesn't help
 * 8. [human] What should I do next?
 * 9. [system] [CONVERSATION SUMMARY - Previous 4 messages]:
 * human: Hi, I'm...
 * 10. [ai] Alright. Can you check if there are any programs open that a...
 *
 * Assistant response: Alright. Can you check if there are any programs open that are not necessary?
 * Sometimes too many programs running at once can slow down your laptop.
 */
