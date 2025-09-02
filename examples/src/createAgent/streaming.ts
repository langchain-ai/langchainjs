/**
 * Streaming with createAgent
 *
 * This example demonstrates various streaming capabilities of createAgent.
 * Streaming allows you to observe agent execution in real-time, which is
 * particularly useful for:
 * - Providing immediate feedback to users
 * - Monitoring agent reasoning and tool calls
 * - Building interactive applications
 * - Debugging agent behavior
 *
 * Stream modes:
 * - "values": Emits complete state after each step
 * - "updates": Emits only state changes after each step
 * - "debug": Emits detailed debug information
 * - "messages": Emits messages from within nodes
 */

import fs from "fs/promises";
import { createAgent, tool, HumanMessage } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Create some example tools
 */
const weatherTool = tool(
  ({ location }: { location: string }) => {
    const weatherData: Record<string, string> = {
      NYC: "Currently 72°F with clear skies",
      Tokyo: "Currently 68°F with light rain",
      Paris: "Currently 59°F with cloudy skies",
    };
    return (
      weatherData[location] || `Weather data not available for ${location}`
    );
  },
  {
    name: "get_weather",
    description: "Get current weather for a specific location",
    schema: z.object({
      location: z.string().describe("The city to get weather for"),
    }),
  }
);

const calculateTool = tool(
  ({ a, b, operation }: { a: number; b: number; operation: string }) => {
    const operations: Record<string, (a: number, b: number) => number> = {
      add: (a, b) => a + b,
      subtract: (a, b) => a - b,
      multiply: (a, b) => a * b,
      divide: (a, b) => a / b,
    };

    const op = operations[operation];
    if (!op) {
      return `Unknown operation: ${operation}`;
    }

    const result = op(a, b);
    return `${a} ${operation} ${b} = ${result}`;
  },
  {
    name: "calculator",
    description: "Perform basic math operations",
    schema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("Math operation"),
    }),
  }
);

/**
 * Create the agent
 */
const agent = createAgent({
  llm: new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  }),
  tools: [weatherTool, calculateTool],
});

/**
 * Example 1: Basic Streaming
 * Stream the complete state after each step
 */
console.log("=== Example 1: Basic Streaming ===\n");

const stream = await agent.stream(
  {
    messages: [new HumanMessage("What's the weather in NYC?")],
  },
  { streamMode: "values" }
);

for await (const chunk of stream) {
  const lastMessage = chunk.messages.at(-1);

  if (lastMessage?.getType() === "human") {
    console.log(`👤 Human: ${lastMessage.content}`);
  } else if (lastMessage?.getType() === "ai") {
    if (lastMessage.content) {
      console.log(`🤖 Assistant: ${lastMessage.content}`);
    }
    if (
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      for (const toolCall of lastMessage.tool_calls) {
        console.log(`🔧 Calling tool: ${toolCall.name}`);
        console.log(`   Arguments:`, toolCall.args);
      }
    }
  } else if (lastMessage?.getType() === "tool") {
    console.log(`📊 Tool result: ${lastMessage.content}`);
  }
}

console.log("\n=== Example 2: Streaming Updates Only ===\n");

/**
 * Example 2: Stream only the updates (deltas)
 * This is more efficient for tracking changes
 */
const updateStream = await agent.stream(
  {
    messages: [new HumanMessage("Calculate 42 multiply by 10")],
  },
  { streamMode: "updates" }
);

for await (const chunk of updateStream) {
  const [nodeId, update] = Object.entries(chunk)[0];

  if (update && typeof update === "object" && "messages" in update) {
    const updateWithMessages = update as { messages: any[] };
    for (const message of updateWithMessages.messages) {
      console.log(`Update from ${nodeId}:`, {
        type: message._getType(),
        content: message.content || "(tool call)",
        toolCalls: "tool_calls" in message ? message.tool_calls : undefined,
      });
    }
  }
}

console.log("\n=== Example 3: Streaming with Multiple Tools ===\n");

