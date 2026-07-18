import { AgentAction } from "@langchain/core/agents";
import { RunnableLambda } from "@langchain/core/runnables";
import { DynamicTool } from "@langchain/core/tools";
import { AgentExecutor } from "../executor.js";
import { RunnableSingleActionAgent } from "../agent.js";

// Regression test for https://github.com/langchain-ai/langchainjs/issues/11222
test("stream() yields the final output when a tool has returnDirect", async () => {
  const agent = new RunnableSingleActionAgent({
    runnable: RunnableLambda.from(
      async (): Promise<AgentAction> => ({
        tool: "lookup",
        toolInput: "answer",
        log: "Invoking lookup",
      })
    ),
    streamRunnable: false,
  });
  const tool = new DynamicTool({
    name: "lookup",
    description: "Look up the answer",
    returnDirect: true,
    func: async () => "the final answer is 42",
  });
  const executor = AgentExecutor.fromAgentAndTools({ agent, tools: [tool] });

  const chunks: Record<string, unknown>[] = [];
  for await (const chunk of await executor.stream({
    input: "What is the answer?",
  })) {
    chunks.push(chunk);
  }

  expect(
    chunks.some((chunk) => chunk.output === "the final answer is 42")
  ).toBe(true);
});
