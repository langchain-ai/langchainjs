import { test, expect } from "vitest";
import { DynamicTool } from "@langchain/core/tools";
import type {
  AgentAction,
  AgentFinish,
  AgentStep,
} from "@langchain/core/agents";
import type { ChainValues } from "@langchain/core/utils/types";
import { BaseSingleActionAgent } from "../agent.js";
import { AgentExecutor } from "../executor.js";

/**
 * Minimal single-action agent that returns a single, predetermined action on
 * its first plan and would return a finish afterwards. Used to drive the
 * executor deterministically without requiring an LLM.
 */
class FakeSingleActionAgent extends BaseSingleActionAgent {
  lc_namespace = ["langchain", "agents", "fake"];

  action: AgentAction;

  constructor(action: AgentAction) {
    super({});
    this.action = action;
  }

  get inputKeys(): string[] {
    return ["input"];
  }

  async plan(
    steps: AgentStep[],
    _inputs: ChainValues
  ): Promise<AgentAction | AgentFinish> {
    // If the tool already ran, finish. With a returnDirect tool the executor
    // should never reach this branch, but guard anyway to avoid loops.
    if (steps.length > 0) {
      return {
        returnValues: { output: steps[steps.length - 1].observation },
        log: "",
      };
    }
    return this.action;
  }
}

// https://github.com/langchain-ai/langchainjs/issues/11222
test("AgentExecutor.stream yields the final answer for returnDirect tools", async () => {
  const tool = new DynamicTool({
    name: "search",
    description: "returns a canned answer",
    returnDirect: true,
    func: async () => "the-direct-answer",
  });

  const agent = new FakeSingleActionAgent({
    tool: "search",
    toolInput: "anything",
    log: "",
  });

  const executor = AgentExecutor.fromAgentAndTools({ agent, tools: [tool] });

  const chunks: Record<string, unknown>[] = [];
  for await (const chunk of await executor.stream({ input: "hi" })) {
    chunks.push(chunk);
  }

  const finalChunk = chunks.find((chunk) => "output" in chunk);
  expect(finalChunk).toBeDefined();
  expect(finalChunk?.output).toBe("the-direct-answer");
});
