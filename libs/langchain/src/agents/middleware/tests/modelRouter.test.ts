import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BaseDecisionModel,
  parseClassifierResponse,
  type Question,
  type State,
} from "@langchain/core/decisions";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import type { RunnableConfig } from "@langchain/core/runnables";
import { omitPayload } from "@langchain/core/tracers/tracer_langchain";

import { createAgent } from "../../index.js";
import { modelRouterMiddleware } from "../modelRouter.js";

const { initChatModel } = vi.hoisted(() => ({ initChatModel: vi.fn() }));
vi.mock("../../../chat_models/universal.js", () => ({ initChatModel }));

const answer = (choice: string) => ({
  type: "choice" as const,
  choice,
  probabilities: { fast: 0.8, powerful: 0.2 },
  confidence: 0.6,
});

class RouteClassifier extends BaseDecisionModel {
  lc_namespace = ["tests", "decisions"];

  requests: [State, Record<string, Question>][] = [];

  constructor(
    private route = "fast",
    private error?: string
  ) {
    super({ model: "fake-router" });
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
      answers: { model_route: answer(this.route) },
    });
  }
}

function router(classifier: RouteClassifier) {
  const models = {
    fast: new FakeListChatModel({ responses: ["fast response"] }),
    powerful: new FakeListChatModel({ responses: ["powerful response"] }),
  };
  const middleware = modelRouterMiddleware({
    choices: {
      fast: { model: models.fast, criteria: "Simple tasks." },
      powerful: { model: models.powerful, criteria: "Complex tasks." },
    },
    instructions: "Choose the least costly model suited to the task.",
    classifier,
  });
  return { middleware, models };
}

describe("modelRouterMiddleware", () => {
  beforeEach(() => {
    initChatModel.mockReset();
  });

  it("routes with the latest human message", async () => {
    const classifier = new RouteClassifier();
    const { middleware, models } = router(classifier);
    const latest = new HumanMessage("Update the README");
    const agent = createAgent({
      model: models.powerful,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("Earlier task"),
        new AIMessage("Ready"),
        latest,
      ],
    });

    expect(classifier.requests).toEqual([
      [
        latest,
        {
          model_route: {
            type: "choice",
            instructions: "Choose the least costly model suited to the task.",
            criteria: { fast: "Simple tasks.", powerful: "Complex tasks." },
          },
        },
      ],
    ]);
    expect(result.messages.at(-1)?.text).toBe("fast response");
    expect(result.modelRoute).toEqual(answer("fast"));
  });

  it("passes the run's abort signal to the classifier", async () => {
    const classifier = new RouteClassifier();
    const { middleware, models } = router(classifier);
    const agent = createAgent({ model: models.fast, middleware: [middleware] });
    const controller = new AbortController();
    classifier.onClassify = () => controller.abort();

    await expect(
      agent.invoke(
        { messages: [new HumanMessage("Do the task")] },
        { signal: controller.signal }
      )
    ).rejects.toThrow();
    expect(classifier.abortedDuringClassify).toBe(true);
  });

  it("omits classifier context from middleware traces", () => {
    const { middleware } = router(new RouteClassifier());

    expect(middleware.tracePolicy?.processInputs).toBe(omitPayload);
  });

  it("propagates classifier failures", async () => {
    const { middleware, models } = router(
      new RouteClassifier("fast", "unavailable")
    );
    const agent = createAgent({ model: models.fast, middleware: [middleware] });

    await expect(
      agent.invoke({ messages: [new HumanMessage("Do the task")] })
    ).rejects.toThrow("unavailable");
  });

  it("rejects state without a human message", async () => {
    const classifier = new RouteClassifier();
    const { middleware, models } = router(classifier);
    const agent = createAgent({ model: models.fast, middleware: [middleware] });

    await expect(
      agent.invoke({ messages: [new AIMessage("Ready")] })
    ).rejects.toThrow("requires a HumanMessage");
    expect(classifier.requests).toEqual([]);
  });

  it("rejects an unknown route", async () => {
    const { middleware, models } = router(new RouteClassifier("other"));
    const agent = createAgent({ model: models.fast, middleware: [middleware] });

    await expect(
      agent.invoke({ messages: [new HumanMessage("Do the task")] })
    ).rejects.toThrow("not one of its labels");
  });

  it("rejects empty choices", () => {
    expect(() =>
      modelRouterMiddleware({
        choices: {},
        instructions: "Choose a route.",
        classifier: new RouteClassifier(),
      })
    ).toThrow("at least one choice");
  });

  it("retries a model string whose initialization failed", async () => {
    const initialized = new FakeListChatModel({ responses: ["initialized"] });
    initChatModel
      .mockRejectedValueOnce(new Error("init failed"))
      .mockResolvedValueOnce(initialized);
    const middleware = modelRouterMiddleware({
      choices: { fast: { model: "openai:gpt-5-mini", criteria: "Simple." } },
      instructions: "Choose a route.",
      classifier: new RouteClassifier(),
    });
    const agent = createAgent({ model: initialized, middleware: [middleware] });

    await expect(
      agent.invoke({ messages: [new HumanMessage("One")] })
    ).rejects.toThrow("init failed");
    const result = await agent.invoke({ messages: [new HumanMessage("Two")] });

    expect(result.messages.at(-1)?.text).toBe("initialized");
    expect(initChatModel).toHaveBeenCalledTimes(2);
  });

  it("initializes a model string once", async () => {
    const initialized = new FakeListChatModel({
      responses: ["initialized", "initialized"],
    });
    initChatModel.mockResolvedValue(initialized);
    const middleware = modelRouterMiddleware({
      choices: { fast: { model: "openai:gpt-5-mini", criteria: "Simple." } },
      instructions: "Choose a route.",
      classifier: new RouteClassifier(),
    });
    const agent = createAgent({ model: initialized, middleware: [middleware] });

    await agent.invoke({ messages: [new HumanMessage("One")] });
    await agent.invoke({ messages: [new HumanMessage("Two")] });

    expect(initChatModel).toHaveBeenCalledTimes(1);
    expect(initChatModel).toHaveBeenCalledWith("openai:gpt-5-mini");
  });
});
