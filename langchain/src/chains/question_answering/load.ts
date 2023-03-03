import { BaseLLM } from "../../llms/index.js";
import { ChatModelChain, LLMChain } from "../llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import {
  MapReduceDocumentsChain,
  StuffDocumentsChain,
} from "../combine_docs_chain.js";
import { DEFAULT_CHAT_QA_PROMPT, DEFAULT_QA_PROMPT } from "./stuff_prompts.js";
import {
  COMBINE_PROMPT,
  DEFAULT_COMBINE_QA_PROMPT,
} from "./map_reduce_prompts.js";
import { BaseChatModel } from "../../chat_models/base.js";

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

export const loadQAChainFromChatModel = (llm: BaseChatModel) => {
  const chatModelChain = new ChatModelChain({
    prompt: DEFAULT_CHAT_QA_PROMPT,
    llm,
  });
  return new StuffDocumentsChain({ llmChain: chatModelChain });
};
