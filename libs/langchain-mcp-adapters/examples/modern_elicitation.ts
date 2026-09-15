import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { z } from "zod";
import { MCPAdapter, type MCPElicitationResume } from "../src/index.js";

const State = Annotation.Root({ result: Annotation<unknown>() });
const checkpointer = new MemorySaver();
const config = { configurable: { thread_id: "mcp-elicitation-example" } };
const createAdapter = () =>
  new MCPAdapter({
    servers: {
      modern: { url: "http://127.0.0.1:3001/mcp" },
    },
  });

function createGraph(adapter: MCPAdapter) {
  return new StateGraph(State)
    .addNode("call", async () => {
      const tools = await adapter.listTools();
      const approve = tools.find((tool) => tool.name === "approve");
      if (!approve) {
        throw new Error("Start modern_server.ts to provide approve");
      }
      return { result: await approve.invoke({}) };
    })
    .addEdge(START, "call")
    .addEdge("call", END)
    .compile({ checkpointer });
}

// Scripted answers to the local server's known question keys. Applications
// collect answers from their user; a URL answer confirms an external action.
const action = z
  .enum(["accept", "decline", "cancel"])
  .parse(process.argv[2] ?? "accept");
const answers: MCPElicitationResume[] = [
  {
    profile:
      action === "accept" ? { action, content: { name: "Ada" } } : { action },
  },
  {
    confirmation:
      action === "accept" ? { action, content: { confirm: true } } : { action },
  },
  { authorization: { action } },
];

let adapter = createAdapter();
let graph = createGraph(adapter);
try {
  await graph.invoke({ result: null }, config);
  for (const resume of answers) {
    const snapshot = await graph.getState(config);
    const pending = snapshot.tasks.flatMap((task) => task.interrupts ?? []);
    if (pending.length === 0) {
      break;
    }
    console.dir(
      pending.map((question) => question.value),
      { depth: null }
    );

    // Keep the checkpointer and thread ID while reconstructing the client.
    await adapter.close();
    adapter = createAdapter();
    graph = createGraph(adapter);
    await graph.invoke(new Command({ resume }), config);
  }
  console.log("Result:", (await graph.getState(config)).values.result);
} finally {
  await adapter.close();
}
