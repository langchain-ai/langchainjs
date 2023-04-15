import { LLMChain } from "../llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
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

interface qaChainParams {
  prompt?: BasePromptTemplate;
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
  questionPrompt?: BasePromptTemplate;
  refinePrompt?: BasePromptTemplate;
  type?: string;
}
export const loadQAChain = (
  llm: BaseLanguageModel,
  params: qaChainParams = {}
) => {
  const {
    prompt = DEFAULT_QA_PROMPT,
    combineMapPrompt = DEFAULT_COMBINE_QA_PROMPT,
    combinePrompt = COMBINE_PROMPT,
    type = "stuff",
  } = params;
  if (type === "stuff") {
    const llmChain = new LLMChain({ prompt, llm });
    const chain = new StuffDocumentsChain({ llmChain });
    return chain;
  }
  if (type === "map_reduce") {
    const llmChain = new LLMChain({ prompt: combineMapPrompt, llm });
    const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm });
    const combineDocumentChain = new StuffDocumentsChain({
      llmChain: combineLLMChain,
      documentVariableName: "summaries",
    });
    const chain = new MapReduceDocumentsChain({
      llmChain,
      combineDocumentChain,
    });
    return chain;
  }
  if (type === "refine") {
    const {
      questionPrompt = QUESTION_PROMPT_SELECTOR.getPrompt(llm),
      refinePrompt = REFINE_PROMPT_SELECTOR.getPrompt(llm),
    } = params;
    const llmChain = new LLMChain({ prompt: questionPrompt, llm });
    const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm });

    const chain = new RefineDocumentsChain({
      llmChain,
      refineLLMChain,
    });
    return chain;
  }
  throw new Error(`Invalid _type: ${type}`);
};

interface StuffQAChainParams {
  prompt?: BasePromptTemplate;
}

export const loadQAStuffChain = (
  llm: BaseLanguageModel,
  params: StuffQAChainParams = {}
) => {
  const { prompt = QA_PROMPT_SELECTOR.getPrompt(llm) } = params;
  const llmChain = new LLMChain({ prompt, llm });
  const chain = new StuffDocumentsChain({ llmChain });
  return chain;
};

interface MapReduceQAChainParams {
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
}

export const loadQAMapReduceChain = (
  llm: BaseLanguageModel,
  params: MapReduceQAChainParams = {}
) => {
  const {
    combineMapPrompt = COMBINE_QA_PROMPT_SELECTOR.getPrompt(llm),
    combinePrompt = COMBINE_PROMPT_SELECTOR.getPrompt(llm),
  } = params;
  const llmChain = new LLMChain({ prompt: combineMapPrompt, llm });
  const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm });
  const combineDocumentChain = new StuffDocumentsChain({
    llmChain: combineLLMChain,
    documentVariableName: "summaries",
  });
  const chain = new MapReduceDocumentsChain({
    llmChain,
    combineDocumentChain,
  });
  return chain;
};

interface RefineQAChainParams {
  questionPrompt?: BasePromptTemplate;
  refinePrompt?: BasePromptTemplate;
}

export const loadQARefineChain = (
  llm: BaseLanguageModel,
  params: RefineQAChainParams = {}
) => {
  const {
    questionPrompt = QUESTION_PROMPT_SELECTOR.getPrompt(llm),
    refinePrompt = REFINE_PROMPT_SELECTOR.getPrompt(llm),
  } = params;
  const llmChain = new LLMChain({ prompt: questionPrompt, llm });
  const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm });

  const chain = new RefineDocumentsChain({
    llmChain,
    refineLLMChain,
  });
  return chain;
};
