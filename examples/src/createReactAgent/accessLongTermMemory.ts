/**
 * Access Long-Term Memory for Procedural Instructions
 *
 * This pattern programmatically retrieves and includes procedural memory components
 * in the system prompt. Unlike semantic search, this is deterministic lookup of
 * stored instructions, preferences, or system behaviors that evolve over time.
 *
 * Procedural vs Semantic Memory:
 * - Procedural: Fixed instructions, preferences, learned behaviors (this example)
 *   - Retrieved programmatically, not by similarity
 *   - Always included in system prompt
 *   - Updated over time based on user interactions
 *
 * - Semantic: Content-based search, contextual retrieval (better suited for tools, see `accessLongTermMemoryInTools.ts`)
 *   - Agent decides what to search for
 *   - Retrieved based on similarity/relevance
 *   - Used for answering specific questions
 *
 * Example Scenario:
 * A coding assistant like Cursor that learns user preferences over time. It stores
 * procedural instructions like "always use TypeScript", "prefer functional patterns",
 * "avoid console.log in production" and programmatically includes these in every
 * system prompt to maintain consistent behavior.
 */

import fs from "node:fs/promises";
import { createReactAgent, tool, InMemoryStore } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Long-term memory store using LangChain primitives
 */
const store = new InMemoryStore();

/**
 * Interface for procedural memory data
 */
interface ProceduralMemory {
  userId: string;
  codingPreferences: string[];
  behaviorInstructions: string[];
  communicationStyle: string;
  lastUpdated: string;
}

/**
 * Initialize some sample procedural memory data
 */
await store.put(["procedural_memory"], "user123", {
  userId: "user123",
  codingPreferences: [
    "Always use TypeScript for new projects",
    "Prefer functional programming patterns",
    "Use const over let when possible",
    "Write comprehensive JSDoc comments",
  ],
  behaviorInstructions: [
    "Provide detailed explanations for complex concepts",
    "Always suggest best practices",
    "Include code examples in responses",
  ],
  communicationStyle: "technical and detailed",
  lastUpdated: "2024-02-20",
});

await store.put(["procedural_memory"], "user456", {
  userId: "user456",
  codingPreferences: [
    "Keep code simple and readable",
    "Avoid over-engineering solutions",
    "Prefer vanilla JavaScript over frameworks when possible",
  ],
  behaviorInstructions: [
    "Keep explanations concise",
    "Focus on practical solutions",
    "Avoid jargon when possible",
  ],
  communicationStyle: "simple and direct",
  lastUpdated: "2024-02-18",
});

/**
 * Tool to get user's procedural memory
 */
const getProceduralMemoryTool = tool(
  async (_: never, config): Promise<string> => {
    if (!store) {
      throw new Error("Store is required when compiling the graph");
    }

    const userId = config.configurable?.userId;
    if (!userId) {
      throw new Error("userId is required in the config");
    }

    const memoryData = await store.get(["procedural_memory"], userId);
    return memoryData
      ? JSON.stringify(memoryData.value, null, 2)
      : "No procedural memory found";
  },
  {
    name: "get_procedural_memory",
    description: "Get user's procedural memory and preferences",
    schema: z.object({}),
  }
);

/**
 * Tool to update user's procedural memory
 */
const updateProceduralMemoryTool = tool(
  async (input, config): Promise<string> => {
    if (!store) {
      throw new Error("Store is required when compiling the graph");
    }

    const userId = config.configurable?.userId;
    if (!userId) {
      throw new Error("userId is required in the config");
    }

    // Get existing memory
    const existingMemory = await store.get(["procedural_memory"], userId);
    const currentMemory = (existingMemory?.value as ProceduralMemory) || {
      userId,
      codingPreferences: [],
      behaviorInstructions: [],
      communicationStyle: "neutral",
      lastUpdated: "",
    };

    // Update with new values
    const updatedMemory = {
      ...currentMemory,
      ...input,
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    await store.put(["procedural_memory"], userId, updatedMemory);
    return "Successfully updated procedural memory";
  },
  {
    name: "update_procedural_memory",
    description: "Update user's procedural memory and preferences",
    schema: z.object({
      codingPreferences: z
        .array(z.string())
        .optional()
        .describe("Coding preferences to add"),
      behaviorInstructions: z
        .array(z.string())
        .optional()
        .describe("Behavior instructions to update"),
      communicationStyle: z
        .string()
        .optional()
        .describe("Communication style preference"),
    }),
  }
);

/**
 * Create coding assistant with procedural memory from LangChain store
 */
const codingAssistant = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [getProceduralMemoryTool, updateProceduralMemoryTool],
  store, // Pass the store to the agent
  prompt: async (state, config) => {
    /**
     * PROGRAMMATIC LOOKUP: Always retrieve procedural memory for this user
     * This is deterministic - we're not searching, just loading stored preferences
     */
    const storeInstance = config.store;
    const userId = config.configurable?.userId;

    let memoryPrompt = "";
    if (storeInstance && userId) {
      const memoryData = await storeInstance.get(["procedural_memory"], userId);
      if (memoryData?.value) {
        const memory = memoryData.value as ProceduralMemory;
        memoryPrompt = `
PROCEDURAL MEMORY (${memory.lastUpdated}):

Coding Preferences:
${memory.codingPreferences.map((pref) => `• ${pref}`).join("\n")}

Behavior Instructions:
${memory.behaviorInstructions.map((inst) => `• ${inst}`).join("\n")}

Communication Style: ${memory.communicationStyle}

---`;
      }
    }

    return [
      {
        role: "system",
        content: `You are a coding assistant with access to the user's long-term preferences stored in LangChain memory.

${memoryPrompt}

Use the above procedural memory to maintain consistent behavior and preferences across all interactions. You can also use the tools to retrieve or update memory as needed.`,
      },
      ...state.messages,
    ];
  },
});

