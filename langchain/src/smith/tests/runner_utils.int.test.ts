import { test } from "@jest/globals";
import { Client, Run, Example } from "langsmith";

import { FakeLLM, FakeChatModel } from "@langchain/core/utils/testing";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunEvalConfig, runOnDataset } from "../runner_utils.js";
import { RunnableLambda } from "@langchain/core/runnables";
import { randomName } from "../name_generation.js";

const outputNotEmpty = ({ run }: { run: Run; example?: Example }) => {
  const firstOutput = run.outputs && Object.values(run.outputs)[0];
  return {
    key: "output_not_empty",
    score: firstOutput && firstOutput.content && firstOutput.content.length > 0,
  };
};

describe("runner_utils KV singleio dataset", () => {
  let client: Client;
  let datasetName: string = "lcjs singleio kv dataset integration tests";
  let evalConfig: RunEvalConfig = { customEvaluators: [outputNotEmpty] };

  beforeAll(async () => {
    client = new Client();
    try {
      await client.readDataset({ datasetName });
    } catch (e) {
      await client.createDataset(datasetName);
      const inputs = [
        "What's the capital of California?",
        "What's the capital of Nevada?",
        "What's the capital of Oregon?",
        "What's the capital of Washington?",
      ];
      const outputs = ["Sacramento", "Carson City", "Salem", "Olympia"];
      await Promise.all(
        inputs.map(async (input, i) => {
          client.createExample(
            { input: input },
            { output: outputs[i] },
            { datasetName }
          );
        })
      );
    }
  });

  test("Chat model on KV singleio dataset", async () => {
    const llm = new FakeChatModel({});

    await runOnDataset(llm, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `fake-chat-model-${randomName()}`,
      projectMetadata: { env: "integration-tests", model: "fake-chat-model" },
    });
    // _check_all_feedback_passed(eval_project_name, client)
  });

  test("FakeLLM on KV singleio dataset", async () => {
    const llm = new FakeLLM({});
    await runOnDataset(llm, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `fake-llm-${randomName()}`,
      projectMetadata: { env: "integration-tests", model: "fake-llm" },
    });
    // _check_all_feedback_passed(eval_project_name, client)
  });

  test("Runnable on KV singleio dataset", async () => {
    const runnable = new RunnableLambda({
      func: (input: { input: string }) => {
        return { "the wackiest input": input.input };
      },
    })
      .pipe(
        ChatPromptTemplate.fromMessages([["human", "{the wackiest input}"]])
      )
      .pipe(new FakeChatModel({}));
    await runOnDataset(runnable, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `runnable-${randomName()}`,
      projectMetadata: { env: "integration-tests" },
      maxConcurrency: 5,
    });
    // _check_all_feedback_passed(eval_project_name, client)
  });

  test("Runnable constructor on KV singleio dataset", async () => {
    const runnable = new RunnableLambda({
      func: (input: { input: string }) => {
        return { "the wackiest input": input.input };
      },
    })
      .pipe(
        ChatPromptTemplate.fromMessages([["human", "{the wackiest input}"]])
      )
      .pipe(new FakeChatModel({}));

    function construct() {
      return runnable;
    }

    await runOnDataset(construct, datasetName, {
      client,
      evaluation: evalConfig,
      projectName: `runnable-constructor-${randomName()}`,
      projectMetadata: { env: "integration-tests" },
      maxConcurrency: 5,
    });
    // _check_all_feedback_passed(eval_project_name, client)
  });

  test("Arb func on KV singleio dataset", async () => {
    async function my_func(inputs: { input: string }) {
      return { "back atcha": inputs.input };
    }
    await runOnDataset(my_func, datasetName, {
      evaluation: evalConfig,
      client,
      maxConcurrency: 5,
      projectName: `arb-function-${randomName()}`,
      projectMetadata: {
        env: "integration-tests",
        model: "fake-chat-in-runnable",
      },
    });
    // _check_all_feedback_passed(eval_project_name, client)
  });

  test("Arb constructor on KV singleio dataset", async () => {
    async function my_func(inputs: { input: string }) {
      return { "back atcha": inputs.input };
    }
    await runOnDataset(() => my_func, datasetName, {
      evaluation: evalConfig,
      client,
      maxConcurrency: 5,
      projectName: `arb-constructor-function-${randomName()}`,
      projectMetadata: {
        env: "integration-tests",
        model: "fake-chat-in-runnable",
      },
    });
    // _check_all_feedback_passed(eval_project_name, client)
  });
});
