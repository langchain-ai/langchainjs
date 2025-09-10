import { createAgent, HumanMessage, tool, MemorySaver } from "langchain";
import { humanInTheLoopMiddleware } from "langchain/middleware";
import { Command } from "@langchain/langgraph";
import { z } from "zod";

const checkpointSaver = new MemorySaver();

// Define a safe tool (no approval needed)
const calculateTool = tool(
  async ({ a, b, operation }: { a: number; b: number; operation: string }) => {
    console.log(
      `🛠️  calculator tool called with args: ${a}, ${b}, ${operation}`
    );
    switch (operation) {
      case "add":
        return `${a} + ${b} = ${a + b}`;
      case "multiply":
        return `${a} * ${b} = ${a * b}`;
      default:
        return "Unknown operation";
    }
  },
  {
    name: "calculator",
    description: "Perform basic math operations",
    schema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
      operation: z.enum(["add", "multiply"]).describe("Math operation"),
    }),
  }
);

// Define a tool that requires approval
const writeFileTool = tool(
  async ({ filename, content }: { filename: string; content: string }) => {
    console.log(
      `🛠️  write_file tool called with args: ${filename}, ${content}`
    );
    // Simulate file writing
    return `Successfully wrote ${content.length} characters to ${filename}`;
  },
  {
    name: "write_file",
    description: "Write content to a file",
    schema: z.object({
      filename: z.string().describe("Name of the file"),
      content: z.string().describe("Content to write"),
    }),
  }
);

// Configure HITL middleware
const hitlMiddleware = humanInTheLoopMiddleware({
  toolConfigs: {
    write_file: {
      requireApproval: true,
      description: "⚠️ File write operation requires approval",
    },
    calculator: {
      requireApproval: false, // Math is safe
    },
  },
});

// Create agent with HITL middleware
const agent = createAgent({
  model: "openai:gpt-4o-mini",
  checkpointSaver,
  prompt:
    "You are a helpful assistant. Use the tools provided to help the user.",
  tools: [calculateTool, writeFileTool],
  middlewares: [hitlMiddleware] as const,
});
const config = {
  configurable: {
    thread_id: "123",
  },
};

console.log("🚀 HITL Tool Approval Example");
console.log("=============================\n");

// Example 1: Safe tool - no approval needed
console.log("📊 Example 1: Using calculator (auto-approved)");
const mathResult = await agent.invoke(
  {
    messages: [new HumanMessage("Calculate 42 * 17")],
  },
  config
);
console.log("Result:", mathResult.messages.at(-1)?.content);

// Example 2: Tool requiring approval
console.log("\n📝 Example 2: Writing to file (requires approval)");
console.log("User: Write 'Hello World' to greeting.txt\n");

// This will pause at the HITL middleware for approval
const initialResult = await agent.invoke(
  {
    messages: [new HumanMessage("Write 'Hello World' to greeting.txt")],
  },
  config
);

// Check if the agent is paused (waiting for approval)
const state = await agent.graph.getState(config);
if (state.next && state.next.length > 0) {
  console.log("⏸️  Interrupted for approval!");

  // Get the interrupt data from the task
  const task = state.tasks?.[0];
  if (task?.interrupts && task.interrupts.length > 0) {
    const requests = task.interrupts[0].value;
    console.log("Tool:", requests[0].action);
    console.log("Args:", JSON.stringify(requests[0].args, null, 2));

    console.log("\nℹ️  In a real application, you would:");
    console.log("  - Show this to the user");
    console.log("  - Get their response (accept/edit/ignore/manual)");
    console.log(
      "  - Resume with: agent.invoke(new Command({ resume: response }))"
    );

    console.log("\n✅ Simulating user approval...\n");

    // Resume with approval
    const resumedResult = await agent.invoke(
      new Command({
        resume: [{ type: "accept" }], // Approve the tool call
      }),
      config
    );

    console.log("Result:", resumedResult.messages.at(-1)?.content);
  }
} else {
  console.log("Agent completed without interruption");
  console.log("Result:", initialResult.messages.at(-1)?.content);
}
