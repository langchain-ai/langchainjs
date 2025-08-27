/**
 * Access Long Term Memory in Tools
 *
 * This allows tools to query and utilize persistent memory stores during execution, allowing them to leverage
 * historical knowledge and learned patterns in their operations.
 *
 * Why this is important:
 * - Knowledge-Enhanced Actions:
 *   Tools can incorporate past learnings and historical data to make better decisions
 * - Persistent Context Awareness:
 *   Maintains continuity across sessions by accessing previously stored information
 * - Intelligent Information Retrieval:
 *   Enables sophisticated search and recommendation capabilities based on accumulated knowledge
 *
 * Example Scenario:
 * A personal assistant that remembers each user's preferences and recent
 * interactions. Tools fetch preferences (e.g., summary style) and update them
 * over time, enabling stable, user-specific behavior across sessions.
 */

import fs from "node:fs/promises";
import { createReactAgent, tool, InMemoryStore } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

/**
 * Long-term memory store using LangChain primitives
 */
const store = new InMemoryStore();

/**
 * Initialize sample user data and knowledge in the store
 */
await store.put(["preferences"], "john_123", [
  "Prefers detailed technical explanations with code examples",
  "Likes step-by-step tutorials",
]);

await store.put(["context"], "john_123", [
  "Previously worked on React components and TypeScript projects",
  "Has experience with web development",
]);

await store.put(["preferences"], "sarah_456", [
  "Likes concise summaries and visual diagrams",
  "Prefers high-level overviews",
]);

await store.put(["context"], "sarah_456", [
  "Is a project manager focusing on team coordination",
  "Has background in project management",
]);

await store.put(["knowledge"], "web_dev", [
  "Previous discussion about implementing authentication in web applications",
  "Best practices for React component architecture",
  "Common patterns for state management",
]);

await store.put(["knowledge"], "database", [
  "Best practices for database optimization and query performance",
  "SQL indexing strategies",
  "Database design principles",
]);

await store.put(["interactions"], "john_123", []);
await store.put(["interactions"], "sarah_456", []);

/**
 * Knowledge retrieval tool that uses long-term memory
 */
const knowledgeRetrievalTool = tool(
  async (input: { query: string; userId?: string }) => {
    if (!store) {
      throw new Error("Store is required when compiling the graph");
    }

    const memories: string[] = [];

    /**
     * Get user-specific preferences and context if userId provided
     */
    if (input.userId) {
      const userPreferences = await store.get(["preferences"], input.userId);
      const userContext = await store.get(["context"], input.userId);

      if (userPreferences?.value) {
        memories.push(
          ...userPreferences.value.map(
            (pref: string) => `User preference: ${pref}`
          )
        );
      }
      if (userContext?.value) {
        memories.push(
          ...userContext.value.map((ctx: string) => `User context: ${ctx}`)
        );
      }
    }

    /**
     * Get relevant domain knowledge based on query keywords
     */
    const domains = ["web_dev", "database"];
    for (const domain of domains) {
      if (
        input.query.toLowerCase().includes(domain.replace("_", " ")) ||
        input.query.toLowerCase().includes("react") ||
        input.query.toLowerCase().includes("auth") ||
        input.query.toLowerCase().includes("database") ||
        input.query.toLowerCase().includes("optimization")
      ) {
        const domainKnowledge = await store.get(["knowledge"], domain);
        if (domainKnowledge?.value) {
          memories.push(
            ...domainKnowledge.value.map(
              (knowledge: string) => `Knowledge: ${knowledge}`
            )
          );
        }
      }
    }

    /**
     * Store this interaction for future reference
     */
    if (input.userId) {
      const interactions = await store.get(["interactions"], input.userId);
      const currentInteractions = interactions?.value || [];
      currentInteractions.push({
        query: input.query,
        timestamp: new Date().toISOString(),
      });
      await store.put(["interactions"], input.userId, currentInteractions);
    }

    const memoryContext = memories.slice(0, 5).join("\n- ");

    return `Found ${memories.length} relevant memories for "${input.query}":

- ${memoryContext}

This information helps me provide more personalized and contextually relevant responses based on your history and preferences.`;
  },
  {
    name: "knowledge_retrieval",
    description:
      "Retrieve relevant information from long-term memory based on user query and preferences",
    schema: z.object({
      query: z.string().describe("The query to search for in long-term memory"),
      userId: z
        .string()
        .optional()
        .describe("Optional user ID to personalize results"),
    }),
  }
);

