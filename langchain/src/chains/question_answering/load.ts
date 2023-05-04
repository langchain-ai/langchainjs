import { LLMChain } from "../llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  MapReduceDocumentsChainInput,
} from "../combine_docs_chain.js";
import { QA_PROMPT_SELECTOR, DEFAULT_QA_PROMPT } from "./stuff_prompts.js";
import {
  COMBINE_PROMPT,
  DEFAULT_COMBINE_QA_PROMPT,
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

export const loadQAChain = (
  llm: BaseLanguageModel,
  params: QAChainParams = { type: "stuff" }
) => {
  const { type, verbose } = params;
  if (type === "stuff") {
    const { prompt = DEFAULT_QA_PROMPT } = params;
    const llmChain = new LLMChain({ prompt, llm, verbose });
    const chain = new StuffDocumentsChain({ llmChain, verbose });
    return chain;
  }
  if (type === "map_reduce") {
    const {
      combineMapPrompt = DEFAULT_COMBINE_QA_PROMPT,
      combinePrompt = COMBINE_PROMPT,
      returnIntermediateSteps,
    } = params;
    const llmChain = new LLMChain({ prompt: combineMapPrompt, llm, verbose });
    const combineLLMChain = new LLMChain({
      prompt: combinePrompt,
      llm,
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
  if (type === "refine") {
    const {
      questionPrompt = QUESTION_PROMPT_SELECTOR.getPrompt(llm),
      refinePrompt = REFINE_PROMPT_SELECTOR.getPrompt(llm),
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
  throw new Error(`Invalid _type: ${type}`);
};

export interface StuffQAChainParams {
  prompt?: BasePromptTemplate;
  verbose?: boolean;
}

export const loadQAStuffChain = (
  llm: BaseLanguageModel,
  params: StuffQAChainParams = {}
) => {
  const { prompt = QA_PROMPT_SELECTOR.getPrompt(llm), verbose } = params;
  const llmChain = new LLMChain({ prompt, llm, verbose });
  const chain = new StuffDocumentsChain({ llmChain });
  return chain;
};

export interface MapReduceQAChainParams {
  returnIntermediateSteps?: MapReduceDocumentsChainInput["returnIntermediateSteps"];
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
  verbose?: boolean;
}

export const loadQAMapReduceChain = (
  llm: BaseLanguageModel,
  params: MapReduceQAChainParams = {}
) => {
  const {
    combineMapPrompt = COMBINE_QA_PROMPT_SELECTOR.getPrompt(llm),
    combinePrompt = COMBINE_PROMPT_SELECTOR.getPrompt(llm),
    verbose,
    returnIntermediateSteps,
  } = params;
  const llmChain = new LLMChain({ prompt: combineMapPrompt, llm, verbose });
  const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm, verbose });
  const combineDocumentChain = new StuffDocumentsChain({
    llmChain: combineLLMChain,
    documentVariableName: "summaries",
  });
  const chain = new MapReduceDocumentsChain({
    llmChain,
    combineDocumentChain,
    returnIntermediateSteps,
  });
  return chain;
};

export interface RefineQAChainParams {
  questionPrompt?: BasePromptTemplate;
  refinePrompt?: BasePromptTemplate;
  verbose?: boolean;
}

export const loadQARefineChain = (
  llm: BaseLanguageModel,
  params: RefineQAChainParams = {}
) => {
  const {
    questionPrompt = QUESTION_PROMPT_SELECTOR.getPrompt(llm),
    refinePrompt = REFINE_PROMPT_SELECTOR.getPrompt(llm),
    verbose,
  } = params;
  const llmChain = new LLMChain({ prompt: questionPrompt, llm, verbose });
  const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm, verbose });

  const chain = new RefineDocumentsChain({
    llmChain,
    refineLLMChain,
  });
  return chain;
};
