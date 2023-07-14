import { test } from "@jest/globals";
import { Example, Run } from "langchainplus-sdk";
import {
  ChoicesOutputParser,
  StringRunEvaluatorInputMapper,
  getCriteriaEvaluator,
  getQAEvaluator,
} from "../implementations.js";
import { LLM } from "../../../llms/base.js";
import { RunEvaluatorChain } from "../base.js";

const testRun: Run = {
  inputs: new Map([["query", "How much wood could a woodchuck chuck?"]]),
  outputs: new Map([["myPrediction", "42. no more, no less."]]),
  execution_order: 1,
  name: "Test Run",
  id: "1",
  end_time: 1,
  start_time: 0,
  run_type: "llm",
  serialized: {},
  session_id: "1",
};

const testExample: Example = {
  inputs: new Map([["query", "How much wood could a woodchuck chuck?"]]),
  outputs: new Map([["answer", "Less than 3 kg."]]),
  id: "1",
  created_at: "2021-01-01",
  modified_at: "2021-01-01",
  dataset_id: "1",
  runs: [],
};

test("Test StringRunEvaluatorInputMapper with correct input", () => {
  const mapper = new StringRunEvaluatorInputMapper({
    predictionMap: { myPrediction: "result" },
    inputMap: { query: "query" },
    answerMap: { answer: "answer" },
  });

  const result = mapper.map(testRun, testExample);
  expect(result).toEqual({
    result: "42. no more, no less.",
    query: "How much wood could a woodchuck chuck?",
    answer: "Less than 3 kg.",
  });
});

test("Test ChoicesOutputParser", async () => {
  const outputParser = new ChoicesOutputParser({
    evaluationName: "Correctness",
    choicesMap: { CORRECT: 1, INCORRECT: 0 },
  });

  const result = await outputParser.parse("CORRECT");
  expect(result).toEqual({
    key: "Correctness",
    score: 1,
    value: "CORRECT",
    comment: undefined,
  });
});

test("Test getQAEvaluator with correct input", async () => {
  class FakeLLM extends LLM {
    _llmType() {
      return "fake";
    }

    async _call(): Promise<string> {
      return "I've got a lot of logit in here\n\nCORRECT";
    }
  }
  const model = new FakeLLM({});
  const chain = getQAEvaluator(model, {
    prompt: "qa",
    inputKey: "query",
    predictionKey: "prediction",
    answerKey: "answer",
    evaluationName: "Correctness",
  });

  expect(chain).toBeInstanceOf(RunEvaluatorChain);
  const result = await chain.evaluateRun(testRun, testExample);
  expect(result).toEqual({
    key: "Correctness",
    score: 1,
    value: "CORRECT",
    comment: "I've got a lot of logit in here",
  });
});

test("Test getCriteriaEvaluator with correct input", async () => {
  class FakeLLM extends LLM {
    _llmType() {
      return "fake";
    }

    async _call(): Promise<string> {
      return (
        "It's fairly concise and correct I'd reckon, " +
        "but I'm still going to fail you.\n\nN"
      );
    }
  }
  const model = new FakeLLM({});
  const chain = await getCriteriaEvaluator(
    model,
    ["correctness", "conciseness"],
    {
      inputKey: "query",
      predictionKey: "myPrediction",
    }
  );

  expect(chain).toBeInstanceOf(RunEvaluatorChain);
  const result = await chain.evaluateRun(testRun, testExample);
  expect(result).toEqual({
    key: "correctness conciseness",
    score: 0,
    value: "N",
    comment:
      "It's fairly concise and correct I'd reckon, but I'm still going to fail you.",
  });
});