/**
 * Example: Different users get different behaviors based on their procedural memory
 */
console.log("=== User with Technical Preferences ===");
const techResult = await codingAssistant.invoke(
  {
    messages: [
      {
        role: "user",
        content: "How should I implement a simple counter component?",
      },
    ],
  },
  { configurable: { userId: "user123" } }
);
console.log(
  "Response:",
  techResult.messages[techResult.messages.length - 1].content
);

console.log("\n=== User with Simple Preferences ===");
const simpleResult = await codingAssistant.invoke(
  {
    messages: [
      {
        role: "user",
        content: "How should I implement a simple counter component?",
      },
    ],
  },
  { configurable: { userId: "user456" } }
);
console.log(
  "Response:",
  simpleResult.messages[simpleResult.messages.length - 1].content
);

/**
 * Example: Update procedural memory using tools
 */
console.log("\n=== Updating Procedural Memory via Tools ===");
const updateResult = await codingAssistant.invoke(
  {
    messages: [
      {
        role: "user",
        content:
          "Please add 'Always include error handling in async functions' to my coding preferences",
      },
    ],
  },
  { configurable: { userId: "user123" } }
);
console.log(
  "Update Response:",
  updateResult.messages[updateResult.messages.length - 1].content
);

/**
 * Example: Verify memory was updated
 */
console.log("\n=== Verifying Updated Memory ===");
const verifyResult = await codingAssistant.invoke(
  {
    messages: [
      { role: "user", content: "What are my current coding preferences?" },
    ],
  },
  { configurable: { userId: "user123" } }
);
console.log(
  "Verification Response:",
  verifyResult.messages[verifyResult.messages.length - 1].content
);

/**
 * Example: Direct store access (for debugging/admin purposes)
 */
console.log("\n=== Direct Store Access ===");
const directMemory = await store.get(["procedural_memory"], "user123");
console.log(
  "Direct store access:",
  JSON.stringify(directMemory?.value, null, 2)
);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await codingAssistant.drawMermaidPng());

/**
 * Example Output:
 *
 * === User with Technical Preferences ===
 * Response: For implementing a counter component, I'd recommend using TypeScript for type safety.
 * Here's a detailed implementation following your preferences:
 *
 * ```tsx
 * interface CounterProps {
 *   initialValue?: number;
 * }
 *
 * const Counter: React.FC<CounterProps> = ({ initialValue = 0 }) => {
 *   const [count, setCount] = useState<number>(initialValue);
 *   // ... detailed implementation with JSDoc comments
 * ```
 *
 * === User with Simple Preferences ===
 * Response: Here's a simple counter component:
 *
 * ```javascript
 * function Counter() {
 *   const [count, setCount] = useState(0);
 *   return (
 *     <div>
 *       <p>Count: {count}</p>
 *       <button onClick={() => setCount(count + 1)}>+</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * This keeps it straightforward and readable.
 *
 * === Updating Procedural Memory via Tools ===
 * Update Response: I've successfully added 'Always include error handling in async functions'
 * to your coding preferences. Your procedural memory has been updated.
 *
 * === Direct Store Access ===
 * Direct store access: {
 *   "userId": "user123",
 *   "codingPreferences": [
 *     "Always use TypeScript for new projects",
 *     "Prefer functional programming patterns",
 *     "Use const over let when possible",
 *     "Write comprehensive JSDoc comments",
 *     "Always include error handling in async functions"
 *   ],
 *   "behaviorInstructions": [...],
 *   "communicationStyle": "technical and detailed",
 *   "lastUpdated": "2024-02-21"
 * }
 */
