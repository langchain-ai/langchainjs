import { LLMChain } from "../llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  MapReduceDocumentsChainInput,
} from "../combine_docs_chain.js";
import { QA_PROMPT_SELECTOR } from "./initialize_stuff_prompts.js";
import {
  COMBINE_PROMPT_SELECTOR,
  COMBINE_QA_PROMPT_SELECTOR,
} from "./initialize_map_reduce_prompts.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import {
  QUESTION_PROMPT_SELECTOR,
  REFINE_PROMPT_SELECTOR,
} from "./initialize_refine_prompts.js";

export type InitializeQAChainParams =
  | ({
      type?: "stuff";
    } & InitializeStuffQAChainParams)
  | ({
      type?: "map_reduce";
    } & InitializeMapReduceQAChainParams)
  | ({
      type?: "refine";
    } & InitializeRefineQAChainParams);

export const initializeQAChain = async (
  llm: BaseLanguageModel,
  params: InitializeQAChainParams = { type: "stuff" }
) => {
  const { type } = params;
  if (type === "stuff") {
    return initializeQAStuffChain(llm, params);
  }
  if (type === "map_reduce") {
    return initializeQAMapReduceChain(llm, params);
  }
  if (type === "refine") {
    return initializeQARefineChain(llm, params);
  }
  throw new Error(`Invalid _type: ${type}`);
};

export interface InitializeStuffQAChainParams {
  prefix?: string;
  prompt?: BasePromptTemplate;
  verbose?: boolean;
}

export async function initializeQAStuffChain(
  llm: BaseLanguageModel,
  params: InitializeStuffQAChainParams = {}
) {
  const {
    prompt = await QA_PROMPT_SELECTOR.getPromptAsync(llm, {
      partialVariables: { prefix: params.prefix ?? "" },
    }),
    verbose,
  } = params;
  const llmChain = new LLMChain({ prompt, llm, verbose });
  const chain = new StuffDocumentsChain({ llmChain, verbose });
  return chain;
}

export interface InitializeMapReduceQAChainParams {
  returnIntermediateSteps?: MapReduceDocumentsChainInput["returnIntermediateSteps"];
  mapChainOptions?: {
    prefix?: string;
    prompt?: BasePromptTemplate;
  };
  combineChainOptions?: {
    prefix?: string;
    prompt?: BasePromptTemplate;
  };
  verbose?: boolean;
}

export async function initializeQAMapReduceChain(
  llm: BaseLanguageModel,
  params: InitializeMapReduceQAChainParams = {}
) {
  const {
    mapChainOptions,
    combineChainOptions,
    verbose,
    returnIntermediateSteps,
  } = params;
  const mapPrompt =
    mapChainOptions?.prompt ??
    (await COMBINE_QA_PROMPT_SELECTOR.getPromptAsync(llm, {
      partialVariables: { prefix: mapChainOptions?.prefix ?? "" },
    }));
  const combinePrompt =
    combineChainOptions?.prompt ??
    (await COMBINE_PROMPT_SELECTOR.getPromptAsync(llm, {
      partialVariables: { prefix: combineChainOptions?.prefix ?? "" },
    }));
  const llmChain = new LLMChain({ prompt: mapPrompt, llm, verbose });
  const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm, verbose });
  const combineDocumentChain = new StuffDocumentsChain({
    llmChain: combineLLMChain,
    documentVariableName: "summaries",
    verbose,
  });
  const chain = new MapReduceDocumentsChain({
    llmChain,
    combineDocumentChain,
    returnIntermediateSteps,
    verbose,
  });
  return chain;
}

export interface InitializeRefineQAChainParams {
  questionChainOptions?: {
    prefix?: string;
    prompt?: BasePromptTemplate;
  };
  refineChainOptions?: {
    prefix?: string;
    prompt?: BasePromptTemplate;
  };
  verbose?: boolean;
}

export async function initializeQARefineChain(
  llm: BaseLanguageModel,
  params: InitializeRefineQAChainParams = {}
) {
  const { questionChainOptions, refineChainOptions, verbose } = params;
  const questionPrompt =
    questionChainOptions?.prompt ??
    (await QUESTION_PROMPT_SELECTOR.getPromptAsync(llm, {
      partialVariables: { prefix: questionChainOptions?.prefix ?? "" },
    }));
  const refinePrompt =
    refineChainOptions?.prompt ??
    (await REFINE_PROMPT_SELECTOR.getPromptAsync(llm, {
      partialVariables: { prefix: refineChainOptions?.prefix ?? "" },
    }));
  const llmChain = new LLMChain({ prompt: questionPrompt, llm, verbose });
  const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm, verbose });

  const chain = new RefineDocumentsChain({
    llmChain,
    refineLLMChain,
    verbose,
  });
  return chain;
}
