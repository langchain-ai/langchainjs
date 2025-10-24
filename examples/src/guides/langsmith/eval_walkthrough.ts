/* eslint-disable import/first */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-duplicates */
import { v4 as uuidv4 } from "uuid";

const uniqueId = uuidv4().slice(0, 8);

import { Client } from "langsmith";

const client = new Client();

import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

const tools = [new TavilySearchResults()];

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0,
});

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

const inputs = [
  { input: "What is LangChain?" },
  { input: "What's LangSmith?" },
  { input: "When was Llama-v2 released?" },
  { input: "What is the langsmith cookbook?" },
  { input: "When did langchain first announce the hub?" },
];

const results = await agentExecutor.batch(inputs);
console.log(results.slice(0, 2));

const referenceOutputs = [
  {
    output:
      "LangChain is an open-source framework for building applications using large language models. It is also the name of the company building LangSmith.",
  },
  {
    output:
      "LangSmith is a unified platform for debugging, testing, and monitoring language model applications and agents powered by LangChain",
  },
  { output: "July 18, 2023" },
  {
    output:
      "The langsmith cookbook is a github repository containing detailed examples of how to use LangSmith to debug, evaluate, and monitor large language model-powered applications.",
  },
  { output: "September 5, 2023" },
];

const datasetName = `lcjs-qa-${uniqueId}`;
const dataset = await client.createDataset(datasetName);

await Promise.all(
  inputs.map(async (input, i) => {
    await client.createExample(input, referenceOutputs[i], {
      datasetId: dataset.id,
    });
  })
);

import type { RunEvalConfig, DynamicRunEvaluatorParams } from "langchain/smith";

// An illustrative custom evaluator example
const notUnsure = async ({ prediction }: DynamicRunEvaluatorParams) => {
  if (typeof prediction?.output !== "string") {
    throw new Error(
      "Invalid prediction format for this evaluator. Please check your chain's outputs and try again."
    );
  }
  return {
    key: "not_unsure",
    score: !prediction.output.includes("not sure"),
  };
};

const evaluation: RunEvalConfig = {
  // The 'evaluators' are loaded from LangChain's evaluation
  // library.
  evaluators: [
    {
      evaluatorType: "labeled_criteria",
      criteria: "correctness",
      feedbackKey: "correctness",
      formatEvaluatorInputs: ({
        rawInput,
        rawPrediction,
        rawReferenceOutput,
      }) => {
        return {
          input: rawInput.input,
          prediction: rawPrediction.output,
          reference: rawReferenceOutput.output,
        };
      },
    },
  ],
  // Custom evaluators can be user-defined RunEvaluator's
  // or a compatible function
  customEvaluators: [notUnsure],
};

import { runOnDataset } from "langchain/smith";

await runOnDataset(agentExecutor, datasetName, {
  evaluationConfig: evaluation,
});
