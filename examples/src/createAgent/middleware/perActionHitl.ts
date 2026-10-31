import {
  createAgent,
  HumanMessage,
  tool,
  perActionHumanInTheLoopMiddleware,
} from "langchain";
import { Command, MemorySaver } from "@langchain/langgraph";
import { z } from "zod";

const checkpointer = new MemorySaver();

const calculateTool = tool(
  async ({ a, b, operation }: { a: number; b: number; operation: string }) => {
    console.log(`🛠️ calculator called: ${a}, ${b}, ${operation}`);
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
      a: z.number(),
      b: z.number(),
      operation: z.enum(["add", "multiply"]),
    }),
  }
);

const writeFileTool = tool(
  async ({ filename, content }: { filename: string; content: string }) => {
    console.log(`🛠️ write_file called: ${filename}`);
    return `Successfully wrote ${content.length} characters to ${filename}`;
  },
  {
    name: "write_file",
    description: "Write content to a file",
    schema: z.object({
      filename: z.string(),
      content: z.string(),
    }),
  }
);

const paHitl = perActionHumanInTheLoopMiddleware({
  interruptOn: {
    calculator: true,
    write_file: true,
  },
});

const agent = createAgent({
  model: "openai:gpt-4o-mini",
  checkpointer,
  tools: [calculateTool, writeFileTool],
  middleware: [paHitl],
});

const config = {
  configurable: {
    thread_id: "pa-hitl-demo-1",
  },
};

console.log("🚀 PA-HITL Example");
console.log("==================\n");

const initial = await agent.invoke(
  {
    messages: [
      new HumanMessage("Calculate 42 * 17 and write 'Hello' to output.txt"),
    ],
  },
  config
);

if (!initial.__interrupt__?.length) {
  console.log("No interrupt was generated.");
  process.exit(0);
}

const interruptRequest = initial.__interrupt__[0].value;
console.log("⏸️ Interrupt action requests:");
for (const action of interruptRequest.actionRequests) {
  console.log(`- ${action.name}: ${JSON.stringify(action.args)}`);
}

console.log("\n✅ Resuming with mixed decisions:");
console.log("- approve calculator");
console.log("- reject write_file");

const resumed = await agent.invoke(
  new Command({
    resume: {
      decisions: interruptRequest.actionRequests.map((action) => {
        if (action.name === "calculator") {
          return { type: "approve" as const };
        }
        return {
          type: "reject" as const,
          message: "File writes are disabled in this environment.",
        };
      }),
    },
  }),
  config
);

console.log("\nFinal message:", resumed.messages.at(-1)?.content);
console.log(
  "\nPA-HITL behavior: approved actions can execute even when other actions in the same interrupt are rejected."
);
