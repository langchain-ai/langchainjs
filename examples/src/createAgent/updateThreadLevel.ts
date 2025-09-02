/**
 * Update Thread Level Before Model Invocation
 *
 * This hook allows you to modify the conversation state and context immediately before the language model is called, enabling dynamic preprocessing and state management.
 *
 * Why this is important:
 * - Memory Management:
 *   Prevents context overflow by trimming or summarizing long conversations before model calls
 * - Dynamic Context Injection:
 *   Adds real-time information or contextual cues just before the model processes the request
 * - Performance Optimization:
 *   Manages token usage and response quality by curating the most relevant context
 *
 * Example Scenario:
 * You're building a support chat bot that handles long troubleshooting sessions. As the conversation grows,
 * you trim older messages to stay within token limits, but you also inject current system status information
 * before each model call so the agent knows if services are down or experiencing issues.
 */

import fs from "node:fs/promises";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Support tool for troubleshooting
 */
const checkSystemStatus = tool(
  async () => {
    /**
     * Simulate checking system status
     */
    const services = ["API", "Database", "Cache"];
    const statuses = services.map((service) => ({
      service,
      status: Math.random() > 0.2 ? "operational" : "down",
    }));
    return `System Status: ${JSON.stringify(statuses)}`;
  },
  {
    name: "check_system_status",
    description: "Check the status of system services",
    schema: z.object({}),
  }
);

/**
 * Create agent with preModelHook for state management
 */
const agent = createAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [checkSystemStatus],
  preModelHook: (state) => {
    /**
     * Memory management - prevent token overflow
     */
    if (state.messages.length > 20) {
      console.log("Trimming conversation history to manage memory");
      return {
        ...state,
        messages: [
          /**
           * Keep original system message if present
           */
          state.messages[0],
          /**
           * Keep last 10 messages
           */
          ...state.messages.slice(-10),
        ],
      };
    }

    /**
     * Inject real-time context before model call
     */
    const currentTime = new Date().toISOString();
    const systemStatusMessage = {
      role: "system",
      content: `Current time: ${currentTime}. Note: Check system status if user reports issues.`,
    };

    return {
      ...state,
      messages: [...state.messages, systemStatusMessage],
    };
  },
});

/**
 * Example Usage
 */
const result = await agent.invoke({
  messages: [
    { role: "user", content: "I can't access my account, is something wrong?" },
  ],
});

console.log(result.messages.at(-1)?.content);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

/**
 * Example Output:
 * All system services are operational at this time. Your inability to access your account may
 * be due to incorrect login details. Please make sure you're using the right credentials. If
 * the issue persists, you might need to reset your password.
 */