/**
 * Preference learning tool that updates long-term memory
 */
const preferencelearningTool = tool(
  async (input: { observation: string; userId: string; category: string }) => {
    if (!store) {
      throw new Error("Store is required when compiling the graph");
    }

    /**
     * Get existing data for this category and user
     */
    const namespace =
      input.category === "preference" ? ["preferences"] : ["context"];
    const existingData = await store.get(namespace, input.userId);
    const currentItems = existingData?.value || [];

    /**
     * Add the new observation to the existing data
     */
    currentItems.push(input.observation);
    await store.put(namespace, input.userId, currentItems);

    /**
     * Check if we had existing preferences
     */
    let updateNote = "";
    if (existingData?.value && existingData.value.length > 0) {
      updateNote = `\n\nNote: This updates your existing ${
        input.category
      } information. Previous entries:\n${existingData.value
        .map((item: string) => `- ${item}`)
        .join("\n")}`;
    }

    return `Learned new ${input.category} for user ${input.userId}: "${input.observation}"${updateNote}

This information will be used to personalize future interactions.`;
  },
  {
    name: "preference_learning",
    description:
      "Learn and store user preferences or context in long-term memory",
    schema: z.object({
      observation: z
        .string()
        .describe("The preference or context to learn about the user"),
      userId: z.string().describe("The user ID this preference belongs to"),
      category: z
        .string()
        .describe("Category of information (preference, context, skill, etc.)"),
    }),
  }
);

/**
 * Create the agent with memory-aware tools
 */
const agent = createReactAgent({
  llm,
  tools: [knowledgeRetrievalTool, preferencelearningTool],
  store, // Pass the store to the agent
  prompt: `You are a personalized AI assistant with access to long-term memory about users and past interactions.

Use the knowledge_retrieval tool to:
- Find relevant information from past conversations
- Understand user preferences and context
- Provide personalized responses

Use the preference_learning tool to:
- Learn new things about users
- Update user preferences when they mention them
- Store important context for future interactions

Always try to personalize your responses based on retrieved memory when appropriate.`,
});

/**
 * Demonstrate long-term memory capabilities with configurable userId
 */
console.log("\n=== John's First Interaction ===");
const johnResult1 = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Hi, I'm John. I need help with React components. Can you check what you know about my preferences?",
      },
    ],
  },
  { configurable: { userId: "john_123" } }
);

console.log(johnResult1.messages.at(-1)?.content);

console.log("\n=== Learning About John's New Preference ===");
const johnResult2 = await agent.invoke(
  {
    messages: [
      ...johnResult1.messages,
      {
        role: "user",
        content:
          "By the way, I prefer step-by-step tutorials over just code examples. Please remember this for next time.",
      },
    ],
  },
  { configurable: { userId: "john_123" } }
);

console.log(johnResult2.messages.at(-1)?.content);

console.log("\n=== Sarah's Different Context ===");
const sarahResult1 = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Hello, I'm Sarah. I need information about database optimization. What do you know about my preferences?",
      },
    ],
  },
  { configurable: { userId: "sarah_456" } }
);

console.log(sarahResult1.messages.at(-1)?.content);

console.log("\n=== John Returns Later ===");
const johnResult3 = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Hi again, it's John. Now I need help with authentication in React apps.",
      },
    ],
  },
  { configurable: { userId: "john_123" } }
);

console.log(johnResult3.messages.at(-1)?.content);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

/**
 * Example Output:
 * === John's First Interaction ===
 * Hi John! It looks like I don't have any stored preferences for you yet. Since you're interested
 * in React components, would you like to share any specific areas or topics within React that
 * you're focusing on? This way, I can tailor my assistance to better suit your needs.
 *
 * === Learning About John's New Preference ===
 * Got it, John! I've noted that you prefer step-by-step tutorials. Now, how can I assist you with
 * React components today?
 *
 * === Sarah's Different Context ===
 * Hello Sarah! It seems I don't have any stored preferences for you yet. Could you tell me a bit
 * about your specific interests or needs regarding database optimization? This will help me provide
 * more tailored information.
 *
 * === John Returns Later ===
 * Hi John! I remember you prefer step-by-step tutorials, so let's go through the process of implementing
 * authentication in a React app together.
 *
 * <...instructions on how to implement authentication in React apps...>
 */
