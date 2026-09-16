/**
 * Modern MCP elicitation inside a `createAgent` run.
 *
 * Start `modern_server.ts` first, then run this with an action:
 *
 *   npx tsx examples/modern_server.ts
 *   npx tsx examples/modern_elicitation.ts accept
 *
 * The server asks three questions in sequence — a name, a confirmation, and a
 * URL action. Each answer is delivered with `Command({ resume })` built by
 * `createMCPElicitationResume`, which targets the interrupt the question came
 * from so the answer cannot land on an unrelated one.
 *
 * Resuming REPLAYS the tool call. The agent re-runs its tool node from the top,
 * the adapter re-issues the initial `tools/call`, and only then sends the
 * answered follow-up. Work the server did before asking therefore happens
 * again, and `beforeToolCall` runs again for each resume — there are no
 * exactly-once effects. Keep server handlers and hooks replay-safe.
 */
import { Command, MemorySaver, type Interrupt } from "@langchain/langgraph";
import { createAgent, FakeToolCallingModel } from "langchain";
import { z } from "zod";
import {
  MCPAdapter,
  createMCPElicitationResume,
  type MCPElicitationResponses,
} from "../src/index.js";

const action = z
  .enum(["accept", "decline", "cancel"])
  .parse(process.argv[2] ?? "accept");

// Answers for the local server's known question keys, in the order it asks
// them. A real application collects these from its user; a URL answer confirms
// that the person completed the external action.
const answers: MCPElicitationResponses[] = [
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

const config = { configurable: { thread_id: "mcp-elicitation-example" } };
const checkpointer = new MemorySaver();

// Override when the server runs on another port, as the example test does.
const url = process.env.MCP_EXAMPLE_URL ?? "http://127.0.0.1:3001/mcp";

const createAdapter = () => new MCPAdapter({ servers: { modern: { url } } });

/**
 * Build the agent from a freshly connected adapter.
 *
 * The checkpointer and thread ID outlive the adapter, so an application may be
 * restarted between a question and its answer. Only the MCP connection is
 * rebuilt; the paused run is picked up from the checkpointer.
 */
async function createAgentWithTools(adapter: MCPAdapter) {
  const tools = await adapter.listTools();
  if (!tools.some((tool) => tool.name.endsWith("approve"))) {
    throw new Error("Start modern_server.ts to provide the approve tool");
  }

  return createAgent({
    model: new FakeToolCallingModel({
      toolCalls: [[{ id: "approve-1", name: "approve", args: {} }], []],
    }),
    tools,
    checkpointer,
  });
}

/** The pending MCP question, if the run stopped on one. */
function pendingQuestion(result: unknown): Interrupt<unknown> | undefined {
  return (
    result as { __interrupt__?: Interrupt<unknown>[] }
  ).__interrupt__?.find(
    (interrupt) =>
      typeof interrupt.value === "object" &&
      interrupt.value !== null &&
      "type" in interrupt.value &&
      interrupt.value.type === "mcp_elicitation"
  );
}

let adapter = createAdapter();
try {
  let agent = await createAgentWithTools(adapter);
  let result: unknown = await agent.invoke(
    { messages: [{ role: "user", content: "Approve the demo action" }] },
    config
  );

  for (const responses of answers) {
    const pending = pendingQuestion(result);
    if (!pending) break;

    console.dir(pending.value, { depth: null });

    // Reconstruct the MCP connection while keeping the checkpointed run.
    await adapter.close();
    adapter = createAdapter();
    agent = await createAgentWithTools(adapter);

    result = await agent.invoke(
      new Command({ resume: createMCPElicitationResume(pending, responses) }),
      config
    );
  }

  const messages = (result as { messages?: { content: unknown }[] }).messages;
  console.log("Result:", messages?.at(-1)?.content);
} finally {
  await adapter.close();
}
