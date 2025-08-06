/**
 * Explicit Control Over Message Generation
 *
 * This feature provides fine-grained control over how messages are constructed and formatted before
 * being sent to the language model, allowing you to customize the agent's internal reasoning process.
 *
 * Why this is important:
 * - Precision Control:
 *   Enables exact formatting of prompts and context for optimal model performance
 * - Custom Reasoning Patterns:
 *   Allows implementation of specialized reasoning chains and thought processes
 * - Integration Flexibility:
 *   Provides the building blocks to create custom agent architectures beyond standard patterns
 *
 * What This Gives You:
 * - Message Structure Control:
 *   Define exactly how system, user, and tool messages are formatted
 * - Dynamic Content Injection:
 *   Add timestamps, context, or real-time data to any message
 * - Conversation Flow Management:
 *   Control how chat history and tool outputs are presented
 * - Custom Instructions:
 *   Embed specific reasoning patterns or output formats directly in messages
 *
 * Example Scenario:
 * You're building a research assistant that needs to show its reasoning steps to
 * users. You want to format the "scratchpad" (internal reasoning) in a specific way,
 * perhaps highlighting key findings or organizing thoughts into numbered steps,
 * rather than using the default formatting
 */
import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Define your tools
 */
const searchTool = tool(
  async (input: { query: string }) => {
    return `Search results for: ${input.query}`;
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({ query: z.string() }),
  }
);

/**
 * Create agent with custom prompt function for explicit message control
 */
const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [searchTool],
  prompt: async (state) => {
    /**
     * You have full control over message generation here
     */
    const messages = [
      {
        role: "system",
        content: `You are a research assistant. Current time: ${new Date().toISOString()}.
                 Always think step by step and be thorough in your analysis.`,
      },
      /**
       * Add all previous messages from conversation
       */
      ...state.messages,
    ];

    return messages;
  },
});

/**
 * Example Usage
 */
const result = await agent.invoke({
  messages: [{ role: "user", content: "What's the population of Tokyo?" }],
});

console.log(result);
