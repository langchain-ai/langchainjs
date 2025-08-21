/**
 * PrepareCall Hook - Dynamic Agent Behavior at Runtime
 *
 * The `prepareCall` hook is a powerful feature that allows you to dynamically
 * modify agent behavior before each LLM invocation. Unlike static configuration,
 * prepareCall gives you complete control over the agent's behavior based on
 * runtime conditions, conversation state, and external context.
 *
 * When is prepareCall important?
 *
 * 1. **User-based customization**: Different users may have different permissions,
 *    preferences, or subscription tiers that affect tool access or model selection.
 * 2. **Dynamic resource management**: Switch between expensive and cheap models
 *    based on task complexity or user quota.
 * 3. **Context-aware behavior**: Modify system prompts, available tools, or
 *    model parameters based on the conversation history or external data.
 * 4. **Security and compliance**: Restrict tool access or filter messages based
 *    on security policies or regulatory requirements.
 * 5. **Preventing errors**: Avoid infinite loops, handle rate limits, or work
 *    around model-specific limitations.
 *
 * Concrete Use Cases:
 *
 * - **SaaS Application**: Basic users get GPT-3.5 and limited tools, while
 *   premium users get GPT-4 and access to email/database tools.
 * - **Customer Support Bot**: Escalate to a more capable model when detecting
 *   complex technical issues or frustrated customers.
 * - **Educational Assistant**: Adjust the system prompt and available tools
 *   based on the student's grade level or learning objectives.
 * - **Enterprise Integration**: Dynamically enable/disable tools based on
 *   user's department, role, or current authentication tokens.
 * - **Cost Optimization**: Use cheaper models for simple queries and upgrade
 *   to expensive models only when necessary (e.g., after 2+ tool calls).
 *
 * This example demonstrates:
 * - Dynamic model selection (GPT-4 vs GPT-5 based on complexity)
 * - Tool access control (basic vs premium users)
 * - Context-aware system messages
 * - Smart tool forcing for specific queries
 * - Infinite loop prevention
 */
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool, HumanMessage, type PreparedCall } from "langchain";
import { z } from "zod";

// Define some practical tools
const calculator = tool(
  ({
    number1,
    number2,
    operation,
  }: {
    number1: number;
    number2: number;
    operation: string;
  }) => {
    switch (operation) {
      case "add":
        return number1 + number2;
      case "subtract":
        return number1 - number2;
      case "multiply":
        return number1 * number2;
      case "divide":
        return number1 / number2;
      default:
        throw new Error(`Invalid operation: ${operation}`);
    }
  },
  {
    name: "calculator",
    description: "Performs mathematical calculations",
    schema: z.object({
      number1: z.number().describe("First number"),
      number2: z.number().describe("Second number"),
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("Operation to perform"),
    }),
  }
);

const searchWeb = tool(
  ({ query }: { query: string }) => {
    // Simulate web search
    const fakeResults = {
      langchain:
        "LangChain is a framework for developing applications powered by language models.",
      openai:
        "OpenAI is an AI research laboratory consisting of the for-profit OpenAI LP and its parent company.",
      weather: "Current weather: 72°F, sunny with light clouds.",
    };

    const result = Object.entries(fakeResults).find(([key]) =>
      query.toLowerCase().includes(key)
    )?.[1];

    return result || `No results found for "${query}"`;
  },
  {
    name: "search_web",
    description: "Search the web for information",
    schema: z.object({
      query: z.string().describe("Search query"),
    }),
  }
);

const sendEmail = tool(
  ({ to, subject, body }: { to: string; subject: string; body: string }) => {
    return `Email sent to ${to} with subject "${subject}" and body: "${body.substring(
      0,
      50
    )}..."`;
  },
  {
    name: "send_email",
    description: "Send an email (requires premium access)",
    schema: z.object({
      to: z.string().describe("Email recipient"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body"),
    }),
  }
);

// Create models with different capabilities
const basicModel = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0,
});

const advancedModel = new ChatOpenAI({
  model: "gpt-5",
});

