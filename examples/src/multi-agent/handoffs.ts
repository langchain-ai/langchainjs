import {
  StateGraph,
  START,
  END,
  MessagesZodState,
  Command,
} from "@langchain/langgraph";
import { createAgent, AIMessage, ToolMessage } from "langchain";
import { tool, ToolRuntime } from "@langchain/core/tools";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { z } from "zod";

// 1. Define state with active_agent tracker
const MultiAgentState = MessagesZodState.extend({
  activeAgent: z.string().optional(),
});

// 2. Create handoff tools
const transferToSales = tool(
  async (_, runtime: ToolRuntime<typeof MultiAgentState>) => {
    const lastAiMessage = [...runtime.state.messages] // [!code highlight]
      .reverse() // [!code highlight]
      .find((msg): msg is AIMessage => msg instanceof AIMessage); // [!code highlight]
    const transferMessage = new ToolMessage({
      // [!code highlight]
      content: "Transferred to sales agent from support agent", // [!code highlight]
      tool_call_id: runtime.toolCallId, // [!code highlight]
    }); // [!code highlight]
    return new Command({
      goto: "sales_agent",
      update: {
        activeAgent: "sales_agent",
        messages: [lastAiMessage, transferMessage].filter(Boolean), // [!code highlight]
      },
      graph: Command.PARENT,
    });
  },
  {
    name: "transfer_to_sales",
    description: "Transfer to the sales agent.",
    schema: z.object({}),
  }
);

const transferToSupport = tool(
  async (_, runtime: ToolRuntime<typeof MultiAgentState>) => {
    const lastAiMessage = [...runtime.state.messages] // [!code highlight]
      .reverse() // [!code highlight]
      .find((msg): msg is AIMessage => msg instanceof AIMessage); // [!code highlight]
    const transferMessage = new ToolMessage({
      // [!code highlight]
      content: "Transferred to support agent from sales agent", // [!code highlight]
      tool_call_id: runtime.toolCallId, // [!code highlight]
    }); // [!code highlight]
    return new Command({
      goto: "support_agent",
      update: {
        activeAgent: "support_agent",
        messages: [lastAiMessage, transferMessage].filter(Boolean), // [!code highlight]
      },
      graph: Command.PARENT,
    });
  },
  {
    name: "transfer_to_support",
    description: "Transfer to the support agent.",
    schema: z.object({}),
  }
);

// 3. Create agents with handoff tools
const salesAgent = createAgent({
  model: "anthropic:claude-sonnet-4-20250514",
  tools: [transferToSupport],
  systemPrompt:
    "You are a sales agent. Help with sales inquiries. If asked about technical issues or support, transfer to the support agent.",
});

const supportAgent = createAgent({
  model: "anthropic:claude-sonnet-4-20250514",
  tools: [transferToSales],
  systemPrompt:
    "You are a support agent. Help with technical issues. If asked about pricing or purchasing, transfer to the sales agent.",
});

// 4. Create agent nodes that invoke the agents
const callSalesAgent = async (
  state: InferInteropZodOutput<typeof MultiAgentState>
) => {
  const response = await salesAgent.invoke(state);
  return response;
};

const callSupportAgent = async (
  state: InferInteropZodOutput<typeof MultiAgentState>
) => {
  const response = await supportAgent.invoke(state);
  return response;
};

// 5. Create router that checks if we should end or continue
const routeAfterAgent = (
  state: InferInteropZodOutput<typeof MultiAgentState>
): "sales_agent" | "support_agent" | "__end__" => {
  const messages = state.messages ?? [];

  // Check the last message - if it's an AIMessage without tool calls, we're done
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg instanceof AIMessage && !lastMsg.tool_calls?.length) {
      // [!code highlight]
      return "__end__"; // [!code highlight]
    }
  }

  // Otherwise route to the active agent
  const active = state.activeAgent ?? "sales_agent";
  return active as "sales_agent" | "support_agent";
};

const routeInitial = (
  state: InferInteropZodOutput<typeof MultiAgentState>
): "sales_agent" | "support_agent" => {
  // Route to the active agent based on state, default to sales agent
  return (state.activeAgent ?? "sales_agent") as
    | "sales_agent"
    | "support_agent";
};

// 6. Build the graph
const builder = new StateGraph(MultiAgentState)
  .addNode("sales_agent", callSalesAgent)
  .addNode("support_agent", callSupportAgent);

// Start with conditional routing based on initial activeAgent
builder.addConditionalEdges(START, routeInitial, [
  "sales_agent",
  "support_agent",
]);

// After each agent, check if we should end or route to another agent
builder.addConditionalEdges("sales_agent", routeAfterAgent, [
  "sales_agent",
  "support_agent",
  END,
]);
builder.addConditionalEdges("support_agent", routeAfterAgent, [
  "sales_agent",
  "support_agent",
  END,
]);

const graph = builder.compile();
const result = await graph.invoke({
  messages: [
    {
      role: "user",
      content: "Hi, I'm having trouble with my account login. Can you help?",
    },
  ],
});

for (const msg of result.messages) {
  console.log(msg.content);
}