/**
 * Example 3: Complex query requiring multiple tools
 * Shows how streaming reveals the agent's reasoning process
 */
const multiToolStream = await agent.stream(
  {
    messages: [
      new HumanMessage(
        "What's the weather in NYC? If it's above 70°F, calculate how much warmer it is than 70."
      ),
    ],
  },
  { streamMode: "values" }
);

let stepCount = 0;
for await (const chunk of multiToolStream) {
  stepCount += 1;
  const lastMessage = chunk.messages[chunk.messages.length - 1];
  console.log(`Step ${stepCount}: ${lastMessage.getType()} message`);

  // Log the actual content or tool calls
  if (lastMessage.content) {
    console.log(
      `  Content: ${lastMessage.content.toString().substring(0, 100)}...`
    );
  }
  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls?.length > 0
  ) {
    console.log(
      `  Tools called:`,
      lastMessage.tool_calls.map((tc: any) => tc.name)
    );
  }
}

console.log("\n=== Example 4: Streaming with Structured Output ===\n");

/**
 * Example 4: Streaming with structured responses
 * The structured response appears in the final state
 */
const WeatherReport = z.object({
  location: z.string(),
  temperature: z.number(),
  conditions: z.string(),
});

const weatherAgent = createAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [weatherTool],
  responseFormat: WeatherReport,
});

const structuredStream = await weatherAgent.stream(
  {
    messages: [new HumanMessage("Get the weather for Tokyo")],
  },
  { streamMode: "values" }
);

for await (const chunk of structuredStream) {
  // The structured response will be available in the final chunk
  if (chunk.structuredResponse) {
    console.log("📋 Structured Response:", chunk.structuredResponse);
  } else {
    const messageCount = chunk.messages.length;
    console.log(`Processing step ${messageCount}...`);
  }
}

/**
 * Save visualization
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

/**
 * Example Output:
 *
 * === Example 1: Basic Streaming ===
 *
 * 👤 Human: What's the weather in NYC?
 * 🔧 Calling tool: get_weather
 *    Arguments: { location: 'New York City' }
 * 📊 Tool result: Weather data not available for New York City
 * 🤖 Assistant: I'm unable to retrieve the weather data for New York City at the moment. Please try again later or check a weather website for the latest updates.
 *
 * === Example 2: Streaming Updates Only ===
 *
 * Update from agent: {
 *   type: 'ai',
 *   content: '(tool call)',
 *   toolCalls: [
 *     {
 *       name: 'calculator',
 *       args: [Object],
 *       type: 'tool_call',
 *       id: 'call_Ee9CYe69NbBioIPfowM34YAW'
 *     }
 *   ]
 * }
 * Update from calculator: { type: 'tool', content: '42 multiply 10 = 420', toolCalls: undefined }
 * Update from agent: {
 *   type: 'ai',
 *   content: '42 multiplied by 10 equals 420.',
 *   toolCalls: []
 * }
 *
 * === Example 3: Streaming with Multiple Tools ===
 *
 * Step 1: human message
 *   Content: What's the weather in NYC? If it's above 70°F, calculate how much warmer it is than 70....
 * Step 2: ai message
 *   Tools called: [ 'get_weather' ]
 * Step 3: tool message
 *   Content: Weather data not available for New York City...
 * Step 4: ai message
 *   Tools called: [ 'get_weather' ]
 * Step 5: tool message
 *   Content: Weather data not available for New York...
 * Step 6: ai message
 *   Tools called: [ 'get_weather' ]
 * Step 7: tool message
 *   Content: Weather data not available for New York, NY...
 * Step 8: ai message
 *   Content: I'm currently unable to retrieve the weather data for New York City. If you have access to a weather...
 *
 * === Example 4: Streaming with Structured Output ===
 *
 * Processing step 1...
 * Processing step 2...
 * Processing step 3...
 * Processing step 4...
 * 📋 Structured Response: { location: 'Tokyo', temperature: 20, conditions: 'light rain' }
 */
