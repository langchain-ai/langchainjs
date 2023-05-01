import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
} from "../combine_docs_chain.js";
import { DEFAULT_PROMPT } from "./stuff_prompts.js";
import { REFINE_PROMPT } from "./refine_prompts.js";

interface summarizationChainParams {
  prompt?: BasePromptTemplate;
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
  refinePrompt?: BasePromptTemplate;
  questionPrompt?: BasePromptTemplate;
  type?: "map_reduce" | "stuff" | "refine";
}
export const loadSummarizationChain = (
  llm: BaseLanguageModel,
  params: summarizationChainParams = {}
) => {
  const {
    prompt = DEFAULT_PROMPT,
    combineMapPrompt = DEFAULT_PROMPT,
    combinePrompt = DEFAULT_PROMPT,
    refinePrompt = REFINE_PROMPT,
    questionPrompt = DEFAULT_PROMPT,
    type = "map_reduce",
  } = params;
  if (type === "stuff") {
    const llmChain = new LLMChain({ prompt, llm });
    const chain = new StuffDocumentsChain({
      llmChain,
      documentVariableName: "text",
    });
    return chain;
  }
  if (type === "map_reduce") {
    const llmChain = new LLMChain({ prompt: combineMapPrompt, llm });
    const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm });
    const combineDocumentChain = new StuffDocumentsChain({
      llmChain: combineLLMChain,
      documentVariableName: "text",
    });
    const chain = new MapReduceDocumentsChain({
      llmChain,
      combineDocumentChain,
      documentVariableName: "text",
    });
    return chain;
  }
  if (type === "refine") {
    const llmChain = new LLMChain({ prompt: questionPrompt, llm });
    const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm });
    const chain = new RefineDocumentsChain({
      llmChain,
      refineLLMChain,
      documentVariableName: "text",
    });
    return chain;
  }
  throw new Error(`Invalid _type: ${type}`);
};
