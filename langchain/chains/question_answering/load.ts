import { BaseLLM } from "../../llms";
import { LLMChain } from "../llm_chain";
import { PromptTemplate } from "../../prompts";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
} from "../combine_docs_chain";
import { DEFAULT_QA_PROMPT } from "./stuff_prompts";
import {
  COMBINE_PROMPT,
  DEFAULT_COMBINE_QA_PROMPT,
} from "./map_reduce_prompts";

interface qaChainParams {
  prompt?: PromptTemplate;
  combineMapPrompt?: PromptTemplate;
  combinePrompt?: PromptTemplate;
  type?: string;
}
export const loadQAChain = (llm: BaseLLM, params: qaChainParams = {}) => {
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
  throw new Error(`Invalid _type: ${type}`);
};
