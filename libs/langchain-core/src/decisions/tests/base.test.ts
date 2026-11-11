import { AsyncLocalStorage } from "node:async_hooks";
import { describe, expect, test } from "vitest";

import { BaseCallbackHandler } from "../../callbacks/base.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/index.js";
import type { RunnableConfig } from "../../runnables/config.js";
import { RunnableLambda } from "../../runnables/base.js";
import type { ChainValues } from "../../utils/types/index.js";
import {
  BaseDecisionModel,
  parseClassifierResponse,
  type ClassifierRequest,
  type ClassifierResponse,
  type Question,
  type State,
} from "../index.js";

function fakeResponse(): ClassifierResponse {
  return parseClassifierResponse({
    model: "fake-model",
    answers: {
      urgent: { type: "noul", noul: 0.9 },
      dept: {
        type: "choice",
        choice: "billing",
        probabilities: { billing: 0.8, technical: 0.2 },
        confidence: 0.6,
      },
    },
    usage_metadata: { input_tokens: 42, output_tokens: 0 },
  });
}

class FakeDecisionModel extends BaseDecisionModel {
  lc_namespace = ["tests", "decisions"];

  requests: [State, Record<string, Question>][] = [];

  get _provider() {
    return "fake";
  }

  async _classify(state: State, questions: Record<string, Question>) {
    this.requests.push([state, questions]);
    return fakeResponse();
  }
}

class NestedCallDecisionModel extends FakeDecisionModel {
  configs: Partial<RunnableConfig>[] = [];

  async _classify(
    state: State,
    questions: Record<string, Question>,
    config?: Partial<RunnableConfig>
  ) {
    this.configs.push(config ?? {});
    await RunnableLambda.from((x: string) => x)
      .withConfig({ runName: "nested" })
      .invoke("x", config);
    return super._classify(state, questions);
  }
}

class RunRecorder extends BaseCallbackHandler {
  name = "run_recorder";

  runs: { name?: string; runId: string; parentRunId?: string }[] = [];

  runType?: string;

  metadata?: Record<string, unknown>;

  outputs: ChainValues[] = [];

  handleChainStart(
    _chain: unknown,
    _inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    _tags?: string[],
    metadata?: Record<string, unknown>,
    runType?: string,
    name?: string
  ) {
    this.runs.push({ name, runId, parentRunId });
    if (name !== "nested") {
      this.runType = runType;
      this.metadata = metadata;
    }
  }

  handleChainEnd(outputs: ChainValues) {
    this.outputs.push(outputs);
  }
}

class FixedAnswersDecisionModel extends FakeDecisionModel {
  constructor(private readonly answers: Record<string, unknown>) {
    super({ model: "fake-model" });
  }

  async _classify() {
    return parseClassifierResponse({
      model: "fake-model",
      answers: this.answers,
    });
  }
}

const URGENT: Question = { type: "noul", instructions: "Is this urgent?" };

const DEPT: Question = {
  type: "choice",
  instructions: "Which team?",
  criteria: { billing: "Payments.", technical: "Bugs." },
};

const request = (): ClassifierRequest => ({
  state: "hello",
  questions: { urgent: URGENT },
});

describe("BaseDecisionModel", () => {
  test("invoke delegates to _classify", async () => {
    const model = new FakeDecisionModel({ model: "fake-model" });

    const response = await model.invoke(request());

    expect(model.requests).toEqual([["hello", { urgent: URGENT }]]);
    expect(response).toEqual(fakeResponse());
    expect(response.nouls.urgent.noul).toBe(0.9);
  });

  test("invoke validates questions before classifying", async () => {
    const model = new FakeDecisionModel({ model: "fake-model" });

    await expect(
      model.invoke({
        state: "hello",
        questions: { urgent: { type: "noul" } as unknown as Question },
      })
    ).rejects.toThrow('Invalid question "urgent": instructions');
    await expect(
      model.invoke({ state: "hello", questions: {} })
    ).rejects.toThrow("at least one question");
    expect(model.requests).toEqual([]);
  });

  test("run carries provider identity and caller metadata", async () => {
    const recorder = new RunRecorder();

    await new FakeDecisionModel({ model: "fake-model" }).invoke(request(), {
      callbacks: [recorder],
      metadata: { team: "support" },
    });

    expect(recorder.runType).toBe("llm");
    expect(recorder.outputs).toHaveLength(1);
    expect(recorder.metadata).toMatchObject({
      team: "support",
      ls_provider: "fake",
      ls_model_name: "fake-model",
      ls_model_type: "chat",
    });
  });

  test("run output carries usage metadata", async () => {
    const recorder = new RunRecorder();

    await new FakeDecisionModel({ model: "fake-model" }).invoke(request(), {
      callbacks: [recorder],
    });

    expect(recorder.outputs[0].usage_metadata).toEqual({
      input_tokens: 42,
      output_tokens: 0,
      total_tokens: 42,
    });
    expect(Object.keys(recorder.outputs[0])).not.toContain("nouls");
  });

  test("nested runs are children of the decision run", async () => {
    const recorder = new RunRecorder();
    const model = new NestedCallDecisionModel({ model: "fake-model" });

    await model.invoke(request(), { callbacks: [recorder] });

    const [decision, nested] = recorder.runs;
    expect(nested.name).toBe("nested");
    expect(nested.parentRunId).toBe(decision.runId);
    expect(model.configs[0]).not.toHaveProperty("runType");
  });

  test("_classify sees metadata from the enclosing run", async () => {
    AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
      new AsyncLocalStorage()
    );
    const model = new NestedCallDecisionModel({ model: "fake-model" });

    await RunnableLambda.from((req: ClassifierRequest) =>
      model.invoke(req)
    ).invoke(request(), { metadata: { outer: 1 } });

    expect(model.configs[0].metadata).toMatchObject({
      outer: 1,
      ls_provider: "fake",
    });
  });

  test("invoke accepts a response answering every question", async () => {
    const response = await new FakeDecisionModel({
      model: "fake-model",
    }).invoke({ state: "hello", questions: { urgent: URGENT, dept: DEPT } });

    expect(response.choices.dept.choice).toBe("billing");
  });

  test("invoke rejects a response missing an answer", async () => {
    const model = new FixedAnswersDecisionModel({});

    await expect(model.invoke(request())).rejects.toThrow(
      'Decision model returned no answer for question "urgent".'
    );
  });

  test("invoke rejects an answer of the wrong type", async () => {
    const model = new FixedAnswersDecisionModel({
      urgent: {
        type: "choice",
        choice: "billing",
        probabilities: { billing: 1 },
        confidence: 1,
      },
    });

    await expect(model.invoke(request())).rejects.toThrow(
      'Decision model returned a choice answer for noul question "urgent".'
    );
  });

  test("invoke rejects a choice outside the question's labels", async () => {
    const model = new FixedAnswersDecisionModel({
      dept: {
        type: "choice",
        choice: "sales",
        probabilities: { sales: 1 },
        confidence: 1,
      },
    });

    await expect(
      model.invoke({ state: "hello", questions: { dept: DEPT } })
    ).rejects.toThrow(
      'Decision model returned a choice for question "dept" that is not one of its labels.'
    );
  });
});
