import { LLMChain } from "../llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  MapReduceDocumentsChainInput,
} from "../combine_docs_chain.js";
import { QA_PROMPT_SELECTOR } from "./stuff_prompts.js";
import {
  COMBINE_PROMPT_SELECTOR,
  COMBINE_QA_PROMPT_SELECTOR,
} from "./map_reduce_prompts.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import {
  QUESTION_PROMPT_SELECTOR,
  REFINE_PROMPT_SELECTOR,
} from "./refine_prompts.js";

export type QAChainParams =
  | ({
      type?: "stuff";
    } & StuffQAChainParams)
  | ({
      type?: "map_reduce";
    } & MapReduceQAChainParams)
  | ({
      type?: "refine";
    } & RefineQAChainParams);

export const initializeQAChain = async (
  llm: BaseLanguageModel,
  params: QAChainParams = { type: "stuff" }
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

export interface StuffQAChainParams {
  prompt?: BasePromptTemplate;
  verbose?: boolean;
}

export async function initializeQAStuffChain(
  llm: BaseLanguageModel,
  params: StuffQAChainParams = {}
) {
  const { prompt = await QA_PROMPT_SELECTOR.getPromptAsync(llm), verbose } =
    params;
  const llmChain = new LLMChain({ prompt, llm, verbose });
  const chain = new StuffDocumentsChain({ llmChain, verbose });
  return chain;
}

export interface MapReduceQAChainParams {
  returnIntermediateSteps?: MapReduceDocumentsChainInput["returnIntermediateSteps"];
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
  verbose?: boolean;
}

export async function initializeQAMapReduceChain(
  llm: BaseLanguageModel,
  params: MapReduceQAChainParams = {}
) {
  const {
    combineMapPrompt = await COMBINE_QA_PROMPT_SELECTOR.getPromptAsync(llm),
    combinePrompt = await COMBINE_PROMPT_SELECTOR.getPromptAsync(llm),
    verbose,
    returnIntermediateSteps,
  } = params;
  const llmChain = new LLMChain({ prompt: combineMapPrompt, llm, verbose });
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

export interface RefineQAChainParams {
  questionPrompt?: BasePromptTemplate;
  refinePrompt?: BasePromptTemplate;
  verbose?: boolean;
}

export async function initializeQARefineChain(
  llm: BaseLanguageModel,
  params: RefineQAChainParams = {}
) {
  const {
    questionPrompt = await QUESTION_PROMPT_SELECTOR.getPromptAsync(llm),
    refinePrompt = await REFINE_PROMPT_SELECTOR.getPromptAsync(llm),
    verbose,
  } = params;
  const llmChain = new LLMChain({ prompt: questionPrompt, llm, verbose });
  const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm, verbose });

  const chain = new RefineDocumentsChain({
    llmChain,
    refineLLMChain,
    verbose,
  });
  return chain;
}
