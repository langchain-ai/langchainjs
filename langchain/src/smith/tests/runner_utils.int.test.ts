import { test } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { Client, Example, Run } from "langsmith";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LLM } from "@langchain/core/language_models/llms";
import {
  AIMessage,
  BaseMessage,
  isBaseMessage,
} from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import { RunnableConfig, RunnableLambda } from "@langchain/core/runnables";
import { DataType, KVMap } from "langsmith/schemas";
import { RunEvalConfig } from "../config.js";
import { randomName } from "../name_generation.js";
import { EvalResults, runOnDataset } from "../runner_utils.js";

const answers: { [question: string]: string } = {
  "What's the capital of California?": "Sacramento",
  "What's the capital of Nevada?": "Carson City",
  "What's the capital of Oregon?": "Salem",
  "What's the capital of Washington?": "Olympia",
};

class FakeLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return answers[prompt] || prompt;
  }
}

export class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    _?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const text = messages[messages.length - 1].content;
    const answer = (answers[text as string] || text) as string;
    await runManager?.handleLLMNewToken(answer);
    const result = new AIMessage({ content: answer });
    return {
      generations: [
        {
          message: result,
          text: answer,
        },
      ],
      llmOutput: {},
    };
  }
}

const getScore = ({ outputs }: { outputs?: KVMap }) =>
  outputs && Object.values(outputs).length > 0;

const outputNotEmpty = async (
  { run }: { run: Run; example?: Example },
  options?: RunnableConfig
) => {
  const lambda = new RunnableLambda({ func: getScore });
  const score = await lambda.invoke(run, options);
  return {
    key: "output_not_empty",
    score,
    comment:
      "We have thoroughly checked the output and it is possibly not not empty.",
  };
};

const alwaysPass = (_: { run: Run; example?: Example }) => ({
  key: "always_pass",
  score: true,
});

const checkFeedbackPassed = (evalResults: EvalResults) => {
  expect(evalResults.projectName).toBeDefined();
  expect(evalResults.results).toBeDefined();
  expect(Object.keys(evalResults.results).length).toBeGreaterThan(0);
  for (const [, result] of Object.entries(evalResults.results)) {
    expect(result.execution_time).toBeGreaterThan(0);
    expect(result.run_id).toBeDefined();
    expect(result.feedback).toBeDefined();
    expect(result.feedback.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-loop-func
    result.feedback.forEach((feedback) => {
      expect(feedback.score).toBeDefined();
      expect(feedback.score).toBeTruthy();
    });
  }
};

const kvDataset = Object.entries(answers).map(([question, answer]) => ({
  inputs: { input: question },
  outputs: { output: answer },
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

const datasetTypes: DataType[] = ["kv", "llm"]; // TODO: add chat
describe.skip.each(datasetTypes)("runner_utils %s dataset", (datasetType) => {
  let client: Client;
  const datasetName = `lcjs ${datasetType} integration tests`;
  const evalConfig: RunEvalConfig = {
    customEvaluators: [outputNotEmpty, alwaysPass],
    evaluators: [
      {
        evaluatorType: "labeled_criteria",
        criteria: "correctness",
        feedbackKey: "labeledCorrect",
        formatEvaluatorInputs: ({
          rawInput,
          rawPrediction,
          rawReferenceOutput,
        }) => {
          let prediction: string;
          if (isBaseMessage(rawPrediction)) {
            if (typeof rawPrediction.content !== "string") {
              throw new Error("Multimodal mesages not supported.");
            }
            prediction = rawPrediction.content;
          } else if (typeof rawPrediction === "string") {
            prediction = rawPrediction;
          } else if (
            rawPrediction &&
            typeof rawPrediction === "object" &&
            "output" in rawPrediction
          ) {
            prediction = rawPrediction.output as string;
          } else {
            throw new Error("Unsupported prediction type.");
          }
          return {
            input: rawInput.input,
            prediction,
            reference: rawReferenceOutput.output,
          };
        },
        llm: new ChatOpenAI({
          model: "gpt-3.5-turbo",
          temperature: 0,
          modelKwargs: { seed: 42 },
        }),
      },
    ],
  };

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
      evaluationConfig: evalConfig,
      projectName: `fake-chat-model-${randomName()}`,
      projectMetadata: { env: "integration-tests", model: "fake-chat-model" },
    });
    checkFeedbackPassed(evalResults);
  });

  test(`FakeLLM on ${datasetType} singleio dataset`, async () => {
    const llm = new FakeLLM({});
    const evalResults = await runOnDataset(llm, datasetName, {
      client,
      evaluationConfig: evalConfig,
      projectName: `fake-llm-${randomName()}`,
      projectMetadata: { env: "integration-tests", model: "fake-llm" },
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Runnable on ${datasetType} singleio dataset`, async () => {
    const runnable = new RunnableLambda({
      func: (input: { input: string }) => ({ output: answers[input.input] }),
    });
    const evalResults = await runOnDataset(runnable, datasetName, {
      client,
      evaluationConfig: evalConfig,
      projectName: `runnable-${randomName()}`,
      projectMetadata: { env: "integration-tests" },
      maxConcurrency: 5,
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Runnable constructor on ${datasetType} singleio dataset`, async () => {
    const runnable = new RunnableLambda({
      func: (input: { input: string }) => ({ output: answers[input.input] }),
    });

    function construct() {
      return runnable;
    }

    const evalResults = await runOnDataset(construct, datasetName, {
      client,
      evaluationConfig: evalConfig,
      projectName: `runnable-constructor-${randomName()}`,
      projectMetadata: { env: "integration-tests" },
      maxConcurrency: 5,
    });
    checkFeedbackPassed(evalResults);
  });

  test(`Arb func on ${datasetType} singleio dataset`, async () => {
    async function my_func({ input }: { input: string }) {
      return { output: answers[input] };
    }
    const evalResults = await runOnDataset(my_func, datasetName, {
      evaluationConfig: evalConfig,
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
    async function my_func({ input }: { input: string }) {
      return { output: answers[input] };
    }
    const evalResults = await runOnDataset(() => my_func, datasetName, {
      evaluationConfig: evalConfig,
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
