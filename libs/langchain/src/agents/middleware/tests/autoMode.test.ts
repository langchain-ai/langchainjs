import { describe, it, expect } from "vitest";
import {
  BaseDecisionModel,
  parseClassifierResponse,
  type Question,
  type State,
} from "@langchain/core/decisions";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { omitPayload } from "@langchain/core/tracers/tracer_langchain";
import { z } from "zod/v4";

import { createAgent } from "../../index.js";
import { autoModeMiddleware } from "../autoMode.js";
import { FakeToolCallingModel } from "../../tests/utils.js";

class RiskClassifier extends BaseDecisionModel {
  lc_namespace = ["tests", "decisions"];

  requests: [State, Record<string, Question>][] = [];

  constructor(
    private probability = 0.1,
    private error?: string
  ) {
    super({ model: "fake-risk" });
  }

  get _provider() {
    return "fake";
  }

  onClassify?: () => void;

  abortedDuringClassify?: boolean;

  async _classify(
    state: State,
    questions: Record<string, Question>,
    config?: Partial<RunnableConfig>
  ) {
    this.requests.push([state, questions]);
    this.onClassify?.();
    this.abortedDuringClassify = config?.signal?.aborted;
    if (this.error) throw new Error(this.error);
    return parseClassifierResponse({
      model: this.model,
      answers: { is_risky: { type: "noul", noul: this.probability } },
    });
  }
}

function deleteTool(executions: string[]) {
  return tool(
    async ({ path }) => {
      executions.push(path);
      return `Deleted ${path}`;
    },
    {
      name: "delete_file",
      description: "Delete a file at the supplied path.",
      schema: z.object({ path: z.string() }),
    }
  );
}

async function runAgent(
  middleware: ReturnType<typeof autoModeMiddleware>,
  toolInstance: ReturnType<typeof deleteTool>,
  messages = [new HumanMessage("Delete the temporary report.")],
  signal?: AbortSignal
) {
  const model = new FakeToolCallingModel({
    toolCalls: [
      [
        {
          name: "delete_file",
          args: { path: "/workspace/report.txt" },
          id: "call_123",
        },
      ],
      [],
    ],
  });
  const agent = createAgent({
    model,
    tools: [toolInstance],
    middleware: [middleware],
  });
  return agent.invoke({ messages }, { signal });
}

const toolMessages = (result: { messages: unknown[] }) =>
  result.messages.filter(ToolMessage.isInstance);

