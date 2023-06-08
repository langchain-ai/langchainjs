import { Example, LangChainPlusClient } from "langchainplus-sdk";

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
  llm: BaseLLM,
  { numRepetitions = 1 }: { numRepetitions?: number }
): Promise<(LLMResult | string)[]> => {
  const results: (LLMResult | string)[] = await Promise.all(
    Array.from({ length: numRepetitions }).map(async () => {
      try {
        const prompt = example.inputs.prompt as string;
        return llm.generate([prompt], undefined, [tracer]);
      } catch (e) {
        console.error(e);
        return stringifyError(e);
      }
    })
  );
  return results;
};

const runChain = async (
  example: Example,
  tracer: LangChainTracer,
  chainFactory: () => Promise<BaseChain>,
  {
    numRepetitions = 1,
  }: {
    numRepetitions?: number;
  }
): Promise<(ChainValues | string)[]> => {
  const results: (ChainValues | string)[] = await Promise.all(
    Array.from({ length: numRepetitions }).map(async () => {
      try {
        const chain = await chainFactory();
        return chain.call(example.inputs, [tracer]);
      } catch (e) {
        console.error(e);
        return stringifyError(e);
      }
    })
  );
  return results;
};

const runChatModel = async (
  example: Example,
  tracer: LangChainTracer,
  chatModel: BaseChatModel,
  {
    numRepetitions = 1,
  }: {
    numRepetitions?: number;
  }
): Promise<(LLMResult | string)[]> => {
  const results: (LLMResult | string)[] = await Promise.all(
    Array.from({ length: numRepetitions }).map(async () => {
      try {
        const messages = example.inputs.messages as StoredMessage[];
        return chatModel.generate(
          [mapStoredMessagesToChatMessages(messages)],
          undefined,
          [tracer]
        );
      } catch (e) {
        console.error(e);
        return stringifyError(e);
      }
    })
  );
  return results;
};

export const runOnDataset = async (
  datasetName: string,
  llmOrChainFactory: BaseLanguageModel | (() => Promise<BaseChain>),
  {
    numRepetitions = 1,
    sessionName,
    client,
  }: {
    numRepetitions?: number;
    sessionName?: string;
    client?: LangChainPlusClient;
  } = {}
): Promise<DatasetRunResults> => {
  const client_ = client ?? new LangChainPlusClient({});
  const examples = await client_.listExamples({ datasetName });
  let sessionName_: string;
  if (sessionName === undefined) {
    const currentTime = new Date().toISOString();
    sessionName_ = `${datasetName}-${llmOrChainFactory.constructor.name}-${currentTime}`;
  } else {
    sessionName_ = sessionName;
  }
  const results: DatasetRunResults = {};
  const modelOrFactoryType = await getModelOrFactoryType(llmOrChainFactory);
  await Promise.all(
    examples.map(async (example) => {
      const tracer = new LangChainTracer({
        exampleId: example.id,
        sessionName: sessionName_,
      });
      if (modelOrFactoryType === "llm") {
        const llm = llmOrChainFactory as BaseLLM;
        const llmResult = await runLLM(example, tracer, llm, {
          numRepetitions,
        });
        results[example.id] = llmResult;
      } else if (modelOrFactoryType === "chainFactory") {
        const chainFactory = llmOrChainFactory as () => Promise<BaseChain>;
        const chainResult = await runChain(example, tracer, chainFactory, {
          numRepetitions,
        });
        results[example.id] = chainResult;
      } else if (modelOrFactoryType === "chatModel") {
        const chatModel = llmOrChainFactory as BaseChatModel;
        const chatModelResult = await runChatModel(example, tracer, chatModel, {
          numRepetitions,
        });
        results[example.id] = chatModelResult;
      } else {
        throw new Error(` llm or chain type: ${llmOrChainFactory}`);
      }
    })
  );
  return results;
};
