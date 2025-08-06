/**
 * Access Thread Level Context in Tools
 *
 * This allows tools to access the current conversation history and thread-specific state during execution, enabling tools to make informed decisions based on the ongoing dialogue.
 *
 * Why this is important:
 * - Conversation-Aware Tools:
 *   Tools can reference previous interactions and maintain consistency with the ongoing conversation
 * - Context-Dependent Actions:
 *   Tool behavior can vary based on what has been discussed or accomplished earlier in the thread
 * - Intelligent Workflow Management:
 *   Enables tools to coordinate with each other and avoid redundant actions
 *
 * Example Scenario:
 * You're building a document search tool for a legal assistant. When the tool is called to search for
 * "contract clauses", it looks at the conversation history to see if the user has been discussing employment
 * contracts vs. vendor contracts, then searches in the appropriate document category automatically.
 */

import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

/**
 * Document search tool that uses conversation context
 */
const documentSearchTool = tool(
  async (input: { query: string }, config) => {
    /**
     * Access conversation history to make contextual decisions
     * The messages are located in config.configurable.__pregel_scratchpad.currentTaskInput.messages
     */
    const currentMessages =
      config?.configurable?.__pregel_scratchpad?.currentTaskInput?.messages ||
      [];
    const conversationContext = currentMessages.slice(-5); // Last 5 messages

    console.log(`Total messages in conversation: ${currentMessages.length}`);
    console.log(`Recent context messages: ${conversationContext.length}`);

    /**
     * Analyze conversation history for context
     * Extract content from LangChain message objects
     */
    const conversationText = conversationContext
      .map((msg: any) => {
        // Handle LangChain message objects
        if (msg.kwargs && msg.kwargs.content) {
          return typeof msg.kwargs.content === "string"
            ? msg.kwargs.content
            : JSON.stringify(msg.kwargs.content);
        }
        // Fallback for other message formats
        return typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content || "");
      })
      .join(" ")
      .toLowerCase();

    console.log(
      `Analyzing conversation context: ${conversationContext.length} recent messages`
    );

    /**
     * Determine document category based on conversation history
     */
    let category = "general";
    let searchScope = "all documents";

    if (
      conversationText.includes("employment") ||
      conversationText.includes("employee") ||
      conversationText.includes("hiring")
    ) {
      category = "employment";
      searchScope = "employment contracts and policies";
    } else if (
      conversationText.includes("vendor") ||
      conversationText.includes("supplier") ||
      conversationText.includes("procurement")
    ) {
      category = "vendor";
      searchScope = "vendor agreements and procurement docs";
    } else if (
      conversationText.includes("lease") ||
      conversationText.includes("property") ||
      conversationText.includes("real estate")
    ) {
      category = "real-estate";
      searchScope = "property and lease agreements";
    }

    console.log(`Searching in category: ${category} (${searchScope})`);

    /**
     * Simulate document search with context-aware results
     */
    const results = [
      `Found 3 relevant documents in ${searchScope} for "${input.query}"`,
      `Context-aware search detected focus on ${category} law`,
      `Documents filtered based on ${conversationContext.length} previous messages`,
    ];

    return results.join("\n");
  },
  {
    name: "search_documents",
    description: "Search legal documents with conversation context awareness",
    schema: z.object({
      query: z.string().describe("The search query for legal documents"),
    }),
  }
);

/**
 * Task management tool that avoids redundancy
 */
const taskManagerTool = tool(
  async (input: { action: string; details: string }, config) => {
    /**
     * Access conversation history to prevent duplicate tasks
     */
    const currentMessages =
      config?.configurable?.__pregel_scratchpad?.currentTaskInput?.messages ||
      [];

    console.log(`Task tool - Total messages: ${currentMessages.length}`);

    /**
     * Check if similar tasks were already discussed
     * Extract content from LangChain message objects
     */
    const recentTasks = currentMessages
      .filter((msg: any) => {
        let content = "";
        // Handle LangChain message objects
        if (msg.kwargs && msg.kwargs.content) {
          content =
            typeof msg.kwargs.content === "string"
              ? msg.kwargs.content
              : JSON.stringify(msg.kwargs.content);
        } else {
          // Fallback for other message formats
          content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content || "");
        }
        return content.includes("task") || content.includes("TODO");
      })
      .slice(-3);

    console.log(
      `Checking for duplicate tasks in ${recentTasks.length} recent task-related messages`
    );

    if (recentTasks.length > 0) {
      const taskHistory = recentTasks
        .map((msg: any) =>
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content) || ""
        )
        .join(" ");

      if (taskHistory.toLowerCase().includes(input.action.toLowerCase())) {
        return `Note: Similar task "${input.action}" was already discussed recently. Updating existing task instead of creating duplicate.\nTask: ${input.details}`;
      }
    }

    return `New task created: ${input.action}\nDetails: ${input.details}\nNo duplicates found in conversation history.`;
  },
  {
    name: "manage_task",
    description:
      "Create or update tasks while avoiding duplicates based on conversation history",
    schema: z.object({
      action: z
        .string()
        .describe(
          "The task action (e.g., 'review contract', 'schedule meeting')"
        ),
      details: z.string().describe("Additional task details"),
    }),
  }
);

