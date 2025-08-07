/**
 * Update Model to Use Before Model Call
 *
 * This capability enables dynamic model selection based on context, allowing the agent to choose the most
 * appropriate language model for each specific task or situation.
 *
 * Why this is important:
 * - Cost Optimization:
 *   Uses smaller, cheaper models for simple tasks and reserves powerful models for complex reasoning
 * - Performance Matching:
 *   Selects models with capabilities that match the specific requirements of each request
 * - Specialized Routing:
 *   Directs different types of queries to models that excel in those particular domains
 *
 * Example Scenario:
 * You're building a coding assistant that handles both simple syntax questions and complex algorithm design.
 * Simple questions like "How do I declare a variable?" use a fast, cost-effective model, while complex requests
 * like "Design a distributed caching algorithm" are routed to a more powerful model.
 */

import { createReactAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

type SelectedModel = "gpt-4o" | "gpt-4o-mini";

function chooseModel(message: string): SelectedModel {
  const text = message.toLowerCase();
  const isComplex = /algorithm|architecture|optimi(?:s|z)e|system design/.test(
    text
  );
  return isComplex ? "gpt-4o" : "gpt-4o-mini";
}

const agent = createReactAgent({
  llm: async (state) => {
    const last = state.messages[state.messages.length - 1];
    const content = typeof last.content === "string" ? last.content : "";
    const modelId = chooseModel(content);
    console.log(
      `\n🧠 Model router → ${modelId} | Query: "${content.slice(0, 60)}..."`
    );
    return new ChatOpenAI({
      model: modelId,
      temperature: modelId === "gpt-4o" ? 0.2 : 0.5,
    });
  },
  tools: [],
  prompt: `You are a concise coding assistant. Answer clearly.`,
});

/**
 * Example
 */
const simple = await agent.invoke({
  messages: [
    { role: "user", content: "How do I declare a variable in JavaScript?" },
  ],
});
console.log("Simple:", simple.messages.at(-1)?.content);

const complex = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Design an algorithm and high-level architecture for a rate limiter service.",
    },
  ],
});
console.log("Complex:", complex.messages.at(-1)?.content);

/**
 * Expected: first query routes to gpt-4o-mini, second to gpt-4o.
 * === Dynamic Model Selection (Simple) ===
 *
 * 🧠 Model router → gpt-4o-mini | Query: "How do I declare a variable in JavaScript?..."
 * Simple: In JavaScript, you can declare a variable using one of three keywords: `var`, `let`,
 * or `const`. Here’s how to use each: ...
 *
 * 🧠 Model router → gpt-4o | Query: "Design an algorithm and high-level architecture for a rate l..."
 * Complex: ### Algorithm for Rate Limiter Service...
 */
