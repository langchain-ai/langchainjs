import PQueueMod from "p-queue";
import { Example, Client } from "langsmith";

import { LangChainTracer } from "../callbacks/handlers/tracer_langchain.js";
import { ChainValues, LLMResult, StoredMessage } from "../schema/index.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { BaseChain } from "../chains/base.js";
import { BaseLLM } from "../llms/base.js";
import { BaseChatModel } from "../chat_models/base.js";
import { mapStoredMessagesToChatMessages } from "../stores/message/utils.js";

export type DatasetRunResults = Record<
  string,
  (string | LLMResult | ChainValues)[]
>;

const stringifyError = (err: Error | unknown): string => {
  let result: string;
  if (err == null) {
    result = "Error null or undefined";
  } else {
    const error = err as Error;
    result = `Error: ${error?.name}: ${error?.message}`;
  }
  return result;
};

export function isLLM(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): llm is BaseLLM {
  const blm = llm as BaseLanguageModel;
  return (
    typeof blm?._modelType === "function" && blm?._modelType() === "base_llm"
  );
}

export function isChatModel(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): llm is BaseChatModel {
  const blm = llm as BaseLanguageModel;
  return (
    typeof blm?._modelType === "function" &&
    blm?._modelType() === "base_chat_model"
  );
}

export async function isChain(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): Promise<boolean> {
  if (isLLM(llm)) {
    return false;
  }
  const bchFactory = llm as () => Promise<BaseChain>;
  const bch = await bchFactory();
  return (
    typeof bch?._chainType === "function" && bch?._chainType() !== undefined
  );
}

type _ModelType = "llm" | "chatModel" | "chainFactory";

async function getModelOrFactoryType(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): Promise<_ModelType> {
  if (isLLM(llm)) {
    return "llm";
  }
  if (isChatModel(llm)) {
    return "chatModel";
  }
  const bchFactory = llm as () => Promise<BaseChain>;
  const bch = await bchFactory();
  if (typeof bch?._chainType === "function") {
    return "chainFactory";
  }
  throw new Error("Unknown model or factory type");
}

const runLLM = async (
  example: Example,
  tracer: LangChainTracer,
  llm: BaseLLM
): Promise<LLMResult | string> => {
  try {
    const prompt = example.inputs.prompt as string;
    return await llm.generate([prompt], undefined, [tracer]);
  } catch (e) {
    console.error(e);
    return stringifyError(e);
  }
};

const runChain = async (
  example: Example,
  tracer: LangChainTracer,
  chainFactory: () => Promise<BaseChain>
): Promise<ChainValues | string> => {
  try {
    const chain = await chainFactory();
    return await chain.call(example.inputs, [tracer]);
  } catch (e) {
    console.error(e);
    return stringifyError(e);
  }
};

const runChatModel = async (
  example: Example,
  tracer: LangChainTracer,
  chatModel: BaseChatModel
): Promise<LLMResult | string> => {
  try {
    const messages = example.inputs.messages as StoredMessage[];
    return await chatModel.generate(
      [mapStoredMessagesToChatMessages(messages)],
      undefined,
      [tracer]
    );
  } catch (e) {
    console.error(e);
    return stringifyError(e);
  }
};

export const runOnDataset = async (
  datasetName: string,
  llmOrChainFactory: BaseLanguageModel | (() => Promise<BaseChain>),
  {
    maxConcurrency = 8,
    numRepetitions = 1,
    projectName,
    client,
  }: {
    maxConcurrency?: number;
    numRepetitions?: number;
    projectName?: string;
    client?: Client;
  } = {}
): Promise<DatasetRunResults> => {
  const PQueue = "default" in PQueueMod ? PQueueMod.default : PQueueMod;
  const queue = new PQueue({ concurrency: maxConcurrency });
  const client_ = client ?? new Client({});
  const examples = await client_.listExamples({ datasetName });
  let projectName_: string;
  if (projectName === undefined) {
    const currentTime = new Date().toISOString();
    projectName_ = `${datasetName}-${
      typeof llmOrChainFactory === "function"
        ? ""
        : llmOrChainFactory.constructor.name
    }-${currentTime}`;
  } else {
    projectName_ = projectName;
  }
  await client_.createProject({ projectName: projectName_ });
  const results: DatasetRunResults = examples.reduce(
    (acc, example) => ({ ...acc, [example.id]: [] }),
    {}
  );
  const modelOrFactoryType = await getModelOrFactoryType(llmOrChainFactory);
  await Promise.all(
    Array.from({ length: numRepetitions })
      .flatMap(() => examples)
      .map(async (example) => {
        const tracer = new LangChainTracer({
          exampleId: example.id,
          projectName: projectName_,
        });
        if (modelOrFactoryType === "llm") {
          const llm = llmOrChainFactory as BaseLLM;
          const llmResult = await queue.add(
            () => runLLM(example, tracer, llm),
            { throwOnTimeout: true }
          );
          results[example.id].push(llmResult);
        } else if (modelOrFactoryType === "chainFactory") {
          const chainFactory = llmOrChainFactory as () => Promise<BaseChain>;
          const chainResult = await queue.add(
            () => runChain(example, tracer, chainFactory),
            { throwOnTimeout: true }
          );
          results[example.id].push(chainResult);
        } else if (modelOrFactoryType === "chatModel") {
          const chatModel = llmOrChainFactory as BaseChatModel;
          const chatModelResult = await queue.add(
            () => runChatModel(example, tracer, chatModel),
            { throwOnTimeout: true }
          );
          results[example.id].push(chatModelResult);
        } else {
          throw new Error(` llm or chain type: ${llmOrChainFactory}`);
        }
      })
  );
  return results;
};