describe("autoModeMiddleware", () => {
  it("asks the configured instructions and criteria", async () => {
    const classifier = new RiskClassifier();
    const criteria = {
      true: "The call modifies data.",
      false: "The call reads data.",
    };
    const middleware = autoModeMiddleware({
      tools: ["delete_file"],
      instructions: "Assess the impact.",
      criteria,
      classifier,
    });

    await runAgent(middleware, deleteTool([]));

    expect(classifier.requests[0][1]).toEqual({
      is_risky: { type: "noul", instructions: "Assess the impact.", criteria },
    });
  });

  it("sends no criteria by default", async () => {
    const classifier = new RiskClassifier();
    const middleware = autoModeMiddleware({
      tools: ["delete_file"],
      classifier,
    });

    await runAgent(middleware, deleteTool([]));

    const question = classifier.requests[0][1].is_risky;
    expect(question.type).toBe("noul");
    expect((question as { criteria?: unknown }).criteria).toBeUndefined();
  });

  it("omits classifier context from middleware traces", () => {
    const middleware = autoModeMiddleware({
      tools: ["delete_file"],
      classifier: new RiskClassifier(),
    });

    expect(middleware.tracePolicy?.processInputs).toBe(omitPayload);
  });

  it.each([
    [0.2, "success", ["/workspace/report.txt"]],
    [0.5, "error", []],
  ])(
    "probability %s gives a %s tool result",
    async (probability, status, expectedExecutions) => {
      const executions: string[] = [];
      const toolInstance = deleteTool(executions);
      const middleware = autoModeMiddleware({
        tools: [toolInstance],
        classifier: new RiskClassifier(probability),
      });

      const result = await runAgent(middleware, toolInstance);

      const [toolMessage] = toolMessages(result);
      expect(toolMessage.status ?? "success").toBe(status);
      expect(toolMessage.tool_call_id).toBe("call_123");
      expect(executions).toEqual(expectedExecutions);
    }
  );

  it("blocks with a message naming the tool and probability", async () => {
    const toolInstance = deleteTool([]);
    const middleware = autoModeMiddleware({
      tools: [toolInstance],
      classifier: new RiskClassifier(0.9),
    });

    const [toolMessage] = toolMessages(
      await runAgent(middleware, toolInstance)
    );

    expect(toolMessage.content).toBe(
      "The tool call `delete_file` was blocked because it was classified as risky (probability: 0.90). The tool was not executed."
    );
  });

  it("lets unlisted tools bypass classification", async () => {
    const executions: string[] = [];
    const toolInstance = deleteTool(executions);
    const classifier = new RiskClassifier(0.9);
    const middleware = autoModeMiddleware({
      tools: ["another_tool"],
      classifier,
    });

    const [toolMessage] = toolMessages(
      await runAgent(middleware, toolInstance)
    );

    expect(toolMessage.status ?? "success").toBe("success");
    expect(executions).toEqual(["/workspace/report.txt"]);
    expect(classifier.requests).toEqual([]);
  });

  it("sends messages, the tool call, and the tool description", async () => {
    const toolInstance = deleteTool([]);
    const classifier = new RiskClassifier(0.9);
    const middleware = autoModeMiddleware({
      tools: [toolInstance],
      classifier,
    });

    await runAgent(middleware, toolInstance);

    const state = classifier.requests[0][0] as Record<string, unknown>;
    const messages = state.messages as AIMessage[];
    expect(messages[0].text).toBe("Delete the temporary report.");
    expect(messages[1].tool_calls?.[0].name).toBe("delete_file");
    expect(state.tool_call).toEqual({
      id: "call_123",
      name: "delete_file",
      args: { path: "/workspace/report.txt" },
    });
    expect(state.tool_description).toBe("Delete a file at the supplied path.");
  });

  it("passes the run's abort signal to the classifier", async () => {
    const toolInstance = deleteTool([]);
    const classifier = new RiskClassifier(0.9);
    const middleware = autoModeMiddleware({
      tools: [toolInstance],
      classifier,
    });
    const controller = new AbortController();
    classifier.onClassify = () => controller.abort();

    await expect(
      runAgent(middleware, toolInstance, undefined, controller.signal)
    ).rejects.toThrow();
    expect(classifier.abortedDuringClassify).toBe(true);
  });

  it("limits classifier context to the last 30 messages", async () => {
    const toolInstance = deleteTool([]);
    const classifier = new RiskClassifier(0.9);
    const middleware = autoModeMiddleware({
      tools: [toolInstance],
      classifier,
    });

    await runAgent(
      middleware,
      toolInstance,
      Array.from({ length: 31 }, (_, i) => new HumanMessage(`message ${i}`))
    );

    const messages = (classifier.requests[0][0] as { messages: AIMessage[] })
      .messages;
    expect(messages).toHaveLength(30);
    expect(messages[0].text).toBe("message 2");
    expect(AIMessage.isInstance(messages[29])).toBe(true);
  });

  it("propagates classifier failures without running the tool", async () => {
    const executions: string[] = [];
    const toolInstance = deleteTool(executions);
    const middleware = autoModeMiddleware({
      tools: [toolInstance],
      classifier: new RiskClassifier(0.1, "unavailable"),
    });

    await expect(runAgent(middleware, toolInstance)).rejects.toThrow(
      "unavailable"
    );
    expect(executions).toEqual([]);
  });

  it("rejects an empty tool list", () => {
    expect(() =>
      autoModeMiddleware({ tools: [], classifier: new RiskClassifier() })
    ).toThrow("at least one tool");
    expect(() =>
      autoModeMiddleware({
        tools: "delete_file" as never,
        classifier: new RiskClassifier(),
      })
    ).toThrow("at least one tool");
  });
});
