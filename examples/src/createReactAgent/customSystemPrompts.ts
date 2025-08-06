/**
 * Specify Custom System Prompt
 *
 * Custom system prompts allow you to define the agent's behavior, personality, and operational guidelines.
 * This can be either a static string or a dynamic function that generates prompts based on current state.
 *
 * Why this is important:
 * - Behavioral Control:
 *   Ensures the agent consistently follows your specific guidelines and maintains
 *   the desired tone and approach
 * - Domain Expertise:
 *   Allows you to inject specialized knowledge and constraints relevant to your
 *   specific use case
 * - Dynamic Adaptation:
 *   Enable context-aware behavior changes based on conversation state, user type,
 *   or external conditions
 *
 * **Example Scenario:**
 * You're building a customer service bot that needs different personalities for
 * different product lines. When a user asks about "enterprise solutions", the
 * agent becomes more formal and technical. When they ask about "consumer
 * products", it becomes friendlier and more casual.
 */

import { createReactAgent, SystemMessage, HumanMessage, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({ model: "gpt-4" });

const getWeather = tool(
  async () => {
    return "The weather is sunny";
  },
  { name: "get_weather", description: "Get the weather" }
);

/**
 * Static prompt - Use for consistent behavior across all interactions
 */
const staticAgent = createReactAgent({
  llm,
  tools: [getWeather],
  prompt:
    "You are a weather assistant. Always be enthusiastic about the weather!",
});

const staticReport = await staticAgent.invoke({
  messages: [new HumanMessage("What is the weather?")],
});

console.log("Static Report:", staticReport.messages.pop()?.content);

/**
 * Dynamic prompt function - Use when behavior needs to adapt based on context
 */
const dynamicAgent = createReactAgent({
  llm,
  tools: [getWeather],
  prompt: async (state) => {
    const userMessage = state.messages[state.messages.length - 1];
    return [
      new SystemMessage(
        `You are helping user: ${userMessage.content}. Be helpful!`
      ),
    ];
  },
});

/**
 * Example Usage
 */
const dynamicReport = await dynamicAgent.invoke({
  messages: [new HumanMessage("What is the weather?")],
});

console.log("Dynamic Report:", dynamicReport.messages.pop()?.content);
