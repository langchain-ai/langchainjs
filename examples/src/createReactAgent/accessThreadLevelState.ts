/**
 * Access Thread Level State in Message Generation
 *
 * This enables the agent to access and utilize the current conversation history and thread-specific state
 * when crafting responses, maintaining conversational coherence and context awareness.
 *
 * Why this is important:
 * - Conversational Continuity:
 *   Maintains coherent dialogue by referencing previous exchanges and building upon established context
 * - Adaptive Responses:
 *   Modifies response style and content based on conversation flow and user interaction patterns
 * - State-Aware Decision Making:
 *   Makes informed choices about tools and actions based on what has already occurred in the conversation
 *
 * Example Scenario:
 * You're building a coding tutor bot. If the user has been asking about Python basics for several messages,
 * then suddenly asks "How do I make a loop?", the agent can infer they want a Python loop example rather than
 * asking them to clarify the programming language.
 */

import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Tool for coding examples
 */
const codeExampleTool = tool(
  async (input: { language: string; concept: string }) => {
    return `Here's a ${input.language} example for ${input.concept}:\n// Example code here`;
  },
  {
    name: "get_code_example",
    description: "Get code examples for programming concepts",
    schema: z.object({
      language: z.string(),
      concept: z.string(),
    }),
  }
);

/**
 * Create agent that uses conversation history for context
 */
const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [codeExampleTool],
  prompt: async (state) => {
    const conversationHistory = state.messages;
    const messageCount = conversationHistory.length;

    // Analyze conversation to infer context
    const recentMessages = conversationHistory.slice(-5);
    const mentionedLanguages = recentMessages
      .map((msg) => msg.content || "")
      .join(" ")
      .toLowerCase();

    let inferredLanguage = "general";
    if (mentionedLanguages.includes("python")) inferredLanguage = "Python";
    else if (mentionedLanguages.includes("javascript"))
      inferredLanguage = "JavaScript";
    else if (mentionedLanguages.includes("java")) inferredLanguage = "Java";

    return [
      {
        role: "system",
        content: `You are a coding tutor. Based on our ${messageCount} message conversation, 
                 the user seems to be working with ${inferredLanguage}. 
                 When they ask about programming concepts, assume they want ${inferredLanguage} examples 
                 unless they specify otherwise.`,
      },
      ...state.messages,
    ];
  },
});

/**
 * Example Usage
 */
const result = await agent.invoke({
  messages: [
    { role: "user", content: "I'm learning Python basics" },
    {
      role: "assistant",
      content: "Great! Python is a wonderful language to start with.",
    },
    { role: "user", content: "How do I make a loop?" }, // Agent will infer Python loop
  ],
});

console.log(result);
