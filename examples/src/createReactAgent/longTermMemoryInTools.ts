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
 * You're building a customer support tool that searches knowledge bases. When a customer asks about
 * "password reset", the tool not only searches current documentation but also recalls similar past cases
 * and their successful resolutions, providing more comprehensive and proven solutions.
 */

import { createReactAgent, tool, MemoryVectorStore } from "langchain";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

// Initialize vector store for long-term memory
const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());

// Simulate adding historical user data and preferences to memory
await vectorStore.addDocuments([
  {
    pageContent:
      "User John prefers detailed technical explanations with code examples",
    metadata: { type: "preference", userId: "john_123" },
  },
  {
    pageContent:
      "User John previously worked on React components and TypeScript projects",
    metadata: { type: "context", userId: "john_123" },
  },
  {
    pageContent: "User Sarah likes concise summaries and visual diagrams",
    metadata: { type: "preference", userId: "sarah_456" },
  },
  {
    pageContent:
      "User Sarah is a project manager focusing on team coordination",
    metadata: { type: "context", userId: "sarah_456" },
  },
  {
    pageContent:
      "Previous discussion about implementing authentication in web applications",
    metadata: { type: "topic", domain: "web_dev" },
  },
  {
    pageContent:
      "Best practices for database optimization and query performance",
    metadata: { type: "knowledge", domain: "database" },
  },
]);

/**
 * Knowledge retrieval tool that uses long-term memory
 */
const knowledgeRetrievalTool = tool(
  async (input: { query: string; userId?: string }) => {
    /**
     * Search long-term memory for relevant information
     * Combines user-specific and general knowledge
     */

    /**
     * Search for user-specific preferences and context
     */
    const userMemories = input.userId
      ? await vectorStore.similaritySearch(
          input.query,
          2,
          (doc) => doc.metadata.userId === input.userId
        )
      : [];

    /**
     * Search for general domain knowledge
     */
    const generalMemories = await vectorStore.similaritySearch(input.query, 3);

    /**
     * Combine and deduplicate memories
     */
    const allMemories = [...userMemories, ...generalMemories]
      .filter(
        (doc, index, arr) =>
          arr.findIndex((d) => d.pageContent === doc.pageContent) === index
      )
      .slice(0, 4);

    /**
     * Format the memory context
     */
    const memoryContext = allMemories
      .map((doc) => `- ${doc.pageContent} (${doc.metadata.type})`)
      .join("\n");

    /**
     * Store this interaction for future reference
     */
    await vectorStore.addDocuments([
      {
        pageContent: `User queried about: ${input.query}`,
        metadata: {
          type: "interaction",
          userId: input.userId || "unknown",
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    return `Found ${allMemories.length} relevant memories for "${input.query}":

${memoryContext}

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
    /**
     * Learn and store new preferences or context about the user
     */

    /**
     * Add the new observation to long-term memory
     */
    await vectorStore.addDocuments([
      {
        pageContent: input.observation,
        metadata: {
          type: input.category,
          userId: input.userId,
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    // Check if this contradicts or updates existing preferences
    const existingPreferences = await vectorStore.similaritySearch(
      input.observation,
      3,
      (doc) =>
        doc.metadata.userId === input.userId &&
        doc.metadata.type === input.category
    );

    let updateNote = "";
    if (existingPreferences.length > 0) {
      updateNote = `\n\nNote: This updates your existing ${
        input.category
      } preferences. Previous related entries:\n${existingPreferences
        .map((doc) => `- ${doc.pageContent}`)
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

// Create the agent with memory-aware tools
const agent = createReactAgent({
  llm,
  tools: [knowledgeRetrievalTool, preferencelearningTool],
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
 * Demonstrate long-term memory capabilities
 */
console.log("\n=== John's First Interaction ===");
const johnResult1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Hi, I'm John. I need help with React components. Can you check what you know about my preferences?",
    },
  ],
});

console.log(johnResult1.messages[johnResult1.messages.length - 1].content);

console.log("\n=== Learning About John's New Preference ===\n");
const johnResult2 = await agent.invoke({
  messages: [
    ...johnResult1.messages,
    {
      role: "user",
      content:
        "By the way, I prefer step-by-step tutorials over just code examples. Please remember this for next time.",
    },
  ],
});

console.log(johnResult2.messages[johnResult2.messages.length - 1].content);

console.log("\n=== Sarah's Different Context ===");
const sarahResult1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Hello, I'm Sarah. I need information about database optimization. What do you know about my preferences?",
    },
  ],
});

console.log(sarahResult1.messages[sarahResult1.messages.length - 1].content);

console.log("\n=== John Returns Later ===");
const johnResult3 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Hi again, it's John. Now I need help with authentication in React apps.",
    },
  ],
});

console.log(johnResult3.messages[johnResult3.messages.length - 1].content);

/**
 * Expected output:
 *
 * === John's First Interaction ===
 * Hi John! I see that you've worked on React components and TypeScript projects before. You also prefer detailed
 * technical explanations with code examples. How can I assist you with React components today?
 *
 * === Learning About John's New Preference ===
 *
 * Got it, John! I've updated your preferences to prioritize step-by-step tutorials over just code examples.
 * How can I assist you with React components today? Would you like a step-by-step guide on a specific topic?
 *
 * === Sarah's Different Context ===
 * Hi Sarah! I see that you're a project manager focusing on team coordination, and you prefer concise summaries
 * and visual diagrams. When it comes to database optimization, I can provide a brief overview and suggest some
 * visual resources if you'd like. Would you like a summary of key optimization techniques, or is there a specific
 * aspect you're interested in?
 *
 * === John Returns Later ===
 * Hi John! I see you've worked with React components and TypeScript before, and you prefer step-by-step tutorials.
 * Let's tackle authentication in React apps with that in mind.
 *
 * To implement authentication in a React app, you can follow these general steps:
 *
 * 1. **Choose an Authentication Method**: Decide whether you'll use a third-party service like Firebase, Auth0,
 *    or implement your own backend authentication.
 *
 * 2. **Set Up Your Authentication Service**:
 *   - For Firebase, you'll need to set up a project in the Firebase console and enable authentication.
 *   - For Auth0, create an application in the Auth0 dashboard and configure your settings.
 *
 * 3. **Install Necessary Packages**:
 *   - For Firebase: `npm install firebase`
 *   - For Auth0: `npm install @auth0/auth0-react`
 *
 * 4. **Initialize the Authentication Service**:
 *   - For Firebase, initialize it in your app with your configuration details.
 *   - For Auth0, wrap your app with the `Auth0Provider` and provide your domain and client ID.
 *
 * 5. **Create Authentication Context**: Use React Context to manage authentication state across your app.
 *
 * 6. **Implement Login and Logout**:
 *   - Create login and logout functions using the methods provided by your authentication service.
 *   - For Firebase, use `signInWithEmailAndPassword` and `signOut`.
 *   - For Auth0, use the `useAuth0` hook to access login and logout functions.
 *
 * 7. **Protect Routes**: Use a higher-order component or a custom hook to protect routes that require authentication.
 *
 * 8. **Handle Authentication State**: Use hooks like `useEffect` to listen for authentication state changes and
 *    update your UI accordingly.
 *
 * Would you like a more detailed guide on any of these steps, or do you have a specific question about implementing
 * authentication?
 */
