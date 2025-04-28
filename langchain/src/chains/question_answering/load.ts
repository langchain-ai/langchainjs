import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { BasePromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "../llm_chain.js";
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
import {
  QUESTION_PROMPT_SELECTOR,
  REFINE_PROMPT_SELECTOR,
} from "./refine_prompts.js";

/**
 * Represents the parameters for creating a QAChain. It can be of three
 * types: "stuff", "map_reduce", or "refine".
 */
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

export const loadQAChain = (
  llm: BaseLanguageModelInterface,
  params: QAChainParams = { type: "stuff" }
) => {
  const { type } = params;
  if (type === "stuff") {
    return loadQAStuffChain(llm, params);
  }
  if (type === "map_reduce") {
    return loadQAMapReduceChain(llm, params);
  }
  if (type === "refine") {
    return loadQARefineChain(llm, params);
  }
  throw new Error(`Invalid _type: ${type}`);
};

/**
 * Represents the parameters for creating a StuffQAChain.
 */
export interface StuffQAChainParams {
  prompt?: BasePromptTemplate;
  verbose?: boolean;
}

/**
 * Loads a StuffQAChain based on the provided parameters. It takes an LLM
 * instance and StuffQAChainParams as parameters.
 * @param llm An instance of BaseLanguageModel.
 * @param params Parameters for creating a StuffQAChain.
 * @returns A StuffQAChain instance.
 */
export function loadQAStuffChain(
  llm: BaseLanguageModelInterface,
  params: StuffQAChainParams = {}
) {
  const { prompt = QA_PROMPT_SELECTOR.getPrompt(llm), verbose } = params;
  const llmChain = new LLMChain({ prompt, llm, verbose });
  const chain = new StuffDocumentsChain({ llmChain, verbose });
  return chain;
}

/**
 * Represents the parameters for creating a MapReduceQAChain.
 */
export interface MapReduceQAChainParams {
  returnIntermediateSteps?: MapReduceDocumentsChainInput["returnIntermediateSteps"];
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
  combineLLM?: BaseLanguageModelInterface;
  verbose?: boolean;
}

/**
 * Loads a MapReduceQAChain based on the provided parameters. It takes an
 * LLM instance and MapReduceQAChainParams as parameters.
 * @param llm An instance of BaseLanguageModel.
 * @param params Parameters for creating a MapReduceQAChain.
 * @returns A MapReduceQAChain instance.
 */
export function loadQAMapReduceChain(
  llm: BaseLanguageModelInterface,
  params: MapReduceQAChainParams = {}
) {
  const {
    combineMapPrompt = COMBINE_QA_PROMPT_SELECTOR.getPrompt(llm),
    combinePrompt = COMBINE_PROMPT_SELECTOR.getPrompt(llm),
    verbose,
    combineLLM,
    returnIntermediateSteps,
  } = params;
  const llmChain = new LLMChain({ prompt: combineMapPrompt, llm, verbose });
  const combineLLMChain = new LLMChain({
    prompt: combinePrompt,
    llm: combineLLM ?? llm,
    verbose,
  });
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

/**
 * Represents the parameters for creating a RefineQAChain.
 */
export interface RefineQAChainParams {
  questionPrompt?: BasePromptTemplate;
  refinePrompt?: BasePromptTemplate;
  refineLLM?: BaseLanguageModelInterface;
  verbose?: boolean;
}

/**
 * Loads a RefineQAChain based on the provided parameters. It takes an LLM
 * instance and RefineQAChainParams as parameters.
 * @param llm An instance of BaseLanguageModel.
 * @param params Parameters for creating a RefineQAChain.
 * @returns A RefineQAChain instance.
 */
export function loadQARefineChain(
  llm: BaseLanguageModelInterface,
  params: RefineQAChainParams = {}
) {
  const {
    questionPrompt = QUESTION_PROMPT_SELECTOR.getPrompt(llm),
    refinePrompt = REFINE_PROMPT_SELECTOR.getPrompt(llm),
    refineLLM,
    verbose,
  } = params;
  const llmChain = new LLMChain({ prompt: questionPrompt, llm, verbose });
  const refineLLMChain = new LLMChain({
    prompt: refinePrompt,
    llm: refineLLM ?? llm,
    verbose,
  });

  const chain = new RefineDocumentsChain({
    llmChain,
    refineLLMChain,
    verbose,
  });
  return chain;
}
