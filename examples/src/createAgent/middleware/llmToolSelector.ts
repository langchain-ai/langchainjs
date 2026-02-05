/**
 * Example: Using LLM Tool Selector Middleware
 *
 * This example demonstrates how to use the LLM Tool Selector middleware
 * to automatically filter tools before they're sent to the main model.
 * This is useful when you have many tools but only a subset are relevant
 * for each query.
 */

import { z } from "zod";
import { createAgent, tool, HumanMessage } from "langchain";
import { llmToolSelectorMiddleware } from "langchain";

// Create a variety of tools for different tasks
const searchWeb = tool(
  async ({ query }: { query: string }) => {
    console.log(`Searching web for: ${query}`);
    return `Search results for "${query}": Found 5 relevant articles...`;
  },
  {
    name: "search_web",
    description:
      "Search the web for current information, news, or general knowledge",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

const searchDatabase = tool(
  async ({ customerId }: { customerId: string }) => {
    console.log(`Looking up customer: ${customerId}`);
    return `Customer ${customerId}: Premium account, joined 2023-01-15`;
  },
  {
    name: "search_database",
    description:
      "Look up customer information in the company database by customer ID",
    schema: z.object({
      customerId: z.string().describe("The customer ID to look up"),
    }),
  }
);

const calculatePrice = tool(
  async ({ items, discount }: { items: number; discount: number }) => {
    const basePrice = items * 29.99;
    const finalPrice = basePrice * (1 - discount / 100);
    return `Total: $${finalPrice.toFixed(
      2
    )} (${items} items, ${discount}% discount)`;
  },
  {
    name: "calculate_price",
    description: "Calculate pricing with discounts for product quotes",
    schema: z.object({
      items: z.number().describe("Number of items"),
      discount: z.number().describe("Discount percentage (0-100)"),
    }),
  }
);

const checkInventory = tool(
  async ({ productId }: { productId: string }) => {
    console.log(`Checking inventory for: ${productId}`);
    return `Product ${productId}: 47 units in stock, 12 on order`;
  },
  {
    name: "check_inventory",
    description: "Check current inventory levels for a product",
    schema: z.object({
      productId: z.string().describe("The product ID to check"),
    }),
  }
);

const scheduleAppointment = tool(
  async ({ date, time }: { date: string; time: string }) => {
    console.log(`Scheduling appointment for: ${date} at ${time}`);
    return `Appointment scheduled for ${date} at ${time}`;
  },
  {
    name: "schedule_appointment",
    description: "Schedule a customer service appointment",
    schema: z.object({
      date: z.string().describe("Date in YYYY-MM-DD format"),
      time: z.string().describe("Time in HH:MM format"),
    }),
  }
);

const sendEmail = tool(
  async ({ recipient, subject }: { recipient: string; subject: string }) => {
    console.log(`Sending email to ${recipient}: ${subject}`);
    return `Email sent to ${recipient}`;
  },
  {
    name: "send_email",
    description: "Send an email to a customer",
    schema: z.object({
      recipient: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject"),
    }),
  }
);

const getWeather = tool(
  async ({ location }: { location: string }) => {
    console.log(`Getting weather for: ${location}`);
    return `Weather in ${location}: Sunny, 72°F`;
  },
  {
    name: "get_weather",
    description: "Get current weather information for a location",
    schema: z.object({
      location: z.string().describe("City or location name"),
    }),
  }
);

const translateText = tool(
  async ({ text, language }: { text: string; language: string }) => {
    console.log(`Translating to ${language}: ${text}`);
    return `[Translated to ${language}]: ${text}`;
  },
  {
    name: "translate_text",
    description: "Translate text to another language",
    schema: z.object({
      text: z.string().describe("Text to translate"),
      language: z.string().describe("Target language"),
    }),
  }
);

async function example1BasicUsage() {
  console.log(
    "\n=== Example 1: Basic Usage - Limit to 3 most relevant tools ===\n"
  );

  // Configure middleware to select only the 3 most relevant tools
  const middleware = llmToolSelectorMiddleware({
    maxTools: 3,
  });

  const agent = createAgent({
    model: "openai:gpt-4o-mini",
    tools: [
      searchWeb,
      searchDatabase,
      calculatePrice,
      checkInventory,
      scheduleAppointment,
      sendEmail,
      getWeather,
      translateText,
    ],
    middleware: [middleware],
  });

  // Ask about a customer - should select database-related tools
  const result = await agent.invoke({
    messages: [new HumanMessage("Look up information for customer ID C12345")],
  });

  console.log(
    "\nAgent response:",
    result.messages[result.messages.length - 1].content
  );
}

async function example2AlwaysInclude() {
  console.log("\n=== Example 2: Always Include Critical Tools ===\n");

  // Always include search_database for customer queries, regardless of selection
  const middleware = llmToolSelectorMiddleware({
    maxTools: 2,
    alwaysInclude: ["search_database", "send_email"], // These don't count toward maxTools
  });

  const agent = createAgent({
    model: "openai:gpt-4o-mini",
    tools: [
      searchWeb,
      searchDatabase,
      calculatePrice,
      checkInventory,
      scheduleAppointment,
      sendEmail,
      getWeather,
      translateText,
    ],
    middleware: [middleware],
  });

  // Even if not selected, search_database and send_email will always be available
  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        "What's the weather like? Also check customer C12345 if needed."
      ),
    ],
  });

  console.log(
    "\nAgent response:",
    result.messages[result.messages.length - 1].content
  );
}

async function example3SmallerModelForSelection() {
  console.log("\n=== Example 3: Use Smaller Model for Tool Selection ===\n");

  // Use a smaller, faster model just for selecting tools
  const middleware = llmToolSelectorMiddleware({
    model: "openai:gpt-4o-mini", // Fast & cheap for tool selection
    maxTools: 3,
    systemPrompt:
      "Select only the tools directly needed to answer the user's question. Prefer specific tools over general ones.",
  });

  const agent = createAgent({
    model: "openai:gpt-4o", // More powerful model for the actual task
    tools: [
      searchWeb,
      searchDatabase,
      calculatePrice,
      checkInventory,
      scheduleAppointment,
      sendEmail,
      getWeather,
      translateText,
    ],
    middleware: [middleware],
  });

  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        "I need a quote for 5 items with a 15% discount, and check if product ABC123 is in stock"
      ),
    ],
  });

  console.log(
    "\nAgent response:",
    result.messages[result.messages.length - 1].content
  );
}

// Run examples
async function main() {
  console.log("🔧 LLM Tool Selector Middleware Examples\n");
  console.log(
    "This middleware reduces costs and improves quality by filtering"
  );
  console.log("tools before they reach the main model.\n");

  try {
    await example1BasicUsage();
    await example2AlwaysInclude();
    await example3SmallerModelForSelection();

    console.log("\n✅ All examples completed!\n");
  } catch (error) {
    console.error("Error running examples:", error);
  }
}

main();