const runtime = z.object({
  userRole: z.enum(["basic", "premium"]),
  taskComplexity: z.enum(["simple", "complex"]),
});

// Create agent with prepareCall hook
const agent = createAgent({
  llm: basicModel, // Default model
  tools: [calculator, searchWeb, sendEmail],
  contextSchema: runtime,
  prepareCall: async (options, runtime) => {
    const { stepNumber, messages, toolCalls, llmCalls } = options;
    const userRole = runtime.context?.userRole || "basic";
    const taskComplexity = runtime.context?.taskComplexity || "simple";

    // Log for demonstration
    console.log(`\n📞 PrepareCall Hook - Step ${stepNumber}`);
    console.log(`   User Role: ${userRole}`);
    console.log(`   Task Complexity: ${taskComplexity}`);
    console.log(`   Previous tool calls: ${toolCalls.length}`);
    console.log(`   Previous LLM calls: ${llmCalls.length}`);

    const overrides: PreparedCall = {};

    // 1. Dynamic model selection based on task complexity
    if (taskComplexity === "complex" || toolCalls.length > 2) {
      overrides.model = advancedModel;
      console.log(`   ✨ Upgrading to GPT-5 for complex task`);
    }

    // 2. Tool access control based on user role
    if (userRole === "basic") {
      // Basic users can't send emails
      overrides.tools = ["calculator", "search_web"];
      console.log(`   🔒 Restricting tools for basic user`);
    } else if (userRole === "premium") {
      // Premium users get all tools
      overrides.tools = ["calculator", "search_web", "send_email"];
      console.log(`   🔓 All tools available for premium user`);
    }

    // 3. Dynamic system message based on context
    if (stepNumber === 0) {
      if (userRole === "premium") {
        overrides.systemMessage =
          "You are a premium AI assistant with access to all features. " +
          "Provide detailed, comprehensive answers and use all available tools when helpful.";
      } else {
        overrides.systemMessage =
          "You are a helpful AI assistant. Note that some features may be restricted. " +
          "Focus on providing accurate information with the tools available.";
      }
      console.log(`   📝 Set custom system message`);
    }

    // 4. Force calculator tool for math questions
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.content?.toString().match(/calculate|compute|solve|math/i)
    ) {
      overrides.toolChoice = {
        type: "function",
        function: { name: "calculator" },
      };
      console.log(`   🎯 Forcing calculator tool for math question`);
    }

    // 5. Prevent infinite loops
    if (llmCalls.length > 5) {
      overrides.tools = []; // Disable all tools
      overrides.systemMessage =
        "Please provide a final answer without using any more tools.";
      console.log(`   🛑 Disabling tools to prevent infinite loop`);
    }

    return overrides;
  },
});

// Example usage
console.log("=== Example 1: Basic User with Simple Task ===");
const result1 = await agent.invoke(
  {
    messages: [new HumanMessage("What is 25 * 4?")],
  },
  {
    configurable: {
      userRole: "basic",
      taskComplexity: "simple",
    },
  }
);
console.log("\nFinal response:", result1.messages.at(-1)?.content);

console.log("\n\n=== Example 2: Premium User with Complex Task ===");
const result2 = await agent.invoke(
  {
    messages: [
      new HumanMessage(
        "Search for information about LangChain, then calculate 0.15 * 250, " +
          "and send the result via email to john@example.com."
      ),
    ],
  },
  {
    configurable: {
      userRole: "premium",
      taskComplexity: "complex",
    },
  }
);
console.log("\nFinal response:", result2.messages.at(-1)?.content);

console.log("\n\n=== Example 3: Basic User Attempting Premium Feature ===");
const result3 = await agent.invoke(
  {
    messages: [
      new HumanMessage("Send an email to boss@company.com about the meeting"),
    ],
  },
  {
    configurable: {
      userRole: "basic",
      taskComplexity: "simple",
    },
  }
);
console.log("\nFinal response:", result3.messages.at(-1)?.content);
