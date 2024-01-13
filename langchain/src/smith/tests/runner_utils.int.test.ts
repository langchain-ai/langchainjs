import { test } from "@jest/globals";
import { Client, Example, Run } from "langsmith";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda } from "@langchain/core/runnables";
import { FakeChatModel, FakeLLM } from "@langchain/core/utils/testing";
import { DataType } from "langsmith/schemas";
import { randomName } from "../name_generation.js";
import { EvalResults, RunEvalConfig, runOnDataset } from "../runner_utils.js";

const outputNotEmpty = ({ run }: { run: Run; example?: Example }) => {
  const score = run?.outputs && Object.values(run?.outputs).length > 0;
  return {
    key: "output_not_empty",
    score,
  };
};

const checkFeedbackPassed = (evalResults: EvalResults) => {
  expect(evalResults.projectName).toBeDefined();
  expect(evalResults.results).toBeDefined();
  expect(Object.keys(evalResults.results).length).toBeGreaterThan(0);
  for (const [_, result] of Object.entries(evalResults.results)) {
    expect(result.execution_time).toBeGreaterThan(0);
    expect(result.run_id).toBeDefined();
    expect(result.feedback).toBeDefined();
    expect(result.feedback.length).toEqual(1);
    expect(result.feedback[0].score).toEqual(true);
  }
};

const kvDataset = [
  ["What's the capital of California?", "Sacramento"],
  ["What's the capital of Nevada?", "Carson City"],
  ["What's the capital of Oregon?", "Salem"],
  ["What's the capital of Washington?", "Olympia"],
].map((pair) => ({
  inputs: { input: pair[0] },
  outputs: { output: pair[1] },
}));

const chatDataset = kvDataset.map((message) => ({
  inputs: {
    input: [
      { type: "system", data: { content: "Hello, how are you?" } },
      { type: "human", data: { content: message.inputs.input } },
    ],
  },
  outputs: {
    output: { type: "ai", data: { content: message.outputs.output } },
  },
}));

const datasetTypes: DataType[] = ["kv", "chat", "llm"];
describe.each(datasetTypes)("runner_utils %s dataset", (datasetType) => {
  //   describe("runner_utils chat dataset", () => {
  //     const datasetType = "chat";
  let client: Client;
  const datasetName = `lcjs ${datasetType} integration tests`;
  const evalConfig: RunEvalConfig = { customEvaluators: [outputNotEmpty] };

  beforeAll(async () => {
    client = new Client();
    try {
      await client.readDataset({ datasetName });
    } catch (e) {
      const dataset = await client.createDataset(datasetName, {
        dataType: datasetType,
      });

      const examples = datasetType === "chat" ? chatDataset : kvDataset;
      await Promise.all(
        examples.map(async (example) => {
          void client.createExample(example.inputs, example.outputs, {
            datasetId: dataset.id,
          });
        })
      );
    }
  });

  test(`Chat model on ${datasetType} singleio dataset`, async () => {
    const llm = new FakeChatModel({});

    const evalResults = await runOnDataset(llm, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `fake-chat-model-${randomName()}`,
      projectMetadata: { env: "integration-tests", model: "fake-chat-model" },
    });
    checkFeedbackPassed(evalResults);
  });

  test(`FakeLLM on ${datasetType} singleio dataset`, async () => {
    const llm = new FakeLLM({});
    const evalResults = await runOnDataset(llm, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `fake-llm-${randomName()}`,
      projectMetadata: { env: "integration-tests", model: "fake-llm" },
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Runnable on ${datasetType} singleio dataset`, async () => {
    const runnable = new RunnableLambda({
      func: (input: { input: string }) => ({
        "the wackiest input": input.input,
      }),
    })
      .pipe(
        ChatPromptTemplate.fromMessages([["human", "{the wackiest input}"]])
      )
      .pipe(new FakeChatModel({}));
    const evalResults = await runOnDataset(runnable, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `runnable-${randomName()}`,
      projectMetadata: { env: "integration-tests" },
      maxConcurrency: 5,
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Runnable constructor on ${datasetType} singleio dataset`, async () => {
    const runnable = new RunnableLambda({
      func: (input: { input: string }) => ({
        "the wackiest input": input.input,
      }),
    })
      .pipe(
        ChatPromptTemplate.fromMessages([["human", "{the wackiest input}"]])
      )
      .pipe(new FakeChatModel({}));

    function construct() {
      return runnable;
    }

    const evalResults = await runOnDataset(construct, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `runnable-constructor-${randomName()}`,
      projectMetadata: { env: "integration-tests" },
      maxConcurrency: 5,
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Arb func on ${datasetType} singleio dataset`, async () => {
    async function my_func(inputs: { input: string }) {
      return { "back atcha": inputs.input };
    }
    const evalResults = await runOnDataset(my_func, datasetName, {
      evaluation: evalConfig,
      client,
      maxConcurrency: 5,
      projectName: `arb-function-${randomName()}`,
      projectMetadata: {
        env: "integration-tests",
        model: "fake-chat-in-runnable",
      },
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Arb constructor on ${datasetType} singleio dataset`, async () => {
    async function my_func(inputs: { input: string }) {
      return { "back atcha": inputs.input };
    }
    const evalResults = await runOnDataset(() => my_func, datasetName, {
      evaluation: evalConfig,
      client,
      maxConcurrency: 5,
      projectName: `arb-constructor-function-${randomName()}`,
      projectMetadata: {
        env: "integration-tests",
        model: "fake-chat-in-runnable",
      },
    });
    checkFeedbackPassed(evalResults);
  });
});