/**
 * Create agent that uses tools with thread-level context awareness
 */
const agent = createReactAgent({
  llm,
  tools: [documentSearchTool, taskManagerTool],
  prompt: `You are a legal assistant AI. You help lawyers with document research and task management.
           Use conversation context to provide more relevant and efficient assistance.
           Avoid redundant actions when similar topics have been discussed recently.`,
});

/**
 * Example 1: Employment Law Conversation - Building Context
 */
console.log("\n=== Building Employment Law Context ===");
const result1 = await agent.invoke({
  messages: [
    { role: "user", content: "I need help reviewing our employment contracts" },
  ],
});

console.log("\n=== Adding Context About Employee Handbooks ===");
const result2 = await agent.invoke({
  messages: [
    ...result1.messages,
    {
      role: "user",
      content:
        "We're updating our employee handbook and need to check termination clauses",
    },
  ],
});

console.log("\n=== Now Search with Employment Context ===");
const result3 = await agent.invoke({
  messages: [
    ...result2.messages,
    {
      role: "user",
      content: "Can you search for 'termination notice requirements'?",
    },
  ],
});

/**
 * Example 2: Vendor Contract Conversation - Context Switch
 */
console.log("\n=== Switching to Vendor Context ===");
const vendorResult1 = await agent.invoke({
  messages: [
    { role: "user", content: "Now I need to work on vendor agreements" },
  ],
});

console.log("\n=== Building Vendor Context ===");
const vendorResult2 = await agent.invoke({
  messages: [
    ...vendorResult1.messages,
    {
      role: "user",
      content:
        "Our procurement team needs standard supplier contract templates",
    },
  ],
});

console.log("\n=== Search with Vendor Context ===");
const vendorResult3 = await agent.invoke({
  messages: [
    ...vendorResult2.messages,
    { role: "user", content: "Search for 'payment terms and conditions'" },
  ],
});

/**
 * Example 3: Task Management with Duplicate Detection
 */
console.log("\n=== Creating First Task ===");
const taskResult1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "I need to create a task to review the Johnson vendor contract",
    },
  ],
});

console.log("\n=== Attempting Duplicate Task ===");
const taskResult2 = await agent.invoke({
  messages: [
    ...taskResult1.messages,
    {
      role: "user",
      content: "Also create a task to review Johnson contract for compliance",
    },
  ],
});

console.log(taskResult2.messages[taskResult2.messages.length - 1].content);

/**
 * Expected output:
 *
 * === Building Employment Law Context ===
 *
 * === Adding Context About Employee Handbooks ===
 * Total messages in conversation: 4
 * Recent context messages: 4
 * Analyzing conversation context: 4 recent messages
 * Searching in category: employment (employment contracts and policies)
 * Task tool - Total messages: 4
 * Checking for duplicate tasks in 0 recent task-related messages
 *
 * === Now Search with Employment Context ===
 * Total messages in conversation: 9
 * Recent context messages: 5
 * Analyzing conversation context: 5 recent messages
 * Searching in category: employment (employment contracts and policies)
 *
 * === Switching to Vendor Context ===
 *
 * === Building Vendor Context ===
 * Total messages in conversation: 4
 * Recent context messages: 4
 * Analyzing conversation context: 4 recent messages
 * Searching in category: vendor (vendor agreements and procurement docs)
 *
 * === Search with Vendor Context ===
 * Total messages in conversation: 8
 * Recent context messages: 5
 * Analyzing conversation context: 5 recent messages
 * Searching in category: vendor (vendor agreements and procurement docs)
 *
 * === Creating First Task ===
 * Task tool - Total messages: 2
 * Checking for duplicate tasks in 1 recent task-related messages
 *
 * === Attempting Duplicate Task ===
 * It seems like the task to review the Johnson vendor contract might overlap with reviewing
 * it for compliance. Would you like me to update the existing task to include compliance review,
 * or should I create a separate task for compliance review?
 */
